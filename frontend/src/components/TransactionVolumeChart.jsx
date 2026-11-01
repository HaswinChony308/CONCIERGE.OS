import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function TransactionVolumeChart() {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const data = [
    { time: '08:00', approved: 12, blocked: 2 },
    { time: '09:00', approved: 19, blocked: 4 },
    { time: '10:00', approved: 15, blocked: 2 },
    { time: '11:00', approved: 22, blocked: 8 },
    { time: '12:00', approved: 28, blocked: 6 },
    { time: '13:00', approved: 27, blocked: 9 },
    { time: '14:00', approved: 18, blocked: 0 },
  ];

  const maxVal = 36;
  const yTicks = [36, 27, 18, 9, 0];
  const total  = data.reduce((s, d) => s + d.approved + d.blocked, 0);
  const totalApproved = data.reduce((s, d) => s + d.approved, 0);
  const totalBlocked  = data.reduce((s, d) => s + d.blocked, 0);

  return (
    <motion.div
      className="rounded-xl bg-[#07090f] border border-[#161e2e] p-5 flex flex-col h-[300px]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-3 border-b border-[#161e2e]">
        <div>
          <h3 className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-blue-400">bar_chart</span>
            TRANSACTION VOLUME
          </h3>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
            REAL-TIME GATEWAY THROUGHPUT
          </p>
        </div>

        <div className="flex items-center gap-4 text-[9px] font-mono">
          <div className="text-right">
            <div className="text-slate-500 uppercase tracking-wider">TOTAL</div>
            <div className="text-white font-bold">{total} TXN</div>
          </div>
          <div className="h-8 w-px bg-[#161e2e]" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-blue-500" />
              <span className="text-slate-400 uppercase tracking-wider">APR <span className="text-blue-400 font-bold">{totalApproved}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-amber-500/60" />
              <span className="text-slate-400 uppercase tracking-wider">BLK <span className="text-amber-400 font-bold">{totalBlocked}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart Canvas ── */}
      <div className="relative flex-1 flex items-end pt-4 pb-1 px-1">
        {/* Y-Axis Grid + Labels */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pt-4 pb-7 px-1">
          {yTicks.map((val) => (
            <div key={val} className="flex items-center gap-2 w-full">
              <span className="w-6 text-[9px] font-mono text-slate-600 text-right shrink-0">{val}</span>
              <div className="flex-1 border-b border-[#161e2e] border-dashed opacity-60" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="relative z-10 ml-8 flex-1 h-full flex items-end justify-between gap-2 sm:gap-4">
          {data.map((item, idx) => {
            const approvedPct = (item.approved / maxVal) * 100;
            const blockedPct  = (item.blocked  / maxVal) * 100;
            const isHovered   = hoveredIdx === idx;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#0e1425] border border-[#1e2d47] text-[9px] font-mono text-white px-2.5 py-1.5 rounded-lg shadow-xl z-30 whitespace-nowrap"
                  >
                    <div className="text-blue-400">✓ {item.approved} approved</div>
                    <div className="text-amber-400">✗ {item.blocked} blocked</div>
                  </motion.div>
                )}

                {/* Bar Stack */}
                <div className="w-full max-w-[40px] flex flex-col justify-end h-full gap-px">
                  {/* Blocked (top) */}
                  {item.blocked > 0 && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.6, delay: idx * 0.07, ease: 'easeOut' }}
                      style={{ height: `${blockedPct}%`, transformOrigin: 'bottom' }}
                      className={`w-full rounded-t-sm transition-colors duration-150 ${
                        isHovered ? 'bg-amber-400/80' : 'bg-amber-500/30'
                      }`}
                    />
                  )}

                  {/* Approved (bottom) */}
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.6, delay: idx * 0.07 + 0.05, ease: 'easeOut' }}
                    style={{
                      height: `${approvedPct}%`,
                      transformOrigin: 'bottom',
                      background: isHovered
                        ? 'linear-gradient(to top, #1d4ed8, #3b82f6)'
                        : 'linear-gradient(to top, #1e40af, #3b82f6)',
                    }}
                    className={`w-full ${item.blocked === 0 ? 'rounded-t-sm' : ''} rounded-b-sm`}
                  />
                </div>

                {/* X Label */}
                <span className={`text-[9px] font-mono mt-2 transition-colors ${
                  isHovered ? 'text-white' : 'text-slate-600'
                }`}>
                  {item.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
