import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Sparkline mini chart ─── */
function Sparkline({ values = [], color = '#3b82f6', height = 28 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 80, h = height;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Animated number counter ─── */
function AnimatedNum({ value, prefix = '', suffix = '', className = '', decimals = 0 }) {
  const [displayed, setDisplayed] = useState(value);
  useEffect(() => {
    let start = null;
    const duration = 600;
    const from = displayed;
    const to = value;
    const step = (ts) => {
      if (!start) start = ts;
      const pct = Math.min((ts - start) / duration, 1);
      setDisplayed(from + (to - from) * pct);
      if (pct < 1) requestAnimationFrame(step);
      else setDisplayed(to);
    };
    requestAnimationFrame(step);
  }, [value]); // eslint-disable-line

  const fmt = decimals > 0
    ? displayed.toFixed(decimals)
    : Math.round(displayed).toLocaleString('en-IN');
  return <span className={className}>{prefix}{fmt}{suffix}</span>;
}

/* ─── Individual metric card ─── */
function MetricCard({ delay, children }) {
  return (
    <motion.div
      className="rounded-xl bg-[#07090f] border border-[#161e2e] p-4 flex flex-col justify-between h-[138px] cursor-default relative overflow-hidden group"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ scale: 1.025 }}
    >
      {/* Hover glow overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at top left, rgba(59,130,246,0.06), transparent 60%)' }} />
      {children}
    </motion.div>
  );
}

const SPARK_GMV  = [80, 110, 90, 145, 120, 148, 130, 160, 148];
const SPARK_LATENCY = [22, 19, 21, 18, 17, 18, 20, 18, 18];

export default function MetricsGrid({ metrics, ceiling, activeMode, onModeChange }) {
  const gmv     = metrics?.total_gmv_inr          || 148250;
  const orders  = metrics?.completed_checkouts     || 32;
  const blocks  = metrics?.guardrail_ceiling_blocks !== undefined ? metrics.guardrail_ceiling_blocks : 4;
  const latency = metrics?.avg_latency_ms          || 18.4;

  const modeLabels = { human: 'B2C CONV', a2a: 'A2A RPC', recovery: 'FALLBACK' };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      {/* ── Card 1: Settlement GMV ── */}
      <MetricCard delay={0}>
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[12px] text-emerald-400">account_balance_wallet</span>
            SETTLEMENT
          </span>
          <span className="px-2 py-0.5 rounded badge-green text-[9px] font-bold">
            {orders} SETTLED
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-1">
            <AnimatedNum
              value={gmv}
              prefix="₹"
              className="text-2xl font-black text-white font-mono tracking-tight"
            />
          </div>
          <Sparkline values={SPARK_GMV} color="#10b981" />
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono mt-1">
          <span className="text-slate-500 uppercase tracking-wider">RAZORPAY SANDBOX</span>
          <span className="text-emerald-400 font-bold tracking-wider flex items-center gap-1">
            <span className="text-emerald-300">↑</span> 99.4% YIELD
          </span>
        </div>
      </MetricCard>

      {/* ── Card 2: Guardrail Interventions ── */}
      <MetricCard delay={0.08}>
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[12px] text-amber-400">gpp_bad</span>
            INTERVENTIONS
          </span>
          <span className="px-2 py-0.5 rounded badge-amber text-[9px] font-bold">GATED</span>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <AnimatedNum value={blocks} className="text-2xl font-black text-white font-mono tracking-tight" />
          <span className="text-[11px] font-mono text-slate-400">BLOCKED / 7 AUTH</span>
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono mt-1">
          <span className="text-blue-400 font-bold">CEIL ₹{ceiling.toLocaleString('en-IN')}</span>
          <span className="text-amber-400 font-bold tracking-wider">0 LEAKAGE</span>
        </div>

        {/* Mini progress bar showing 4/7 blocked */}
        <div className="w-full h-1 bg-[#161e2e] rounded mt-2">
          <div className="h-1 bg-amber-500 rounded transition-all duration-700"
               style={{ width: `${(blocks / 7) * 100}%` }} />
        </div>
      </MetricCard>

      {/* ── Card 3: Graph Loop Latency ── */}
      <MetricCard delay={0.16}>
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[12px] text-cyan-400">show_chart</span>
            GRAPH LOOP
          </span>
          <span className="px-2 py-0.5 rounded badge-cyan text-[9px] font-bold">SUB-20MS</span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-1">
            <AnimatedNum
              value={latency}
              decimals={1}
              className="text-2xl font-black text-white font-mono tracking-tight"
            />
            <span className="text-sm font-mono text-cyan-400 font-bold">ms</span>
          </div>
          <Sparkline values={SPARK_LATENCY} color="#06b6d4" />
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono mt-1">
          <span className="text-slate-500 uppercase tracking-wider">LANGGRAPH STATE</span>
          <span className="text-blue-400 font-bold flex items-center gap-1">
            <span className="pulse-dot pulse-dot-blue" style={{ width: 6, height: 6 }} />
            IDLE
          </span>
        </div>
      </MetricCard>

      {/* ── Card 4: Pipeline Mode Switcher ── */}
      <MetricCard delay={0.24}>
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[12px] text-violet-400">account_tree</span>
            PIPELINE
          </span>
          <span className="text-[10px] text-slate-500 font-mono">V2.4.0</span>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="flex bg-[#030508] p-1 rounded-lg border border-[#161e2e] text-[10px] font-mono my-1.5 gap-0.5">
          {['human', 'a2a', 'recovery'].map(mode => (
            <button
              key={mode}
              onClick={() => onModeChange && onModeChange(mode)}
              className={`flex-1 py-1.5 text-center font-bold tracking-wider transition-all duration-200 rounded-md text-[9px] uppercase ${
                activeMode === mode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode === 'human' ? 'HUMAN' : mode === 'a2a' ? 'A2A' : 'RECOV'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-slate-500 uppercase tracking-wider">CONTEXT:</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={activeMode}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="text-white font-black tracking-wider"
            >
              {modeLabels[activeMode] || 'B2C CONV'}
            </motion.span>
          </AnimatePresence>
        </div>
      </MetricCard>
    </section>
  );
}
