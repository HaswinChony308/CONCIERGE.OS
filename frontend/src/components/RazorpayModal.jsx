import React from 'react';

export default function RazorpayModal({ 
  isOpen, 
  onClose, 
  item, 
  onSimulateOutcome 
}) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="rounded-3xl bg-[#0e1424] border border-emerald-500/40 p-6 md:p-8 max-w-md w-full shadow-2xl animate-enter">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              RZP
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Razorpay Checkout Sandbox</h3>
              <p className="text-[11px] font-mono text-emerald-400">Acme Gear Labs (mid_dev_9024)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="py-5 flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-white/[0.08] flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">{item.name}</h4>
              <span className="text-xs font-mono text-slate-400">SKU: {item.sku}</span>
            </div>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              ₹{item.price.toLocaleString('en-IN')}.00
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 leading-relaxed font-mono">
            <strong>Track 01 Verification Sandbox:</strong> Test both happy-path settlement and mandated failure recovery handling.
          </div>

          {item.short_url && (
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-blue-300">
                <span className="material-symbols-outlined text-sm">link</span>
                <span>Live Razorpay Link:</span>
              </div>
              <a
                href={item.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 font-semibold"
              >
                <span>Open rzp.io Checkout</span>
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </a>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={() => onSimulateOutcome('SUCCESS')}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Simulate Success (Capture &amp; Settle)</span>
            </button>

            <button
              onClick={() => onSimulateOutcome('DECLINED')}
              className="w-full py-3 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">error</span>
              <span>Simulate Card Decline (Trigger Track 01 Recovery)</span>
            </button>

            <button
              onClick={() => onSimulateOutcome('TIMEOUT')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">timer_off</span>
              <span>Simulate 504 Timeout (Test Idempotency)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
