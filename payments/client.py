"""
Payment client interface.

Both the mock and real Razorpay-backed clients implement this exact
surface, so the agent's tools never know or care which one they're
talking to. That's what lets us build and demo the whole flow before
test-mode keys exist, then flip one env var once they do.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class OrderResult:
    order_id: str
    amount_inr: int
    status: str  # "created"


@dataclass
class PaymentLinkResult:
    payment_link_id: str
    order_id: str
    short_url: str
    status: str  # "created"


@dataclass
class PaymentStatusResult:
    payment_link_id: str
    status: str  # "created" | "paid" | "failed" | "expired"
    method: Optional[str] = None
    error_reason: Optional[str] = None


class PaymentClient(ABC):
    @abstractmethod
    def create_order(self, amount_inr: int, receipt: str) -> OrderResult:
        ...

    @abstractmethod
    def create_payment_link(self, order_id: str, amount_inr: int, description: str) -> PaymentLinkResult:
        ...

    @abstractmethod
    def check_payment_status(self, payment_link_id: str) -> PaymentStatusResult:
        ...
