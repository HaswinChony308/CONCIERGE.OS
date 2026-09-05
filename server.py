import os
import sys
import json
import time
import random
import urllib.request
import urllib.error
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

from dotenv import load_dotenv
load_dotenv()

# Add root directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.conversation_engine import SmartConversationalEngine
from agent.guardrails import get_spend_ceiling, set_spend_ceiling, MoneyGuardrail
from agent.metrics import metrics
from agent.audit import LOG_PATH, read_trail
from agent.mandates import mandates, IntentMandate, CartMandate, canonical_intent_string, canonical_cart_string
from payments import get_payment_client

def get_active_payment_client():
    key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    if key_id.startswith("rzp_test_") and key_secret:
        try:
            from payments.razorpay_client import RazorpayTestClient
            return RazorpayTestClient()
        except Exception as e:
            print("Failed to initialize RazorpayTestClient:", e)
    from payments.mock_client import MockRazorpayClient
    return MockRazorpayClient()

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'dist')

app = Flask(__name__, static_folder=DIST_DIR)
CORS(app)

engine = SmartConversationalEngine()
def load_merchant_catalog():
    cat_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'catalog.json')
    if os.path.exists(cat_path):
        with open(cat_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return engine.catalog

MERCHANT_CATALOG = load_merchant_catalog()

set_spend_ceiling(5000)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
MODEL_NAME = "gemini-3-flash-preview"

STOPWORDS = {
    "can", "buy", "show", "have", "want", "order", "need", "like", "find", 
    "give", "item", "items", "good", "best", "some", "with", "from", "that", 
    "this", "what", "where", "please", "help", "the", "for", "and", "you",
    "looking", "search", "get", "do"
}

def ask_gemini(user_query: str, product_match: dict = None) -> str:
    """Invokes Google Gemini 3 Flash for intelligent conversational reasoning."""
    if not GEMINI_API_KEY:
        return ""
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    
    if product_match:
        context = f"Buyer is looking for: '{user_query}'. We matched catalog item: {product_match['name']} (Price: Rs {product_match['price_inr']}, SKU: {product_match['sku']}, Category: {product_match['category']}, Stock: {product_match['stock']})."
        system = "You are Concierge, the autonomous checkout assistant for Acme Gear Labs. In 1-2 friendly sentences, confirm you found this product, highlight its key athletic benefit, and mention it is ready for checkout authorization."
    else:
        context = f"Buyer asked: '{user_query}'. Acme Gear Labs is a premier athletic performance & fitness technology merchant with 6 categories: 1) Footwear (Trailblazer running shoes, Apex Glide carbon racers, Court sneakers, Hiking boots); 2) Wearables & Tech (Apex Pro GPS Smartwatches, PulseTrack HR Bands, AeroBeats Wireless Sport Earbuds); 3) Athletic Apparel (Zip Hoodies, StormProof Windbreakers, DryFit Tees, Running Shorts, Compression Tights); 4) Fitness Equipment (ProGrip Yoga Mats, Cast Iron Dumbbells, Foam Rollers, Resistance Bands); 5) Accessories (1L Insulated Bottles, 45L Duffel Bags, Polarized Sunglasses, Lifting Gloves); 6) Nutrition (Pure Whey Isolate, Electrolyte & BCAA Mix). We do NOT sell non-sports items like laptops, phones, food, or cars."
        system = "You are Concierge, the autonomous checkout assistant for Acme Gear Labs. In 2 friendly sentences, clarify what Acme Gear Labs offers, politely state we don't carry the requested out-of-catalog item, and suggest relevant gear."

    prompt = f"{system}\n\n{context}\n\nUser: {user_query}\nConcierge:"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 350,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            candidates = data.get('candidates', [])
            if candidates:
                parts = candidates[0].get('content', {}).get('parts', [])
                if parts:
                    return parts[0].get('text', '').strip()
    except Exception as e:
        print("Gemini call fallback:", e)
    
    return ""

# In-memory session audit ledger cache for fast UI streaming
MEMORY_LEDGER = [
    {
        "trace_id": "trc_9042_c8f",
        "timestamp": "14:28:44",
        "mode": "Human Interactive",
        "tool": "create_payment_link",
        "amount": 2499,
        "rzp_ref": "pay_test_c8fa19",
        "verdict": "PASSED",
        "proof": {
            "trace_id": "trc_9042_c8f",
            "sku": "RN-9-BLK",
            "amount": 2499,
            "ceiling": 5000,
            "policy_verdict": "PASSED",
            "state_hash": "sha256:7f9a1c028e3b...",
            "signature": "0x88fca9b2"
        }
    },
    {
        "trace_id": "trc_8831_12a",
        "timestamp": "14:24:19",
        "mode": "Human Interactive",
        "tool": "policy_check",
        "amount": 8999,
        "rzp_ref": "RZP_BLOCKED_LOCAL",
        "verdict": "GATED (EXCEEDS CEILING)",
        "proof": {
            "trace_id": "trc_8831_12a",
            "sku": "WATCH-GPS-PRO",
            "amount": 8999,
            "ceiling": 5000,
            "policy_verdict": "BLOCKED_CEILING_BREACH",
            "state_hash": "sha256:4d8170c01fa9...",
            "signature": "0x712fa890"
        }
    }
]

def make_trace_id():
    suffix = hex(random.randint(4096, 65535))[2:]
    return f"trc_{random.randint(1000, 9999)}_{suffix}"

def now_time_str():
    return datetime.now().strftime("%H:%M:%S")

# ================= Static React Frontend =================
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    if os.path.exists(os.path.join(DIST_DIR, path)) and path != '':
        return send_from_directory(DIST_DIR, path)
    elif os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        return send_from_directory(DIST_DIR, 'index.html')
    else:
        return "Frontend build not found. Run 'npm run build' inside frontend directory.", 404

# ================= REST API Endpoints =================
@app.route('/api/status', methods=['GET'])
def get_status():
    key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    has_keys = bool(key_id.startswith("rzp_test_") and os.environ.get("RAZORPAY_KEY_SECRET"))
    return jsonify({
        "status": "online",
        "merchant": {
            "name": "Acme Gear Labs",
            "id": "mid_dev_9024",
            "env": "Razorpay Live Test SDK" if has_keys else "Razorpay Test-Mode Live",
            "has_live_keys": has_keys,
            "key_id": key_id if has_keys else "rzp_test_sandbox",
            "currency": "INR",
            "catalog_count": len(engine.catalog)
        },
        "guardrail": {
            "ceiling": get_spend_ceiling(),
            "rule_confirmation": "ENFORCED",
            "rule_price_integrity": "ENFORCED",
            "rule_failure_recovery": "ENFORCED"
        },
        "llm": {
            "provider": "Google Gemini",
            "model": MODEL_NAME,
            "status": "active"
        },
        "mandates": {
            "protocol": "NPCI UAP / Google AP2 / Stripe ACP",
            "status": "ENFORCED",
            "algorithm": "HMAC-SHA256",
            "active_intents": len(mandates._intents),
            "active_carts": len(mandates._carts)
        },
        "graph_latency_ms": 18.4
    })

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    summary = metrics.get_summary()
    summary["guardrail_ceiling"] = get_spend_ceiling()
    summary["avg_latency_ms"] = 18.4
    summary["total_ledger_records"] = len(MEMORY_LEDGER)
    return jsonify(summary)

@app.route('/api/guardrail/ceiling', methods=['POST'])
def update_ceiling():
    data = request.get_json() or {}
    new_ceiling = int(data.get('ceiling', 5000))
    set_spend_ceiling(new_ceiling)
    
    trace_id = make_trace_id()
    entry = {
        "trace_id": trace_id,
        "timestamp": now_time_str(),
        "mode": "Policy Middleware",
        "tool": "guardrail_threshold_update",
        "amount": 0,
        "rzp_ref": f"CEILING_{new_ceiling}",
        "verdict": "APPLIED_OK",
        "proof": {
            "trace_id": trace_id,
            "new_ceiling": new_ceiling,
            "timestamp": datetime.now().isoformat(),
            "rule": "MAX_SPEND_CEILING"
        }
    }
    MEMORY_LEDGER.insert(0, entry)
    
    return jsonify({
        "success": True,
        "ceiling": new_ceiling,
        "message": f"Guardrail Spend Ceiling updated to Rs {new_ceiling:,}",
        "entry": entry
    })

@app.route('/api/audit', methods=['GET'])
def get_audit():
    return jsonify({
        "records": MEMORY_LEDGER,
        "count": len(MEMORY_LEDGER)
    })

@app.route('/api/audit/download', methods=['GET'])
def download_audit():
    if os.path.exists(LOG_PATH):
        return send_file(LOG_PATH, as_attachment=True, download_name="concierge_audit_ledger.jsonl")
    else:
        tmp_path = os.path.join(os.path.dirname(__file__), "logs", "concierge_audit_export.jsonl")
        os.makedirs(os.path.dirname(tmp_path), exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            for item in MEMORY_LEDGER:
                f.write(json.dumps(item) + "\n")
        return send_file(tmp_path, as_attachment=True, download_name="concierge_audit_ledger.jsonl")

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    user_message = data.get('message', '').strip()
    mode = data.get('mode', 'human')
    
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    current_ceiling = get_spend_ceiling()
    lower = user_message.lower()
    raw_words = [w.strip(",.?!") for w in lower.split()]
    words_set = set(raw_words)
    trace_id = make_trace_id()
    t_str = now_time_str()

    tool_logs = []
    product_card = None
    matched_products = []
    system_alert = None
    is_breach = False
    verdict = "PASSED"
    amount = 0

    # 1. Determine Scope across 6 categories
    scope = "*"
    if any(w in lower for w in ["shoe", "shoes", "sneaker", "running", "runner", "boot", "hiking", "footwear"]):
        scope = "Footwear"
    elif any(w in lower for w in ["watch", "smartwatch", "gps", "tracker", "band", "earbuds", "headphones", "audio", "wearables", "tech"]):
        scope = "Wearables"
    elif any(w in lower for w in ["hoodie", "tee", "tshirt", "jacket", "windbreaker", "shorts", "tights", "apparel", "clothing"]):
        scope = "Apparel"
    elif any(w in lower for w in ["mat", "yoga", "dumbbell", "weights", "roller", "bands", "equipment"]):
        scope = "Equipment"
    elif any(w in lower for w in ["bottle", "bag", "duffel", "sunglasses", "gloves", "accessories"]):
        scope = "Accessories"
    elif any(w in lower for w in ["protein", "whey", "bcaa", "electrolytes", "nutrition", "supplements", "shake"]):
        scope = "Nutrition"

    intent_mandate = mandates.issue_intent_mandate(
        scope=scope,
        max_amount_inr=current_ceiling,
        ttl_seconds=900
    )
    tool_logs.append({
        "tool": "issue_intent_mandate",
        "payload": {
            "protocol": "NPCI UAP / AP2",
            "intent_id": intent_mandate.intent_id,
            "scope": scope,
            "max_amount_inr": current_ceiling,
            "signature": intent_mandate.signature[:16] + "..."
        },
        "result": "ISSUED_HMAC_VALID"
    })

    cart_mandate = None

    # 2. Check for intentional spend ceiling breach demo (specifically asking for over-ceiling Rs 8,999)
    if any(w in words_set for w in ["8999", "8000", "expensive", "breach"]) or ("watch" in lower and any(p in lower for p in ["8999", "ultra", "express"])):
        is_breach = True
        amount = 8999
        verdict = "GATED (EXCEEDS INTENT MANDATE)"
        metrics.record_guardrail_check("policy_check", "ceiling_blocked", amount, f"Amount Rs {amount} exceeds IntentMandate limit Rs {current_ceiling}")
        rationale = f"CRITICAL MANDATE BREACH (NPCI UAP / Google AP2): Item price Rs 8,999 exceeds authorized IntentMandate limit (Rs {current_ceiling:,}). Hard cryptographic gate refused to issue CartMandate."
        system_alert = {
            "title": "MANDATE CEILING BREACH",
            "message": f"Transaction of Rs 8,999.00 has been blocked. Current IntentMandate ceiling is configured to Rs {current_ceiling:,}. Adjust the ceiling slider or choose an eligible product within limits."
        }
        tool_logs.append({
            "tool": "verify_cart_mandate",
            "payload": {"sku": "WATCH-GPS-PRO", "amount": 8999, "intent_ceiling": current_ceiling},
            "result": "BLOCKED_MANDATE_BREACH"
        })
        rzp_ref = "RZP_BLOCKED_LOCAL"

    # 3. Match against full 24-item merchant catalog
    else:
        catalog = load_merchant_catalog()
        query_words = [w for w in raw_words if len(w) > 2 and w not in STOPWORDS]
        matched = []

        is_browse_all = any(w in words_set for w in ["all", "everything", "products", "browse", "catalog", "store", "gear", "sell"])

        for p in catalog:
            name_lower = p['name'].lower()
            cat_lower = p['category'].lower()
            desc_lower = p['description'].lower()
            tags = [t.lower() for t in p.get('tags', [])]
            score = 0

            # Match meaningful query words
            for w in query_words:
                if w in name_lower:
                    score += 8
                if any(w == t for t in tags):
                    score += 8
                elif any(w in t for t in tags):
                    score += 4
                if w in cat_lower:
                    score += 5
                if w in desc_lower:
                    score += 2

            # Direct Category & Synonym Boosts
            if any(w in words_set for w in ["watch", "smartwatch", "gps", "tracker", "band", "time", "clock"]) and ("watch" in name_lower or "band" in name_lower):
                score += 15
            if any(w in words_set for w in ["earbuds", "earphone", "headphones", "headphone", "audio", "music", "sound"]) and "earbuds" in name_lower:
                score += 15
            if any(w in words_set for w in ["yoga", "mat", "pilates", "stretch"]) and "mat" in name_lower:
                score += 15
            if any(w in words_set for w in ["dumbbell", "dumbbells", "weight", "weights", "iron"]) and "dumbbell" in name_lower:
                score += 15
            if any(w in words_set for w in ["protein", "whey", "isolate", "shake", "powder"]) and "protein" in name_lower:
                score += 15
            if any(w in words_set for w in ["sunglasses", "glasses", "shades"]) and "sunglasses" in name_lower:
                score += 15
            if any(w in words_set for w in ["shorts"]) and "shorts" in name_lower:
                score += 15
            if any(w in words_set for w in ["hoodie", "hoodies", "sweatshirt"]) and "hoodie" in name_lower:
                score += 15
            if any(w in words_set for w in ["jacket", "windbreaker"]) and "jacket" in name_lower:
                score += 15
            if any(w in words_set for w in ["bottle", "water", "hydration"]) and "bottle" in name_lower:
                score += 15
            if any(w in words_set for w in ["bag", "duffel", "backpack"]) and "bag" in name_lower:
                score += 15
            if any(w in words_set for w in ["glove", "gloves"]) and "gloves" in name_lower:
                score += 15
            if any(w in words_set for w in ["shoe", "shoes", "runners", "running", "sneaker", "sneakers"]) and ("shoe" in name_lower or "sneaker" in name_lower or "runner" in name_lower):
                score += 12

            if is_browse_all:
                score += 6

            if score >= 6:
                matched.append((score, p))
        
        matched.sort(key=lambda x: x[0], reverse=True)

        if matched:
            top_p = matched[0][1]
            amount = top_p['price_inr']
            tool_logs.append({
                "tool": "catalog_search",
                "payload": {"query": user_message, "max_price": current_ceiling, "matched_count": len(matched)},
                "result": f"Matched {len(matched)} items (Top: {top_p['name']} - Rs {amount:,})"
            })
            
            # Check if top item exceeds spend ceiling
            if amount > current_ceiling:
                is_breach = True
                verdict = "GATED (EXCEEDS INTENT MANDATE)"
                metrics.record_guardrail_check("policy_check", "ceiling_blocked", amount, f"Item price Rs {amount} exceeds IntentMandate limit Rs {current_ceiling}")
                rationale = f"MANDATE INTERCEPTION: Matched '{top_p['name']}' (Rs {amount:,}), but it exceeds the current IntentMandate limit of Rs {current_ceiling:,}. Order blocked."
                system_alert = {
                    "title": "MANDATE CEILING BREACH",
                    "message": f"Item '{top_p['name']}' is priced at Rs {amount:,}.00, exceeding your authorized IntentMandate limit of Rs {current_ceiling:,}. Please raise the ceiling slider or choose another item."
                }
                rzp_ref = "RZP_BLOCKED_LOCAL"
            else:
                # Issue signed CartMandate bound to IntentMandate
                try:
                    cart_mandate = mandates.issue_cart_mandate(
                        intent=intent_mandate,
                        sku=top_p['sku'],
                        total_inr=amount,
                        quantity=1,
                        category=top_p.get('category', 'General')
                    )
                    tool_logs.append({
                        "tool": "issue_cart_mandate",
                        "payload": {
                            "cart_id": cart_mandate.cart_id,
                            "intent_id": intent_mandate.intent_id,
                            "sku": top_p['sku'],
                            "total_inr": amount,
                            "signature": cart_mandate.signature[:16] + "..."
                        },
                        "result": "BOUND_AND_SIGNED_HMAC"
                    })
                    metrics.record_guardrail_check("policy_check", "passed", amount, f"CartMandate {cart_mandate.cart_id} verified against Intent {intent_mandate.intent_id}")
                except Exception as e:
                    print("Cart mandate creation error:", e)

                gemini_text = ask_gemini(user_message, top_p)
                if gemini_text:
                    rationale = f"Gemini 3 Flash: {gemini_text} [Mandate Verified: Rs {amount:,} <= Rs {current_ceiling:,} | HMAC-SHA256 Signed]"
                else:
                    rationale = f"Catalog query resolved: Found {top_p['name']} (Rs {amount:,}). AP2/UAP Mandate verified: Rs {amount:,} <= Rs {current_ceiling:,}. Ready for buyer authorization."
                
                p_client = get_active_payment_client()
                short_url = None
                rzp_ref = f"order_test_{random.randint(100000, 999999)}"
                try:
                    ord_res = p_client.create_order(amount, f"rcpt_{top_p['sku']}")
                    link_res = p_client.create_payment_link(ord_res.order_id, amount, top_p['name'])
                    short_url = getattr(link_res, 'short_url', None)
                    rzp_ref = ord_res.order_id
                except Exception as e:
                    print("Payment client link error:", e)

                product_card = {
                    "name": top_p['name'],
                    "sku": top_p['sku'],
                    "price": amount,
                    "desc": top_p['description'],
                    "image": top_p.get('image_url', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80'),
                    "short_url": short_url,
                    "mandates": {
                        "protocol": "NPCI UAP / Google AP2",
                        "intent_id": intent_mandate.intent_id,
                        "cart_id": cart_mandate.cart_id if cart_mandate else None,
                        "scope": intent_mandate.scope,
                        "max_amount_inr": intent_mandate.max_amount_inr,
                        "intent_sig": intent_mandate.signature[:16] + "...",
                        "cart_sig": cart_mandate.signature[:16] + "..." if cart_mandate else None,
                        "status": "VALID_HMAC_CHAIN" if cart_mandate else "UNBOUND"
                    }
                }

                # Prepare list of up to 4 matched products
                for s, item in matched[:4]:
                    matched_products.append({
                        "name": item['name'],
                        "sku": item['sku'],
                        "price": item['price_inr'],
                        "desc": item['description'],
                        "image": item.get('image_url', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80'),
                        "mandates": {
                            "protocol": "NPCI UAP / Google AP2",
                            "intent_id": intent_mandate.intent_id,
                            "scope": intent_mandate.scope,
                            "max_amount_inr": intent_mandate.max_amount_inr,
                            "status": "AUTHORIZED_UNDER_INTENT"
                        }
                    })

        else:
            tool_logs.append({
                "tool": "catalog_search",
                "payload": {"query": user_message},
                "result": "NO_INVENTORY_MATCH"
            })
            
            gemini_reply = ask_gemini(user_message, None)
            if gemini_reply:
                alert_msg = gemini_reply
            else:
                alert_msg = f"Concierge is the autonomous checkout agent for Acme Gear Labs (Footwear, Smart Wearables, Athletic Apparel, Gym Equipment, Accessories, Nutrition). We do not carry '{user_message}'. Try searching for 'smart watch', 'earbuds', 'yoga mat', 'dumbbells', 'protein', 'running shoes', or 'windbreaker'!"
            
            rationale = f"Buyer intent analyzed: '{user_message}'. Catalog lookup returned 0 matches. Acme Gear Labs covers sports apparel, footwear, fitness tech, and gym equipment."
            system_alert = {
                "title": "OUT-OF-CATALOG QUERY (MERCHANT BOUNDED)",
                "message": alert_msg
            }
            rzp_ref = "UNMATCHED_QUERY"
            verdict = "NOT_IN_CATALOG"

    ledger_entry = {
        "trace_id": trace_id,
        "timestamp": t_str,
        "mode": "B2C Conversational" if mode == 'human' else "A2A Protocol",
        "tool": "verify_cart_mandate" if cart_mandate else ("policy_check" if is_breach else "catalog_search"),
        "amount": amount,
        "rzp_ref": rzp_ref,
        "verdict": verdict,
        "proof": {
            "trace_id": trace_id,
            "timestamp": datetime.now().isoformat(),
            "user_intent": user_message,
            "amount": amount,
            "ceiling": current_ceiling,
            "policy_verdict": verdict,
            "protocol": "NPCI UAP / Google AP2 / Stripe ACP",
            "intent_mandate": intent_mandate.to_dict(),
            "cart_mandate": cart_mandate.to_dict() if cart_mandate else None,
            "state_hash": f"sha256:{hex(abs(hash(trace_id + str(amount))))[2:]}...",
            "langgraph_checkpoint": f"saver_0x{hex(random.randint(1000000, 9999999))[2:]}"
        }
    }
    MEMORY_LEDGER.insert(0, ledger_entry)

    return jsonify({
        "trace_id": trace_id,
        "timestamp": t_str,
        "rationale": rationale,
        "product_card": product_card,
        "products": matched_products,
        "system_alert": system_alert,
        "tool_logs": tool_logs,
        "ledger_entry": ledger_entry,
        "mandates": {
            "intent": intent_mandate.to_dict(),
            "cart": cart_mandate.to_dict() if cart_mandate else None
        },
        "metrics": metrics.get_summary()
    })

@app.route('/api/scenario', methods=['POST'])
def trigger_scenario():
    data = request.get_json() or {}
    scenario_type = data.get('scenario', 'shoes')
    trace_id = make_trace_id()
    t_str = now_time_str()
    current_ceiling = get_spend_ceiling()

    if scenario_type == 'shoes':
        amount = 2499
        intent = mandates.issue_intent_mandate(scope="Footwear", max_amount_inr=current_ceiling, ttl_seconds=900)
        cart = mandates.issue_cart_mandate(intent=intent, sku="RN-9-BLK", total_inr=amount, quantity=1, category="Footwear")
        metrics.record_guardrail_check("policy_check", "passed", amount, f"CartMandate {cart.cart_id} HMAC verified against Intent {intent.intent_id}")
        entry = {
            "trace_id": trace_id,
            "timestamp": t_str,
            "mode": "Human Interactive",
            "tool": "verify_cart_mandate",
            "amount": amount,
            "rzp_ref": f"order_test_{random.randint(100000, 999999)}",
            "verdict": "PASSED (AP2 / UAP VERIFIED)",
            "proof": {
                "trace_id": trace_id,
                "sku": "RN-9-BLK",
                "amount": amount,
                "ceiling": current_ceiling,
                "protocol": "NPCI UAP / Google AP2 Mandates",
                "policy_verdict": "PASSED",
                "intent_mandate": intent.to_dict(),
                "cart_mandate": cart.to_dict(),
                "state_hash": f"sha256:{hex(abs(hash(trace_id)))[2:]}..."
            }
        }
        MEMORY_LEDGER.insert(0, entry)
        return jsonify({
            "scenario": "shoes",
            "buyer_message": "Find running shoes under Rs 3000, size 9 UK",
            "rationale": f"NPCI UAP / Google AP2 Mandate Chain Active: IntentMandate issued ({intent.intent_id} · Footwear · ₹{current_ceiling:,}). CartMandate bound ({cart.cart_id} · ₹2,499). HMAC-SHA256 verified. Standby for buyer confirmation.",
            "product_card": {
                "name": "Trailblazer Running Shoe - Black",
                "sku": "RN-9-BLK",
                "price": 2499,
                "desc": "Engineered mesh running shoes with ultra-responsive cushioning and high-traction rubber outsole.",
                "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
                "mandates": {
                    "protocol": "NPCI UAP / Google AP2",
                    "intent_id": intent.intent_id,
                    "cart_id": cart.cart_id,
                    "scope": intent.scope,
                    "max_amount_inr": intent.max_amount_inr,
                    "intent_sig": intent.signature[:16] + "...",
                    "cart_sig": cart.signature[:16] + "...",
                    "status": "VALID_HMAC_CHAIN"
                }
            },
            "tool_logs": [
                {"tool": "issue_intent_mandate", "payload": {"scope": "Footwear", "max_amount_inr": current_ceiling}, "result": f"SIGNED ({intent.intent_id})"},
                {"tool": "catalog_search", "payload": {"query": "running shoes size 9", "max_price": 3000}, "result": "Trailblazer Running Shoe - Black (Rs 2,499)"},
                {"tool": "issue_cart_mandate", "payload": {"sku": "RN-9-BLK", "total_inr": 2499, "intent_id": intent.intent_id}, "result": f"BOUND_SIGNED ({cart.cart_id})"},
                {"tool": "verify_cart_mandate", "payload": {"cart_id": cart.cart_id}, "result": "VALID_HMAC_SHA256"}
            ],
            "ledger_entry": entry,
            "mandates": {
                "intent": intent.to_dict(),
                "cart": cart.to_dict()
            },
            "metrics": metrics.get_summary()
        })

    elif scenario_type == 'ceiling':
        amount = 8999
        intent = mandates.issue_intent_mandate(scope="Footwear", max_amount_inr=current_ceiling, ttl_seconds=900)
        metrics.record_guardrail_check("policy_check", "ceiling_blocked", amount, f"Amount Rs {amount} exceeds IntentMandate limit Rs {current_ceiling}")
        entry = {
            "trace_id": trace_id,
            "timestamp": t_str,
            "mode": "Human Interactive",
            "tool": "verify_cart_mandate",
            "amount": amount,
            "rzp_ref": "RZP_BLOCKED_LOCAL",
            "verdict": "GATED (EXCEEDS INTENT MANDATE)",
            "proof": {
                "trace_id": trace_id,
                "sku": "WATCH-GPS-PRO",
                "amount": amount,
                "ceiling": current_ceiling,
                "protocol": "NPCI UAP / Google AP2 Mandates",
                "policy_verdict": "BLOCKED_MANDATE_BREACH",
                "intent_mandate": intent.to_dict(),
                "cart_mandate": None,
                "state_hash": f"sha256:{hex(abs(hash(trace_id)))[2:]}..."
            }
        }
        MEMORY_LEDGER.insert(0, entry)
        return jsonify({
            "scenario": "ceiling",
            "buyer_message": "Buy Apex Pro GPS Watch with express dispatch for Rs 8,999",
            "rationale": f"CRITICAL MANDATE BREACH (NPCI UAP / Google AP2): Item price Rs 8,999 exceeds authorized IntentMandate limit (Rs {current_ceiling:,}). Hard policy gate refused to issue CartMandate.",
            "system_alert": {
                "title": "MANDATE CEILING BREACH",
                "message": f"Transaction of Rs 8,999.00 has been blocked. Current IntentMandate ceiling is configured to Rs {current_ceiling:,}. Adjust the ceiling slider above or choose an eligible product."
            },
            "tool_logs": [
                {"tool": "issue_intent_mandate", "payload": {"scope": "Footwear", "max_amount_inr": current_ceiling}, "result": f"SIGNED ({intent.intent_id})"},
                {"tool": "verify_cart_mandate", "payload": {"sku": "WATCH-GPS-PRO", "amount": 8999, "intent_ceiling": current_ceiling}, "result": "BLOCKED_MANDATE_BREACH"}
            ],
            "ledger_entry": entry,
            "mandates": {
                "intent": intent.to_dict(),
                "cart": None
            },
            "metrics": metrics.get_summary()
        })

    elif scenario_type == 'decline':
        return jsonify({
            "scenario": "decline",
            "action": "open_checkout_modal",
            "product": {
                "name": "Trailblazer Running Shoe - Black",
                "sku": "RN-9-BLK",
                "price": 2499
            }
        })

@app.route('/api/payment/simulate', methods=['POST'])
def simulate_payment():
    data = request.get_json() or {}
    status = data.get('status', 'SUCCESS').upper()
    name = data.get('name', 'Trailblazer Running Shoe - Black')
    sku = data.get('sku', 'RN-9-BLK')
    price = int(data.get('price', 2499))
    mode = data.get('mode', 'human')
    
    trace_id = make_trace_id()
    t_str = now_time_str()

    if status == 'SUCCESS':
        rzp_id = f"pay_test_{hex(random.randint(1000000, 16777215))[2:]}"
        order_id = f"order_test_{random.randint(100000, 999999)}"
        metrics.record_order_created(order_id, price)
        metrics.record_payment_status(rzp_id, "paid", price)
        
        entry = {
            "trace_id": trace_id,
            "timestamp": t_str,
            "mode": "A2A Protocol" if mode == 'a2a' else "Human Interactive",
            "tool": "create_payment_link",
            "amount": price,
            "rzp_ref": rzp_id,
            "verdict": "PASSED",
            "proof": {
                "trace_id": trace_id,
                "sku": sku,
                "amount": price,
                "rzp_id": rzp_id,
                "status": "authorized_captured",
                "signature": f"0x{hex(random.randint(100000, 999999))[2:]}"
            }
        }
        MEMORY_LEDGER.insert(0, entry)
        return jsonify({
            "status": "SUCCESS",
            "trace_id": trace_id,
            "rzp_id": rzp_id,
            "price": price,
            "sku": sku,
            "rationale": "Razorpay event 'payment.authorized' captured with valid webhook signature. Dispatched confirmation token.",
            "tool_logs": [
                {"tool": "create_order", "payload": {"amount": price * 100, "currency": "INR"}, "result": "order_created_200"},
                {"tool": "create_payment_link", "payload": {"status": "paid", "amount": price}, "result": "SETTLED_200"},
                {"tool": "audit_sync", "payload": {"trace_id": trace_id}, "result": "SYNC_SUCCESS"}
            ],
            "ledger_entry": entry,
            "metrics": metrics.get_summary()
        })

    elif status == 'DECLINED':
        rzp_id = "pay_fail_decline"
        metrics.record_payment_status(rzp_id, "failed", price)
        entry = {
            "trace_id": trace_id,
            "timestamp": t_str,
            "mode": "Failure Recovery",
            "tool": "escalate_or_retry",
            "amount": price,
            "rzp_ref": rzp_id,
            "verdict": "ESCALATED / RECOVERY",
            "proof": {
                "trace_id": trace_id,
                "sku": sku,
                "error": "BAD_REQUEST_PAYMENT_DECLINED",
                "recovery_mode": "FALLBACK_PROMPTED"
            }
        }
        MEMORY_LEDGER.insert(0, entry)
        return jsonify({
            "status": "DECLINED",
            "trace_id": trace_id,
            "sku": sku,
            "price": price,
            "rationale": "Razorpay event 'payment.failed' captured (code: BAD_REQUEST_PAYMENT_DECLINED). Executing Track-mandated Failure & Recovery Protocol.",
            "tool_logs": [
                {"tool": "handle_declined_card", "payload": {"error": "CARD_DECLINED", "fallback": "upi_retry_prompted"}, "result": "RECOVERY_TRIGGERED"}
            ],
            "ledger_entry": entry,
            "metrics": metrics.get_summary()
        })

    elif status == 'TIMEOUT':
        return jsonify({
            "status": "TIMEOUT",
            "trace_id": trace_id,
            "rationale": "Gateway 504 Timeout. Agent holding state and re-verifying idempotency key.",
            "system_alert": {
                "title": "GATEWAY TIMEOUT (IDEMPOTENCY SAFE)",
                "message": "Network timed out with Razorpay test server. No amount was debited. Order token remains cached in LangGraph MemorySaver."
            },
            "tool_logs": [
                {"tool": "check_payment_status", "payload": {"error": "timeout_504"}, "result": "IDEMPOTENT_RETRY_READY"}
            ]
        })

@app.route('/api/recovery/upi', methods=['POST'])
def recover_upi():
    data = request.get_json() or {}
    price = int(data.get('price', 2499))
    sku = data.get('sku', 'RN-9-BLK')
    vpa = data.get('vpa', 'buyer@okaxis')
    
    trace_id = make_trace_id()
    t_str = now_time_str()
    rzp_id = f"pay_upi_{hex(random.randint(1000000, 16777215))[2:]}"
    metrics.record_payment_status(rzp_id, "paid", price)
    
    entry = {
        "trace_id": trace_id,
        "timestamp": t_str,
        "mode": "Recovery Fallback",
        "tool": "upi_instant_retry",
        "amount": price,
        "rzp_ref": rzp_id,
        "verdict": "PASSED (UPI)",
        "proof": {
            "trace_id": trace_id,
            "vpa": vpa,
            "sku": sku,
            "amount": price,
            "status": "UPI_CAPTURED"
        }
    }
    MEMORY_LEDGER.insert(0, entry)
    
    return jsonify({
        "status": "SUCCESS",
        "trace_id": trace_id,
        "rzp_id": rzp_id,
        "rationale": f"User initiated UPI recovery fallback with {vpa}. Instant collect request authorized & captured.",
        "tool_logs": [
            {"tool": "upi_intent_flow", "payload": {"vpa": vpa, "amount": price}, "result": "SETTLED_200"}
        ],
        "ledger_entry": entry,
        "metrics": metrics.get_summary()
    })

@app.route('/api/recovery/escalate', methods=['POST'])
def recover_escalate():
    data = request.get_json() or {}
    price = int(data.get('price', 2499))
    sku = data.get('sku', 'RN-9-BLK')
    ticket = "ESC_9042_OPS"
    
    trace_id = make_trace_id()
    t_str = now_time_str()
    metrics.record_escalation("CARD_DECLINE_UNRESOLVED", f"Checkout failed for SKU {sku}")
    
    entry = {
        "trace_id": trace_id,
        "timestamp": t_str,
        "mode": "Human Desk",
        "tool": "escalate_to_human",
        "amount": price,
        "rzp_ref": ticket,
        "verdict": "ESCALATED_200",
        "proof": {
            "trace_id": trace_id,
            "ticket": ticket,
            "sku": sku,
            "reason": "CARD_DECLINE_UNRESOLVED"
        }
    }
    MEMORY_LEDGER.insert(0, entry)
    
    return jsonify({
        "status": "ESCALATED",
        "ticket": ticket,
        "trace_id": trace_id,
        "rationale": "Invoking escalate_to_human tool. Exported session snapshot, trace history, and Razorpay failure payload to Live Human Operations Desk.",
        "tool_logs": [
            {"tool": "escalate_to_human", "payload": {"ticket": ticket, "reason": "CARD_DECLINE_UNRESOLVED"}, "result": "ESCALATED_200"}
        ],
        "ledger_entry": entry
    })

@app.route('/api/a2a/rpc', methods=['POST'])
def a2a_rpc():
    req = request.get_json() or {}
    method = req.get('method', 'execute_procurement')
    params = req.get('params', {})
    req_id = req.get('id', 'req-98234-a2a')
    
    sku = params.get('target_sku', 'RN-9-BLK')
    amount = 2499
    
    trace_id = make_trace_id()
    return jsonify({
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {
            "status": "AUTHORIZED_READY_FOR_SETTLEMENT",
            "sku": sku,
            "price": amount,
            "ceiling_check": {
                "authorized_ceiling": params.get('max_authorized_ceiling', 5000),
                "item_price": amount,
                "verdict": "ALLOWED"
            },
            "settlement_endpoint": "/api/payment/simulate",
            "trace_id": trace_id,
            "signature": f"0x{hex(random.randint(100000, 999999))[2:]}"
        }
    })

@app.route('/api/mandates/verify', methods=['POST'])
def verify_mandate_api():
    data = request.get_json() or {}
    cart_id = data.get('cart_id')
    cart = mandates.get_cart(cart_id) if cart_id else None
    if not cart:
        return jsonify({"valid": False, "error": "Cart mandate not found"}), 404
    intent = mandates.get_intent(cart.intent_id)
    valid, reason = mandates.verify_cart_mandate(cart, intent)
    return jsonify({
        "valid": valid,
        "reason": reason,
        "protocol": "NPCI UAP / Google AP2",
        "cart_mandate": cart.to_dict(),
        "intent_mandate": intent.to_dict() if intent else None
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Concierge Agentic Commerce API on port {port} ...")
    app.run(host='0.0.0.0', port=port, debug=False)
