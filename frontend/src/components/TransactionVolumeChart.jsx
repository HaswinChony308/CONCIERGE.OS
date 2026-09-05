import React from 'react';

export default function TransactionVolumeChart() {
  // Data matching the AI Studio dashboard screenshot
  const data = [
    { time: '08:00', approved: 12, blocked: 2 },
    { time: '09:00', approved: 19, blocked: 4 },
    { time: '10:00', approved: 15, blocked: 2 },
    { time: '11:00', approved: 22, blocked: 8 },
    { time: '12:00', approved: 28, blocked: 6 },
    { time: '13:00', approved: 27, blocked: 9 },
    { time: '14:00', approved: 18, blocked: 0 },
  ];

  const maxVal = 36;
  const yTicks = [36, 27, 18, 9, 0];

  return (
    <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-5 flex flex-col justify-between h-[300px]">
      {/* Chart Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#161e2e]/60">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-300">
          TRANSACTION VOLUME
        </span>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6]"></span>
            <span className="text-slate-300 uppercase tracking-wider">APPROVED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#1f293d]"></span>
            <span className="text-slate-400 uppercase tracking-wider">BLOCKED</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative flex-1 flex items-end pt-6 pb-2 px-2">
        {/* Y Axis Grid Lines & Labels */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-2">
          {yTicks.map((val) => (
            <div key={val} className="flex items-center gap-3 w-full">
              <span className="w-6 text-[10px] font-mono text-slate-500 text-right">{val}</span>
              <div className="flex-1 border-b border-[#161e2e]/60"></div>
            </div>
          ))}
        </div>

        {/* Stacked Bars */}
        <div className="relative z-10 ml-9 flex-1 h-full flex items-end justify-between gap-3 sm:gap-6 pt-2">
          {data.map((item, idx) => {
            const approvedHeightPct = (item.approved / maxVal) * 100;
            const blockedHeightPct = (item.blocked / maxVal) * 100;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                <div className="w-full max-w-[48px] flex flex-col justify-end items-center h-full relative cursor-pointer">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 border border-slate-700 text-[10px] font-mono text-white px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                    App: {item.approved} | Blk: {item.blocked}
                  </div>

                  {/* Blocked Top Bar */}
                  {item.blocked > 0 && (
                    <div
                      style={{ height: `${blockedHeightPct}%` }}
                      className="w-full bg-[#1f293d] rounded-t-xs hover:bg-[#2b3952] transition-colors"
                    ></div>
                  )}

                  {/* Approved Bottom Bar */}
                  <div
                    style={{ height: `${approvedHeightPct}%` }}
                    className={`w-full bg-[#3b82f6] hover:bg-[#60a5fa] transition-colors ${
                      item.blocked === 0 ? 'rounded-t-xs' : ''
                    }`}
                  ></div>
                </div>

                {/* X Axis Label */}
                <span className="text-[10px] font-mono text-slate-400 mt-2.5">
                  {item.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

