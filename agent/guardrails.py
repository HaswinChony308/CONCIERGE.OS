"""
Guardrail layer for Concierge.

Every money-moving call from the agent passes through here, not directly to the
payment client. Enforces:
1. Minimum/positive amount check.
2. Spend ceiling check (requires explicit buyer_confirmed flag).
3. Price & Catalog integrity check (prevents prompt injection & hallucinated prices).
4. Telemetry hooks to ConciergeMetrics and append-only audit trail.
"""

import json
import os
from typing import Optional
from agent import audit
from agent.metrics import metrics
from agent.mandates import mandates, IntentMandate, CartMandate
from payments.client import PaymentClient, OrderResult, PaymentLinkResult, PaymentStatusResult

CATALOG_PATH = os.environ.get("CATALOG_PATH", "data/catalog.json")


def get_spend_ceiling() -> int:
    return int(os.environ.get("SPEND_CEILING_INR", "2000"))


def set_spend_ceiling(ceiling: int) -> None:
    os.environ["SPEND_CEILING_INR"] = str(ceiling)


class ConfirmationRequired(Exception):
    """Raised when an action needs an explicit buyer confirmation that
    hasn't been given yet. The agent must surface this to the buyer as a
    question, not retry silently."""

    def __init__(self, amount_inr: int, description: str):
        self.amount_inr = amount_inr
        self.description = description
        ceiling = get_spend_ceiling()
        super().__init__(
            f"Confirmation required: {description} for ₹{amount_inr:,} "
            f"exceeds no-confirmation ceiling of ₹{ceiling:,}."
        )


class BlockedAction(Exception):
    """Raised for malformed, price-tampered, or clearly invalid requests that
    never reach the payment gateway at all."""
    pass


class MoneyGuardrail:
    def __init__(self, client: PaymentClient):
        self._client = client
        self._link_amounts = {}

    def _verify_catalog_price(self, sku: str, quantity: int, amount_inr: int):
        """Zero-hallucination / Anti-tamper verification."""
        if not os.path.exists(CATALOG_PATH):
            return
        with open(CATALOG_PATH, "r") as f:
            catalog = json.load(f)
        product = next((p for p in catalog if p["sku"] == sku), None)
        if product:
            expected_amount = product["price_inr"] * quantity
            if amount_inr != expected_amount:
                metrics.record_guardrail_check(
                    action="create_order",
                    status="price_tamper_blocked",
                    amount_inr=amount_inr,
                    details=f"Price mismatch: expected ₹{expected_amount}, received ₹{amount_inr}",
                )
                raise BlockedAction(
                    f"Price integrity check failed: SKU {sku} x {quantity} should be ₹{expected_amount}, "
                    f"but agent requested ₹{amount_inr}."
                )

    def create_order(
        self,
        amount_inr: int,
        receipt: str,
        reasoning: str,
        buyer_confirmed: bool = False,
        sku: str = "",
        quantity: int = 1,
        cart_mandate_id: Optional[str] = None,
        cart_mandate: Optional[CartMandate] = None
    ) -> OrderResult:
        ceiling = get_spend_ceiling()

        if amount_inr <= 0:
            metrics.record_guardrail_check(
                action="create_order", status="anomaly_blocked", amount_inr=amount_inr, details="Non-positive amount"
            )
            raise BlockedAction(f"Refusing non-positive order amount: ₹{amount_inr}")

        if sku:
            self._verify_catalog_price(sku, quantity, amount_inr)

        # 1. Mandate-Based Authorization (NPCI UAP / Google AP2)
        resolved_cart = cart_mandate or (mandates.get_cart(cart_mandate_id) if cart_mandate_id else None)
        if resolved_cart:
            valid, reason = mandates.verify_cart_mandate(resolved_cart)
            if not valid:
                metrics.record_guardrail_check(
                    action="create_order", status="mandate_blocked", amount_inr=amount_inr, details=reason
                )
                raise BlockedAction(f"Mandate verification failed: {reason}")
            metrics.record_guardrail_check(
                action="create_order", status="mandate_passed", amount_inr=amount_inr, details=f"CartMandate {resolved_cart.cart_id} HMAC verified"
            )
        else:
            # 2. Fallback check (Confirmation + Ceiling)
            if amount_inr > ceiling and not buyer_confirmed:
                metrics.record_guardrail_check(
                    action="create_order", status="ceiling_blocked", amount_inr=amount_inr, details=f"Exceeds ceiling ₹{ceiling}"
                )
                raise ConfirmationRequired(amount_inr, f"order {receipt}")
            metrics.record_guardrail_check(action="create_order", status="passed", amount_inr=amount_inr)

        mandate_params = {}
        if resolved_cart:
            mandate_params = {
                "cart_mandate_id": resolved_cart.cart_id,
                "intent_id": resolved_cart.intent_id,
                "mandate_sig": resolved_cart.signature[:16] + "..."
            }

        action_id = audit.log_intent(
            action="create_order",
            reasoning=reasoning,
            params={
                "amount_inr": amount_inr,
                "receipt": receipt,
                "sku": sku,
                "quantity": quantity,
                "buyer_confirmed": buyer_confirmed or bool(resolved_cart),
                **mandate_params
            },
        )
        try:
            result = self._client.create_order(amount_inr, receipt)
        except Exception as e:
            audit.log_outcome(action_id, "create_order", result={}, error=str(e))
            raise

        audit.log_outcome(action_id, "create_order", result=result.__dict__)
        metrics.record_order_created(result.order_id, result.amount_inr)
        return result

    def create_payment_link(
        self,
        order_id: str,
        amount_inr: int,
        description: str,
        reasoning: str,
        buyer_confirmed: bool = False,
        cart_mandate_id: Optional[str] = None,
        cart_mandate: Optional[CartMandate] = None
    ) -> PaymentLinkResult:
        ceiling = get_spend_ceiling()
        resolved_cart = cart_mandate or (mandates.get_cart(cart_mandate_id) if cart_mandate_id else None)
        if resolved_cart:
            valid, reason = mandates.verify_cart_mandate(resolved_cart)
            if not valid:
                metrics.record_guardrail_check(
                    action="create_payment_link", status="mandate_blocked", amount_inr=amount_inr, details=reason
                )
                raise BlockedAction(f"Mandate verification failed: {reason}")
            metrics.record_guardrail_check(
                action="create_payment_link", status="mandate_passed", amount_inr=amount_inr, details=f"CartMandate {resolved_cart.cart_id} HMAC verified"
            )
        else:
            if amount_inr > ceiling and not buyer_confirmed:
                metrics.record_guardrail_check(
                    action="create_payment_link", status="ceiling_blocked", amount_inr=amount_inr, details=f"Exceeds ceiling ₹{ceiling}"
                )
                raise ConfirmationRequired(amount_inr, description)
            metrics.record_guardrail_check(action="create_payment_link", status="passed", amount_inr=amount_inr)

        action_id = audit.log_intent(
            action="create_payment_link",
            reasoning=reasoning,
            params={
                "order_id": order_id,
                "amount_inr": amount_inr,
                "description": description,
                "cart_mandate_id": resolved_cart.cart_id if resolved_cart else None
            },
        )
        try:
            result = self._client.create_payment_link(order_id, amount_inr, description)
        except Exception as e:
            audit.log_outcome(action_id, "create_payment_link", result={}, error=str(e))
            raise

        audit.log_outcome(action_id, "create_payment_link", result=result.__dict__)
        self._link_amounts[result.payment_link_id] = amount_inr
        metrics.record_payment_link_created(result.payment_link_id, order_id, amount_inr)
        return result

    def check_payment_status(self, payment_link_id: str, reasoning: str, amount_inr: int = 0) -> PaymentStatusResult:
        action_id = audit.log_intent(
            action="check_payment_status",
            reasoning=reasoning,
            params={"payment_link_id": payment_link_id},
        )
        result = self._client.check_payment_status(payment_link_id)
        audit.log_outcome(action_id, "check_payment_status", result=result.__dict__)
        resolved_amount = amount_inr or self._link_amounts.get(payment_link_id, 0)
        metrics.record_payment_status(payment_link_id, result.status, amount_inr=resolved_amount)
        return result
