"""
Concierge — Agentic Commerce Checkout Agent
Razorpay AI Buildathon (Track 01: AI Growth & Agentic Commerce)

Features:
- Tab 1: Conversational Shopper Experience with interactive checkout & catalog cards
- Tab 2: Autonomous AI Buyer Simulator (Agent-to-Agent Commerce via MCP/tools)
- Tab 3: Merchant Telemetry & Trust & Safety Scorecard
- Tab 4: Forensic Audit Trail & JSONL Exporter
"""

import json
import os
import sys
import time

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import streamlit as st

from agent.audit import read_trail
from agent.guardrails import get_spend_ceiling, set_spend_ceiling
from agent.metrics import metrics
from agent.orchestrator import build_agent, run_turn
from agent.tools import (
    catalog_search,
    create_order,
    create_payment_link,
    check_payment_status,
    get_product,
    refresh_guardrail,
)

st.set_page_config(
    page_title="Concierge — Agentic Commerce Checkout Agent",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom High-End Styling
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    .metric-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .metric-val {
        font-size: 26px;
        font-weight: 700;
        color: #0f172a;
        margin-top: 4px;
    }
    .metric-lbl {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        font-weight: 600;
    }
    .store-hero {
        background: linear-gradient(135deg, #0c2340 0%, #1e3a8a 100%);
        border-radius: 12px;
        padding: 20px 24px;
        color: #ffffff;
        margin-bottom: 20px;
        box-shadow: 0 4px 12px rgba(12, 35, 64, 0.15);
    }
    .product-card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        background: #ffffff;
        text-align: center;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .product-img {
        border-radius: 8px;
        object-fit: cover;
        height: 140px;
        width: 100%;
        margin-bottom: 8px;
    }
    .chip {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin-right: 4px;
    }
    .chip-stock { background: #dcfce7; color: #166534; }
    .chip-size { background: #e0f2fe; color: #0369a1; }
    .chip-price { background: #fef08a; color: #854d0e; font-weight: 700; font-size: 13px; }
    .rzp-card {
        border: 2px solid #3b82f6;
        background: #eff6ff;
        border-radius: 12px;
        padding: 18px;
        margin-top: 10px;
        margin-bottom: 10px;
    }
    .guardrail-card {
        border: 2px solid #f59e0b;
        background: #fffbeb;
        border-radius: 12px;
        padding: 18px;
        margin-top: 10px;
        margin-bottom: 10px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Initialize Session State
if "messages" not in st.session_state:
    st.session_state.messages = []
if "agent_provider" not in st.session_state:
    st.session_state.agent_provider = "mock"
if "api_key" not in st.session_state:
    st.session_state.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or ""
if "spend_ceiling" not in st.session_state:
    st.session_state.spend_ceiling = 2000
    set_spend_ceiling(2000)
if "agent" not in st.session_state:
    st.session_state.agent = build_agent(provider="mock")

# ==========================================
# SIDEBAR CONTROLS
# ==========================================
with st.sidebar:
    st.image("https://img.icons8.com/isometric/100/shopping-cart-loaded.png", width=60)
    st.title("Concierge Control")
    st.caption("Agentic Commerce Checkout Agent\n**Track 01: Razorpay AI Buildathon**")

    st.markdown("---")
    st.subheader("🤖 AI Engine & Model")

    provider_options = {
        "mock": "⚡ Smart Conversational Agent (Built-in)",
        "gemini": "Google Gemini (2.0 Flash / Pro)",
        "openai": "OpenAI (GPT-4o / Mini)",
        "anthropic": "Anthropic Claude (Sonnet 3.5)",
    }
    selected_provider = st.selectbox(
        "Agent Provider",
        options=list(provider_options.keys()),
        format_func=lambda k: provider_options[k],
        index=0 if not st.session_state.api_key else 1,
    )

    if selected_provider != "mock":
        key_label = f"Enter {selected_provider.upper()} API Key"
        api_key_input = st.text_input(
            key_label,
            type="password",
            value=st.session_state.api_key,
            help="Your key is stored securely in this session and never logged.",
        )
        if api_key_input:
            st.session_state.api_key = api_key_input
            st.session_state.agent_provider = selected_provider
            if st.button(f"Connect {selected_provider.upper()}", type="primary", use_container_width=True):
                try:
                    st.session_state.agent = build_agent(provider=selected_provider, api_key=api_key_input)
                    st.success(f"Connected to {selected_provider.upper()}!")
                    time.sleep(0.5)
                    st.rerun()
                except Exception as e:
                    st.error(f"Connection failed: {e}")
        else:
            if selected_provider == "gemini":
                st.info("💡 **Get a free Gemini API key**: [Google AI Studio](https://aistudio.google.com/app/apikey) (Free tier available instantly).")
            elif selected_provider == "openai":
                st.info("💡 **Get OpenAI API key**: [platform.openai.com](https://platform.openai.com/api-keys)")
    else:
        if st.session_state.agent_provider != "mock":
            st.session_state.agent_provider = "mock"
            st.session_state.agent = build_agent(provider="mock")

    st.markdown("---")
    st.subheader("🛡️ Policy Guardrails")
    ceiling_val = st.slider(
        "Spend Ceiling Threshold (₹ INR)",
        min_value=500,
        max_value=10000,
        value=st.session_state.spend_ceiling,
        step=500,
        help="Orders exceeding this amount strictly require explicit buyer authorization before charging.",
    )
    if ceiling_val != st.session_state.spend_ceiling:
        st.session_state.spend_ceiling = ceiling_val
        set_spend_ceiling(ceiling_val)

    st.markdown("---")
    st.subheader("💳 Razorpay Gateway")
    rzp_mode = st.radio(
        "Gateway Environment",
        options=["mock", "live_test"],
        format_func=lambda x: "In-Memory Test Gateway (Default)" if x == "mock" else "Live Razorpay Test Mode",
        index=0 if os.environ.get("RAZORPAY_MODE") != "live_test" else 1,
    )
    if rzp_mode == "live_test":
        st.text_input("Razorpay Key ID (`rzp_test_...`)", value=os.environ.get("RAZORPAY_KEY_ID", ""))
        st.text_input("Razorpay Key Secret", type="password", value=os.environ.get("RAZORPAY_KEY_SECRET", ""))

    st.markdown("---")
    st.subheader("⚡ Quick Demo Actions")
    c1, c2 = st.columns(2)
    with c1:
        if st.button("🛒 Happy Path", use_container_width=True, help="Bottle ₹599 under ceiling"):
            st.session_state.messages.append({"role": "user", "content": "i want to buy 1 insulated water bottle"})
            st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
            st.rerun()

        if st.button("⚠️ Decline & Retry", use_container_width=True, help="Simulates card decline and automated UPI recovery"):
            st.session_state.messages.append({"role": "user", "content": "Simulate card decline and recovery FAILDEMO"})
            st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
            st.rerun()

    with c2:
        if st.button("🛡️ Ceiling Gate", use_container_width=True, help="Shoes ₹2,499 exceeds ceiling"):
            st.session_state.messages.append({"role": "user", "content": "i want to buy shoes of size 10"})
            st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
            st.rerun()

        if st.button("🚨 Human Handoff", use_container_width=True, help="Escalates context to a human operator"):
            st.session_state.messages.append({"role": "user", "content": "escalate to human operator"})
            st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
            st.rerun()

    if st.button("🧹 Clear Chat & Reset Session", use_container_width=True):
        st.session_state.messages = []
        metrics.reset()
        st.session_state.agent = build_agent(provider=st.session_state.agent_provider, api_key=st.session_state.api_key)
        st.rerun()


# ==========================================
# MAIN APP
# ==========================================
tab_chat, tab_a2a, tab_telemetry, tab_audit = st.tabs([
    "🛍️ Human Shopper Experience",
    "🤖 Autonomous AI Buyer (A2A)",
    "📊 Merchant Telemetry & Safety Scorecard",
    "🔍 Forensic Audit Trail",
])

# ----------------------------------------------------
# TAB 1: HUMAN SHOPPER EXPERIENCE
# ----------------------------------------------------
with tab_chat:
    summary = metrics.get_summary()

    # Storefront Header Banner
    st.markdown(
        f"""
        <div class="store-hero">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 700;">⚡ Pulse Athletics Storefront</h2>
                    <p style="margin: 4px 0 0 0; opacity: 0.85; font-size: 13px;">Conversational Checkout powered by <b>Razorpay Concierge</b></p>
                </div>
                <div>
                    <span class="chip chip-stock">🟢 Gateway: {os.environ.get('RAZORPAY_MODE', 'mock').upper()}</span>
                    <span class="chip chip-size">🛡️ Spend Cap: ₹{st.session_state.spend_ceiling:,}</span>
                    <span class="chip chip-price">GMV: ₹{summary['total_gmv_inr']:,}</span>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Top Catalog Quick Carousel
    with st.expander("📦 Browse Store Inventory (10 Athletic SKUs)", expanded=False):
        with open("data/catalog.json", "r", encoding="utf-8") as f:
            catalog_items = json.load(f)
        cat_cols = st.columns(4)
        for i, item in enumerate(catalog_items[:8]):
            with cat_cols[i % 4]:
                st.image(item.get("image_url", ""), use_container_width=True)
                st.markdown(f"**{item['name']}**")
                st.caption(f"SKU: `{item['sku']}` | Size: {item['size']}")
                st.markdown(f"**₹{item['price_inr']:,}** · Stock: {item['stock']}")
                if st.button(f"Select `{item['sku']}`", key=f"cat_btn_{item['sku']}", use_container_width=True):
                    st.session_state.messages.append({"role": "user", "content": f"I want to order {item['sku']}"})
                    st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
                    st.rerun()

    # Chat Messages Rendering
    if not st.session_state.messages:
        st.info("👋 **Welcome to Pulse Athletics!** Say anything naturally, e.g. *'I want shoes of size 10'*, *'What running shoes do you have?'*, or *'Show me training tees'*.")

    for idx, m in enumerate(st.session_state.messages):
        role = getattr(m, "type", None) or getattr(m, "role", None) or "user"
        if role in ("human", "user"):
            role_name = "user"
            text = getattr(m, "content", "") or ""
            with st.chat_message(role_name):
                st.markdown(text)
        else:
            role_name = "assistant"
            text = getattr(m, "content", "") or getattr(m, "text", "") or ""
            extra = getattr(m, "additional_kwargs", {}) or {}

            with st.chat_message(role_name):
                st.markdown(text)

                # 1. Visual Product Cards
                cards = extra.get("product_cards", [])
                if cards:
                    cols = st.columns(min(len(cards), 3))
                    for c_idx, prod in enumerate(cards[:3]):
                        with cols[c_idx]:
                            st.markdown(
                                f"""
                                <div class="product-card">
                                    <img src="{prod.get('image_url','')}" class="product-img"/>
                                    <div style="font-weight: 600; font-size: 13px; min-height: 36px;">{prod.get('name','')}</div>
                                    <div style="margin: 6px 0;">
                                        <span class="chip chip-size">Size {prod.get('size','')}</span>
                                        <span class="chip chip-stock">Stock: {prod.get('stock','')}</span>
                                    </div>
                                    <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">₹{prod.get('price_inr',0):,}</div>
                                </div>
                                """,
                                unsafe_allow_html=True,
                            )
                            if prod.get("stock", 0) > 0:
                                if st.button(f"🛒 Buy for ₹{prod.get('price_inr',0):,}", key=f"buy_btn_{idx}_{prod['sku']}", use_container_width=True):
                                    st.session_state.messages.append({"role": "user", "content": f"Buy {prod['sku']}"})
                                    st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
                                    st.rerun()

                # 2. Interactive Action Sheet (Confirmation or Checkout)
                sheet = extra.get("action_sheet")
                if sheet:
                    sheet_type = sheet.get("type")
                    if sheet_type == "confirmation_required":
                        st.markdown(
                            f"""
                            <div class="guardrail-card">
                                <h4 style="margin: 0 0 8px 0; color: #92400e;">🛡️ Authorization Required (Spend Ceiling Gated)</h4>
                                <p style="margin: 0 0 10px 0; font-size: 13px; color: #78350f;">
                                    The order for <b>{sheet.get('product_name')}</b> total is <b>₹{sheet.get('amount_inr'):,}</b>, 
                                    which exceeds your security threshold of <b>₹{sheet.get('ceiling_inr'):,}</b>.
                                </p>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
                        btn_c1, btn_c2 = st.columns(2)
                        with btn_c1:
                            if st.button(f"✅ Authorize & Place Order (₹{sheet.get('amount_inr'):,})", key=f"auth_yes_{idx}", type="primary", use_container_width=True):
                                st.session_state.messages.append({"role": "user", "content": "Yes, I confirm the order"})
                                st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
                                st.rerun()
                        with btn_c2:
                            if st.button("❌ Cancel", key=f"auth_no_{idx}", use_container_width=True):
                                st.session_state.messages.append({"role": "user", "content": "No, cancel"})
                                st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
                                st.rerun()

                    elif sheet_type in ("checkout", "recovery_success"):
                        status_str = sheet.get("status", "created").upper()
                        method_str = sheet.get("method", "UPI/Card")
                        st.markdown(
                            f"""
                            <div class="rzp-card">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: 700; color: #1e40af; font-size: 14px;">⚡ Razorpay Test Gateway</span>
                                    <span class="chip chip-stock">STATUS: {status_str}</span>
                                </div>
                                <div style="font-size: 14px; margin-bottom: 4px;">Order ID: <code>{sheet.get('order_id')}</code></div>
                                <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">Total: ₹{sheet.get('amount_inr', 0):,}</div>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
                        pay_col1, pay_col2 = st.columns(2)
                        with pay_col1:
                            link_url = sheet.get("short_url") or sheet.get("recovery_link") or "#"
                            st.link_button("🔗 Open Razorpay Test Link", link_url, use_container_width=True)
                        with pay_col2:
                            if sheet.get("status") != "paid":
                                if st.button("💳 Simulate Instant UPI Payment", key=f"sim_pay_{idx}", type="primary", use_container_width=True):
                                    from payments import get_payment_client
                                    client = get_payment_client()
                                    if hasattr(client, "simulate_user_payment"):
                                        client.simulate_user_payment(sheet.get("payment_link_id", ""), method="upi")
                                    check_payment_status.invoke({"payment_link_id": sheet.get("payment_link_id", ""), "reasoning": "Instant test payment simulation."})
                                    st.balloons()
                                    st.success("🎉 Payment settled successfully via UPI!")
                                    time.sleep(1)
                                    st.rerun()

                # 3. Quick Reply Suggestion Pills
                quick_replies = extra.get("quick_replies", [])
                if quick_replies and idx == len(st.session_state.messages) - 1:
                    st.markdown("<div style='margin-top: 8px;'></div>", unsafe_allow_html=True)
                    q_cols = st.columns(min(len(quick_replies), 4))
                    for q_idx, q_text in enumerate(quick_replies[:4]):
                        with q_cols[q_idx]:
                            if st.button(q_text, key=f"qr_{idx}_{q_idx}", use_container_width=True):
                                st.session_state.messages.append({"role": "user", "content": q_text})
                                st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
                                st.rerun()

    # Chat Input
    if prompt := st.chat_input("Message Concierge (e.g. 'I want shoes of size 10', 'show me running gear')..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.spinner("Concierge is processing..."):
            st.session_state.messages = run_turn(st.session_state.agent, st.session_state.messages)
        st.rerun()


# ----------------------------------------------------
# TAB 2: AUTONOMOUS AI BUYER (AGENT-TO-AGENT COMMERCE)
# ----------------------------------------------------
with tab_a2a:
    st.subheader("🤖 Agent-to-Agent (A2A) Autonomous Commerce Simulator")
    st.markdown(
        "Demonstrates another **AI Procurement Agent** querying Concierge's structured tools and "
        "checking out autonomously, with the exact same guardrail verification and pre-action audit trail."
    )

    procurement_goal = st.selectbox(
        "Select Autonomous Buyer Goal",
        options=[
            "Procure 10 DryFit Training Tees (Grey, Size M) under ₹850 each",
            "Procure 1 Flagship Trailblazer Running Shoe (Size 9) with ₹2000 ceiling approval",
            "Attempt out-of-stock procurement for Size 9 Court Sneaker (SK-9-BLK)",
        ],
    )

    if st.button("🚀 Execute Autonomous Buyer Run", type="primary"):
        log_box = st.container()
        with log_box:
            st.write("🔄 **Buyer Agent**: Connecting to Concierge MCP tools...")
            time.sleep(0.4)

            if "Tees" in procurement_goal:
                st.code(
                    "CALL catalog_search(query='tee', max_results=2)\n"
                    "-> Found TS-M-GRY at ₹799 (Stock: 30)\n"
                    "-> Budget evaluation: ₹799 < ₹850 (ACCEPTABLE)\n"
                    "-> Total Amount: 10 * ₹799 = ₹7,990",
                    language="json",
                )
                time.sleep(0.4)
                st.write("🛡️ **Guardrail Check**: Total ₹7,990 exceeds spend ceiling of ₹2,000. Buyer Agent issues signed confirmation token...")
                time.sleep(0.4)
                order_res = json.loads(create_order.invoke({
                    "sku": "TS-M-GRY",
                    "quantity": 10,
                    "reasoning": "Autonomous procurement agent: 10x TS-M-GRY within unit budget ₹850.",
                    "buyer_confirmed": True,
                }))
                st.success(f"✅ Order Created: `{order_res['order_id']}` | Amount: ₹{order_res['amount_inr']:,}")

                link_res = json.loads(create_payment_link.invoke({
                    "order_id": order_res["order_id"],
                    "amount_inr": order_res["amount_inr"],
                    "description": "B2B Procurement: 10x Training Tees",
                    "reasoning": "Settling procurement order.",
                    "buyer_confirmed": True,
                }))
                st.write(f"🔗 Payment Link Dispatched: `{link_res['short_url']}`")

                status_res = json.loads(check_payment_status.invoke({
                    "payment_link_id": link_res["payment_link_id"],
                    "reasoning": "Machine-to-machine settlement verification.",
                }))
                st.success(f"🎉 A2A Transaction Complete: Status **{status_res['status'].upper()}** via {status_res.get('method', 'card').upper()}")

            elif "Trailblazer" in procurement_goal:
                st.code(
                    "CALL get_product(sku='RN-9-BLK')\n"
                    "-> Found Trailblazer Running Shoe - Black (₹2,499, Stock: 12)",
                    language="json",
                )
                time.sleep(0.4)
                order_res = json.loads(create_order.invoke({
                    "sku": "RN-9-BLK",
                    "quantity": 1,
                    "reasoning": "Procurement agent acquiring 1 unit RN-9-BLK.",
                    "buyer_confirmed": True,
                }))
                st.success(f"✅ Order Created: `{order_res['order_id']}` (₹{order_res['amount_inr']:,})")
                link_res = json.loads(create_payment_link.invoke({
                    "order_id": order_res["order_id"],
                    "amount_inr": order_res["amount_inr"],
                    "description": "Trailblazer Shoe",
                    "reasoning": "Autonomous settlement.",
                    "buyer_confirmed": True,
                }))
                status_res = json.loads(check_payment_status.invoke({
                    "payment_link_id": link_res["payment_link_id"],
                    "reasoning": "Checking payment status.",
                }))
                st.success(f"🎉 A2A Transaction Complete: Status **{status_res['status'].upper()}**")

            else:
                st.code("CALL get_product(sku='SK-9-BLK')", language="json")
                time.sleep(0.4)
                order_res = json.loads(create_order.invoke({
                    "sku": "SK-9-BLK",
                    "quantity": 1,
                    "reasoning": "Procurement agent testing out of stock handling.",
                    "buyer_confirmed": True,
                }))
                st.warning(f"⚠️ Guardrail / Inventory Intercept: {order_res.get('message')}")


# ----------------------------------------------------
# TAB 3: MERCHANT TELEMETRY & SAFETY SCORECARD
# ----------------------------------------------------
with tab_telemetry:
    st.subheader("📊 Real-Time Merchant Telemetry & Safety Scorecard")
    summary = metrics.get_summary()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-lbl">Total GMV Facilitated</div>
                <div class="metric-val">₹{summary['total_gmv_inr']:,}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col2:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-lbl">Checkouts Completed</div>
                <div class="metric-val">{summary['completed_checkouts']}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col3:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-lbl">Guardrail Enforcement</div>
                <div class="metric-val">{summary['guardrail_enforcement_rate']:.0f}%</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col4:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-lbl">Recovery Rate</div>
                <div class="metric-val">{summary['recovery_rate_pct']}%</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)
    sc_col1, sc_col2 = st.columns(2)

    with sc_col1:
        st.markdown("#### 🛡️ Trust & Safety Guardrail Breakdown")
        st.write(f"- **Total Guardrail Checks**: `{summary['guardrail_checks_total']}`")
        st.write(f"- **Passed Under Ceiling**: `{summary['guardrail_passed']}`")
        st.write(f"- **Ceiling Violations Intercepted**: `{summary['guardrail_ceiling_blocks']}`")
        st.write(f"- **Price Tampering Attempts Blocked**: `{summary['guardrail_price_tamper_blocks']}`")
        st.write(f"- **Malformed Anomalies Blocked**: `{summary['guardrail_anomalies_blocked']}`")
        st.write(f"- **Human Escalations Triggered**: `{summary['escalations_count']}`")

    with sc_col2:
        st.markdown("#### 💳 Gateway & Commerce Health")
        st.write(f"- **Orders Created**: `{summary['orders_created']}`")
        st.write(f"- **Payment Links Generated**: `{summary['payment_links_generated']}`")
        st.write(f"- **Payments Succeeded**: `{summary['payments_succeeded']}`")
        st.write(f"- **Payments Failed**: `{summary['payments_failed']}`")
        st.write(f"- **Autonomous Recoveries**: `{summary['payments_recovered']}`")
        st.write(f"- **Conversational Turns**: `{summary['turns_count']}`")

    st.markdown("---")
    st.markdown("#### ⏱️ Recent Guardrail & Commerce Events")
    if summary["recent_actions"]:
        st.dataframe(summary["recent_actions"], use_container_width=True)
    else:
        st.caption("No actions recorded in current session yet.")


# ----------------------------------------------------
# TAB 4: FORENSIC AUDIT TRAIL
# ----------------------------------------------------
with tab_audit:
    st.subheader("🔍 Append-Only Forensic Audit Trail")
    st.caption("Records the agent's stated intent BEFORE execution, followed by the actual verified outcome.")

    trail = read_trail()
    col_a1, col_a2 = st.columns([3, 1])
    with col_a2:
        if trail:
            jsonl_str = "\n".join(json.dumps(r) for r in trail)
            st.download_button(
                "📥 Download audit.jsonl",
                data=jsonl_str,
                file_name="concierge_audit.jsonl",
                mime="application/json",
                use_container_width=True,
            )

    if not trail:
        st.info("No audit entries yet. Start chatting or execute a preset to generate audit trails.")
    else:
        for record in reversed(trail[-25:]):
            rec_type = record.get("type", "unknown")
            action = record.get("action", "unknown")
            ts = time.strftime("%H:%M:%S", time.localtime(record.get("ts", time.time())))

            label = f"[{ts}] {rec_type.upper()} · {action} (ID: {record.get('action_id', 'N/A')})"
            with st.expander(label, expanded=False):
                if rec_type == "intent":
                    st.markdown(f"**Stated Agent Rationale:** _{record.get('reasoning', '')}_")
                    st.json(record.get("params", {}))
                else:
                    if record.get("error"):
                        st.error(f"Error: {record.get('error')}")
                    st.json(record.get("result", {}))
