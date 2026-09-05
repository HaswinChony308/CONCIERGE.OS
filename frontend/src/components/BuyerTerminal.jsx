import React, { useState, useRef, useEffect } from 'react';

export default function BuyerTerminal({
  activeMode,
  onModeChange,
  ceiling,
  messages,
  onSendMessage,
  onScenarioSelect,
  onOpenCheckout,
  onInspectPayload,
  onUpiFallback,
  onHumanEscalate,
  onResetSession,
  isWorking,
}) {
  const [inputText, setInputText] = useState('');
  const streamRef = useRef(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages, isWorking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="rounded-xl bg-[#090d14] border border-[#161e2e] p-5 flex flex-col justify-between h-[680px]">
      {/* Top Header */}
      <div className="flex flex-col gap-3 pb-3 border-b border-[#161e2e]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-xs bg-[#3b82f6]"></span>
              <span className="w-1.5 h-1.5 rounded-xs bg-[#3b82f6]"></span>
              <span className="w-1.5 h-1.5 rounded-xs bg-[#3b82f6]"></span>
            </div>
            <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
              {activeMode === 'human'
                ? 'SESSION_USR_9042 // RAZORPAY AUTONOMOUS TERMINAL'
                : activeMode === 'a2a'
                ? 'A2A_PEER_AGENT_RPC // JSON-RPC 2.0 TERMINAL'
                : 'EXCEPTION_HANDLER // RAZORPAY FALLBACK RECOVERY'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded border border-[#161e2e] bg-[#05070c] text-[10px] font-mono text-[#3b82f6] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-xs bg-[#3b82f6]"></span>
              <span>STATE_READY</span>
            </div>
            <button
              onClick={onResetSession}
              title="Reset Session"
              className="p-1 rounded border border-[#161e2e] bg-[#05070c] text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-xs">refresh</span>
            </button>
          </div>
        </div>

        {/* Presets Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
          <span className="text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-slate-500">bolt</span>
            PRESETS:
          </span>
          <button
            onClick={() => onScenarioSelect('shoes')}
            className="py-1 px-3 rounded border border-[#161e2e] bg-[#05070c] hover:bg-[#0d1320] text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-xs text-[#3b82f6]">bolt</span>
            <span>RUNNING SHOES &lt; ₹3,000 (SIZE 9)</span>
          </button>
          <button
            onClick={() => onScenarioSelect('ceiling')}
            className="py-1 px-3 rounded border border-[#161e2e] bg-[#05070c] hover:bg-[#0d1320] text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-xs text-amber-400">bolt</span>
            <span>GPS WATCH ₹8,999 (CEILING BREACH)</span>
          </button>
          <button
            onClick={() => onScenarioSelect('decline')}
            className="py-1 px-3 rounded border border-[#161e2e] bg-[#05070c] hover:bg-[#0d1320] text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-xs text-rose-400">credit_card</span>
            <span>DECLINED</span>
          </button>
        </div>
      </div>

      {/* Stream Area */}
      <div ref={streamRef} className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
        {activeMode === 'a2a' ? (
          <div className="flex flex-col gap-4 font-mono text-xs animate-enter">
            <div className="flex items-center justify-between text-cyan-400 pb-2 border-b border-white/[0.08]">
              <span className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">hub</span>
                A2A JSON-RPC 2.0 Machine Negotiation Channel
              </span>
              <span className="text-slate-400 text-[11px]">DIALECT: MCP / A2A-v1</span>
            </div>

            <div className="p-4 rounded-xl bg-[#090d16] border border-white/[0.06] text-slate-300">
              <span className="text-cyan-400 font-semibold">// Incoming Agent-to-Agent Introspection</span><br />
              <span className="text-emerald-400">POST</span> /a2a/v1/checkout/session HTTP/2<br />
              Host: concierge.acme.internal<br />
              X-Agent-Signature: 0x9f8b72a...890a<br /><br />
              <pre className="text-slate-300 leading-relaxed overflow-x-auto">
{JSON.stringify({
  jsonrpc: "2.0",
  method: "execute_procurement",
  params: {
    target_sku: "RN-APX-09-BLK",
    quantity: 1,
    max_authorized_ceiling: ceiling,
    currency: "INR",
    webhook_return: "https://buyer-agent.internal/cb"
  },
  id: "req-98234-a2a"
}, null, 2)}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-white/[0.06] text-emerald-400 text-[11px]">
              &gt;&gt; Concierge Graph Engine: Verified catalog signature. Guardrail Ceiling (₹{ceiling.toLocaleString('en-IN')}) verified VALID.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenCheckout({ name: 'Apex Glide 9 Pro', sku: 'RN-APX-09-BLK', price: 2499 })}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(56,189,248,0.25)]"
              >
                Execute A2A Razorpay Settlement
              </button>
              <button
                onClick={() => onModeChange('human')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
              >
                Return to Human Buyer
              </button>
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            if (m.type === 'buyer') {
              return (
                <div key={idx} className="flex items-start justify-end gap-4 max-w-xl self-end ml-auto animate-enter">
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Buyer (Session #9042)</span>
                    <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-100 text-sm leading-relaxed shadow-sm">
                      {m.text}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-200 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                </div>
              );
            }

            if (m.type === 'rationale') {
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">psychology</span>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Agent Pre-Action Rationale
                    </span>
                    <div className="p-3.5 rounded-xl bg-[#090d17] border border-white/[0.06] font-mono text-[11px] text-slate-300 leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            }

            if (m.type === 'product_card') {
              const { name, sku, price, desc, image } = m.product;
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <div className="rounded-2xl bg-gradient-to-b from-[#111728] to-[#0c101d] border border-white/10 p-5 shadow-xl flex flex-col sm:flex-row gap-5 hover:border-emerald-500/40 transition-all duration-300">
                      <div className="w-full sm:w-40 h-36 rounded-xl bg-slate-950 overflow-hidden relative shrink-0 border border-white/[0.08]">
                        <img className="w-full h-full object-cover" src={image} alt={name} />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-emerald-400 text-[10px] font-mono font-semibold border border-emerald-500/30">
                          VALIDATED SKU
                        </div>
                      </div>

                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-lg font-bold text-white tracking-tight font-sans">{name}</h4>
                              <span className="text-xs font-mono text-slate-400">SKU: {sku}</span>
                            </div>
                            <span className="text-2xl font-black text-emerald-400 font-mono">
                              ₹{price.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2 leading-relaxed">{desc}</p>
                        </div>

                        {m.product.mandates && (
                          <div className="mt-3 p-2.5 rounded-xl bg-[#090e1a] border border-cyan-500/25 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold tracking-wider">
                                AP2 / UAP MANDATE
                              </span>
                              <span className="text-slate-400">
                                Intent: <span className="text-white font-bold">{m.product.mandates.intent_id}</span>
                              </span>
                              {m.product.mandates.cart_id && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span className="text-slate-400">
                                    Cart: <span className="text-emerald-400 font-bold">{m.product.mandates.cart_id}</span>
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <span className="material-symbols-outlined text-[14px]">verified_user</span>
                              <span>HMAC-SHA256</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-white/[0.07]">
                          <button
                            onClick={() => onOpenCheckout(m.product)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                          >
                            <span className="material-symbols-outlined text-[17px]">lock_open</span>
                            <span>Authorize &amp; Pay ₹{price.toLocaleString('en-IN')}</span>
                          </button>
                          {m.product.short_url && (
                            <a
                              href={m.product.short_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-mono transition-all flex items-center gap-1.5"
                              title="Open official Razorpay payment page in new tab"
                            >
                              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                              <span>Live RZP</span>
                            </a>
                          )}
                          <button
                            onClick={() => onInspectPayload(sku, price)}
                            className="py-2.5 px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-slate-300 hover:text-white text-xs font-mono transition-colors"
                          >
                            Payload
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (m.type === 'product_list') {
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">grid_view</span>
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                          Matched Catalog Items ({m.products.length})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                          Within Spend Limit
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">Select an item to authorize</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                      {m.products.map((item, pIdx) => (
                        <div
                          key={pIdx}
                          className="rounded-xl bg-gradient-to-b from-[#111728] to-[#0c101d] border border-white/10 p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-200 group shadow-lg"
                        >
                          <div>
                            <div className="w-full h-32 rounded-lg bg-slate-950 overflow-hidden relative border border-white/[0.08] mb-3">
                              <img
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                src={item.image}
                                alt={item.name}
                              />
                              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-emerald-400 text-[9px] font-mono font-semibold border border-emerald-500/30">
                                SKU: {item.sku}
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-white tracking-tight leading-snug line-clamp-1">
                                {item.name}
                              </h4>
                              <span className="text-base font-black text-emerald-400 font-mono shrink-0">
                                ₹{item.price.toLocaleString('en-IN')}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                              {item.desc}
                            </p>

                            {item.mandates && (
                              <div className="mt-2.5 px-2 py-1 rounded bg-[#090e1a] border border-cyan-500/25 flex items-center justify-between text-[10px] font-mono">
                                <span className="text-cyan-300 font-bold">AP2 / UAP MANDATE</span>
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">verified</span>
                                  SIGNED
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/[0.07]">
                            <button
                              onClick={() => onOpenCheckout(item)}
                              className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            >
                              <span className="material-symbols-outlined text-[15px]">lock_open</span>
                              <span>Authorize</span>
                            </button>
                            <button
                              onClick={() => onInspectPayload(item.sku, item.price)}
                              className="py-2 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-slate-300 hover:text-white text-[11px] font-mono transition-colors"
                              title="Inspect mandate payload"
                            >
                              Payload
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            if (m.type === 'alert') {
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">gavel</span>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                      {m.title}
                    </span>
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm leading-relaxed shadow-sm">
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            }

                        if (m.type === 'payment_success') {
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                      Checkout Settled // Razorpay Sandbox
                    </span>
                    <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 text-white shadow-lg">
                      <p className="font-bold text-emerald-400 text-base">Payment of ₹{m.price.toLocaleString('en-IN')} confirmed!</p>
                      <p className="text-xs font-mono text-slate-400 mt-2">
                        Razorpay ID: <span className="text-cyan-400">{m.rzp_id}</span><br />
                        SKU: <span className="text-white">{m.sku}</span> | Express Dispatch Scheduled.
                      </p>
                      {m.short_url && (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <a href={m.short_url} target="_blank" rel="noopener noreferrer" 
                             className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg transition-colors">
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                              Open Live Razorpay Link
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (m.type === 'payment_declined') {
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">error</span>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                        Autonomous Recovery Protocol
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-[10px]">
                        CARD_DECLINED
                      </span>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900 border border-rose-500/30 text-white shadow-lg flex flex-col gap-3">
                      <p className="font-bold text-rose-400">Your test card transaction was declined by the issuer.</p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Concierge has saved your cart reservation for 15 minutes. Select a recovery rail below: Instant 1-Click UPI payment or direct live operator hand-off.
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-2 pt-3 border-t border-white/[0.08]">
                        <button
                          onClick={onUpiFallback}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                        >
                          <span className="material-symbols-outlined text-base">qr_code_2</span>
                          <span>1-Click Retry via UPI</span>
                        </button>
                        <button
                          onClick={onHumanEscalate}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
                        >
                          <span className="material-symbols-outlined text-base">support_agent</span>
                          <span>Escalate to Human</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (m.type === 'escalated') {
              return (
                <div key={idx} className="flex items-start gap-4 max-w-3xl animate-enter">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">support_agent</span>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                      Live Human Operations Desk
                    </span>
                    <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 text-white shadow-lg">
                      <p className="font-bold text-amber-400">Session successfully escalated to human desk.</p>
                      <p className="text-xs font-mono text-slate-400 mt-1">
                        Hand-off Packet ID: <span className="text-emerald-400">{m.ticket}</span> | Operator notified with checkout context.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}

        {isWorking && (
          <div className="flex items-center gap-2.5 text-xs font-mono text-slate-400 py-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>LangGraph agent checking policy constraints...</span>
          </div>
        )}
      </div>

      {/* Input Form matching AI Studio Screenshot */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-[#161e2e] flex items-center gap-2.5">
        <button
          type="button"
          title="Voice Command"
          className="w-10 h-10 rounded border border-[#161e2e] bg-[#05070c] text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-base">mic</span>
        </button>

        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Instruct Concierge..."
            className="w-full bg-[#05070c] border border-[#161e2e] rounded px-3.5 py-2.5 pr-16 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#2563eb] font-mono transition-colors"
          />
          <span className="absolute right-2.5 px-1.5 py-0.5 rounded border border-[#161e2e] bg-[#0d1320] text-[9px] font-mono text-slate-500 uppercase tracking-wider pointer-events-none">
            RETURN
          </span>
        </div>

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-5 py-2.5 rounded bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          <span>DISPATCH</span>
        </button>
      </form>
    </div>
  );
}
