import React, { useState, useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────
   Protocol steps that animate in sequence
───────────────────────────────────────────── */
const PROTOCOL_STEPS = [
  {
    id: 'intent',
    label: 'IntentMandate',
    icon: 'flag',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    bgColor: 'bg-cyan-500/10',
    glowColor: 'shadow-cyan-500/30',
  },
  {
    id: 'cart',
    label: 'CartMandate',
    icon: 'shopping_cart',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/10',
    glowColor: 'shadow-blue-500/30',
  },
  {
    id: 'guardrail',
    label: 'GuardrailGate',
    icon: 'shield',
    color: 'text-violet-400',
    borderColor: 'border-violet-500/40',
    bgColor: 'bg-violet-500/10',
    glowColor: 'shadow-violet-500/30',
  },
  {
    id: 'payment',
    label: 'PaymentToken',
    icon: 'bolt',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    bgColor: 'bg-emerald-500/10',
    glowColor: 'shadow-emerald-500/30',
  },
];

/* ─────────────────────────────────────────────
   Simulated protocol conversation turns
───────────────────────────────────────────── */
const PROTOCOL_TURNS = [
  {
    step: 0,
    agent: 'buyer',
    type: 'IntentMandate',
    delay: 400,
    text: 'Issuing IntentMandate for scope: Footwear. Budget ceiling ₹3,000. Requesting catalog discovery.',
    payload: {
      jsonrpc: '2.0',
      method: 'commerce.intent',
      id: 'req_m1_001',
      params: {
        mandate_type: 'IntentMandate',
        scope: 'Footwear',
        max_amount_inr: 3000,
        currency: 'INR',
        buyer_agent: 'BuyerBot-v1.2',
        hmac_sig: 'sha256:a1b2c3d4e5f6...',
        protocol: 'NPCI-UAP/1.0',
      },
    },
  },
  {
    step: 0,
    agent: 'concierge',
    type: 'IntentAck',
    delay: 900,
    text: 'IntentMandate ACCEPTED. HMAC chain verified. Scope: Footwear. Ceiling: ₹3,000. Initiating catalog search.',
    payload: {
      jsonrpc: '2.0',
      id: 'req_m1_001',
      result: {
        mandate_id: 'mnd_int_9042_a1',
        status: 'ACCEPTED',
        scope_validated: true,
        ceiling_inr: 3000,
        hmac_verified: true,
        catalog_query_dispatched: true,
      },
    },
  },
  {
    step: 1,
    agent: 'concierge',
    type: 'CartMandate',
    delay: 1600,
    text: 'Catalog match found: Apex Glide 9 Pro @ ₹2,499 — within ceiling. Issuing CartMandate for buyer approval.',
    payload: {
      jsonrpc: '2.0',
      method: 'commerce.cart',
      id: 'req_m2_001',
      params: {
        mandate_type: 'CartMandate',
        parent_mandate_id: 'mnd_int_9042_a1',
        sku: 'RN-APX-09-BLK',
        name: 'Apex Glide 9 Pro',
        total_inr: 2499,
        within_ceiling: true,
        hmac_sig: 'sha256:f9e8d7c6b5a4...',
      },
    },
  },
  {
    step: 1,
    agent: 'buyer',
    type: 'CartAck',
    delay: 2300,
    text: 'CartMandate reviewed. ₹2,499 ≤ ₹3,000 ceiling. APPROVED. Authorizing payment step.',
    payload: {
      jsonrpc: '2.0',
      id: 'req_m2_001',
      result: {
        cart_mandate_id: 'mnd_crt_9042_b2',
        buyer_authorized: true,
        amount_verified: true,
        ceiling_check: 'PASS',
        proceed_to_payment: true,
      },
    },
  },
  {
    step: 2,
    agent: 'concierge',
    type: 'GuardrailGate',
    delay: 3000,
    text: 'MoneyGuardrail evaluating. Stock confirmed. Price integrity check: PASS. HMAC chain: VALID.',
    payload: {
      jsonrpc: '2.0',
      method: 'guardrail.evaluate',
      id: 'req_g1_001',
      params: {
        intent_mandate_id: 'mnd_int_9042_a1',
        cart_mandate_id: 'mnd_crt_9042_b2',
        policy_checks: {
          spend_ceiling: 'PASS',
          price_integrity: 'PASS',
          stock_available: 'PASS',
          hmac_chain_valid: true,
        },
        verdict: 'ALLOW',
      },
    },
  },
  {
    step: 2,
    agent: 'buyer',
    type: 'GuardrailAck',
    delay: 3600,
    text: 'GuardrailGate verdict ALLOW received. All policy checks passed. Requesting payment token.',
    payload: {
      jsonrpc: '2.0',
      id: 'req_g1_001',
      result: {
        guardrail_verdict: 'ALLOW',
        all_checks_passed: true,
        audit_trace_id: 'trc_9042_c8f',
      },
    },
  },
  {
    step: 3,
    agent: 'concierge',
    type: 'PaymentToken',
    delay: 4400,
    text: 'Payment token generated. Razorpay link dispatched. Transaction complete. Audit entry appended.',
    payload: {
      jsonrpc: '2.0',
      method: 'commerce.payment',
      id: 'req_p1_001',
      params: {
        mandate_type: 'PaymentToken',
        cart_mandate_id: 'mnd_crt_9042_b2',
        rzp_order_id: 'order_test_Abc12XyzPqr',
        rzp_short_url: 'https://rzp.io/i/test-abc',
        amount_inr: 2499,
        idempotency_key: 'rcpt_RN-APX-09-BLK_mnd_crt_9042_b2',
        state_hash: 'sha256:7f9a1c028e3b...',
      },
    },
  },
  {
    step: 3,
    agent: 'buyer',
    type: 'Complete',
    delay: 5100,
    text: '✅ Protocol complete. Payment link received. Checkout executed autonomously — zero human intervention.',
    payload: {
      jsonrpc: '2.0',
      id: 'req_p1_001',
      result: {
        protocol_status: 'COMPLETE',
        payment_link_opened: true,
        human_intervention: false,
        total_latency_ms: 5100,
        audit_appended: true,
      },
    },
  },
];

/* ─────────────────────────────────────────────
   Single message bubble
───────────────────────────────────────────── */
function ProtocolBubble({ turn, onExpand }) {
  const [expanded, setExpanded] = useState(false);
  const isBuyer = turn.agent === 'buyer';

  const toggle = () => {
    setExpanded(v => !v);
    if (!expanded && onExpand) onExpand(turn);
  };

  return (
    <div className={`flex flex-col gap-1 ${isBuyer ? 'items-start' : 'items-end'} animate-in`}>
      {/* Agent label */}
      <div className={`flex items-center gap-1.5 text-[9px] font-mono tracking-widest uppercase ${isBuyer ? 'text-cyan-500' : 'text-violet-400'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isBuyer ? 'bg-cyan-400' : 'bg-violet-400'}`}
          style={{ boxShadow: isBuyer ? '0 0 6px #22d3ee' : '0 0 6px #a78bfa' }} />
        {isBuyer ? 'BuyerBot-v1.2' : 'Concierge.OS'}
        <span className="text-slate-600">·</span>
        <span className="text-slate-600">{turn.type}</span>
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[90%] rounded-xl px-3.5 py-2.5 cursor-pointer border transition-all duration-200 ${
          isBuyer
            ? 'bg-[#0b1929] border-cyan-500/20 hover:border-cyan-500/40'
            : 'bg-[#120b29] border-violet-500/20 hover:border-violet-500/40'
        }`}
        onClick={toggle}
      >
        <p className="text-[11px] text-slate-300 leading-relaxed font-mono">{turn.text}</p>

        {/* Expand hint */}
        <div className={`mt-1.5 flex items-center gap-1 text-[9px] font-mono ${isBuyer ? 'text-cyan-600' : 'text-violet-600'}`}>
          <span className="material-symbols-outlined text-[10px]">{expanded ? 'expand_less' : 'data_object'}</span>
          {expanded ? 'hide payload' : 'view json-rpc payload'}
        </div>

        {/* Payload inspector */}
        {expanded && (
          <div className="mt-2 rounded-lg bg-[#07090f] border border-[#161e2e] p-2.5 overflow-auto max-h-48">
            <pre className="text-[9px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(turn.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Protocol pipeline step node
───────────────────────────────────────────── */
function PipelineNode({ step, index, activeStep, isComplete }) {
  const isActive = index === activeStep;
  const isDone = index < activeStep || isComplete;

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      {/* Node circle */}
      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
        isDone
          ? `${step.bgColor} border-emerald-500/60 shadow-lg shadow-emerald-500/20`
          : isActive
          ? `${step.bgColor} ${step.borderColor} shadow-lg ${step.glowColor} animate-pulse`
          : 'bg-[#0b0f1a] border-[#1e2d47]'
      }`}>
        {isDone ? (
          <span className="material-symbols-outlined text-[14px] text-emerald-400">check</span>
        ) : (
          <span className={`material-symbols-outlined text-[14px] ${isActive ? step.color : 'text-slate-600'}`}>
            {step.icon}
          </span>
        )}
      </div>

      {/* Connector line (between nodes) */}
      {index < PROTOCOL_STEPS.length - 1 && (
        <div className="absolute" style={{ display: 'none' }} />
      )}

      {/* Label */}
      <span className={`text-[8px] font-mono uppercase tracking-widest text-center leading-tight ${
        isDone ? 'text-emerald-400' : isActive ? step.color : 'text-slate-600'
      }`}>
        {step.label}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main AgentProtocolPanel
───────────────────────────────────────────── */
export default function AgentProtocolPanel({ ceiling = 5000 }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [visibleTurns, setVisibleTurns] = useState([]);
  const [buyerOnline, setBuyerOnline] = useState(true);
  const [conciergeOnline, setConciergeOnline] = useState(true);
  const [latency, setLatency] = useState(0);
  const scrollRef = useRef(null);
  const timersRef = useRef([]);

  /* scroll to bottom whenever new turn arrives */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleTurns]);

  const clearAllTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  const handleRun = () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsComplete(false);
    setVisibleTurns([]);
    setActiveStep(0);
    setLatency(0);
    clearAllTimers();

    const start = Date.now();

    PROTOCOL_TURNS.forEach((turn, idx) => {
      const t = setTimeout(() => {
        setVisibleTurns(prev => [...prev, turn]);
        setActiveStep(turn.step);
        setLatency(Date.now() - start);
      }, turn.delay);
      timersRef.current.push(t);
    });

    // Mark complete after last turn
    const lastDelay = PROTOCOL_TURNS[PROTOCOL_TURNS.length - 1].delay;
    const done = setTimeout(() => {
      setIsRunning(false);
      setIsComplete(true);
      setActiveStep(PROTOCOL_STEPS.length); // past last step
    }, lastDelay + 600);
    timersRef.current.push(done);
  };

  const handleReset = () => {
    clearAllTimers();
    setIsRunning(false);
    setIsComplete(false);
    setVisibleTurns([]);
    setActiveStep(-1);
    setLatency(0);
  };

  return (
    <section className="rounded-xl border border-[#161e2e] bg-[#07090f] overflow-hidden flex flex-col">

      {/* ── Panel Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#161e2e] bg-[#0b0f1a]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
              style={{ boxShadow: '0 0 8px #22d3ee' }} />
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"
              style={{ boxShadow: '0 0 8px #a78bfa', animationDelay: '0.4s' }} />
          </div>
          <h2 className="text-[11px] font-black font-mono uppercase tracking-[0.2em] text-white">
            AI ↔ AI Protocol
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[8px] font-mono font-bold tracking-widest bg-violet-500/10 border border-violet-500/30 text-violet-400 uppercase">
            NPCI-UAP · AP2
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
              <span className="material-symbols-outlined text-[12px]">check_circle</span>
              COMPLETE · {latency}ms
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              RUNNING · {latency}ms
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={isRunning}
            className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border border-[#1e2d47] text-slate-500 hover:text-white hover:border-[#2e3d5f] transition-all disabled:opacity-30"
          >
            RESET
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
              isRunning
                ? 'bg-violet-900/30 border border-violet-500/20 text-violet-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white shadow-lg shadow-violet-900/30'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">
              {isRunning ? 'sync' : 'play_arrow'}
            </span>
            {isRunning ? 'RUNNING...' : 'RUN FULL PROTOCOL'}
          </button>
        </div>
      </div>

      {/* ── Agent Status Row ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#161e2e] bg-[#080b13]">
        {/* Buyer Agent */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0b1929] border border-cyan-500/20 flex-1">
          <span className={`w-1.5 h-1.5 rounded-full ${buyerOnline ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`}
            style={buyerOnline ? { boxShadow: '0 0 5px #22d3ee' } : {}} />
          <div>
            <div className="text-[9px] font-mono font-bold text-cyan-400 tracking-widest uppercase">BuyerBot-v1.2</div>
            <div className="text-[8px] font-mono text-slate-500">Machine Buyer · Google AP2</div>
          </div>
          <span className="ml-auto text-[8px] font-mono text-cyan-600 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
            {buyerOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Protocol arrow */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-mono text-slate-600 tracking-widest">JSON-RPC</span>
          <div className="flex items-center gap-0.5 text-slate-500">
            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          </div>
          <span className="text-[8px] font-mono text-slate-600 tracking-widest">NPCI-UAP</span>
        </div>

        {/* Concierge Agent */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#120b29] border border-violet-500/20 flex-1">
          <span className={`w-1.5 h-1.5 rounded-full ${conciergeOnline ? 'bg-violet-400 animate-pulse' : 'bg-slate-600'}`}
            style={conciergeOnline ? { boxShadow: '0 0 5px #a78bfa', animationDelay: '0.3s' } : {}} />
          <div>
            <div className="text-[9px] font-mono font-bold text-violet-400 tracking-widest uppercase">Concierge.OS</div>
            <div className="text-[8px] font-mono text-slate-500">Seller Agent · v2.4.0</div>
          </div>
          <span className="ml-auto text-[8px] font-mono text-violet-600 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
            {conciergeOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* ── Protocol Pipeline ── */}
      <div className="px-4 py-3 border-b border-[#161e2e] bg-[#07090f]">
        <div className="text-[8px] font-mono uppercase tracking-widest text-slate-600 mb-2">Mandate Pipeline</div>
        <div className="flex items-start justify-between relative">
          {/* Connector line */}
          <div className="absolute top-4 left-4 right-4 h-px bg-[#161e2e] z-0" />
          {PROTOCOL_STEPS.map((step, i) => (
            <PipelineNode
              key={step.id}
              step={step}
              index={i}
              activeStep={activeStep}
              isComplete={isComplete}
            />
          ))}
        </div>
      </div>

      {/* ── Conversation Stream ── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[280px] max-h-[380px] overflow-y-auto p-4 flex flex-col gap-3 scroll-smooth"
      >
        {visibleTurns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-[#0b0f1a] border border-[#161e2e] flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-slate-600">smart_toy</span>
            </div>
            <p className="text-[11px] font-mono text-slate-600 text-center max-w-xs leading-relaxed">
              No agents active. Press <span className="text-cyan-400 font-bold">RUN FULL PROTOCOL</span> to watch
              BuyerBot and Concierge negotiate a full autonomous checkout — zero human clicks.
            </p>
          </div>
        ) : (
          visibleTurns.map((turn, i) => (
            <ProtocolBubble key={i} turn={turn} />
          ))
        )}

        {/* Typing indicator while running */}
        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-[9px] font-mono text-slate-600">agent processing...</span>
          </div>
        )}
      </div>

      {/* ── Footer Stats ── */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[#161e2e] bg-[#080b13]">
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
          <span className="material-symbols-outlined text-[11px] text-slate-600">swap_vert</span>
          <span>{visibleTurns.length} / {PROTOCOL_TURNS.length} messages</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
          <span className="material-symbols-outlined text-[11px] text-slate-600">lock</span>
          <span>HMAC-SHA256 · All mandates cryptographically signed</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[9px] font-mono">
          <span className="text-slate-600">Ceiling:</span>
          <span className="text-blue-400 font-bold">₹{ceiling.toLocaleString('en-IN')}</span>
        </div>
        {isComplete && (
          <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
            <span className="material-symbols-outlined text-[11px]">verified</span>
            Zero human intervention
          </div>
        )}
      </div>
    </section>
  );
}
