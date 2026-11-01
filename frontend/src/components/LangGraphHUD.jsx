import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NODES = [
  { id: 'catalog', label: 'CATALOG', icon: 'search' },
  { id: 'policy',  label: 'POLICY',  icon: 'shield' },
  { id: 'order',   label: 'ORDER',   icon: 'shopping_cart' },
  { id: 'pay',     label: 'PAY',     icon: 'payments' },
  { id: 'audit',   label: 'AUDIT',   icon: 'history' },
];

function NodeBadge({ node, isActive, isPast }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        animate={isActive ? { scale: [1, 1.08, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.6 }}
        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 ${
          isActive
            ? 'border-blue-500 bg-blue-600/20 shadow-sm shadow-blue-500/30'
            : isPast
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-[#161e2e] bg-[#030508]'
        }`}
      >
        <span className={`material-symbols-outlined text-[13px] transition-colors ${
          isActive ? 'text-blue-400' : isPast ? 'text-emerald-500' : 'text-slate-600'
        }`}>
          {node.icon}
        </span>
      </motion.div>
      <span className={`text-[8px] font-mono font-bold tracking-wider uppercase transition-colors ${
        isActive ? 'text-blue-400' : isPast ? 'text-emerald-500' : 'text-slate-600'
      }`}>
        {node.label}
      </span>
    </div>
  );
}

export default function LangGraphHUD({ toolLogs, activeNode }) {
  const terminalRef = useRef(null);
  const [traceId] = useState(() => `#${Math.random().toString(16).slice(2, 8).toUpperCase()}`);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [toolLogs]);

  const activeIdx = NODES.findIndex(n => n.id === activeNode);

  const colorForTool = (tool = '') => {
    if (tool.includes('policy') || tool.includes('guardrail')) return 'text-amber-400';
    if (tool.includes('pay') || tool.includes('payment') || tool.includes('razorpay')) return 'text-emerald-400';
    if (tool.includes('audit') || tool.includes('ledger')) return 'text-violet-400';
    if (tool.includes('escalate')) return 'text-rose-400';
    return 'text-blue-400';
  };

  return (
    <div className="rounded-xl bg-[#07090f] border border-[#161e2e] p-5 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between pb-3 border-b border-[#161e2e]">
        <div>
          <h3 className="text-[11px] font-black tracking-[0.18em] text-white uppercase font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-cyan-400">account_tree</span>
            EXECUTION STREAM
          </h3>
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            LANGGRAPH STATE MACHINE
          </p>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-mono text-slate-500">TRACE ID</div>
          <div className="text-[10px] font-mono text-blue-400 font-bold">{traceId}</div>
        </div>
      </div>

      {/* ── Node Pipeline ── */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-4 left-4 right-4 h-px bg-[#161e2e]" />
        {/* Filled progress */}
        <div
          className="absolute top-4 left-4 h-px bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-700"
          style={{ width: activeIdx >= 0 ? `${(activeIdx / (NODES.length - 1)) * calc('100% - 2rem')}` : '0%' }}
        />
        <div className="relative flex justify-between">
          {NODES.map((n, i) => (
            <NodeBadge
              key={n.id}
              node={n}
              isActive={activeNode === n.id}
              isPast={i < activeIdx}
            />
          ))}
        </div>
      </div>

      {/* ── Tool Log Console ── */}
      <div
        ref={terminalRef}
        className="h-36 overflow-y-auto rounded-lg bg-[#030508] border border-[#161e2e] p-3 font-mono text-[10px] space-y-1 scanline"
      >
        {/* Boot line */}
        <div className="text-slate-600 flex gap-2">
          <span className="text-slate-700">[INIT]</span>
          <span className="text-slate-500">invoke:</span>
          <span className="text-slate-400">system(&#123;"status":"init"&#125;)</span>
        </div>

        <AnimatePresence>
          {toolLogs.map((log, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="leading-relaxed border-t border-[#161e2e]/30 pt-1"
            >
              <div className="flex items-start gap-2">
                <span className="text-slate-700 shrink-0">[{log.time || '14:28:44'}]</span>
                <span className={`font-bold shrink-0 ${colorForTool(log.tool)}`}>{log.tool}:</span>
                <span className="text-slate-400 break-all">{JSON.stringify(log.payload)}</span>
              </div>
              {log.result && (
                <div className="text-emerald-400 text-[9px] pl-10 mt-0.5 flex items-center gap-1">
                  <span className="text-emerald-600">↳</span>
                  {log.result}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Blinking cursor */}
        <div className="terminal-cursor text-[10px] text-blue-400 font-mono">&gt;</div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between text-[9px] font-mono border-t border-[#161e2e] pt-3">
        <div className="flex items-center gap-1.5 text-slate-500">
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          CHECKPOINT SAVED
        </div>
        <span className="text-violet-400 font-bold uppercase tracking-wider">
          HMAC VALIDATED
        </span>
      </div>
    </div>
  );
}

// Helper to avoid CSS calc() in JSX string
function calc(expr) { return `calc(${expr})`; }
