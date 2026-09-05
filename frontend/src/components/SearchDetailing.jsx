import React, { useState } from 'react';

export default function SearchDetailing({ onSelectQuery }) {
  const [searchQuery, setSearchQuery] = useState('');

  const defaultItems = [
    {
      sku: 'SKU: WATCH-GPS-PRO',
      subtext: 'POLICY INTERCEPT',
      status: 'BLOCKED',
      type: 'blocked'
    },
    {
      sku: 'SKU: RN-APX-09-BLK',
      subtext: 'AUTH COMPLETE',
      status: 'APPROVED',
      type: 'approved'
    },
    {
      sku: 'INTENT: RUNNING SHOES',
      subtext: 'MANDATE CHAIN VALID',
      status: 'APPROVED',
      type: 'approved'
    },
    {
      sku: 'SKU: BT-STD',
      subtext: 'WATER BOTTLE 1L',
      status: 'APPROVED',
      type: 'approved'
    }
  ];

  const filtered = defaultItems.filter(item => 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtext.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-5 flex flex-col justify-between h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#161e2e]/60">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-300">
          SEARCH DETAILING
        </span>
        <span className="material-symbols-outlined text-slate-500 text-sm">search</span>
      </div>

      {/* Search Input */}
      <div className="my-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="QUERY METRICS &amp; LOGS..."
          className="w-full bg-[#05070c] border border-[#161e2e] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 transition-colors"
        />
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectQuery && onSelectQuery(item.sku)}
            className="p-2.5 rounded-lg bg-[#05070c] border border-[#161e2e] hover:border-slate-700 flex items-center justify-between transition-all cursor-pointer group"
          >
            <div>
              <div className="text-xs font-mono font-bold text-slate-200 group-hover:text-white">
                {item.sku}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                {item.subtext}
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                item.type === 'blocked'
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

