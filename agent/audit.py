"""
Append-only audit trail.

Every money-moving tool call writes two records: an INTENT record (what
the agent is about to do and why, written BEFORE the action happens) and
an OUTCOME record (what actually happened). This ordering matters — it's
what makes the log a record of reasoning-then-action rather than just a
transaction receipt, and it means a crash mid-call still leaves evidence
of what was attempted.
"""

import json
import os
import time
import uuid
from typing import Optional

LOG_PATH = os.environ.get("AUDIT_LOG_PATH", "logs/audit.jsonl")


def _write(record: dict) -> None:
    os.makedirs(os.path.dirname(LOG_PATH) or ".", exist_ok=True)
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def log_intent(action: str, reasoning: str, params: dict) -> str:
    """Call this BEFORE executing a guarded action. Returns an action_id
    to correlate with the outcome record."""
    action_id = str(uuid.uuid4())[:8]
    _write(
        {
            "type": "intent",
            "action_id": action_id,
            "action": action,
            "reasoning": reasoning,
            "params": params,
            "ts": time.time(),
        }
    )
    return action_id


def log_outcome(action_id: str, action: str, result: dict, error: Optional[str] = None) -> None:
    _write(
        {
            "type": "outcome",
            "action_id": action_id,
            "action": action,
            "result": result,
            "error": error,
            "ts": time.time(),
        }
    )


def read_trail() -> list:
    if not os.path.exists(LOG_PATH):
        return []
    with open(LOG_PATH) as f:
        return [json.loads(line) for line in f if line.strip()]
