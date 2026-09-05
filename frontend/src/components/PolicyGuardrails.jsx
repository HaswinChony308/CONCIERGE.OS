import React from 'react';

export default function PolicyGuardrails({ ceiling, onCeilingChange }) {
  return (
    <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-[#161e2e]">
        <div>
          <h3 className="text-xs font-bold tracking-widest text-white uppercase font-mono">
            POLICY GUARDRAILS
          </h3>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            PRE-FLIGHT VERIFICATION
          </p>
        </div>
        <span className="px-2 py-0.5 rounded border border-[#161e2e] bg-[#05070c] text-slate-300 font-mono text-[10px] font-bold">
          STRICT
        </span>
      </div>

      {/* Spend Ceiling Slider */}
      <div className="my-4">
        <div className="flex items-center justify-between text-[11px] font-mono mb-2">
          <span className="text-slate-400">₹1K (MIN)</span>
          <span className="text-white font-bold text-sm">
            ₹{ceiling.toLocaleString('en-IN')}
          </span>
          <span className="text-slate-400">₹15K (MAX)</span>
        </div>
        <input
          type="range"
          min="1000"
          max="15000"
          step="500"
          value={ceiling}
          onChange={(e) => onCeilingChange(e.target.value)}
          className="w-full h-1 bg-[#05070c] border border-[#161e2e] rounded appearance-none cursor-pointer accent-[#2563eb]"
        />
      </div>

      {/* Rules Matrix matching AI Studio Screenshot */}
      <div className="space-y-2 text-xs font-mono">
        <div className="p-2.5 rounded bg-[#05070c] border border-[#161e2e] flex items-center justify-between">
          <span className="text-slate-300 text-[11px] uppercase tracking-wider">
            RULE 2: CONFIRM-BEFORE-CHARGE
          </span>
          <span className="text-[#3b82f6] text-[10px] font-bold tracking-wider">
            ENFORCED
          </span>
        </div>

        <div className="p-2.5 rounded bg-[#05070c] border border-[#161e2e] flex items-center justify-between">
          <span className="text-slate-300 text-[11px] uppercase tracking-wider">
            RULE 3: NEGATIVE PRICE FILTER
          </span>
          <span className="text-cyan-400 text-[10px] font-bold tracking-wider">
            ACTIVE
          </span>
        </div>

        <div className="p-2.5 rounded bg-[#05070c] border border-[#161e2e] flex items-center justify-between">
          <span className="text-slate-300 text-[11px] uppercase tracking-wider">
            RULE 4: FAILURE PROTOCOL
          </span>
          <span className="text-slate-500 text-[10px] font-mono tracking-wider">
            STANDBY
          </span>
        </div>
      </div>
    </div>
  );
}
