
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
        "Connecting to Gemini AI...",
        "Scanning Google Maps...",
        "Extracting contact numbers...",
        "Checking business ratings...",
        "Verifying locations...",
        "Preparing final report..."
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
    } catch (error: any) {
      console.error(error);
      const msg = error.message?.includes("API_KEY_MISSING") 
        ? "Error: API_KEY not found. Please add it to your Vercel Environment Variables." 
        : "Search failed due to a timeout or API error. Please try again with a smaller radius or fewer categories.";
      alert(msg);
      setLoading(false);
    }
  }, [userCoords]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      alert("Please select at least one category.");
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
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:max-w-6xl">
            <div className="relative flex-[1.5]">
              <i className="fa-solid fa-location-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="text" value={city} list="india-cities" onChange={(e) => setCity(e.target.value)} placeholder="Enter city name..." className="w-full pl-10 pr-4 py-2.5 border border-slate-700 bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" required />
            </div>
            
            <div className="relative flex-[1.5]" ref={dropdownRef}>
              <div 
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full py-2.5 px-4 border border-slate-700 bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer flex items-center justify-between min-h-[44px]"
              >
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                  {selectedCategories.length === 0 ? (
                    <span className="text-slate-400 text-sm">Select categories...</span>
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
                      placeholder="Search categories..." 
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

            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Radius</span>
                <span className="text-[10px] font-black text-indigo-400">{radius}km</span>
              </div>
              <div className="relative flex items-center h-full">
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  value={radius} 
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
              {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              {loading ? 'Scanning...' : 'Find 100 Leads'}
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 text-center border border-slate-800 shadow-2xl flex flex-col items-center gap-10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]"></div>
            
            <div className="relative z-10 space-y-4">
              <h3 className="text-4xl font-black text-white tracking-tight">Searching...</h3>
              <p className="text-slate-500 max-w-md mx-auto text-lg font-medium">{tickerMessage}</p>
            </div>

            <div className="w-full max-w-xl relative z-10">
              <div className="flex justify-between items-end mb-4">
                <div className="text-left">
                  <span className="text-4xl font-black text-indigo-400">{Math.round(progress)}%</span>
                  <span className="text-slate-400 ml-2 font-bold uppercase text-xs tracking-widest">Completed</span>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-200">{simulatedLeads}</span>
                  <span className="text-slate-400 ml-2 font-bold uppercase text-xs tracking-widest">Found</span>
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
                    <i className="fa-solid fa-history text-indigo-500"></i> History
                  </h3>
                </div>
                <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="py-12 text-center opacity-40 text-xs">No recent activity</div>
                  ) : (
                    history.map(h => (
                      <div key={h.id} onClick={() => { setCity(h.query.city); setSelectedCategories(h.query.categories); setRadius(h.query.radius); performSearch(h.query.city, h.query.categories, h.query.radius); }} className="group p-4 rounded-xl border border-slate-800 hover:border-indigo-500 hover:bg-indigo-900/10 transition-all cursor-pointer">
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
                  <h2 className="text-3xl font-black text-white">Leads Dashboard</h2>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button onClick={() => exportToCSV(leads)} disabled={leads.length === 0} className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-800 text-white border border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all disabled:opacity-50">
                    <i className="fa-solid fa-file-csv mr-2"></i> CSV
                  </button>
                  <button onClick={() => exportToPDF(leads, selectedCategories)} disabled={leads.length === 0} className="flex-1 sm:flex-none px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all disabled:opacity-50">
                    <i className="fa-solid fa-file-pdf mr-2"></i> PDF Report
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
        
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: #6366f1;
          cursor: pointer;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 0 5px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
};

export default App;
