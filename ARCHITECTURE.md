# Concierge — Agentic Commerce Checkout Agent
**Track:** AI Growth & Agentic Commerce  
**Author:** Haswin Chony Saladi  
**Status:** Buildathon Submission v1.0 — Reference Implementation  

---

## 1. Problem

A merchant on a payments platform wants an AI agent that can grow revenue by
talking to buyers — human or another AI — browsing the catalog, answering
product questions, and closing the sale end-to-end, without a human on the
merchant's side touching the checkout flow.

The hard part isn't the chat. It's making every money-moving step
**explainable, bounded, and gated**, with a clean audit trail and graceful
handling when something fails (a declined card, a bad SKU, a buyer who
changes their mind mid-checkout).

---

## 2. Product Idea

**Concierge**: an autonomous agentic commerce control center that sits in front of a
merchant's catalog and completes checkout on the payment gateway's test-mode
APIs. Two buyer types, one agent:

- **Human buyer** → chat-based conversational checkout ("show me running
  shoes under ₹3000, size 9" → agent narrows catalog, confirms, pays).
- **AI buyer** → the same agent exposed as a small set of structured,
  machine-readable tools (an "agent-readable catalog" via JSON-RPC 2.0 / MCP), so another AI agent
  can query stock/price and transact without a human in the loop.

Both flows share 100% of the underlying state graph, guardrails, and cryptographic audit log.

---

## 3. Architecture

```
                 ┌─────────────────────────┐
 Human (chat) ─▶ │                         │
                 │   Orchestrator Agent    │      ┌──────────────────┐
 AI buyer   ─▶   │   (LangGraph, tool-     │─────▶│  Guardrail /      │
 (structured     │   calling loop)         │      │  Policy Layer     │
 tool calls)     │                         │◀─────│  (spend ceiling,  │
                 └───────────┬─────────────┘      │  confirm-above-X, │
                             │                     │  blocklist)       │
                             ▼                     └──────────────────┘
                 ┌─────────────────────────┐
                 │        Tool Layer        │
                 │ catalog_search()         │
                 │ get_product()            │
                 │ create_intent_mandate()  │──▶ Mandate Store (signed,
                 │ create_cart_mandate()    │    scoped, single-use —
                 │ create_order()           │    see agent/mandates.py)
                 │ create_payment_link()    │
                 │ check_payment_status()   │
                 │ escalate_to_human()      │
                 └───────────┬─────────────┘
                             ▼
                 ┌─────────────────────────┐
                 │  Razorpay Test-Mode API  │
                 │  (Orders + Payment Links)│
                 └───────────┬─────────────┘
                             ▼
                 ┌─────────────────────────┐
                 │   Audit Log (append-only)│
                 │   every tool call +      │
                 │   agent's stated reason  │
                 │   + outcome, JSONL/BigQ  │
                 └─────────────────────────┘
```

**Why this shape:**
- The **guardrail layer sits between the agent and every money-moving tool**,
  not inside the agent's prompt — so a bad completion or prompt injection cannot bypass a spend
  cap. This is the single most important design decision for the "bounded
  and gated" bar.
- The **audit log records the agent's reasoning before the action**, not
  just the outcome — that's what makes it explainable rather than just
  logged.
- **Tools are narrow and typed** (not "call the Razorpay API generically")
  so the agent's action space is small enough to reason about and to test.

---

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Orchestration | LangChain / LangGraph + Google Gemini 3 Flash | Multi-step checkout graph with state checkpointing and instant zero-latency thinking budget |
| Backend API | Python Flask / REST + MCP JSON-RPC 2.0 | Lightweight, modular REST endpoints for live streaming UI and machine-to-machine agents |
| Frontend | React + Tailwind CSS (Cyber-Fintech Dashboard) | Real-time LangGraph HUD, dynamic guardrail ceiling slider, verifiable proof modal, and dual B2C/A2A terminal |
| Payments | Razorpay Python SDK, **test mode only** (`rzp_test_...`) | Official sandbox SDK with instant simulation fallback |
| Mandates & Proofs | HMAC-SHA256 Signed Mandates (`agent/mandates.py`) | Lightweight reference implementation of NPCI UAP and Google AP2 authorization tokens |
| Audit log | Append-only JSONL (`logs/audit_trail.jsonl`) | Cryptographically verified trail with SHA-256 state hashes and export capability |

---

## 5. Guardrails: Mandate-Based Authorization (The Part the Panel Will Probe Hardest)

**Why now, specifically:** NPCI's UAP, Google's AP2, and OpenAI/Stripe's ACP are
three independent efforts converging on the same shape — a scoped, time-bound,
explicit authorization object standing between "the buyer wants something" and
"money moved." Razorpay and NPCI already ran a live pilot (Feb 2026) putting
agentic UPI payments on Claude for Zomato/Swiggy/Zepto, using consent-based
authorization with per-merchant spending limits. Concierge implements a
lightweight version of that pattern rather than inventing an ad-hoc one:

1. **Intent Mandate** — created as soon as the buyer states what they want and
   roughly what they're willing to spend: a category scope and a max amount,
   valid for a limited time (15 minutes). This is the buyer's stated authorization boundary,
   made explicit and inspectable instead of implicit in the conversation.
2. **Cart Mandate** — created once the buyer approves a specific item and
   price, bound to a valid Intent Mandate. It can only be created inside that
   intent's category scope and under its ceiling, and it can fund exactly one
   order — reusing it a second time is refused.
3. **`create_order` requires a valid, unexpired, unconsumed Cart Mandate.**
   No boolean flag, no "trust the last thing the model said" — the guardrail
   layer verifies the mandate's signature, expiry, and single-use status
   before it will touch the payment client.
4. **System-wide ceiling as a second layer** — an Intent Mandate can't
   authorize above an operator-set ceiling regardless of what the buyer asks
   for, so there's a hard limit underneath the buyer-declared one.
5. **Both mandates are HMAC-SHA256 signed** for tamper-evidence. Honest
   framing: this is *not* full asymmetric verifiable credentials like AP2's
   actual Mandates — it's a scoped simplification appropriate for a buildathon
   build, and the pitch explicitly frames it as such.
6. **Reasoning-before-action logging** — every call to a money-moving tool is
   preceded by a one-line logged rationale, and every mandate creation,
   verification failure, and consumption is itself an audit record.

See `agent/mandates.py` for the implementation.

---

## 6. Failure Handling (Demoed on Purpose)

Pick one failure and show it end-to-end in the pitch video:

- Simulate a **declined test card** (`BAD_REQUEST_PAYMENT_DECLINED`) → agent intercepts
  the failed status via `check_payment_status`, reserves the cart inventory for 15 minutes,
  explains it in plain language, offers **1-Click Retry via UPI (`buyer@okaxis`)**, and —
  if unresolvable — calls `escalate_to_human` (`ESC_9042_OPS`) and logs the full attempt chain.

This scripted failure-and-recovery fulfills the Track 01 mandate: "one failure handled gracefully."

---

## 7. Submission Checklist

- [x] Public GitHub repo with this architecture doc as `ARCHITECTURE.md`
- [x] Full-Stack working codebase with `server.py`, `frontend/`, and `agent/mandates.py`
- [x] README with setup + recorded screenshots of the flow
- [x] Honest "What Broke and How I Fixed It" documentation
- [ ] 5-minute pitch video recorded using `demo_video_blueprint.md`

---

## 8. Resolution to Open Question: B2C vs A2A Demo Star

**The Strategy**:
1. **B2C Conversational Checkout (Hero Flow - 70% of video)**:
   - Shows human buyer talking to Gemini 3 Flash.
   - Shows Intent Mandate creation, Cart Mandate binding, and spend ceiling enforcement.
   - Shows live Razorpay test-mode checkout link (`rzp.io`) and card decline recovery.
2. **A2A Tool Negotiation (Climax Showcase - 30% of video)**:
   - Toggle to `A2A Tool (M2M)` in the UI.
   - Demonstrates that the exact same mandate validation and Razorpay settlement engine powers machine procurement via JSON-RPC 2.0.
