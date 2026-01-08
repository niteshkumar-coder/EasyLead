
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BusinessLead, SearchQuery, SearchHistory } from './types';
import { BUSINESS_CATEGORIES, STORAGE_KEYS, INDIA_CITIES } from './constants';
import { findBusinessLeads, calculateDistance } from './services/businessService';
import { exportToCSV, exportToPDF, copyToClipboard } from './services/exportService';
import LeadTable from './components/LeadTable';

const App: React.FC = () => {
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDeployGuide, setShowDeployGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [simulatedLeads, setSimulatedLeads] = useState(0);
  const [tickerMessage, setTickerMessage] = useState('Initializing search...');
  
  const tickerIntervalRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.warn("Location access denied", err),
        { enableHighAccuracy: true }
      );
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      setSimulatedLeads(0);
      const messages = [
        "Gemini AI से जुड़ रहे हैं...",
        "Google Maps स्कैन कर रहे हैं...",
        "संपर्क नंबर निकाले जा रहे हैं...",
        "बिजनेस रेटिंग चेक कर रहे हैं...",
        "लोकेशन वेरिफाई हो रही है...",
        "रिपोर्ट तैयार की जा रही है..."
      ];
      tickerIntervalRef.current = window.setInterval(() => {
        setTickerMessage(messages[Math.floor(Math.random() * messages.length)]);
      }, 1500);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) return prev; 
          const step = prev < 60 ? 1.2 : 0.3; 
          return prev + step;
        });
        setSimulatedLeads(prev => {
          if (prev >= 100) return prev;
          return Math.random() > 0.6 ? prev + 2 : prev;
        });
      }, 80);
    } else {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [loading]);

  const performSearch = useCallback(async (searchCity: string, searchCategories: string[], searchRadius: number) => {
    if (!searchCity || searchCategories.length === 0) return;
    setLoading(true);
    setLeads([]); 
    try {
      const results = await findBusinessLeads({ city: searchCity, categories: searchCategories, radius: searchRadius }, userCoords || undefined);
      const processed = results.map(lead => {
        if (userCoords && lead.lat && lead.lng) {
          return { ...lead, distance: calculateDistance(userCoords.lat, userCoords.lng, lead.lat, lead.lng) };
        }
        return lead;
      });
      setProgress(100);
      setSimulatedLeads(processed.length);
      setTimeout(() => {
        setLeads(processed);
        setLoading(false);
      }, 500);
      if (processed.length > 0) {
        const newHistoryItem: SearchHistory = {
          id: Date.now().toString(),
          query: { city: searchCity, categories: searchCategories, radius: searchRadius },
          timestamp: new Date().toLocaleString(),
          resultCount: processed.length
        };
        setHistory(prev => {
          const filtered = prev.filter(h => !(h.query.city === searchCity && JSON.stringify(h.query.categories) === JSON.stringify(searchCategories)));
          const updated = [newHistoryItem, ...filtered.slice(0, 14)];
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error(error);
      alert("सर्च फेल हो गया। कृपया दोबारा कोशिश करें।");
      setLoading(false);
    }
  }, [userCoords]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      alert("कृपया कम से कम एक कैटेगरी चुनें।");
      return;
    }
    performSearch(city, selectedCategories, radius);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredCategories = BUSINESS_CATEGORIES.filter(cat => 
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 transition-colors duration-300">
      <datalist id="india-cities">
        {INDIA_CITIES.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* Deployment Guide Modal (Hindi) */}
      {showDeployGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="sticky top-0 bg-slate-900 p-6 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <i className="fa-brands fa-github text-3xl text-indigo-400"></i>
                <h2 className="text-xl font-bold">GitHub & Vercel पर लाइव करें</h2>
              </div>
              <button onClick={() => setShowDeployGuide(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Step 0: Get API KEY */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm">0</span>
                  <h3 className="text-lg font-bold text-emerald-400">Gemini API Key लें</h3>
                </div>
                <div className="pl-11 space-y-3">
                  <p className="text-slate-400 text-sm">अगर आपके पास API Key नहीं है, तो अभी यहां से लें (यह फ्री है):</p>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50 rounded-lg text-sm font-bold transition-all">
                    <i className="fa-solid fa-key"></i>
                    Get Free API Key
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                  </a>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">1</span>
                  <h3 className="text-lg font-bold">GitHub पर Repository बनाएं</h3>
                </div>
                <p className="text-slate-400 pl-11 text-sm">GitHub पर जाएं और <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">easylead</span> नाम से नई Repo बनाएं।</p>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">2</span>
                  <h3 className="text-lg font-bold">ये कमांड्स चलाएं</h3>
                </div>
                <p className="text-slate-400 pl-11 text-sm">अपने कंप्यूटर के फोल्डर में Terminal खोलें और ये कोड कॉपी करके पेस्ट करें:</p>
                <div className="pl-11">
                  <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-indigo-300 border border-slate-800 relative group">
                    <pre><code>{`git init
git add .
git commit -m "site live"
git branch -M main
git remote add origin https://github.com/YOUR_USER/easylead.git
git push -u origin main`}</code></pre>
                    <button onClick={() => {
                        navigator.clipboard.writeText('git init\ngit add .\ngit commit -m "site live"\ngit branch -M main\ngit remote add origin https://github.com/YOUR_USER/easylead.git\ngit push -u origin main');
                        alert("कोड कॉपी हो गया!");
                    }} className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-all">
                      <i className="fa-solid fa-copy"></i>
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-rose-400 font-bold flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    अगर "vite: command not found" आए, तो मेरे द्वारा दिए गए नए package.json को अपडेट करें।
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">3</span>
                  <h3 className="text-lg font-bold">Vercel पर कनेक्ट करें</h3>
                </div>
                <ul className="text-slate-400 pl-11 text-sm space-y-2 list-disc">
                  <li>Vercel.com पर जाएं और GitHub वाली Repo को Import करें।</li>
                  <li><b>Environment Variables</b> में जाकर <b>API_KEY</b> और अपनी की (Key) डालना न भूलें।</li>
                  <li>Deploy बटन दबाएं और आपकी साइट लाइव हो जाएगी!</li>
                </ul>
              </section>

              <button onClick={() => setShowDeployGuide(false)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-xl">
                ठीक है, मैं समझ गया!
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 md:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg">
                <i className="fa-solid fa-bolt text-white text-xl"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">EasyLead</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">High Speed Lead Gen</p>
              </div>
            </div>
            <div className="flex items-center gap-3 lg:hidden">
              <button onClick={() => setShowDeployGuide(true)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 border border-slate-700">
                <i className="fa-brands fa-github"></i>
              </button>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:max-w-5xl">
            <div className="relative flex-1">
              <i className="fa-solid fa-location-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="text" value={city} list="india-cities" onChange={(e) => setCity(e.target.value)} placeholder="शहर का नाम लिखें..." className="w-full pl-10 pr-4 py-2.5 border border-slate-700 bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" required />
            </div>
            
            <div className="relative flex-1" ref={dropdownRef}>
              <div 
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full py-2.5 px-4 border border-slate-700 bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer flex items-center justify-between min-h-[44px]"
              >
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                  {selectedCategories.length === 0 ? (
                    <span className="text-slate-400 text-sm">कैटेगरी चुनें...</span>
                  ) : (
                    selectedCategories.slice(0, 1).map(cat => (
                      <span key={cat} className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-lg text-xs font-bold whitespace-nowrap">
                        {cat}
                      </span>
                    ))
                  )}
                  {selectedCategories.length > 1 && (
                    <span className="text-indigo-400 text-xs font-bold">+{selectedCategories.length - 1}</span>
                  )}
                </div>
                <i className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}></i>
              </div>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in duration-200">
                  <div className="relative mb-2">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input 
                      type="text" 
                      autoFocus
                      placeholder="सर्च करें..." 
                      className="w-full pl-9 pr-4 py-2 bg-slate-800 border-none rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredCategories.map(cat => (
                      <label key={cat} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                        <input 
                          type="checkbox" 
                          checked={selectedCategories.includes(cat)}
                          onChange={() => toggleCategory(cat)}
                          className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-slate-700"
                        />
                        <span className={`text-sm ${selectedCategories.includes(cat) ? 'font-bold text-indigo-400' : 'text-slate-300'}`}>
                          {cat}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
              {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              {loading ? 'स्कैन हो रहा है...' : '100 लीड्स खोजें'}
            </button>
          </form>

          <div className="hidden lg:flex items-center gap-2">
            <button 
              onClick={() => setShowDeployGuide(true)} 
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-bold transition-all"
            >
              <i className="fa-brands fa-github text-lg"></i>
              Live Host करें
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 text-center border border-slate-800 shadow-2xl flex flex-col items-center gap-10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]"></div>
            
            <div className="relative z-10 space-y-4">
              <h3 className="text-4xl font-black text-white tracking-tight">खोज जारी है...</h3>
              <p className="text-slate-500 max-w-md mx-auto text-lg font-medium">{tickerMessage}</p>
            </div>

            <div className="w-full max-w-xl relative z-10">
              <div className="flex justify-between items-end mb-4">
                <div className="text-left">
                  <span className="text-4xl font-black text-indigo-400">{Math.round(progress)}%</span>
                  <span className="text-slate-400 ml-2 font-bold uppercase text-xs tracking-widest">पूरा हुआ</span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-200">{simulatedLeads}</span>
                  <span className="text-slate-400 ml-2 font-bold uppercase text-xs tracking-widest">मिले</span>
                </div>
              </div>

              <div className="h-6 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-1">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[loading_1s_linear_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            <aside className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <i className="fa-solid fa-history text-indigo-500"></i> हिस्ट्री
                  </h3>
                </div>
                <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="py-12 text-center opacity-40 text-xs">कोई हालिया गतिविधि नहीं</div>
                  ) : (
                    history.map(h => (
                      <div key={h.id} onClick={() => { setCity(h.query.city); setSelectedCategories(h.query.categories); performSearch(h.query.city, h.query.categories, h.query.radius); }} className="group p-4 rounded-xl border border-slate-800 hover:border-indigo-500 hover:bg-indigo-900/10 transition-all cursor-pointer">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm truncate">{h.query.city}</span>
                          <span className="text-[10px] bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full font-bold">{h.resultCount}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{h.timestamp}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>

            <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                <div>
                  <h2 className="text-3xl font-black text-white">लीड्स डैशबोर्ड</h2>
                  <p className="text-slate-500 font-medium">Gemini AI द्वारा वेरिफाइड डेटा</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button onClick={() => exportToCSV(leads)} disabled={leads.length === 0} className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-800 text-white border border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all disabled:opacity-50">
                    <i className="fa-solid fa-file-csv mr-2"></i> CSV
                  </button>
                  <button onClick={() => exportToPDF(leads, selectedCategories)} disabled={leads.length === 0} className="flex-1 sm:flex-none px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all disabled:opacity-50">
                    <i className="fa-solid fa-file-pdf mr-2"></i> PDF रिपोर्ट
                  </button>
                </div>
              </div>
              <LeadTable leads={leads} />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-10 px-6 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-slate-400">
          <div className="flex items-center gap-6">
            <p>© 2024 EasyLead India</p>
            <span className="w-1 h-1 rounded-full bg-slate-300/20"></span>
            <p>Engine: Gemini 3 Flash</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowDeployGuide(true)} className="hover:text-white transition-colors flex items-center gap-2">
              <i className="fa-brands fa-github"></i>
              होस्टिंग गाइड
            </button>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
