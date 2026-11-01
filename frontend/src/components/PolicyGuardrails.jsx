import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* Helper: percentage position for range fill */
function rangePct(val, min, max) {
  return ((val - min) / (max - min)) * 100;
}

const RULES = [
  {
    id: 1,
    label: 'CEILING ENFORCEMENT',
    desc: 'Blocks payments above intent mandate limit',
    status: 'ENFORCED',
    statusClass: 'badge-blue',
    icon: 'block',
  },
  {
    id: 2,
    label: 'CONFIRM-BEFORE-CHARGE',
    desc: 'Requires explicit user click to authorize',
    status: 'ENFORCED',
    statusClass: 'badge-blue',
    icon: 'touch_app',
  },
  {
    id: 3,
    label: 'NEGATIVE PRICE FILTER',
    desc: 'Rejects zero or negative amounts',
    status: 'ACTIVE',
    statusClass: 'badge-cyan',
    icon: 'money_off',
  },
  {
    id: 4,
    label: 'FAILURE PROTOCOL',
    desc: 'Card decline → UPI recovery path',
    status: 'STANDBY',
    statusClass: 'badge-amber',
    icon: 'health_and_safety',
  },
];

export default function PolicyGuardrails({ ceiling, onCeilingChange }) {
  const pct = rangePct(ceiling, 1000, 15000);

  return (
    <motion.div
      className="rounded-xl bg-[#07090f] border border-[#161e2e] p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2 }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between pb-3 border-b border-[#161e2e]">
        <div>
          <h3 className="text-[11px] font-black tracking-[0.18em] text-white uppercase font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-blue-400">policy</span>
            POLICY GUARDRAILS
          </h3>
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            PRE-FLIGHT MANDATE VERIFICATION
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md badge-blue text-[9px] font-bold font-mono uppercase tracking-widest">
          STRICT
        </span>
      </div>

      {/* ── Spend Ceiling Slider ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 uppercase tracking-wider">SPEND CEILING</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">₹1K</span>
            <div className="relative px-2 py-0.5 rounded-md bg-[#030508] border border-blue-500/30">
              <span className="text-white font-black text-sm">₹{ceiling.toLocaleString('en-IN')}</span>
            </div>
            <span className="text-slate-400">₹15K</span>
          </div>
        </div>

        <div className="relative">
          <input
            type="range"
            min="1000"
            max="15000"
            step="500"
            value={ceiling}
            onChange={(e) => onCeilingChange(e.target.value)}
            style={{ '--range-pct': `${pct}%` }}
            className="w-full"
          />
        </div>

        {/* Visual zone indicator */}
        <div className="flex gap-1 text-[9px] font-mono">
          <div className={`flex-1 py-1 rounded text-center border transition-all ${
            ceiling <= 3000 ? 'border-amber-500/40 bg-amber-500/8 text-amber-400' : 'border-[#161e2e] text-slate-600'
          }`}>LOW ≤3K</div>
          <div className={`flex-1 py-1 rounded text-center border transition-all ${
            ceiling > 3000 && ceiling <= 8000 ? 'border-blue-500/40 bg-blue-500/8 text-blue-400' : 'border-[#161e2e] text-slate-600'
          }`}>MID 3–8K</div>
          <div className={`flex-1 py-1 rounded text-center border transition-all ${
            ceiling > 8000 ? 'border-rose-500/40 bg-rose-500/8 text-rose-400' : 'border-[#161e2e] text-slate-600'
          }`}>HIGH &gt;8K</div>
        </div>
      </div>

      {/* ── Rules Matrix ── */}
      <div className="space-y-1.5">
        {RULES.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#030508] border border-[#161e2e]
                       hover:border-[#1e2d47] hover:bg-[#0b0f1a] transition-all duration-150 cursor-default group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[13px] text-slate-500 group-hover:text-slate-400 transition-colors">
                {rule.icon}
              </span>
              <div>
                <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                  R{rule.id}: {rule.label}
                </div>
                <div className="text-[9px] font-mono text-slate-600 group-hover:text-slate-500 transition-colors mt-0.5">
                  {rule.desc}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest ${rule.statusClass}`}>
              {rule.status}
            </span>
          </div>
        ))}
      </div>

      {/* ── HMAC Status Footer ── */}
      <div className="flex items-center justify-between pt-3 border-t border-[#161e2e] text-[9px] font-mono">
        <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[11px]">verified_user</span>
          MANDATE CHAIN
        </span>
        <span className="text-violet-400 font-bold uppercase tracking-wider">
          HMAC SHA-256 ✓
        </span>
      </div>
    </motion.div>
  );
}
