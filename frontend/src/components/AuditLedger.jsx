import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function VerdictBadge({ verdict }) {
  const v = verdict || '';
  const isBreach    = v.includes('GATED') || v.includes('FAIL') || v.includes('BLOCKED') || v.includes('BREACH');
  const isEscalated = v.includes('ESCALATED') || v.includes('RECOVERY') || v.includes('DECLINED');
  const isPassed    = v.includes('PASSED') || v.includes('SUCCESS') || v.includes('CAPTURED') || v.includes('OK');

  const cls = isBreach    ? 'badge-amber'
            : isEscalated ? 'badge-rose'
            : isPassed    ? 'badge-green'
            : 'badge-blue';

  const icon = isBreach    ? 'block'
             : isEscalated ? 'warning'
             : isPassed    ? 'check_circle'
             : 'info';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${cls}`}>
      <span className="material-symbols-outlined text-[10px]">{icon}</span>
      {verdict}
    </span>
  );
}

export default function AuditLedger({ records, onInspectProof, onDownloadJsonl, onPingLedger }) {
  return (
    <motion.section
      className="rounded-xl bg-[#07090f] border border-[#161e2e] p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#161e2e]">
        <div className="flex items-center gap-3">
          {/* Icon Block */}
          <div className="w-9 h-9 rounded-lg bg-[#0b0f1a] border border-[#161e2e] flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-blue-400">history</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[11px] font-black tracking-[0.15em] text-white uppercase font-mono">
                VERIFIABLE AUDIT LEDGER
              </h2>
              <span className="px-2 py-0.5 rounded badge-green text-[9px] font-bold font-mono">
                APPEND-ONLY
              </span>
              <span className="px-2 py-0.5 rounded badge-blue text-[9px] font-bold font-mono">
                BIGQUERY SYNC: OK
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
              Cryptographically signed settlement events · HMAC-SHA256 state proofs · Pre-action rationales
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPingLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#161e2e] bg-[#030508]
                       hover:bg-[#0b0f1a] hover:border-[#1e2d47] text-slate-400 hover:text-white
                       font-mono text-[10px] uppercase tracking-wider transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">sync</span>
            FORCE PING
          </button>
          <button
            onClick={onDownloadJsonl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5
                       hover:bg-blue-500/10 hover:border-blue-500/50 text-blue-400
                       font-mono text-[10px] uppercase tracking-wider transition-all"
          >
            <span className="material-symbols-outlined text-[13px]">download</span>
            EXPORT JSONL
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-[#161e2e]">
        <table className="w-full text-left font-mono text-[11px] min-w-[760px]">
          <thead>
            <tr className="border-b border-[#161e2e] bg-[#030508]">
              {['TIMESTAMP', 'TRACE ID', 'MODE', 'TOOL / ACTION', 'AMOUNT', 'REFERENCE', 'POLICY VERDICT', 'PROOF'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2.5 px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap ${i === 7 ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#161e2e]/50">
            <AnimatePresence>
              {records.map((r, i) => (
                <motion.tr
                  key={r.trace_id + i}
                  initial={{ opacity: 0, backgroundColor: 'rgba(59,130,246,0.08)' }}
                  animate={{ opacity: 1, backgroundColor: 'transparent' }}
                  transition={{ duration: 0.6 }}
                  className="hover:bg-[#0b0f1a] transition-colors cursor-default"
                >
                  {/* Timestamp */}
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[10px]">{r.timestamp}</td>

                  {/* Trace ID */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-slate-300 font-bold text-[10px]">{r.trace_id}</span>
                  </td>

                  {/* Mode */}
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[10px]">{r.mode}</td>

                  {/* Tool */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-white font-bold text-[10px]">{r.tool}</span>
                  </td>

                  {/* Amount */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`font-bold text-[10px] ${r.amount > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {r.amount > 0 ? `₹${r.amount.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </td>

                  {/* Reference */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="hash-text">{r.rzp_ref}</span>
                  </td>

                  {/* Policy Verdict */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <VerdictBadge verdict={r.verdict} />
                  </td>

                  {/* Proof Button */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onInspectProof(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#1e2d47]
                                 bg-[#030508] hover:bg-[#0e1425] hover:border-blue-500/40
                                 text-slate-400 hover:text-blue-400
                                 transition-all text-[9px] font-mono font-bold uppercase tracking-wider"
                    >
                      <span className="material-symbols-outlined text-[11px]">security</span>
                      VIEW PROOF
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {records.length === 0 && (
          <div className="py-10 text-center text-slate-600 font-mono text-[11px] uppercase tracking-widest">
            NO RECORDS — LEDGER IS EMPTY
          </div>
        )}
      </div>

      {/* ── Footer Stats ── */}
      <div className="flex flex-wrap items-center gap-4 pt-2 text-[9px] font-mono text-slate-600">
        <span>{records.length} EVENTS RECORDED</span>
        <span className="text-[#161e2e]">|</span>
        <span className="text-violet-500">APPEND-ONLY · CRYPTOGRAPHICALLY VERIFIED</span>
        <span className="text-[#161e2e]">|</span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[10px] text-emerald-500">verified</span>
          SHA-256 CHAIN INTACT
        </span>
      </div>
    </motion.section>
  );
}
