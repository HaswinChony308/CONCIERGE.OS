"""
In-memory mock of the Razorpay test-mode flow.

Use RAZORPAY_MODE=mock (the default) until real test keys are ready — the
agent, guardrails and audit log code do not change at all when you switch
to RazorpayTestClient later.

Any order whose `receipt` contains "FAILDEMO" will decline on its first
payment-link check and succeed on the second — this is what powers the
scripted failure-and-recovery demo described in ARCHITECTURE.md.
"""

import itertools
import time
from typing import Dict

from payments.client import (
    PaymentClient,
    OrderResult,
    PaymentLinkResult,
    PaymentStatusResult,
)


class MockRazorpayClient(PaymentClient):
    def __init__(self):
        self._order_ids = itertools.count(1)
        self._link_ids = itertools.count(1)
        self._orders: Dict[str, dict] = {}          # order_id -> {amount, receipt, attempts}
        self._links: Dict[str, dict] = {}            # payment_link_id -> {order_id, attempt_number, status, method}

    def create_order(self, amount_inr: int, receipt: str) -> OrderResult:
        order_id = f"order_MOCK{next(self._order_ids):06d}"
        self._orders[order_id] = {"amount": amount_inr, "receipt": receipt, "attempts": 0}
        return OrderResult(order_id=order_id, amount_inr=amount_inr, status="created")

    def create_payment_link(self, order_id: str, amount_inr: int, description: str) -> PaymentLinkResult:
        if order_id not in self._orders:
            raise ValueError(f"unknown order_id {order_id}")
        self._orders[order_id]["attempts"] += 1
        attempt_number = self._orders[order_id]["attempts"]

        link_id = f"plink_MOCK{next(self._link_ids):06d}"
        self._links[link_id] = {
            "order_id": order_id,
            "attempt_number": attempt_number,
            "amount_inr": amount_inr,
            "description": description,
            "status": "created",
            "method": None,
        }

        short_url = f"https://rzp.io/mock/{link_id}"
        return PaymentLinkResult(
            payment_link_id=link_id,
            order_id=order_id,
            short_url=short_url,
            status="created",
        )

    def simulate_user_payment(self, payment_link_id: str, method: str = "upi"):
        """Allows the UI demo to simulate user paying on the link."""
        if payment_link_id in self._links:
            self._links[payment_link_id]["status"] = "paid"
            self._links[payment_link_id]["method"] = method

    def check_payment_status(self, payment_link_id: str) -> PaymentStatusResult:
        if payment_link_id not in self._links:
            raise ValueError(f"unknown payment_link_id {payment_link_id}")

        link = self._links[payment_link_id]
        order = self._orders[link["order_id"]]
        is_scripted_failure = "FAILDEMO" in order["receipt"]

        # Simulate slight realistic gateway latency
        time.sleep(0.2)

        if is_scripted_failure and link["attempt_number"] == 1:
            link["status"] = "failed"
            return PaymentStatusResult(
                payment_link_id=payment_link_id,
                status="failed",
                error_reason="card_declined",
            )

        # In mock mode, if not failed, it resolves as paid
        link["status"] = "paid"
        method = "upi" if is_scripted_failure or link["attempt_number"] > 1 else "card"
        link["method"] = method

        return PaymentStatusResult(
            payment_link_id=payment_link_id,
            status="paid",
            method=method,
        )
