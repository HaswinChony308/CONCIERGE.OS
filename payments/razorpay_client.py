"""
Thin wrapper around the Razorpay Python SDK, restricted to test mode.

Swap in by setting RAZORPAY_MODE=live_test and providing
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (the *test mode* keys from the
dashboard — never live keys during the buildathon). Nothing else in the
codebase changes: agent/tools.py only ever talks to the PaymentClient
interface in payments/client.py.
"""

import os

import razorpay

from payments.client import (
    PaymentClient,
    OrderResult,
    PaymentLinkResult,
    PaymentStatusResult,
)


class RazorpayTestClient(PaymentClient):
    def __init__(self):
        key_id = os.environ["RAZORPAY_KEY_ID"]
        key_secret = os.environ["RAZORPAY_KEY_SECRET"]
        if not key_id.startswith("rzp_test_"):
            raise RuntimeError(
                "RAZORPAY_KEY_ID does not look like a test-mode key "
                "(expected it to start with 'rzp_test_'). Refusing to run "
                "against what might be a live key."
            )
        self._client = razorpay.Client(auth=(key_id, key_secret))

    def create_order(self, amount_inr: int, receipt: str) -> OrderResult:
        order = self._client.order.create(
            {
                "amount": amount_inr * 100,  # paise
                "currency": "INR",
                "receipt": receipt,
            }
        )
        return OrderResult(order_id=order["id"], amount_inr=amount_inr, status=order["status"])

    def create_payment_link(self, order_id: str, amount_inr: int, description: str) -> PaymentLinkResult:
        link = self._client.payment_link.create(
            {
                "amount": amount_inr * 100,
                "currency": "INR",
                "description": description,
                "notes": {"order_id": order_id},
            }
        )
        return PaymentLinkResult(
            payment_link_id=link["id"],
            order_id=order_id,
            short_url=link["short_url"],
            status=link["status"],
        )

    def check_payment_status(self, payment_link_id: str) -> PaymentStatusResult:
        link = self._client.payment_link.fetch(payment_link_id)
        status = link["status"]
        payments = link.get("payments") or []
        method = payments[-1].get("method") if payments else None
        error_reason = None
        if status == "failed" and payments:
            error_reason = payments[-1].get("error_reason") or "unknown"
        return PaymentStatusResult(
            payment_link_id=payment_link_id,
            status=status,
            method=method,
            error_reason=error_reason,
        )
