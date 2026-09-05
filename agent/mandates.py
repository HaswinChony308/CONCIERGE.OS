"""
agent/mandates.py

Reference implementation of the Mandate authorization pattern converging across:
1. NPCI Unified Agent Protocol (UAP) - Pre-authorized scoped consent & spend allowances for agentic UPI.
2. Google Agent Payments Protocol (AP2) - Non-repudiable Intent Mandates and Cart Mandates.
3. Stripe / OpenAI Agent Commerce Protocol (ACP) - Time-bound per-merchant allowance tokens.

Provides:
- IntentMandate: Buyer-defined scope, spend limit, expiry, and HMAC-SHA256 signature.
- CartMandate: Exact SKU, quantity, price, and category bound to a parent IntentMandate.
- Cryptographic verification preventing black-box LLM bypass or prompt injection.
"""

import os
import hmac
import hashlib
import time
import json
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Tuple, Any

# HMAC Secret key from environment or fallback default
MANDATE_SECRET = os.environ.get("MANDATE_SECRET_KEY", "concierge_ap2_uap_secret_key_mid_dev_9024").encode("utf-8")
MERCHANT_ID = os.environ.get("MERCHANT_ID", "mid_dev_9024")
DEFAULT_MANDATE_TTL_SECONDS = int(os.environ.get("MANDATE_TTL_SECONDS", "900"))  # 15 minutes


@dataclass
class IntentMandate:
    intent_id: str          # e.g., "int_9024_a8f1"
    merchant_id: str        # e.g., "mid_dev_9024"
    scope: str              # e.g., "footwear", "apparel", "hydration", or "*"
    max_amount_inr: int     # e.g., 3000
    issued_at: float        # Unix timestamp
    expires_at: float       # Unix timestamp
    signature: str          # HMAC-SHA256 hex digest

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CartMandate:
    cart_id: str            # e.g., "crt_4412_91ca"
    intent_id: str          # Foreign key to parent IntentMandate
    merchant_id: str        # e.g., "mid_dev_9024"
    sku: str                # e.g., "RN-9-BLK"
    quantity: int           # e.g., 1
    total_inr: int          # e.g., 2499
    category: str           # e.g., "Footwear"
    issued_at: float        # Unix timestamp
    signature: str          # HMAC-SHA256 hex digest

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def canonical_intent_string(
    intent_id: str,
    merchant_id: str,
    scope: str,
    max_amount_inr: int,
    issued_at: int,
    expires_at: int
) -> str:
    """Canonical RFC-compliant string representation for Intent Mandate signing."""
    return f"uap.intent.v1|merchant:{merchant_id}|id:{intent_id}|scope:{scope.lower()}|max_inr:{max_amount_inr}|iat:{issued_at}|exp:{expires_at}"


def canonical_cart_string(
    cart_id: str,
    intent_id: str,
    merchant_id: str,
    sku: str,
    quantity: int,
    total_inr: int,
    category: str,
    issued_at: int
) -> str:
    """Canonical RFC-compliant string representation for Cart Mandate signing."""
    return f"uap.cart.v1|merchant:{merchant_id}|id:{cart_id}|intent_id:{intent_id}|sku:{sku}|qty:{quantity}|total_inr:{total_inr}|cat:{category.lower()}|iat:{issued_at}"


def compute_hmac(canonical_payload: str) -> str:
    """Computes HMAC-SHA256 hex digest over canonical payload string."""
    return hmac.new(MANDATE_SECRET, canonical_payload.encode("utf-8"), hashlib.sha256).hexdigest()


class MandateRegistry:
    """In-memory verifiable registry of issued mandates."""

    def __init__(self):
        self._intents: Dict[str, IntentMandate] = {}
        self._carts: Dict[str, CartMandate] = {}

    def issue_intent_mandate(
        self,
        scope: str = "*",
        max_amount_inr: int = 5000,
        ttl_seconds: int = DEFAULT_MANDATE_TTL_SECONDS,
        intent_id: Optional[str] = None
    ) -> IntentMandate:
        now = time.time()
        iat = int(now)
        exp = int(now + ttl_seconds)
        iid = intent_id or f"int_{int(now*1000)%1000000}_{os.urandom(2).hex()}"
        
        canonical = canonical_intent_string(
            intent_id=iid,
            merchant_id=MERCHANT_ID,
            scope=scope,
            max_amount_inr=max_amount_inr,
            issued_at=iat,
            expires_at=exp
        )
        sig = compute_hmac(canonical)
        
        mandate = IntentMandate(
            intent_id=iid,
            merchant_id=MERCHANT_ID,
            scope=scope,
            max_amount_inr=max_amount_inr,
            issued_at=now,
            expires_at=now + ttl_seconds,
            signature=sig
        )
        self._intents[iid] = mandate
        return mandate

    def issue_cart_mandate(
        self,
        intent: IntentMandate,
        sku: str,
        total_inr: int,
        quantity: int = 1,
        category: str = "General",
        cart_id: Optional[str] = None
    ) -> CartMandate:
        # Pre-validate before issuing
        valid, reason = self.verify_intent_mandate(intent)
        if not valid:
            raise ValueError(f"Cannot issue CartMandate on invalid IntentMandate: {reason}")
        
        if total_inr > intent.max_amount_inr:
            raise ValueError(
                f"Cart total Rs {total_inr:,} breaches IntentMandate spending limit Rs {intent.max_amount_inr:,}"
            )
        
        # Verify scope if not wildcard
        if intent.scope != "*" and intent.scope.lower() not in category.lower() and category.lower() not in intent.scope.lower():
            raise ValueError(
                f"Cart item category '{category}' is outside IntentMandate authorized scope '{intent.scope}'"
            )

        now = time.time()
        iat = int(now)
        cid = cart_id or f"crt_{int(now*1000)%1000000}_{os.urandom(2).hex()}"

        canonical = canonical_cart_string(
            cart_id=cid,
            intent_id=intent.intent_id,
            merchant_id=MERCHANT_ID,
            sku=sku,
            quantity=quantity,
            total_inr=total_inr,
            category=category,
            issued_at=iat
        )
        sig = compute_hmac(canonical)

        mandate = CartMandate(
            cart_id=cid,
            intent_id=intent.intent_id,
            merchant_id=MERCHANT_ID,
            sku=sku,
            quantity=quantity,
            total_inr=total_inr,
            category=category,
            issued_at=now,
            signature=sig
        )
        self._carts[cid] = mandate
        return mandate

    def verify_intent_mandate(self, intent: IntentMandate) -> Tuple[bool, str]:
        """Cryptographically verifies an IntentMandate signature and expiry."""
        now = time.time()
        if now > intent.expires_at:
            return False, f"IntentMandate expired at {time.strftime('%H:%M:%S', time.localtime(intent.expires_at))}"

        expected_canonical = canonical_intent_string(
            intent_id=intent.intent_id,
            merchant_id=intent.merchant_id,
            scope=intent.scope,
            max_amount_inr=intent.max_amount_inr,
            issued_at=int(intent.issued_at),
            expires_at=int(intent.expires_at)
        )
        expected_sig = compute_hmac(expected_canonical)

        if not hmac.compare_digest(intent.signature, expected_sig):
            return False, "Cryptographic HMAC-SHA256 signature verification failed (Tampered IntentMandate)"

        return True, "VALID_INTENT_MANDATE"

    def verify_cart_mandate(self, cart: CartMandate, intent: Optional[IntentMandate] = None) -> Tuple[bool, str]:
        """Cryptographically verifies a CartMandate against its parent IntentMandate."""
        parent_intent = intent or self._intents.get(cart.intent_id)
        if not parent_intent:
            return False, f"Parent IntentMandate '{cart.intent_id}' not found in registry"

        # Verify parent intent first
        intent_valid, intent_reason = self.verify_intent_mandate(parent_intent)
        if not intent_valid:
            return False, f"Parent IntentMandate invalid: {intent_reason}"

        # Verify cart signature
        expected_canonical = canonical_cart_string(
            cart_id=cart.cart_id,
            intent_id=cart.intent_id,
            merchant_id=cart.merchant_id,
            sku=cart.sku,
            quantity=cart.quantity,
            total_inr=cart.total_inr,
            category=cart.category,
            issued_at=int(cart.issued_at)
        )
        expected_sig = compute_hmac(expected_canonical)

        if not hmac.compare_digest(cart.signature, expected_sig):
            return False, "Cryptographic HMAC-SHA256 signature verification failed (Tampered CartMandate)"

        # Verify bounds against parent intent
        if cart.total_inr > parent_intent.max_amount_inr:
            return False, f"Cart total Rs {cart.total_inr:,} exceeds Intent ceiling Rs {parent_intent.max_amount_inr:,}"

        # Verify scope
        if parent_intent.scope != "*":
            in_scope = (
                parent_intent.scope.lower() in cart.category.lower() or
                cart.category.lower() in parent_intent.scope.lower()
            )
            if not in_scope:
                return False, f"Cart category '{cart.category}' violates Intent scope '{parent_intent.scope}'"

        return True, "VALID_CART_MANDATE"

    def get_intent(self, intent_id: str) -> Optional[IntentMandate]:
        return self._intents.get(intent_id)

    def get_cart(self, cart_id: str) -> Optional[CartMandate]:
        return self._carts.get(cart_id)


# Singleton instance for the application
mandates = MandateRegistry()
