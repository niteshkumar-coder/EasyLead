
import React, { useState, useMemo } from 'react';
import { BusinessLead } from '../types';

interface LeadTableProps {
  leads: BusinessLead[];
}

const LeadTable: React.FC<LeadTableProps> = ({ leads }) => {
  const [sortKey, setSortKey] = useState<keyof BusinessLead>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedLeads = useMemo(() => {
    if (!Array.isArray(leads)) return [];
    return [...leads].sort((a, b) => {
      const valA = a[sortKey] ?? 0;
      const valB = b[sortKey] ?? 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [leads, sortKey, sortOrder]);

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

  const isPhoneMissing = (phone: string | null) => {
    if (!phone) return true;
    const p = String(phone).trim().toLowerCase();
    const invalidList = ['', 'null', 'na', 'n/a', 'none', 'undefined', 'not available', 'not found', 'missing', 'no phone', 'hidden'];
    return invalidList.includes(p) || p.length < 6;
  };

  const sanitizePhoneForLink = (phone: any) => {
    return String(phone || "").replace(/[^0-9+]/g, '');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col max-h-[700px] relative overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 shadow-sm">
            <tr>
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
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Maps</th>
              <th className="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedLeads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-32 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-4">
                    <i className="fa-solid fa-map-location-dot text-6xl opacity-10"></i>
                    <p className="text-lg font-medium">No results to display</p>
                    <p className="text-sm">Try searching for different categories or a larger radius.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedLeads.map((lead, idx) => (
                <tr key={lead.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-4 text-sm text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={lead.name}>{lead.name}</td>
                  <td className="px-4 py-4 text-sm font-bold">
                    {lead.rating ? (
                      <div className={`flex items-center gap-1.5 ${getRatingColor(lead.rating)}`}>
                        <i className="fa-solid fa-star text-[10px]"></i>
                        {Number(lead.rating).toFixed(1)}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-bold uppercase">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {lead.userRatingsTotal !== null ? (
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {Number(lead.userRatingsTotal).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-bold">0</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {lead.distance !== null ? (
                      <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${getDistanceColor(lead.distance)}`}>
                        {Number(lead.distance).toFixed(1)}km
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">...</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {!isPhoneMissing(lead.phone) ? (
                      <a href={`tel:${sanitizePhoneForLink(lead.phone)}`} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline whitespace-nowrap inline-flex items-center gap-2">
                        <i className="fa-solid fa-phone-flip text-[10px]"></i>
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded">NA</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {lead.mapsUrl ? (
                      <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 font-bold flex items-center gap-1 whitespace-nowrap">
                        <i className="fa-solid fa-location-dot"></i> Maps
                      </a>
                    ) : 'NA'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500 truncate max-w-[300px]" title={lead.address}>
                    {lead.address}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default LeadTable;
