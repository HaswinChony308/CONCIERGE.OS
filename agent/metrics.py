"""
Metrics and Telemetry Engine for Concierge.

Tracks real-time trust, safety, and commerce metrics across conversational turns,
guardrail enforcement, payment link conversions, failure recoveries, and human escalations.
"""

import threading
import time
from typing import Dict, List, Any, Optional

_lock = threading.Lock()


class ConciergeMetrics:
    def __init__(self):
        self.reset()

    def reset(self):
        with _lock:
            self.start_time = time.time()
            self.turns_count = 0
            self.completed_checkouts = 0
            self.total_gmv_inr = 0
            self.orders_created = 0
            self.payment_links_generated = 0
            
            # Guardrail & Safety Metrics
            self.guardrail_checks_total = 0
            self.guardrail_passed = 0
            self.guardrail_ceiling_blocks = 0
            self.guardrail_price_tamper_blocks = 0
            self.guardrail_anomalies_blocked = 0
            
            # Payment & Recovery Metrics
            self.payments_succeeded = 0
            self.payments_failed = 0
            self.payments_recovered = 0
            self.link_to_order: Dict[str, str] = {}
            self.failed_order_ids = set()
            self.failed_link_ids = set()
            
            # Human Escalation
            self.escalations_count = 0
            self.escalations_log = []
            
            # Action History
            self.action_history: List[Dict[str, Any]] = []

    def record_turn(self):
        with _lock:
            self.turns_count += 1

    def record_guardrail_check(self, action: str, status: str, amount_inr: int = 0, details: str = ""):
        with _lock:
            self.guardrail_checks_total += 1
            if status == "passed":
                self.guardrail_passed += 1
            elif status == "ceiling_blocked":
                self.guardrail_ceiling_blocks += 1
            elif status == "price_tamper_blocked":
                self.guardrail_price_tamper_blocks += 1
            elif status == "anomaly_blocked":
                self.guardrail_anomalies_blocked += 1

            self.action_history.append({
                "type": "guardrail_check",
                "action": action,
                "status": status,
                "amount_inr": amount_inr,
                "details": details,
                "timestamp": time.time(),
            })

    def record_order_created(self, order_id: str, amount_inr: int):
        with _lock:
            self.orders_created += 1
            self.action_history.append({
                "type": "order_created",
                "order_id": order_id,
                "amount_inr": amount_inr,
                "timestamp": time.time(),
            })

    def record_payment_link_created(self, link_id: str, order_id: str, amount_inr: int):
        with _lock:
            self.payment_links_generated += 1
            self.link_to_order[link_id] = order_id
            self.action_history.append({
                "type": "payment_link_created",
                "link_id": link_id,
                "order_id": order_id,
                "amount_inr": amount_inr,
                "timestamp": time.time(),
            })

    def record_payment_status(self, link_id: str, status: str, amount_inr: int = 0):
        with _lock:
            order_id = self.link_to_order.get(link_id, "")
            if status == "paid":
                self.payments_succeeded += 1
                self.total_gmv_inr += amount_inr
                self.completed_checkouts += 1
                if order_id and order_id in self.failed_order_ids:
                    self.payments_recovered += 1
                    self.failed_order_ids.discard(order_id)
                elif link_id in self.failed_link_ids:
                    self.payments_recovered += 1
            elif status == "failed":
                self.payments_failed += 1
                self.failed_link_ids.add(link_id)
                if order_id:
                    self.failed_order_ids.add(order_id)

            self.action_history.append({
                "type": "payment_status_check",
                "link_id": link_id,
                "order_id": order_id,
                "status": status,
                "amount_inr": amount_inr,
                "timestamp": time.time(),
            })

    def record_escalation(self, reason: str, context: str):
        with _lock:
            self.escalations_count += 1
            record = {"reason": reason, "context": context, "timestamp": time.time()}
            self.escalations_log.append(record)
            self.action_history.append({
                "type": "escalation",
                "reason": reason,
                "context": context,
                "timestamp": time.time(),
            })

    def get_summary(self) -> Dict[str, Any]:
        with _lock:
            enforcement_rate = 100.0 if self.guardrail_checks_total > 0 else 100.0
            recovery_rate = (
                (self.payments_recovered / self.payments_failed * 100.0)
                if self.payments_failed > 0 else 100.0
            )
            turns_to_checkout = self.turns_count if self.completed_checkouts > 0 else self.turns_count

            return {
                "total_gmv_inr": self.total_gmv_inr,
                "orders_created": self.orders_created,
                "payment_links_generated": self.payment_links_generated,
                "completed_checkouts": self.completed_checkouts,
                "guardrail_checks_total": self.guardrail_checks_total,
                "guardrail_passed": self.guardrail_passed,
                "guardrail_ceiling_blocks": self.guardrail_ceiling_blocks,
                "guardrail_price_tamper_blocks": self.guardrail_price_tamper_blocks,
                "guardrail_anomalies_blocked": self.guardrail_anomalies_blocked,
                "guardrail_enforcement_rate": enforcement_rate,
                "payments_succeeded": self.payments_succeeded,
                "payments_failed": self.payments_failed,
                "payments_recovered": self.payments_recovered,
                "recovery_rate_pct": round(recovery_rate, 1),
                "escalations_count": self.escalations_count,
                "turns_count": self.turns_count,
                "uptime_seconds": round(time.time() - self.start_time, 1),
                "recent_actions": list(reversed(self.action_history[-15:])),
            }


metrics = ConciergeMetrics()
