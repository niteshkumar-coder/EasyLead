
import React, { useState } from 'react';
import { BusinessLead } from '../types';

interface LeadTableProps {
  leads: BusinessLead[];
}

const LeadTable: React.FC<LeadTableProps> = ({ leads }) => {
  const [sortKey, setSortKey] = useState<keyof BusinessLead>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedLeads = [...leads].sort((a, b) => {
    const valA = a[sortKey] || 0;
    const valB = b[sortKey] || 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    }
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  const toggleSort = (key: keyof BusinessLead) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getDistanceColor = (dist: number) => {
    if (dist < 2) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (dist < 10) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-emerald-600 dark:text-emerald-400';
    if (rating >= 4.0) return 'text-indigo-600 dark:text-indigo-400';
    if (rating >= 3.0) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  // Helper to check if phone is effectively missing
  const isPhoneMissing = (phone: string | null) => {
    if (!phone) return true;
    const p = phone.trim().toLowerCase();
    return (
      p === '' || 
      p === 'null' || 
      p === 'na' || 
      p === 'n/a' || 
      p === 'none' || 
      p === 'undefined' || 
      p === 'not available' || 
      p === 'not found' || 
      p === 'missing'
    );
  };

  // Helper to clean phone for href link
  const sanitizePhoneForLink = (phone: string) => {
    return phone.replace(/[^0-9+]/g, '');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col max-h-[700px] relative">
      <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1600px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shadow-sm">
              <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No.</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => toggleSort('name')}>
                Business Name {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => toggleSort('rating')}>
                Rating {sortKey === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => toggleSort('userRatingsTotal')}>
                Reviews {sortKey === 'userRatingsTotal' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => toggleSort('distance')}>
                Dist {sortKey === 'distance' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => toggleSort('establishedDate')}>
                Established {sortKey === 'establishedDate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact Number</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Website</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Maps</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedLeads.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-32 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-4">
                    <i className="fa-solid fa-map-location-dot text-6xl opacity-10"></i>
                    <p className="text-lg font-medium">Find 100+ business leads in minutes</p>
                    <p className="text-sm">Enter a city and categories to start deep search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedLeads.map((lead, idx) => (
                <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-4 text-sm text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">{lead.name}</td>
                  <td className="px-4 py-4 text-sm font-bold">
                    {lead.rating ? (
                      <div className={`flex items-center gap-1.5 ${getRatingColor(lead.rating)}`}>
                        <i className="fa-solid fa-star text-[10px]"></i>
                        {lead.rating.toFixed(1)}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-bold">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {lead.userRatingsTotal !== null ? (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {lead.userRatingsTotal.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-bold">0</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {lead.distance !== null ? (
                      <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${getDistanceColor(lead.distance)}`}>
                        {lead.distance.toFixed(1)}km
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">...</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span className="bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-100 dark:border-slate-700 flex items-center gap-1.5 w-max">
                      <i className="fa-regular fa-calendar text-[10px] text-indigo-500"></i>
                      {lead.establishedDate || 'NA'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm min-w-[180px]">
                    {!isPhoneMissing(lead.phone) ? (
                      <a 
                        href={`tel:${sanitizePhoneForLink(lead.phone!)}`} 
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold hover:underline whitespace-nowrap"
                      >
                        <i className="fa-solid fa-phone-flip text-[10px]"></i>
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm uppercase tracking-widest inline-flex items-center gap-1">
                        <i className="fa-solid fa-phone-slash text-[8px]"></i>
                        NA
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {lead.website ? (
                      <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 rounded-lg transition-all inline-block" title={lead.website}>
                        <i className="fa-solid fa-globe"></i>
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-2 truncate max-w-[150px]">
                        <i className="fa-regular fa-envelope"></i>
                        {lead.email}
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {lead.mapsUrl && (
                      <a 
                        href={lead.mapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800/50"
                      >
                        <i className="fa-solid fa-location-dot text-[10px]"></i>
                        Google Maps
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500 truncate max-w-[250px]" title={lead.address}>
                    {lead.address}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
};

export default LeadTable;
