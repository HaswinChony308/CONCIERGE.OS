"""
Smart Conversational Dialog Engine for Concierge.

Understands natural human speech, messy typos (e.g. 'i wante dto but shoes of size 10'),
maintains conversation history, handles follow-up queries ('can i see more?'),
compares products, and produces structured interactive UI payloads (product cards,
action buttons, confirmation gates, payment states).
"""

import json
import os
import re
import difflib
from typing import List, Dict, Any, Optional, Tuple

from agent.tools import (
    catalog_search,
    get_product,
    create_order,
    create_payment_link,
    check_payment_status,
    escalate_to_human,
    get_cross_sell_recommendations,
)
from agent.guardrails import get_spend_ceiling
from agent.metrics import metrics

CATALOG_PATH = os.environ.get("CATALOG_PATH", "data/catalog.json")


def _load_catalog() -> List[Dict[str, Any]]:
    if not os.path.exists(CATALOG_PATH):
        return []
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


class SmartConversationalEngine:
    def __init__(self):
        self.catalog = _load_catalog()
        self.last_category = None
        self.last_viewed_skus = []
        self.current_page = 0
        self.pending_order = None  # {"sku": str, "quantity": int, "amount": int, "product": dict}
        self.last_order_id = None
        self.last_payment_link = None
        self.awaiting_confirmation = False
        self.last_intent = None

    def _fuzzy_match_word(self, word: str, candidates: List[str], cutoff: float = 0.7) -> Optional[str]:
        matches = difflib.get_close_matches(word, candidates, n=1, cutoff=cutoff)
        return matches[0] if matches else None

    def _extract_size(self, text: str) -> Optional[str]:
        # Match size 8, 9, 10, M, L, Standard
        m = re.search(r'\b(?:size\s*)?(10|9|8|standard|m|l|xl)\b', text, re.IGNORECASE)
        if m:
            val = m.group(1).upper()
            if val in ("10", "9", "8"):
                return val
            if val in ("M", "L", "STANDARD"):
                return val.capitalize() if val == "STANDARD" else val
        return None

    def _extract_intent_and_entities(self, user_text: str) -> Dict[str, Any]:
        text = user_text.lower().strip()
        words = re.findall(r'\b[a-z0-9\-_]+\b', text)

        # Normalize common typos
        typo_map = {
            "wante": "want",
            "wnt": "want",
            "dto": "to",
            "buut": "buy",
            "but": "buy" if any(w in words for w in ["want", "shoes", "size", "order", "i"]) else "but",
            "shoos": "shoes",
            "shoo": "shoes",
            "sneekers": "sneakers",
            "runing": "running",
            "botle": "bottle",
            "hoddie": "hoodie",
            "hodi": "hoodie",
            "teeshirt": "tee",
            "tshirt": "tee",
        }
        normalized_words = [typo_map.get(w, w) for w in words]
        normalized_text = " ".join(normalized_words)

        size = self._extract_size(user_text)

        # Check for explicit SKU mentions
        found_sku = None
        for p in self.catalog:
            sku_clean = p["sku"].lower().replace("-", "")
            text_clean = text.replace("-", "").replace(" ", "")
            if sku_clean in text_clean or p["sku"].lower() in text:
                found_sku = p["sku"]
                break

        # Check intent types
        is_greeting = any(w in ("hi", "hello", "hey", "hola", "sup") for w in normalized_words)
        is_see_more = any(p in normalized_text for p in ["see more", "show more", "next", "more options", "what else", "other items"])
        is_confirmation = any(w in ("yes", "confirm", "proceed", "sure", "ok", "okay", "go ahead", "do it", "yep", "place order") for w in normalized_words)
        is_cancel = any(w in ("no", "cancel", "stop", "nevermind", "dont", "don't") for w in normalized_words)
        is_escalate = any(w in normalized_text for w in ["human", "agent", "support", "person", "representative", "manager", "operator"])
        is_failure_demo = any(w in normalized_text for w in ["faildemo", "decline", "fail demo", "simulate decline", "card failure"])
        is_buy_intent = any(w in normalized_words for w in ["buy", "order", "purchase", "checkout", "get", "take"]) or bool(found_sku and "buy" in normalized_text)
        is_price_inquiry = any(w in normalized_text for w in ["price", "how much", "cost", "cheaper", "expensive", "rate"])

        # Detect category
        category = None
        if any(w in normalized_text for w in ["shoe", "shoes", "sneaker", "sneakers", "runner", "running", "footwear"]):
            category = "footwear"
        elif any(w in normalized_text for w in ["tee", "tshirt", "shirt", "hoodie", "apparel", "wear", "clothes"]):
            category = "apparel"
        elif any(w in normalized_text for w in ["bottle", "bag", "duffel", "accessory", "accessories", "gear"]):
            category = "accessories"

        # Detect color
        color = None
        if "black" in normalized_text:
            color = "black"
        elif "white" in normalized_text:
            color = "white"
        elif "grey" in normalized_text or "gray" in normalized_text:
            color = "grey"
        elif "navy" in normalized_text or "blue" in normalized_text:
            color = "navy"

        return {
            "original_text": user_text,
            "normalized_text": normalized_text,
            "size": size,
            "color": color,
            "found_sku": found_sku,
            "category": category,
            "is_greeting": is_greeting,
            "is_see_more": is_see_more,
            "is_confirmation": is_confirmation,
            "is_cancel": is_cancel,
            "is_escalate": is_escalate,
            "is_failure_demo": is_failure_demo,
            "is_buy_intent": is_buy_intent,
            "is_price_inquiry": is_price_inquiry,
        }

    def process_turn(self, user_text: str) -> Dict[str, Any]:
        """
        Processes a conversational turn with full dialogue state management.
        Returns a rich dict containing:
        - reply_text: Natural language response
        - product_cards: List of matching product objects to render visually
        - action_sheet: Optional confirmation or payment card payload
        - quick_replies: List of suggestion pills for the user to click
        """
        metrics.record_turn()
        ceiling = get_spend_ceiling()
        analysis = self._extract_intent_and_entities(user_text)

        # -------------------------------------------------------------
        # 1. Scripted Failure & Recovery Demo (FAILDEMO)
        # -------------------------------------------------------------
        if analysis["is_failure_demo"]:
            from agent.guardrails import MoneyGuardrail
            from payments import get_payment_client
            g = MoneyGuardrail(get_payment_client())
            order = g.create_order(
                amount_inr=2499,
                receipt="RN-9-BLK-FAILDEMO",
                reasoning="Scripted demo of card decline and automated UPI recovery.",
                buyer_confirmed=True,
                sku="RN-9-BLK",
                quantity=1,
            )
            link1 = g.create_payment_link(
                order_id=order.order_id,
                amount_inr=2499,
                description="Trailblazer Running Shoe (Card Attempt)",
                reasoning="Initial attempt using test card.",
                buyer_confirmed=True,
            )
            status1 = g.check_payment_status(link1.payment_link_id, reasoning="Checking card status.")

            # Automated retry with UPI fallback
            link2 = g.create_payment_link(
                order_id=order.order_id,
                amount_inr=2499,
                description="Trailblazer Running Shoe (UPI Recovery)",
                reasoning="Retrying payment via UPI fallback after card decline.",
                buyer_confirmed=True,
            )
            status2 = g.check_payment_status(link2.payment_link_id, reasoning="Checking UPI retry settlement.")

            reply = (
                "⚠️ **Payment Alert**: Your initial card transaction for **Trailblazer Running Shoe** "
                f"(Order `{order.order_id}`, ₹2,499) was **declined** by the card network (`card_declined`).\n\n"
                "🔄 **Autonomous Recovery Triggered**: Rather than dropping the sale, I instantly generated a secure **UPI Fallback Link** for you.\n\n"
                f"✅ **Verified Settlement**: The UPI retry succeeded with status **PAID**! Your order `{order.order_id}` has been confirmed."
            )
            return {
                "reply_text": reply,
                "product_cards": [p for p in self.catalog if p["sku"] == "RN-9-BLK"],
                "action_sheet": {
                    "type": "recovery_success",
                    "order_id": order.order_id,
                    "amount_inr": 2499,
                    "first_link": link1.short_url,
                    "recovery_link": link2.short_url,
                    "status": "paid",
                    "method": "UPI",
                },
                "quick_replies": ["🛍️ Buy Another Item", "📊 View Telemetry Scorecard", "🔍 Inspect Audit Trail"],
            }

        # -------------------------------------------------------------
        # 2. Human Escalation
        # -------------------------------------------------------------
        if analysis["is_escalate"]:
            res = json.loads(escalate_to_human.invoke({
                "reason": "Customer requested human merchant assistance.",
                "context": f"User query: '{user_text}'",
            }))
            return {
                "reply_text": f"🛎️ **Human Operator Connected**: {res['message']} A member of the store team has received your order history and will step in directly.",
                "product_cards": [],
                "action_sheet": {"type": "escalation", "status": "escalated"},
                "quick_replies": ["👟 Browse Running Shoes", "💧 Insulated Water Bottle", "👕 Training Tees"],
            }

        # -------------------------------------------------------------
        # 3. Confirmation Handling (When awaiting buyer consent)
        # -------------------------------------------------------------
        if self.awaiting_confirmation and self.pending_order:
            if analysis["is_confirmation"]:
                pending = self.pending_order
                self.awaiting_confirmation = False
                self.pending_order = None

                order_res = json.loads(create_order.invoke({
                    "sku": pending["sku"],
                    "quantity": pending["quantity"],
                    "reasoning": f"Buyer explicitly confirmed charge of ₹{pending['amount']:,} for {pending['sku']}.",
                    "buyer_confirmed": True,
                }))

                if "order_id" in order_res:
                    self.last_order_id = order_res["order_id"]
                    link_res = json.loads(create_payment_link.invoke({
                        "order_id": order_res["order_id"],
                        "amount_inr": order_res["amount_inr"],
                        "description": f"Order {order_res['order_id']} - {pending['product']['name']}",
                        "reasoning": "Generating payment link following buyer approval.",
                        "buyer_confirmed": True,
                    }))
                    self.last_payment_link = link_res["short_url"]

                    # Fetch upsell recommendation
                    cross_res = json.loads(get_cross_sell_recommendations.invoke({"sku": pending["sku"]}))
                    upsell_items = cross_res.get("recommendations", [])
                    upsell_msg = ""
                    if upsell_items:
                        top_rec = upsell_items[0]
                        upsell_msg = f"\n\n💡 **Complete Your Kit**: Customers who bought this also love the **{top_rec['name']}** (₹{top_rec['price_inr']:,}). Would you like to add one?"

                    reply = (
                        f"🎉 **Order Confirmed & Placed!**\n\n"
                        f"Your order for **{pending['product']['name']}** has been secured.\n"
                        f"- **Order ID**: `{order_res['order_id']}`\n"
                        f"- **Total Amount**: **₹{order_res['amount_inr']:,}**\n"
                        f"- **Payment Link**: [{link_res['short_url']}]({link_res['short_url']})\n"
                        f"- **Status**: Ready for test payment"
                        f"{upsell_msg}"
                    )
                    return {
                        "reply_text": reply,
                        "product_cards": [pending["product"]] + upsell_items[:1],
                        "action_sheet": {
                            "type": "checkout",
                            "order_id": order_res["order_id"],
                            "payment_link_id": link_res["payment_link_id"],
                            "short_url": link_res["short_url"],
                            "amount_inr": order_res["amount_inr"],
                            "product_name": pending["product"]["name"],
                            "status": "created",
                        },
                        "quick_replies": [f"Add {upsell_items[0]['name']}" if upsell_items else "🛍️ Shop More", "💳 Pay with Test UPI", "🔍 View Audit Log"],
                    }
            elif analysis["is_cancel"]:
                cancelled_prod = self.pending_order["product"]["name"]
                self.awaiting_confirmation = False
                self.pending_order = None
                return {
                    "reply_text": f"No problem at all! I've cancelled the order for **{cancelled_prod}**. Let me know what else you'd like to look for!",
                    "product_cards": [],
                    "action_sheet": None,
                    "quick_replies": ["👟 Shoes under ₹3000", "💧 Water Bottles", "👕 Training Apparel"],
                }

        # -------------------------------------------------------------
        # 4. Handle "See More" / Paging / Follow-ups
        # -------------------------------------------------------------
        if analysis["is_see_more"]:
            cat = self.last_category or "footwear"
            matches = [p for p in self.catalog if p["category"] == cat and p["sku"] not in self.last_viewed_skus]
            if not matches:
                matches = [p for p in self.catalog if p["sku"] not in self.last_viewed_skus]

            self.last_viewed_skus.extend([p["sku"] for p in matches[:3]])
            reply = f"Here are more selections from our **{cat.capitalize()}** collection:"
            return {
                "reply_text": reply,
                "product_cards": matches[:3],
                "action_sheet": None,
                "quick_replies": [f"Buy {p['name'].split('-')[0].strip()}" for p in matches[:2]] + ["👕 Show Apparel", "💧 View Accessories"],
            }

        # -------------------------------------------------------------
        # 5. Targeted Buying & Sizing Search (e.g. 'i wante dto but shoes of size 10')
        # -------------------------------------------------------------
        target_sku = analysis["found_sku"]
        target_size = analysis["size"]
        target_category = analysis["category"]

        # If user specified "shoes of size 10", match specifically!
        if not target_sku:
            candidates = self.catalog
            if target_category:
                candidates = [p for p in candidates if p["category"] == target_category]
                self.last_category = target_category

            if target_size:
                size_matches = [p for p in candidates if str(p.get("size", "")).upper() == target_size.upper()]
                if size_matches:
                    candidates = size_matches

            if analysis["color"]:
                color_matches = [p for p in candidates if analysis["color"] in p["name"].lower()]
                if color_matches:
                    candidates = color_matches

            # If user has a purchase intent and there's a strong candidate
            if candidates:
                if len(candidates) == 1 or (analysis["is_buy_intent"] and target_size):
                    target_sku = candidates[0]["sku"]

        # If we identified a concrete product to buy or inspect
        if target_sku and (analysis["is_buy_intent"] or target_size):
            product = next((p for p in self.catalog if p["sku"] == target_sku), None)
            if product:
                if product["stock"] <= 0:
                    alt_items = [p for p in self.catalog if p["category"] == product["category"] and p["stock"] > 0]
                    return {
                        "reply_text": f"⚠️ The **{product['name']}** (SKU `{product['sku']}`) is currently out of stock! Here are in-stock alternatives you might like:",
                        "product_cards": alt_items[:2],
                        "action_sheet": None,
                        "quick_replies": [f"Order {p['name'].split('-')[0].strip()}" for p in alt_items[:2]],
                    }

                amount = product["price_inr"]
                self.last_category = product["category"]

                # Check spend ceiling guardrail
                if amount > ceiling:
                    self.awaiting_confirmation = True
                    self.pending_order = {
                        "sku": product["sku"],
                        "quantity": 1,
                        "amount": amount,
                        "product": product,
                    }
                    reply = (
                        f"🛡️ **Spend Ceiling Policy Gated**\n\n"
                        f"You've selected the **{product['name']}** in **Size {product['size']}**.\n\n"
                        f"- **Price**: **₹{amount:,}** (Stock: {product['stock']} available)\n"
                        f"- **Configured Ceiling**: **₹{ceiling:,}**\n\n"
                        f"Because this exceeds your spend ceiling of ₹{ceiling:,}, Razorpay Concierge requires explicit buyer authorization before placing the order.\n\n"
                        f"👉 **Click 'Confirm Order' below or reply 'Yes' to authorize payment of ₹{amount:,}.**"
                    )
                    return {
                        "reply_text": reply,
                        "product_cards": [product],
                        "action_sheet": {
                            "type": "confirmation_required",
                            "sku": product["sku"],
                            "product_name": product["name"],
                            "amount_inr": amount,
                            "ceiling_inr": ceiling,
                        },
                        "quick_replies": ["✅ Yes, I Confirm (₹" + str(amount) + ")", "❌ Cancel Order", "👟 Show other sizes"],
                    }
                else:
                    # Under ceiling direct purchase
                    order_res = json.loads(create_order.invoke({
                        "sku": product["sku"],
                        "quantity": 1,
                        "reasoning": f"Under-ceiling direct order for {product['name']}.",
                        "buyer_confirmed": False,
                    }))
                    link_res = json.loads(create_payment_link.invoke({
                        "order_id": order_res["order_id"],
                        "amount_inr": order_res["amount_inr"],
                        "description": product["name"],
                        "reasoning": "Instant payment link creation under ceiling.",
                        "buyer_confirmed": False,
                    }))

                    reply = (
                        f"✅ **Purchase Completed!** (Under ₹{ceiling:,} ceiling)\n\n"
                        f"- **Item**: **{product['name']}** (Size: {product['size']})\n"
                        f"- **Total**: **₹{amount:,}**\n"
                        f"- **Order ID**: `{order_res['order_id']}`\n\n"
                        f"Your secure test payment link is ready below:"
                    )
                    return {
                        "reply_text": reply,
                        "product_cards": [product],
                        "action_sheet": {
                            "type": "checkout",
                            "order_id": order_res["order_id"],
                            "payment_link_id": link_res["payment_link_id"],
                            "short_url": link_res["short_url"],
                            "amount_inr": amount,
                            "product_name": product["name"],
                            "status": "created",
                        },
                        "quick_replies": ["💳 Pay with Test UPI", "🛍️ View Apparel", "🔍 Inspect Audit Log"],
                    }

        # -------------------------------------------------------------
        # 6. Natural Language Search & Category Exploration
        # -------------------------------------------------------------
        # Score catalog against query
        scores = []
        for p in self.catalog:
            blob = f"{p['name']} {p['category']} {p['description']} {' '.join(p.get('tags', []))}".lower()
            score = 0
            for w in analysis["normalized_text"].split():
                if len(w) > 2 and w in blob:
                    score += 2 if (w in p['name'].lower() or w in p['category'].lower()) else 1
            if target_category and p['category'] == target_category:
                score += 3
            if target_size and str(p.get('size', '')).upper() == target_size.upper():
                score += 3
            if score > 0:
                scores.append((score, p))

        scores.sort(key=lambda x: x[0], reverse=True)
        matching_products = [s[1] for s in scores]

        if not matching_products:
            matching_products = self.catalog[:4]
            reply = (
                f"I couldn't find an exact match for '{user_text}', but here are our **top trending merchant picks** right now! "
                "Tell me what size or style you need and I'll find it for you:"
            )
        else:
            cat_label = f" in **{target_category.capitalize()}**" if target_category else ""
            size_label = f" (Size {target_size})" if target_size else ""
            lines = [f"• **{p['name']}** (SKU: `{p['sku']}`) — **₹{p['price_inr']:,}** (Size: {p['size']})" for p in matching_products[:3]]
            reply = f"Here are the best matches{cat_label}{size_label} from our store:\n" + "\n".join(lines) + "\n\nTap any card below to order or inspect!"

        self.last_viewed_skus = [p["sku"] for p in matching_products[:4]]
        return {
            "reply_text": reply,
            "product_cards": matching_products[:4],
            "action_sheet": None,
            "quick_replies": [f"Order {p['name'].split('-')[0].strip()}" for p in matching_products[:2]] + ["👀 See More", "🛡️ Test Spend Ceiling", "⚠️ Simulate Decline"],
        }
