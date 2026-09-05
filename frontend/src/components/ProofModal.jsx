import React from 'react';

export default function ProofModal({ isOpen, onClose, proofData }) {
  if (!isOpen || !proofData) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(proofData, null, 2));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="rounded-3xl bg-[#0e1424] border border-cyan-500/40 p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-enter">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-2xl">verified</span>
            <div>
              <h3 className="font-bold text-white text-base">Cryptographic Proof Inspector</h3>
              <p className="text-[11px] font-mono text-slate-400">
                Trace: <span className="text-cyan-400">{proofData.trace_id || 'trc_verified'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="py-4">
          {proofData.intent_mandate && (
            <div className="mb-4 p-4 rounded-2xl bg-cyan-950/25 border border-cyan-500/30 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-cyan-500/20 pb-2">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">token</span>
                  <span>NPCI UAP / Google AP2 Mandate Chain</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">HMAC-SHA256 VERIFIED</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 pt-1">
                <div>
                  <span className="text-slate-400">Intent ID:</span> <span className="text-white font-bold">{proofData.intent_mandate.intent_id}</span>
                  <br />
                  <span className="text-slate-400">Scope:</span> <span className="text-cyan-300">{proofData.intent_mandate.scope}</span>
                  <br />
                  <span className="text-slate-400">Max Allowance:</span> <span className="text-emerald-400 font-bold">₹{proofData.intent_mandate.max_amount_inr?.toLocaleString('en-IN')}</span>
                </div>
                {proofData.cart_mandate && (
                  <div>
                    <span className="text-slate-400">Cart ID:</span> <span className="text-white font-bold">{proofData.cart_mandate.cart_id}</span>
                    <br />
                    <span className="text-slate-400">SKU:</span> <span className="text-cyan-300">{proofData.cart_mandate.sku}</span>
                    <br />
                    <span className="text-slate-400">Total:</span> <span className="text-emerald-400 font-bold">₹{proofData.cart_mandate.total_inr?.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-white/[0.06] text-[11px] text-slate-400 truncate">
                <span>HMAC Signature: </span>
                <span className="text-emerald-400">{proofData.cart_mandate?.signature || proofData.intent_mandate?.signature}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-300 mb-3 font-sans">
            Verifiable proof record showing state hashes, evaluated guardrail conditions, and cryptographic signature:
          </p>
          <pre className="p-4 rounded-2xl bg-[#080c14] border border-white/[0.08] text-xs font-mono text-emerald-400 overflow-x-auto max-h-80 leading-relaxed">
            {JSON.stringify(proofData, null, 2)}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">content_copy</span>
            <span>Copy JSON</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
