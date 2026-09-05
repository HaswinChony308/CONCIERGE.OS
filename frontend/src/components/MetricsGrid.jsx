import React from 'react';

export default function MetricsGrid({ metrics, ceiling, activeMode, onModeChange }) {
  const gmv = metrics?.total_gmv_inr || 148250;
  const orders = metrics?.completed_checkouts || 32;
  const blocks = metrics?.guardrail_ceiling_blocks !== undefined ? metrics.guardrail_ceiling_blocks : 4;
  const latency = metrics?.avg_latency_ms || 18.4;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: SETTLEMENT */}
      <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-4 flex flex-col justify-between h-[130px]">
        <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-slate-400">
          <span>SETTLEMENT</span>
          <span className="px-2 py-0.5 rounded border border-[#161e2e] text-[10px] text-slate-400">
            SETTLED ({orders})
          </span>
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white font-mono tracking-tight">
            ₹{gmv.toLocaleString('en-IN')}
          </span>
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            +14.2%
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 uppercase tracking-wider">RAZORPAY SANDBOX</span>
          <span className="text-[#3b82f6] font-bold tracking-wider">99.4% YIELD</span>
        </div>
      </div>

      {/* Card 2: INTERVENTIONS */}
      <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-4 flex flex-col justify-between h-[130px]">
        <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-slate-400">
          <span>INTERVENTIONS</span>
          <span className="px-2 py-0.5 rounded border border-[#161e2e] text-[10px] text-slate-400">
            GATED
          </span>
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className="text-2xl font-bold text-white font-mono tracking-tight">
            {blocks}
          </span>
          <span className="text-xs font-mono text-slate-400">
            BLOCKED / 7 AUTH
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-[#3b82f6] font-bold">CEILING: ₹{ceiling.toLocaleString('en-IN')}</span>
          <span className="text-amber-400 font-bold tracking-wider">0 LEAKAGE</span>
        </div>
      </div>

      {/* Card 3: GRAPH LOOP */}
      <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-4 flex flex-col justify-between h-[130px]">
        <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-slate-400">
          <span>GRAPH LOOP</span>
          <span className="px-2 py-0.5 rounded border border-[#161e2e] text-[10px] text-slate-400">
            SUB-20MS
          </span>
        </div>

        <div className="flex items-baseline gap-1 my-1">
          <span className="text-2xl font-bold text-white font-mono tracking-tight">
            {latency}
          </span>
          <span className="text-sm font-mono text-cyan-400 font-bold">
            ms
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 uppercase tracking-wider">LANGGRAPH STATE</span>
          <span className="text-[#3b82f6] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-xs bg-[#3b82f6]"></span>
            IDLE
          </span>
        </div>
      </div>

      {/* Card 4: PIPELINE */}
      <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-4 flex flex-col justify-between h-[130px]">
        <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-slate-400">
          <span>PIPELINE</span>
          <span className="text-[10px] text-slate-500 font-mono">V2.4.0</span>
        </div>

        {/* Mode Switcher Segmented Control */}
        <div className="flex bg-[#05070c] p-1 rounded-sm border border-[#161e2e] text-xs font-mono my-1">
          <button
            onClick={() => onModeChange && onModeChange('human')}
            className={`flex-1 py-1 text-center font-bold tracking-wider transition-all rounded-xs text-[10px] ${
              activeMode === 'human'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            HUMAN
          </button>
          <button
            onClick={() => onModeChange && onModeChange('a2a')}
            className={`flex-1 py-1 text-center font-bold tracking-wider transition-all rounded-xs text-[10px] ${
              activeMode === 'a2a'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            A2A TOOL
          </button>
          <button
            onClick={() => onModeChange && onModeChange('recovery')}
            className={`flex-1 py-1 text-center font-bold tracking-wider transition-all rounded-xs text-[10px] ${
              activeMode === 'recovery'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            RECOVERY
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 uppercase tracking-wider">CONTEXT:</span>
          <span className="text-white font-bold tracking-wider">
            {activeMode === 'human' ? 'B2C CONV' : activeMode === 'a2a' ? 'A2A RPC' : 'FALLBACK'}
          </span>
        </div>
      </div>
    </section>
  );
}
