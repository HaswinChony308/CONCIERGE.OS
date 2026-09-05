import React from 'react';

export default function AuditLedger({ records, onInspectProof, onDownloadJsonl, onPingLedger }) {
  return (
    <section className="rounded-xl bg-[#090d14] border border-[#161e2e] p-5 flex flex-col gap-4">
      {/* Header matching AI Studio Screenshot */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#161e2e]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border border-[#161e2e] bg-[#05070c] text-[#3b82f6] flex items-center justify-center">
            <span className="material-symbols-outlined text-base">history</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold tracking-widest text-white uppercase font-mono">
                VERIFIABLE APPEND-ONLY AUDIT LEDGER
              </h2>
              <span className="px-1.5 py-0.5 rounded border border-[#161e2e] bg-[#05070c] text-slate-300 font-mono text-[10px] font-bold">
                BIGQUERY SYNC: OK
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
              CRYPTOGRAPHICALLY SIGNED SETTLEMENT EVENTS, TOOL INVOCATIONS, AND PRE-ACTION RATIONALES FOR REGULATORY VERIFICATION.
            </p>
          </div>
        </div>

        {/* Buttons on Right */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onDownloadJsonl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#161e2e] bg-[#05070c] hover:bg-[#0d1320] text-slate-300 font-mono text-xs transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span className="uppercase tracking-wider">EXPORT JSONL</span>
          </button>

          <button
            onClick={onPingLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#161e2e] bg-[#05070c] hover:bg-[#0d1320] text-slate-300 font-mono text-xs transition-colors"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span className="uppercase tracking-wider">FORCE LEDGER PING</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[#161e2e] text-slate-500 text-[10px] uppercase tracking-widest">
              <th className="py-2.5 px-3">TIMESTAMP</th>
              <th className="py-2.5 px-3">TRACE ID</th>
              <th className="py-2.5 px-3">MODE</th>
              <th className="py-2.5 px-3">TOOL / ACTION</th>
              <th className="py-2.5 px-3">AMOUNT</th>
              <th className="py-2.5 px-3">REFERENCE</th>
              <th className="py-2.5 px-3">POLICY VERDICT</th>
              <th className="py-2.5 px-3 text-right">PROOF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#161e2e]/50 text-[11px]">
            {records.map((r, i) => {
              const isBreach = r.verdict.includes('GATED') || r.verdict.includes('FAIL') || r.verdict.includes('BLOCKED');
              const isEscalated = r.verdict.includes('ESCALATED') || r.verdict.includes('RECOVERY');
              const badgeClass = isBreach
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : isEscalated
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-blue-500/10 text-[#3b82f6] border border-blue-500/30';

              return (
                <tr key={i} className="hover:bg-[#05070c] transition-colors">
                  <td className="py-2.5 px-3 text-slate-400">{r.timestamp}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-bold">{r.trace_id}</td>
                  <td className="py-2.5 px-3 text-slate-400">{r.mode}</td>
                  <td className="py-2.5 px-3 text-white font-bold">{r.tool}</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">
                    {r.amount > 0 ? `₹${r.amount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{r.rzp_ref}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
                      {r.verdict}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onInspectProof(r)}
                      className="px-2 py-1 rounded border border-[#161e2e] bg-[#05070c] hover:bg-[#0d1320] text-slate-300 hover:text-white transition-colors text-[10px] uppercase tracking-wider"
                    >
                      VIEW PROOF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
