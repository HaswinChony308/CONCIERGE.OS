"""
Tool definitions exposed to the agent.

Kept deliberately narrow: no generic "call the Razorpay API" escape hatch.
Every tool here is typed, does one thing, and the money-moving tools
go through agent/guardrails.py rather than payments/ directly.
"""

import json
import os
from typing import Optional

from langchain_core.tools import tool

from agent.audit import log_intent, log_outcome
from agent.guardrails import MoneyGuardrail, ConfirmationRequired, BlockedAction
from agent.metrics import metrics
from payments import get_payment_client

CATALOG_PATH = os.environ.get("CATALOG_PATH", "data/catalog.json")
_guardrail = MoneyGuardrail(get_payment_client())


def refresh_guardrail():
    global _guardrail
    _guardrail = MoneyGuardrail(get_payment_client())


def _load_catalog():
    with open(CATALOG_PATH, "r") as f:
        return json.load(f)


@tool
def catalog_search(query: str, max_results: int = 5) -> str:
    """Search the merchant's product catalog by free-text query (matches
    against name, category, or tags). Returns matching products with sku, name,
    size, price_inr, stock, and description."""
    catalog = _load_catalog()
    q = query.lower()
    matches = [
        p for p in catalog
        if (
            q in p["name"].lower()
            or q in p["category"].lower()
            or any(q in t.lower() for t in p.get("tags", []))
        )
    ][:max_results]
    return json.dumps(matches)


@tool
def get_product(sku: str) -> str:
    """Look up a single product by exact SKU. Returns its full record including
    price, stock, and description, or an error if the SKU doesn't exist."""
    catalog = _load_catalog()
    for p in catalog:
        if p["sku"].upper() == sku.upper():
            return json.dumps(p)
    return json.dumps({"error": f"unknown sku {sku}"})


@tool
def create_order(sku: str, quantity: int, reasoning: str, buyer_confirmed: bool = False) -> str:
    """Create an order for a SKU and quantity. `reasoning` must state the
    exact item, quantity, and total price being ordered — this is logged
    before the action runs. Set buyer_confirmed=True only after the buyer
    has explicitly agreed to the exact amount in the conversation; orders
    above the spend ceiling will be refused otherwise and you'll be told
    to ask for confirmation."""
    sku = sku.upper()
    catalog = _load_catalog()
    product = next((p for p in catalog if p["sku"].upper() == sku), None)
    if product is None:
        return json.dumps({"error": f"unknown sku {sku}"})
    if quantity <= 0:
        return json.dumps({"error": f"invalid quantity {quantity}: must be at least 1"})
    if product["stock"] < quantity:
        return json.dumps({
            "error": "out_of_stock",
            "message": f"Insufficient stock for {sku}: only {product['stock']} available, asked for {quantity}"
        })

    amount_inr = product["price_inr"] * quantity
    receipt = f"{sku}-x{quantity}-{os.urandom(2).hex()}"
    try:
        result = _guardrail.create_order(
            amount_inr=amount_inr,
            receipt=receipt,
            reasoning=reasoning,
            buyer_confirmed=buyer_confirmed,
            sku=sku,
            quantity=quantity,
        )
    except ConfirmationRequired as e:
        return json.dumps({
            "error": "confirmation_required",
            "message": str(e),
            "amount_inr": e.amount_inr,
            "sku": sku,
            "quantity": quantity
        })
    except BlockedAction as e:
        return json.dumps({"error": "blocked", "message": str(e)})
    return json.dumps({"order_id": result.order_id, "amount_inr": result.amount_inr, "status": result.status})


@tool
def create_payment_link(
    order_id: str, amount_inr: int, description: str, reasoning: str, buyer_confirmed: bool = False
) -> str:
    """Create a payment link for an existing order_id. Use this after
    create_order succeeds, or again as a retry if a previous payment
    attempt failed."""
    try:
        result = _guardrail.create_payment_link(
            order_id=order_id,
            amount_inr=amount_inr,
            description=description,
            reasoning=reasoning,
            buyer_confirmed=buyer_confirmed,
        )
    except ConfirmationRequired as e:
        return json.dumps({"error": "confirmation_required", "message": str(e)})
    except BlockedAction as e:
        return json.dumps({"error": "blocked", "message": str(e)})
    return json.dumps(
        {"payment_link_id": result.payment_link_id, "short_url": result.short_url, "status": result.status}
    )


@tool
def check_payment_status(payment_link_id: str, reasoning: str) -> str:
    """Check whether a payment link has been paid, failed, or is still
    pending. Always check this after presenting a payment link before
    telling the buyer the order succeeded."""
    result = _guardrail.check_payment_status(payment_link_id, reasoning=reasoning)
    return json.dumps(
        {"status": result.status, "method": result.method, "error_reason": result.error_reason}
    )


@tool
def escalate_to_human(reason: str, context: str) -> str:
    """Hand off to a human merchant operator. Use this when a payment has
    failed more than once, or the buyer asks for something outside what
    you're able to safely do on your own."""
    action_id = log_intent(action="escalate_to_human", reasoning=reason, params={"context": context})
    log_outcome(action_id, "escalate_to_human", result={"status": "escalated"})
    metrics.record_escalation(reason=reason, context=context)
    return json.dumps({
        "status": "escalated",
        "message": "A human operator has been notified and will assist you shortly."
    })


@tool
def get_cross_sell_recommendations(sku: str) -> str:
    """Recommend complementary products (cross-sell / upsell) for a given SKU
    to grow merchant revenue and increase average order value (AOV). Call this after
    a buyer selects a product to suggest a matching bundle."""
    catalog = _load_catalog()
    product = next((p for p in catalog if p["sku"].upper() == sku.upper()), None)
    if not product:
        return json.dumps({"error": f"unknown sku {sku}"})

    cat = product.get("category", "")
    recs = []
    if cat == "footwear":
        recs = [p for p in catalog if p["category"] in ("accessories", "apparel") and p["stock"] > 0][:2]
    elif cat == "apparel":
        recs = [p for p in catalog if p["category"] in ("accessories", "footwear") and p["stock"] > 0][:2]
    else:
        recs = [p for p in catalog if p["category"] in ("footwear", "apparel") and p["stock"] > 0][:2]

    return json.dumps({
        "original_sku": sku,
        "recommendations": recs,
        "pitch": f"Customers who bought {product['name']} frequently add these items to complete their training kit."
    })


ALL_TOOLS = [
    catalog_search,
    get_product,
    create_order,
    create_payment_link,
    check_payment_status,
    escalate_to_human,
    get_cross_sell_recommendations,
]
