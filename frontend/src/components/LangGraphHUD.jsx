import React, { useRef, useEffect } from 'react';

export default function LangGraphHUD({ toolLogs, activeNode }) {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [toolLogs]);

  const nodes = [
    { id: 'catalog', label: 'CATALOG' },
    { id: 'policy', label: 'POLICY' },
    { id: 'order', label: 'ORDER' },
    { id: 'pay', label: 'PAY' },
    { id: 'audit', label: 'AUDIT' },
  ];

  return (
    <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-[#161e2e]">
        <div>
          <h3 className="text-xs font-bold tracking-widest text-white uppercase font-mono">
            EXECUTION STREAM
          </h3>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            ACTIVE NODE FLOW
          </p>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          TRC: #8924_C8F
        </span>
      </div>

      {/* 5 Nodes Pipeline */}
      <div className="grid grid-cols-5 gap-2 my-3 font-mono text-[10px]">
        {nodes.map((n) => {
          const isActive = activeNode === n.id;
          return (
            <div
              key={n.id}
              className={`py-2 px-1 rounded text-center border transition-all duration-200 uppercase tracking-wider ${
                isActive
                  ? 'bg-[#0d172e] border-[#2563eb] text-[#3b82f6] font-bold shadow-sm'
                  : 'bg-[#05070c] border-[#161e2e] text-slate-500'
              }`}
            >
              {n.label}
            </div>
          );
        })}
      </div>

      {/* Log Console Terminal Window */}
      <div
        ref={terminalRef}
        className="h-32 overflow-y-auto rounded bg-[#05070c] border border-[#161e2e] p-3 font-mono text-[11px] text-slate-400 space-y-1.5"
      >
        <div className="text-slate-500">
          [14:28:44] <span className="text-slate-300 font-bold">invoke:</span> system({`{"status":"init"}`})
        </div>
        {toolLogs.map((log, idx) => (
          <div key={idx} className="leading-relaxed border-t border-[#161e2e]/40 pt-1">
            <span className="text-slate-500">[{log.time || '14:28:44'}]</span>{' '}
            <span className="text-[#3b82f6] font-bold">{log.tool}:</span>{' '}
            <span className="text-slate-300">{JSON.stringify(log.payload)}</span>
            {log.result && (
              <div className="text-emerald-400 text-[10px] pl-3 mt-0.5">
                ↳ {log.result}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#161e2e] text-[10px] font-mono mt-3">
        <span className="text-slate-500 uppercase tracking-wider">CHECKPOINT SAVED</span>
        <span className="text-[#3b82f6] font-bold uppercase tracking-wider">HMAC VALIDATED</span>
      </div>
    </div>
  );
}
