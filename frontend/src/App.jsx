import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MetricsGrid from './components/MetricsGrid';
import TransactionVolumeChart from './components/TransactionVolumeChart';
import SearchDetailing from './components/SearchDetailing';
import BuyerTerminal from './components/BuyerTerminal';
import PolicyGuardrails from './components/PolicyGuardrails';
import LangGraphHUD from './components/LangGraphHUD';
import AuditLedger from './components/AuditLedger';
import RazorpayModal from './components/RazorpayModal';
import ProofModal from './components/ProofModal';

const DEFAULT_MESSAGES = [
  {
    type: 'rationale',
    text: 'Autonomous commerce engine initialized. I enforce deterministic policies with a hard confirmation gate before generating payment tokens. What would you like to acquire today?'
  }
];

export default function App() {
  const [ceiling, setCeiling] = useState(5000);
  const [activeMode, setActiveMode] = useState('human');
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [isWorking, setIsWorking] = useState(false);
  
  const [activeNode, setActiveNode] = useState('catalog');
  const [toolLogs, setToolLogs] = useState([
    {
      time: '14:28:44.102',
      tool: 'catalog_search',
      payload: { query: 'running shoes size 9', max_price: 3000 },
      result: 'Apex Glide 9 Pro (₹2,499)'
    },
    {
      time: '14:28:44.120',
      tool: 'policy_check',
      payload: { sku: 'RN-APX-09-BLK', amount: 2499, ceiling: 5000 },
      result: 'ALLOW_WITHIN_CEILING'
    }
  ]);

  const [metrics, setMetrics] = useState({
    total_gmv_inr: 0,
    completed_checkouts: 0,
    guardrail_ceiling_blocks: 0,
    guardrail_enforcement_rate: 100.0,
    avg_latency_ms: 18.4,
  });

  const [records, setRecords] = useState([
    {
      trace_id: 'trc_9042_c8f',
      timestamp: '14:28:44',
      mode: 'Human Interactive',
      tool: 'create_payment_link',
      amount: 2499,
      rzp_ref: 'pay_test_c8fa19',
      verdict: 'PASSED',
      proof: {
        trace_id: 'trc_9042_c8f',
        sku: 'RN-APX-09-BLK',
        amount: 2499,
        ceiling: 5000,
        policy_verdict: 'PASSED',
        state_hash: 'sha256:7f9a1c028e3b...',
        signature: '0x88fca9b2'
      }
    },
    {
      trace_id: 'trc_8831_12a',
      timestamp: '14:24:19',
      mode: 'Human Interactive',
      tool: 'policy_check',
      amount: 8999,
      rzp_ref: 'RZP_BLOCKED_LOCAL',
      verdict: 'GATED (EXCEEDS CEILING)',
      proof: {
        trace_id: 'trc_8831_12a',
        sku: 'WATCH-GPS-PRO',
        amount: 8999,
        ceiling: 5000,
        policy_verdict: 'BLOCKED_CEILING_BREACH',
        state_hash: 'sha256:4d8170c01fa9...',
        signature: '0x712fa890'
      }
    }
  ]);

  // Modals state
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [proofData, setProofData] = useState(null);
  const [isProofOpen, setIsProofOpen] = useState(false);

  // Fetch initial status & metrics from backend
  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => {
        if (data && data.total_gmv_inr !== undefined) {
          setMetrics(data);
        }
      })
      .catch(() => console.log('Using local metrics state'));

    fetch('/api/audit')
      .then(res => res.json())
      .then(data => {
        if (data && data.records) {
          setRecords(data.records);
        }
      })
      .catch(() => console.log('Using local ledger state'));
  }, []);

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    if (mode === 'recovery') {
      handleScenarioSelect('decline');
    }
  };

  const handleCeilingChange = (newVal) => {
    const val = parseInt(newVal, 10);
    setCeiling(val);

    fetch('/api/guardrail/ceiling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ceiling: val })
    })
      .then(res => res.json())
      .then(data => {
        if (data.entry) {
          setRecords(prev => [data.entry, ...prev]);
        }
      })
      .catch(() => {});

    setToolLogs(prev => [
      ...prev,
      {
        time: new Date().toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 900 + 100),
        tool: 'guardrail_threshold_update',
        payload: { new_ceiling: val },
        result: 'APPLIED_OK'
      }
    ]);
  };

  const handleSendMessage = async (text) => {
    setMessages(prev => [...prev, { type: 'buyer', text }]);
    setIsWorking(true);
    setActiveNode('catalog');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: activeMode })
      });
      const data = await res.json();
      setIsWorking(false);

      if (data.tool_logs) {
        setToolLogs(prev => [...prev, ...data.tool_logs]);
      }
      if (data.rationale) {
        setMessages(prev => [...prev, { type: 'rationale', text: data.rationale }]);
      }
      if (data.products && data.products.length > 1) {
        setMessages(prev => [...prev, { type: 'product_list', products: data.products }]);
        setActiveNode('order');
      } else if (data.product_card) {
        setMessages(prev => [...prev, { type: 'product_card', product: data.product_card }]);
        setActiveNode('order');
      }
      if (data.system_alert) {
        setMessages(prev => [...prev, { type: 'alert', title: data.system_alert.title, text: data.system_alert.message }]);
        setActiveNode('policy');
      }
      if (data.ledger_entry) {
        setRecords(prev => [data.ledger_entry, ...prev]);
      }
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      // Local fallback
      setTimeout(() => {
        setIsWorking(false);
        setMessages(prev => [
          ...prev,
          {
            type: 'rationale',
            text: `Processed intent: "${text}". Checked against ₹${ceiling.toLocaleString('en-IN')} spend ceiling.`
          },
          {
            type: 'product_card',
            product: {
              name: 'Apex Glide 9 Pro',
              sku: 'RN-APX-09-BLK',
              price: 2499,
              desc: 'Trail-optimized Vibram outsole, dual-density responsive foam, UK 9 standard fit.',
              image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUIIFA4CTrxUwxe7nsYlPBV2pHCLToy7DnAglQWhluIi0vwPxDroeHyyJbkvi89tyApmozzc0fSBBrY018wHkjHEWFvW8xaPsuufWfEL5nVo-9H3iEgMiQF7nJZZPGksD9mlyfMPdZxGK1rwO_Pzhmy_VVXKBFpMiq8KyIyRgT2fOBHOo05CiIMq6-X6TuFahx_mquaxqqdCKz4-Z29iiIWjIHGHVEiIFbv000RubqbbV-yJDJOYaWQA'
            }
          }
        ]);
      }, 500);
    }
  };

  const handleScenarioSelect = async (type) => {
    if (type === 'decline') {
      setCheckoutItem({ name: 'Apex Glide 9 Pro', sku: 'RN-APX-09-BLK', price: 2499 });
      setIsCheckoutOpen(true);
      return;
    }

    setIsWorking(true);
    setActiveNode(type === 'shoes' ? 'catalog' : 'policy');

    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: type })
      });
      const data = await res.json();
      setIsWorking(false);

      if (data.buyer_message) {
        setMessages(prev => [...prev, { type: 'buyer', text: data.buyer_message }]);
      }
      if (data.rationale) {
        setMessages(prev => [...prev, { type: 'rationale', text: data.rationale }]);
      }
      if (data.product_card) {
        setMessages(prev => [...prev, { type: 'product_card', product: data.product_card }]);
        setActiveNode('order');
      }
      if (data.system_alert) {
        setMessages(prev => [...prev, { type: 'alert', title: data.system_alert.title, text: data.system_alert.message }]);
      }
      if (data.tool_logs) {
        setToolLogs(prev => [...prev, ...data.tool_logs]);
      }
      if (data.ledger_entry) {
        setRecords(prev => [data.ledger_entry, ...prev]);
      }
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch {
      setIsWorking(false);
    }
  };

  const handleSimulateOutcome = async (status) => {
    setIsCheckoutOpen(false);
    setIsWorking(true);
    setActiveNode('pay');

    try {
      const res = await fetch('/api/payment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          name: checkoutItem.name,
          sku: checkoutItem.sku,
          price: checkoutItem.price,
          mode: activeMode
        })
      });
      const data = await res.json();
      setIsWorking(false);

      if (data.tool_logs) {
        setToolLogs(prev => [...prev, ...data.tool_logs]);
      }
      if (data.rationale) {
        setMessages(prev => [...prev, { type: 'rationale', text: data.rationale }]);
      }

      if (status === 'SUCCESS') {
        setActiveNode('audit');
        setMessages(prev => [
          ...prev,
          {
            type: 'payment_success',
            price: checkoutItem.price,
            sku: checkoutItem.sku,
            rzp_id: data.rzp_id,
            short_url: data.short_url
          }
        ]);
      } else if (status === 'DECLINED') {
        setMessages(prev => [
          ...prev,
          {
            type: 'payment_declined',
            price: checkoutItem.price,
            sku: checkoutItem.sku
          }
        ]);
      } else if (status === 'TIMEOUT') {
        setMessages(prev => [
          ...prev,
          {
            type: 'alert',
            title: data.system_alert.title,
            text: data.system_alert.message
          }
        ]);
      }

      if (data.ledger_entry) {
        setRecords(prev => [data.ledger_entry, ...prev]);
      }
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch {
      setIsWorking(false);
    }
  };

  const handleUpiFallback = async () => {
    setIsWorking(true);
    try {
      const res = await fetch('/api/recovery/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: 2499,
          sku: 'RN-APX-09-BLK',
          vpa: 'buyer@okaxis'
        })
      });
      const data = await res.json();
      setIsWorking(false);

      setMessages(prev => [
        ...prev,
        { type: 'buyer', text: 'Retry with UPI: buyer@okaxis' },
        { type: 'rationale', text: data.rationale },
        {
          type: 'payment_success',
          price: 2499,
          sku: 'RN-APX-09-BLK',
          rzp_id: data.rzp_id
        }
      ]);

      if (data.tool_logs) setToolLogs(prev => [...prev, ...data.tool_logs]);
      if (data.ledger_entry) setRecords(prev => [data.ledger_entry, ...prev]);
      if (data.metrics) setMetrics(data.metrics);
      setActiveNode('audit');
    } catch {
      setIsWorking(false);
    }
  };

  const handleHumanEscalate = async () => {
    setIsWorking(true);
    try {
      const res = await fetch('/api/recovery/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: 2499,
          sku: 'RN-APX-09-BLK'
        })
      });
      const data = await res.json();
      setIsWorking(false);

      setMessages(prev => [
        ...prev,
        { type: 'rationale', text: data.rationale },
        { type: 'escalated', ticket: data.ticket }
      ]);

      if (data.tool_logs) setToolLogs(prev => [...prev, ...data.tool_logs]);
      if (data.ledger_entry) setRecords(prev => [data.ledger_entry, ...prev]);
    } catch {
      setIsWorking(false);
    }
  };

  const handleResetSession = () => {
    setMessages([
      {
        type: 'rationale',
        text: 'Session state cleared. Choose a scenario chip above or instruct Concierge to begin autonomous checkout.'
      }
    ]);
  };

  const handleInspectPayload = (sku, price) => {
    setProofData({
      agent: "Concierge-v2.4",
      action: "create_payment_link",
      payload: {
        amount: price * 100,
        currency: "INR",
        description: "Autonomous Checkout: " + sku,
        customer: {
          name: "Session 9042",
          email: "buyer.agent9042@example.com",
          contact: "+919876543210"
        },
        notify: { sms: true, email: true },
        notes: {
          guardrail_ceiling: ceiling,
          pre_action_verified: true,
          deterministic_latency_ms: 18.4
        }
      }
    });
    setIsProofOpen(true);
  };

  const handleInspectProof = (record) => {
    setProofData(record.proof || {
      trace_id: record.trace_id,
      timestamp: new Date().toISOString(),
      tool: record.tool,
      amount: record.amount,
      verdict: record.verdict,
      guardrail_matrix: {
        ceiling_rule: "PASS",
        confirm_gate: "USER_CLICK_AUTHORIZED",
        hmac_verified: true
      }
    });
    setIsProofOpen(true);
  };

  const handleDownloadJsonl = () => {
    window.open('/api/audit/download', '_blank');
  };

  const handlePingLedger = () => {
    fetch('/api/audit')
      .then(res => res.json())
      .then(data => {
        if (data && data.records) setRecords(data.records);
      })
      .catch(() => {});
  };

  const handleNavigate = (section) => {
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 p-4 lg:p-6 flex flex-col gap-4 max-w-[1700px] mx-auto">
      <Header
        ceiling={ceiling}
        activeMode={activeMode}
        onModeChange={handleModeChange}
        onNavigate={handleNavigate}
      />

      <MetricsGrid
        metrics={metrics}
        ceiling={ceiling}
        activeMode={activeMode}
        onModeChange={handleModeChange}
      />

      {/* Row 2: Transaction Volume (8 cols) & Search Detailing (4 cols) matching AI Studio */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8">
          <TransactionVolumeChart />
        </div>
        <div className="lg:col-span-4">
          <SearchDetailing onSelectQuery={(q) => handleSendMessage(q)} />
        </div>
      </section>

      {/* Row 3: Buyer Terminal (7 cols) & Guardrails + Execution Stream (5 cols) */}
      <section id="terminal" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (7 cols): Terminal Stream */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <BuyerTerminal
            activeMode={activeMode}
            onModeChange={handleModeChange}
            ceiling={ceiling}
            messages={messages}
            onSendMessage={handleSendMessage}
            onScenarioSelect={handleScenarioSelect}
            onOpenCheckout={(item) => {
              setCheckoutItem(item);
              setIsCheckoutOpen(true);
            }}
            onInspectPayload={handleInspectPayload}
            onUpiFallback={handleUpiFallback}
            onHumanEscalate={handleHumanEscalate}
            onResetSession={handleResetSession}
            isWorking={isWorking}
          />
        </div>

        {/* Right Column (5 cols): Guardrails & LangGraph Telemetry */}
        <div id="policy" className="lg:col-span-5 flex flex-col gap-4">
          <PolicyGuardrails
            ceiling={ceiling}
            onCeilingChange={handleCeilingChange}
          />

          <LangGraphHUD
            toolLogs={toolLogs}
            activeNode={activeNode}
          />
        </div>
      </section>

      {/* Row 4: Verifiable Append-Only Audit Ledger */}
      <div id="ledger">
        <AuditLedger
          records={records}
          onInspectProof={handleInspectProof}
          onDownloadJsonl={handleDownloadJsonl}
          onPingLedger={handlePingLedger}
        />
      </div>

      {/* Modals */}
      <RazorpayModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        item={checkoutItem}
        onSimulateOutcome={handleSimulateOutcome}
      />

      <ProofModal
        isOpen={isProofOpen}
        onClose={() => setIsProofOpen(false)}
        proofData={proofData}
      />
    </div>
  );
}
