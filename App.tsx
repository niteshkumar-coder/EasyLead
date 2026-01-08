
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BusinessLead, SearchQuery, SearchHistory, User } from './types';
import { BUSINESS_CATEGORIES, STORAGE_KEYS, INDIA_CITIES } from './constants';
import { findBusinessLeads, calculateDistance } from './services/businessService';
import { exportToCSV, exportToPDF, copyToClipboard } from './services/exportService';
import LeadTable from './components/LeadTable';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '' });
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    // Load User
    const savedUser = localStorage.getItem('easylead_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }

    // Load History
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
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
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
      const messages = ["Connecting to AI...", "Scanning Maps...", "Extracting contacts...", "Verifying...", "Preparing report..."];
      tickerIntervalRef.current = window.setInterval(() => {
        setTickerMessage(messages[Math.floor(Math.random() * messages.length)]);
      }, 1500);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => (prev >= 98 ? prev : prev + (prev < 60 ? 1.5 : 0.4)));
        setSimulatedLeads(prev => (prev >= 100 ? prev : Math.random() > 0.7 ? prev + 3 : prev));
      }, 70);
    } else {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [loading]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.name || !authForm.email) return;
    const newUser = { name: authForm.name, email: authForm.email };
    setUser(newUser);
    localStorage.setItem('easylead_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('easylead_user');
  };

  const performSearch = useCallback(async (searchCity: string, searchCategories: string[], searchRadius: number) => {
    if (!searchCity || searchCategories.length === 0) return;
    setLoading(true);
    setError(null);
    setLeads([]); 
    try {
      const results = await findBusinessLeads({ city: searchCity, categories: searchCategories, radius: searchRadius }, userCoords || undefined);
      const processed = (results || []).map(lead => {
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
        if (processed.length === 0) {
          setError("No results found. Please try again with a broader search.");
        }
      }, 500);

      if (processed.length > 0) {
        const newHistoryItem: SearchHistory = {
          id: Date.now().toString(),
          query: { city: searchCity, categories: searchCategories, radius: searchRadius },
          timestamp: new Date().toLocaleString(),
          resultCount: processed.length
        };
        setHistory(prev => {
          const filtered = prev.filter(h => h.query.city !== searchCity || JSON.stringify(h.query.categories) !== JSON.stringify(searchCategories));
          const updated = [newHistoryItem, ...filtered.slice(0, 14)];
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [userCoords]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) return alert("Select at least one category.");
    performSearch(city, selectedCategories, radius);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const filteredCategories = BUSINESS_CATEGORIES.filter(cat => cat.toLowerCase().includes(categorySearch.toLowerCase()));

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-violet-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl z-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center bg-indigo-600 p-3 rounded-2xl shadow-lg mb-6">
              <i className="fa-solid fa-bolt text-white text-2xl"></i>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Welcome to EasyLead</h1>
            <p className="text-slate-400 font-medium">Please enter your details to access the dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
              <div className="relative">
                <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="text" 
                  required 
                  value={authForm.name} 
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  placeholder="John Doe" 
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Gmail Address</label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="email" 
                  required 
                  value={authForm.email} 
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="john@gmail.com" 
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-xl hover:shadow-indigo-500/20 active:scale-[0.98]"
            >
              Access Dashboard
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Privacy Guaranteed &bull; Secure Access
          </p>
        </div>

        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
        `}</style>
      </div>
    );
  }

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
            
            {/* User Profile / Logout for Mobile */}
            <div className="lg:hidden flex items-center gap-3">
               <span className="text-xs font-bold text-slate-400 truncate max-w-[80px]">{user.name}</span>
               <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-rose-500"><i className="fa-solid fa-right-from-bracket"></i></button>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:max-w-4xl">
            <div className="relative flex-[1.5]">
              <i className="fa-solid fa-location-dot absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input type="text" value={city} list="india-cities" onChange={(e) => setCity(e.target.value)} placeholder="City name..." className="w-full pl-10 pr-4 py-2 border border-slate-700 bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
            </div>
            
            <div className="relative flex-[1.5]" ref={dropdownRef}>
              <div onClick={() => setShowCategoryDropdown(!showCategoryDropdown)} className="w-full py-2 px-4 border border-slate-700 bg-slate-800 rounded-xl cursor-pointer flex items-center justify-between min-h-[42px]">
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                  {selectedCategories.length === 0 ? <span className="text-slate-400 text-sm">Categories...</span> : selectedCategories.slice(0, 1).map(cat => <span key={cat} className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">{cat}</span>)}
                  {selectedCategories.length > 1 && <span className="text-indigo-400 text-xs font-bold">+{selectedCategories.length - 1}</span>}
                </div>
                <i className={`fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}></i>
              </div>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <input type="text" placeholder="Search..." className="w-full mb-2 p-2 bg-slate-800 border-none rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} />
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredCategories.map(cat => (
                      <label key={cat} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggleCategory(cat)} className="w-4 h-4 rounded bg-slate-700" />
                        <span className="text-xs text-slate-300">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
              <div className="flex justify-between px-1"><span className="text-[10px] font-bold text-slate-400 uppercase">Radius</span><span className="text-[10px] font-black text-indigo-400">{radius}km</span></div>
              <input type="range" min="1" max="100" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>

            <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
              {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              {loading ? 'Finding...' : 'Start Search'}
            </button>
          </form>

          {/* Desktop User Info */}
          <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-slate-800">
            <div className="text-right">
              <p className="text-xs font-black text-white">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">{user.email}</p>
            </div>
            <button onClick={handleLogout} title="Logout" className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 shadow-2xl flex flex-col items-center gap-10">
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-white">Searching local database...</h3>
              <p className="text-slate-400 font-medium">{tickerMessage}</p>
            </div>
            <div className="w-full max-w-lg">
              <div className="flex justify-between items-end mb-2">
                <span className="text-3xl font-black text-indigo-400">{Math.round(progress)}%</span>
                <span className="text-xl font-black text-slate-300">{simulatedLeads} found</span>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-0.5"><div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
            </div>
          </div>
        ) : error ? (
           <div className="bg-rose-900/10 border border-rose-500/50 rounded-2xl p-8 text-center">
              <i className="fa-solid fa-triangle-exclamation text-rose-500 text-4xl mb-4"></i>
              <h3 className="text-xl font-bold text-white mb-2">Search Failed</h3>
              <p className="text-rose-300 mb-6">{error}</p>
              <button onClick={() => setError(null)} className="px-6 py-2 bg-rose-600 text-white rounded-lg font-bold">Try Again</button>
           </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-6 py-3 border-b border-slate-800 font-bold flex items-center gap-2">
                  <i className="fa-solid fa-history text-indigo-500"></i> History
                </div>
                <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {history.length === 0 ? <div className="py-8 text-center opacity-30 text-xs italic">No search history</div> : history.map(h => (
                    <div key={h.id} onClick={() => { setCity(h.query.city); setSelectedCategories(h.query.categories); setRadius(h.query.radius); performSearch(h.query.city, h.query.categories, h.query.radius); }} className="p-3 rounded-lg hover:bg-indigo-600/10 cursor-pointer border border-transparent hover:border-indigo-500/30 transition-all">
                      <div className="flex justify-between items-center"><span className="font-bold text-sm truncate">{h.query.city}</span><span className="text-xs text-indigo-400 font-black">+{h.resultCount}</span></div>
                      <p className="text-[10px] text-slate-500">{h.timestamp}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                <h2 className="text-2xl font-black text-white">Verified Leads</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => exportToCSV(leads)} disabled={leads.length === 0} className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-700 disabled:opacity-30">CSV</button>
                  <button onClick={() => exportToPDF(leads, selectedCategories)} disabled={leads.length === 0} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold disabled:opacity-30">PDF</button>
                </div>
              </div>
              <LeadTable leads={leads} />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          <div className="flex items-center gap-4">
            <p>© 2024 EasyLead India</p>
            <span className="h-1 w-1 bg-slate-800 rounded-full"></span>
            <p className="text-slate-400">Logged in as: {user.name} ({user.email})</p>
          </div>
          <p>Powered by Gemini 3 Flash & Google Search</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
