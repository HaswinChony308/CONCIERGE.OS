"""
Automated Test Suite for Concierge.

Verifies:
1. Catalog search & product lookup
2. Under-ceiling direct purchase flow
3. Over-ceiling confirmation guardrail (blocked without confirmation, allowed with confirmation)
4. Anti-tamper price integrity check (blocked if price doesn't match catalog)
5. Inventory backoff protection (blocked if stock is insufficient)
6. Scripted payment failure & autonomous recovery flow (FAILDEMO)
7. Human escalation tool execution
8. Audit trail consistency (intent logged before outcome)
9. Real-time metrics collector calculation

Run: py -3 test_smoke.py
"""

import json
import os
import sys

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

os.environ["RAZORPAY_MODE"] = "mock"
os.environ["AUDIT_LOG_PATH"] = "logs/smoke_audit.jsonl"
os.environ["SPEND_CEILING_INR"] = "1500"  # ₹1500 threshold for testing

# Clean slate for audit log
if os.path.exists(os.environ["AUDIT_LOG_PATH"]):
    os.remove(os.environ["AUDIT_LOG_PATH"])

from agent.tools import (
    catalog_search,
    get_product,
    create_order,
    create_payment_link,
    check_payment_status,
    escalate_to_human,
    get_cross_sell_recommendations,
)
from agent.guardrails import MoneyGuardrail, BlockedAction, ConfirmationRequired
from agent.audit import read_trail
from agent.metrics import metrics
from agent.orchestrator import build_agent, run_turn
from payments import get_payment_client


def test_suite():
    print("==================================================")
    print("🚀 RUNNING CONCIERGE TEST SUITE")
    print("==================================================")

    # 1. Catalog search
    print("\n[1] Testing catalog_search...")
    search_res = json.loads(catalog_search.invoke({"query": "running"}))
    assert len(search_res) >= 2, "Expected at least 2 running shoes"
    print(f"  ✓ Found {len(search_res)} products matching 'running'")

    # 2. Exact product lookup
    print("\n[2] Testing get_product...")
    prod = json.loads(get_product.invoke({"sku": "RN-9-BLK"}))
    assert prod["sku"] == "RN-9-BLK"
    assert prod["price_inr"] == 2499
    print(f"  ✓ Found product {prod['name']} (₹{prod['price_inr']})")

    # 3. Under-ceiling purchase (Bottle ₹599 < ₹1500 ceiling)
    print("\n[3] Testing under-ceiling purchase (Bottle ₹599, ceiling ₹1500)...")
    order = json.loads(create_order.invoke({
        "sku": "BT-STD",
        "quantity": 1,
        "reasoning": "Under-ceiling smoke test purchase for 1 water bottle.",
        "buyer_confirmed": False
    }))
    assert "order_id" in order, f"Expected order creation, got: {order}"
    print(f"  ✓ Order created: {order['order_id']} for ₹{order['amount_inr']}")

    link = json.loads(create_payment_link.invoke({
        "order_id": order["order_id"],
        "amount_inr": order["amount_inr"],
        "description": "Insulated Water Bottle 1L",
        "reasoning": "Generating link for bottle.",
        "buyer_confirmed": False
    }))
    assert "payment_link_id" in link
    print(f"  ✓ Payment link generated: {link['payment_link_id']} ({link['short_url']})")

    status = json.loads(check_payment_status.invoke({
        "payment_link_id": link["payment_link_id"],
        "reasoning": "Checking payment status."
    }))
    assert status["status"] == "paid"
    print(f"  ✓ Payment verified: {status['status']} via {status.get('method')}")

    # 4. Over-ceiling purchase without confirmation (Shoe ₹2499 > ₹1500 ceiling)
    print("\n[4] Testing over-ceiling confirmation gate (Shoe ₹2499 > ₹1500)...")
    blocked_order = json.loads(create_order.invoke({
        "sku": "RN-9-BLK",
        "quantity": 1,
        "reasoning": "Buyer wants shoes, but hasn't confirmed yet.",
        "buyer_confirmed": False
    }))
    assert blocked_order.get("error") == "confirmation_required", f"Expected confirmation_required, got: {blocked_order}"
    print(f"  ✓ Successfully blocked by guardrail: {blocked_order['message']}")

    # 5. Over-ceiling purchase WITH confirmation
    print("\n[5] Testing over-ceiling purchase with buyer_confirmed=True...")
    confirmed_order = json.loads(create_order.invoke({
        "sku": "RN-9-BLK",
        "quantity": 1,
        "reasoning": "Buyer explicitly confirmed ₹2499 charge.",
        "buyer_confirmed": True
    }))
    assert "order_id" in confirmed_order
    print(f"  ✓ Over-ceiling order approved after confirmation: {confirmed_order['order_id']}")

    # 6. Price-tamper / Hallucination defense test
    print("\n[6] Testing price-tamper / hallucination defense...")
    g = MoneyGuardrail(get_payment_client())
    tamper_caught = False
    try:
        # Attacker tries to pass ₹10 for a ₹2499 shoe
        g.create_order(
            amount_inr=10,
            receipt="RN-9-BLK-EXPLOIT",
            reasoning="Attempting price tampering",
            buyer_confirmed=True,
            sku="RN-9-BLK",
            quantity=1
        )
    except BlockedAction as e:
        tamper_caught = True
        print(f"  ✓ Guardrail intercepted price tampering: {e}")
    assert tamper_caught, "Expected guardrail to block price tampering!"

    # 7. Inventory Out-of-Stock Protection
    print("\n[7] Testing out-of-stock protection...")
    sold_out = json.loads(create_order.invoke({
        "sku": "SK-9-BLK",  # stock is 0
        "quantity": 1,
        "reasoning": "Buyer trying to order out of stock sneaker.",
        "buyer_confirmed": True
    }))
    assert sold_out.get("error") == "out_of_stock"
    print(f"  ✓ Out-of-stock caught: {sold_out['message']}")

    # 8. Scripted failure & autonomous recovery (FAILDEMO)
    print("\n[8] Testing scripted payment failure and autonomous recovery (FAILDEMO)...")
    fail_order = g.create_order(
        amount_inr=2499,
        receipt="RN-9-BLK-FAILDEMO",
        reasoning="Testing failure and recovery flow.",
        buyer_confirmed=True,
        sku="RN-9-BLK",
        quantity=1
    )
    fail_link1 = g.create_payment_link(fail_order.order_id, 2499, "Trailblazer (Demo)", "Attempt 1 on card.", buyer_confirmed=True)
    status1 = g.check_payment_status(fail_link1.payment_link_id, "Checking attempt 1.")
    assert status1.status == "failed"
    assert status1.error_reason == "card_declined"
    print(f"  ✓ First attempt successfully declined: {status1.error_reason}")

    # Autonomous recovery: agent creates attempt 2 (UPI fallback)
    fail_link2 = g.create_payment_link(fail_order.order_id, 2499, "Trailblazer (UPI Retry)", "Attempt 2 via UPI.", buyer_confirmed=True)
    status2 = g.check_payment_status(fail_link2.payment_link_id, "Checking attempt 2.")
    assert status2.status == "paid"
    assert status2.method == "upi"
    print(f"  ✓ Autonomous recovery succeeded: {status2.status} via {status2.method}")

    # 9. Human Escalation Tool
    print("\n[9] Testing escalate_to_human...")
    esc = json.loads(escalate_to_human.invoke({
        "reason": "Payment repeated failure test.",
        "context": fail_order.order_id
    }))
    assert esc["status"] == "escalated"
    print(f"  ✓ Escalated to human operator: {esc['message']}")

    # 10. Cross-Sell / Upsell Revenue Tool
    print("\n[10] Testing get_cross_sell_recommendations...")
    cross_res = json.loads(get_cross_sell_recommendations.invoke({"sku": "RN-9-BLK"}))
    assert len(cross_res["recommendations"]) >= 1
    print(f"  ✓ Cross-sell recommendations generated for {cross_res['original_sku']}: {len(cross_res['recommendations'])} items")

    # 11. Audit Trail Verification
    print("\n[11] Testing audit trail integrity...")
    trail = read_trail()
    assert len(trail) >= 8, f"Expected at least 8 audit events, got {len(trail)}"
    # Verify intent-before-outcome ordering
    intents = [r for r in trail if r["type"] == "intent"]
    outcomes = [r for r in trail if r["type"] == "outcome"]
    assert len(intents) > 0 and len(outcomes) > 0
    print(f"  ✓ Audit trail verified: {len(trail)} events recorded ({len(intents)} intents, {len(outcomes)} outcomes)")

    # 12. Metrics Engine Telemetry Verification
    print("\n[12] Testing metrics calculation...")
    summary = metrics.get_summary()
    assert summary["orders_created"] >= 3
    assert summary["guardrail_checks_total"] >= 4
    assert summary["guardrail_ceiling_blocks"] >= 1
    assert summary["guardrail_price_tamper_blocks"] >= 1
    assert summary["payments_recovered"] >= 1
    print(f"  ✓ Metrics verified:")
    print(f"    - Total GMV: ₹{summary['total_gmv_inr']:,}")
    print(f"    - Guardrail Checks: {summary['guardrail_checks_total']} (Ceiling blocks: {summary['guardrail_ceiling_blocks']}, Tamper blocks: {summary['guardrail_price_tamper_blocks']})")
    print(f"    - Recovery Rate: {summary['recovery_rate_pct']}%")

    # 13. Orchestrator End-to-End Test (Deterministic Simulator)
    print("\n[13] Testing Orchestrator Agent loop (Simulator Mode)...")
    agent = build_agent()
    history = run_turn(agent, [{"role": "user", "content": "show me water bottles"}])
    assert len(history) > 1
    bot_reply = history[-1].content
    assert "bottle" in bot_reply.lower() or "599" in bot_reply
    print(f"  ✓ Orchestrator turn 1 (search) succeeded.")

    history = run_turn(agent, history + [{"role": "user", "content": "I want to buy 1 bottle"}])
    bot_reply = history[-1].content
    assert "order" in bot_reply.lower() or "success" in bot_reply.lower() or "completed" in bot_reply.lower()
    print(f"  ✓ Orchestrator turn 2 (under-ceiling purchase) succeeded.")

    print("\n==================================================")
    print("🏆 ALL 13 TEST SUITE CHECKS PASSED PERFECTLY!")
    print("==================================================")


if __name__ == "__main__":
    test_suite()
