import React from 'react';

export default function Header({ 
  ceiling, 
  activeMode, 
  onModeChange, 
  status,
  onNavigate 
}) {
  return (
    <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#161e2e]">
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-sm bg-[#2563eb] text-black font-black flex items-center justify-center text-lg font-mono shadow-sm">
          C
        </div>
        <div>
          <h1 className="text-xs font-bold tracking-widest text-white font-mono uppercase">
            CONCIERGE.OS
          </h1>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            AUTONOMOUS AGENT
          </p>
        </div>
      </div>

      {/* Connectivity & Guardrail Chips */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#090d14] border border-[#161e2e] text-slate-300">
          <span className="w-2 h-2 rounded-xs bg-[#3b82f6]"></span>
          <span className="text-slate-400">RAZORPAY <span className="text-[#3b82f6] font-bold">TEST-MODE</span></span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#090d14] border border-[#161e2e] text-slate-300">
          <span className="material-symbols-outlined text-[15px] text-[#3b82f6]">shield</span>
          <span className="text-slate-400">GUARDRAILS <span className="text-[#3b82f6] font-bold">₹{ceiling.toLocaleString('en-IN')} LIMIT</span></span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#090d14] border border-[#161e2e] text-slate-300">
          <span className="material-symbols-outlined text-[15px] text-[#3b82f6]">show_chart</span>
          <span className="text-slate-400">LOOP <span className="text-[#3b82f6] font-bold">18.4MS</span></span>
        </div>
      </div>

      {/* Navigation & Merchant Info */}
      <div className="flex items-center gap-6">
        <nav className="flex items-center gap-4 text-xs font-mono">
          <button 
            onClick={() => onNavigate && onNavigate('terminal')}
            className="text-[#3b82f6] hover:underline font-semibold"
          >
            Terminal
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('policy')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Policy
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('ledger')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Ledger
          </button>
        </nav>

        <div className="h-4 w-[1px] bg-[#161e2e]"></div>

        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <div className="text-xs font-mono font-bold text-white tracking-wider">
              ACME LABS
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              acc_test_9042
            </div>
          </div>
          <div className="p-1.5 rounded bg-[#090d14] border border-[#161e2e] text-slate-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm">storefront</span>
          </div>
        </div>
      </div>
    </header>
  );
}
