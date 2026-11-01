import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ITEMS = [
  {
    sku: 'WATCH-GPS-PRO',
    label: '⚡ GPS WATCH ₹8,999 (CEILING BREACH)',
    subtext: 'POLICY INTERCEPT · MANDATE BLOCKED',
    status: 'BLOCKED',
    type: 'blocked',
    query: 'buy GPS watch 8999',
  },
  {
    sku: 'RN-APX-09-BLK',
    label: '⚡ RUNNING SHOES < ₹3,000 (SIZE 9)',
    subtext: 'AUTH COMPLETE · HMAC VERIFIED',
    status: 'APPROVED',
    type: 'approved',
    query: 'find running shoes under 3000 size 9',
  },
  {
    sku: 'INTENT-SHOES',
    label: '⚡ INTENT: RUNNING SHOES',
    subtext: 'MANDATE CHAIN VALID · SIGNED',
    status: 'MANDATE OK',
    type: 'approved',
    query: 'show me running shoes',
  },
  {
    sku: 'BT-STD',
    label: '⚡ WATER BOTTLE < ₹1,000',
    subtext: 'WITHIN CEILING · AUTHORIZED',
    status: 'APPROVED',
    type: 'approved',
    query: 'water bottle under 1000',
  },
  {
    sku: 'FAILDEMO',
    label: '💳 CARD DECLINE + UPI RECOVERY',
    subtext: 'SCENARIO: AUTONOMOUS RECOVERY',
    status: 'RECOVERY',
    type: 'recovery',
    query: 'FAILDEMO',
  },
];

export default function SearchDetailing({ onSelectQuery }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lastClicked, setLastClicked] = useState(null);

  const filtered = ITEMS.filter(item =>
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtext.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClick = (item) => {
    setLastClicked(item.sku);
    if (onSelectQuery) onSelectQuery(item.query);
    setTimeout(() => setLastClicked(null), 1200);
  };

  const badgeClass = (type) => {
    if (type === 'blocked')  return 'badge-amber';
    if (type === 'recovery') return 'badge-rose';
    return 'badge-blue';
  };

  return (
    <motion.div
      className="rounded-xl bg-[#07090f] border border-[#161e2e] p-5 flex flex-col h-[300px]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-[#161e2e]">
        <div>
          <h3 className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-blue-400">search</span>
            SCENARIO LAUNCHER
          </h3>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
            CLICK TO FIRE A DEMO SCENARIO
          </p>
        </div>
        <span className="px-2 py-0.5 rounded badge-blue text-[9px] font-mono font-bold">
          {filtered.length} LOADED
        </span>
      </div>

      {/* ── Search Input ── */}
      <div className="my-2.5 relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px] text-slate-600">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="FILTER SCENARIOS..."
          className="w-full bg-[#030508] border border-[#161e2e] focus:border-blue-500/50 rounded-lg pl-8 pr-3 py-1.5
                     text-[10px] font-mono text-slate-300 placeholder:text-slate-700
                     focus:outline-none transition-colors"
        />
      </div>

      {/* ── Items ── */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        <AnimatePresence>
          {filtered.map((item, idx) => (
            <motion.div
              key={item.sku}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{
                opacity: 1,
                x: 0,
                backgroundColor: lastClicked === item.sku
                  ? 'rgba(59,130,246,0.12)'
                  : 'rgba(3,5,8,0)',
              }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              onClick={() => handleClick(item)}
              className="p-2.5 rounded-lg border border-[#161e2e] hover:border-[#1e2d47] hover:bg-[#0b0f1a]
                         flex items-center justify-between transition-all cursor-pointer group"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-[10px] font-mono font-bold text-slate-200 group-hover:text-white truncate leading-tight">
                  {item.label}
                </div>
                <div className="text-[9px] font-mono text-slate-600 group-hover:text-slate-500 mt-0.5 truncate">
                  {item.subtext}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${badgeClass(item.type)}`}>
                  {item.status}
                </span>
                <span className="material-symbols-outlined text-[12px] text-slate-700 group-hover:text-blue-500 transition-colors">
                  play_arrow
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-6 text-slate-700 font-mono text-[10px] uppercase tracking-widest">
            NO SCENARIOS MATCH
          </div>
        )}
      </div>
    </motion.div>
  );
}
