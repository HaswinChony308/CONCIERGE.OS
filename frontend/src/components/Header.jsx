import React, { useState, useEffect } from 'react';

const NAV_LINKS = [
  { id: 'terminal',    label: 'Terminal' },
  { id: 'policy',      label: 'Policy' },
  { id: 'ai-protocol', label: 'AI Proto', aiOnly: true },
  { id: 'ledger',      label: 'Ledger' },
];

const STATUS_CHIPS = [
  {
    icon: 'payments',
    label: 'RAZORPAY',
    value: 'TEST-MODE',
    pulse: true,
  },
  {
    icon: 'shield',
    label: 'GUARDRAILS',
    value: null, // dynamic
  },
  {
    icon: 'speed',
    label: 'LOOP',
    value: '18.4MS',
  },
  {
    icon: 'lock',
    label: 'HMAC',
    value: 'SHA-256',
    color: 'text-violet-400',
  },
];

export default function Header({ ceiling, activeMode, onModeChange, onNavigate }) {
  const [activeNav, setActiveNav] = useState('terminal');
  const [tick, setTick] = useState(0);

  // Tiny clock tick for live feeling
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const handleNav = (id) => {
    setActiveNav(id);
    if (onNavigate) onNavigate(id);
  };

  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-4 border-b border-[#161e2e] mb-1">

      {/* ── Brand ── */}
      <div className="flex items-center gap-3">
        {/* Logo Mark */}
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#6366f1] flex items-center justify-center shadow-lg shadow-blue-900/30">
            <span className="text-white font-black text-base font-mono tracking-tighter">C</span>
          </div>
          {/* Online dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#030508]"
                style={{ boxShadow: '0 0 6px #10b981' }} />
        </div>

        <div>
          <h1 className="text-sm font-black tracking-[0.2em] text-white font-mono uppercase leading-none">
            CONCIERGE<span className="text-blue-400">.OS</span>
          </h1>
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.15em] mt-0.5">
            Autonomous Agentic Commerce
          </p>
        </div>

        {/* Razorpay × NPCI badge */}
        <div className="hidden md:flex items-center gap-1 ml-2 px-2 py-1 rounded border border-violet-500/20 bg-violet-500/5">
          <span className="text-[9px] font-mono font-bold text-violet-400 uppercase tracking-widest">
            NPCI UAP · AP2
          </span>
        </div>
      </div>

      {/* ── Status Chips ── */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
        {/* Razorpay test-mode */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b0f1a] border border-[#161e2e]">
          <span className="pulse-dot pulse-dot-blue" style={{ width: 7, height: 7 }} />
          <span className="text-slate-400">RAZORPAY <span className="text-blue-400 font-bold">TEST-MODE</span></span>
        </div>

        {/* Guardrail ceiling */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b0f1a] border border-[#161e2e]">
          <span className="material-symbols-outlined text-[13px] text-blue-400">shield</span>
          <span className="text-slate-400">CEIL <span className="text-blue-400 font-bold">₹{ceiling.toLocaleString('en-IN')}</span></span>
        </div>

        {/* Loop latency */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b0f1a] border border-[#161e2e]">
          <span className="material-symbols-outlined text-[13px] text-cyan-400">speed</span>
          <span className="text-slate-400">LOOP <span className="text-cyan-400 font-bold">18.4MS</span></span>
        </div>

        {/* HMAC chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b0f1a] border border-violet-500/20">
          <span className="material-symbols-outlined text-[13px] text-violet-400">lock</span>
          <span className="text-violet-400 font-bold">HMAC SHA-256</span>
        </div>
      </div>

      {/* ── Nav + Merchant ── */}
      <div className="flex items-center gap-4">
        {/* Nav Pills */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#0b0f1a] border border-[#161e2e] rounded-lg p-1">
          {NAV_LINKS.map(link => {
            const isActive = activeNav === link.id;
            const isAiTab = link.aiOnly;
            const aiModeOn = activeMode === 'ai';
            return (
              <button
                key={link.id}
                onClick={() => handleNav(link.id)}
                className={`px-3 py-1 rounded text-[11px] font-mono font-semibold tracking-wider transition-all duration-200 flex items-center gap-1 ${
                  isActive && isAiTab && aiModeOn
                    ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white shadow-sm'
                    : isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50'
                    : isAiTab && aiModeOn
                    ? 'text-cyan-400 hover:text-white border border-cyan-500/30 hover:border-cyan-500/60'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {isAiTab && (
                  <span className={`text-[9px] ${aiModeOn ? 'text-cyan-300' : 'text-slate-600'}`}>🤖</span>
                )}
                {link.label}
                {isAiTab && aiModeOn && (
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="h-5 w-px bg-[#161e2e] hidden lg:block" />

        {/* Merchant Card */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b0f1a] border border-[#161e2e] hover:border-[#1e2d47] transition-colors">
          <div className="text-right">
            <div className="text-[11px] font-mono font-black text-white tracking-wider">ACME LABS</div>
            <div className="text-[9px] font-mono text-slate-500 tracking-wider">acc_test_9042</div>
          </div>
          <div className="w-7 h-7 rounded-md bg-[#161e2e] flex items-center justify-center text-slate-400">
            <span className="material-symbols-outlined text-base">storefront</span>
          </div>
        </div>
      </div>
    </header>
  );
}
