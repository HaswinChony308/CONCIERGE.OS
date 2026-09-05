"""
Orchestrator: LangGraph tool-calling agent with multi-provider LLM support
(Anthropic, OpenAI, Google Gemini) and a built-in deterministic simulator for
zero-key offline demos.
"""

import json
import os
import re
from typing import List, Dict, Any, Optional

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langgraph.prebuilt import create_react_agent

from agent.tools import (
    ALL_TOOLS,
    catalog_search,
    get_product,
    create_order,
    create_payment_link,
    check_payment_status,
    escalate_to_human,
    get_cross_sell_recommendations,
)
from agent.metrics import metrics
from agent.conversation_engine import SmartConversationalEngine

SYSTEM_PROMPT = """You are Concierge, an intelligent shopping and checkout agent for a merchant's storefront. \
You help buyers browse the catalog, answer questions, and safely complete purchases end-to-end.

Rules you MUST strictly follow:
1. Always search the catalog using catalog_search or get_product before recommending products or creating orders.
2. Before calling create_order or create_payment_link:
   - State the exact item(s), size, quantity, and total price (₹) back to the buyer.
   - If the total amount exceeds the spend ceiling, wait for the buyer's explicit confirmation before calling create_order with buyer_confirmed=True.
3. Always pass a clear `reasoning` string to money-moving tools explaining what you are doing and why.
4. If a tool returns {"error": "confirmation_required", ...}, do NOT retry immediately — ask the buyer clearly:
   "The total is ₹[amount], which exceeds your threshold. Would you like me to confirm and place this order?"
   Only set buyer_confirmed=True on your next attempt AFTER the buyer says yes.
5. If payment check returns "failed" (e.g. card declined), explain the failure in plain language, offer to retry with UPI / alternative test method, and if it fails again, call escalate_to_human.
6. Never state an order has succeeded unless check_payment_status returns "paid".
7. After order completion, call get_cross_sell_recommendations to suggest a complementary bundle and grow merchant revenue.
"""


class DeterministicSimulatorAgent:
    """Smart Conversational Agent powered by SmartConversationalEngine with
    full dialogue state tracking, natural speech understanding, typo resilience,
    and interactive UI actions."""

    def __init__(self):
        self.engine = SmartConversationalEngine()

    def invoke(self, state: Dict[str, Any]) -> Dict[str, Any]:
        messages = state.get("messages", [])
        if not messages:
            return {"messages": []}

        last_msg = messages[-1]
        text = getattr(last_msg, "content", "") or ""
        if isinstance(text, list):
            text = " ".join(b.get("text", "") for b in text if isinstance(b, dict))
        user_input = str(text).strip()

        turn_result = self.engine.process_turn(user_input)

        ai_msg = AIMessage(
            content=turn_result["reply_text"],
            additional_kwargs={
                "product_cards": turn_result.get("product_cards", []),
                "action_sheet": turn_result.get("action_sheet"),
                "quick_replies": turn_result.get("quick_replies", []),
            },
        )
        return {"messages": messages + [ai_msg]}


def build_agent(provider: Optional[str] = None, api_key: Optional[str] = None):
    """Factory to construct agent based on selected provider and API keys."""
    provider = (provider or os.environ.get("CONCIERGE_PROVIDER", "auto")).lower()
    
    # 1. Anthropic
    anthropic_key = api_key if provider == "anthropic" else os.environ.get("ANTHROPIC_API_KEY")
    if (provider in ("anthropic", "auto")) and anthropic_key:
        try:
            from langchain_anthropic import ChatAnthropic
            model_name = os.environ.get("CONCIERGE_MODEL", "claude-3-5-sonnet-20241022")
            llm = ChatAnthropic(model=model_name, temperature=0, api_key=anthropic_key)
            return create_react_agent(llm, tools=ALL_TOOLS, prompt=SYSTEM_PROMPT)
        except Exception as e:
            if provider == "anthropic":
                raise e

    # 2. OpenAI
    openai_key = api_key if provider == "openai" else os.environ.get("OPENAI_API_KEY")
    if (provider in ("openai", "auto")) and openai_key:
        try:
            from langchain_openai import ChatOpenAI
            model_name = os.environ.get("CONCIERGE_MODEL", "gpt-4o-mini")
            llm = ChatOpenAI(model=model_name, temperature=0, api_key=openai_key)
            return create_react_agent(llm, tools=ALL_TOOLS, prompt=SYSTEM_PROMPT)
        except Exception as e:
            if provider == "openai":
                raise e

    # 3. Google Gemini
    gemini_key = api_key if provider in ("gemini", "google") else (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
    if (provider in ("gemini", "google", "auto")) and gemini_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model_name = os.environ.get("CONCIERGE_MODEL", "gemini-2.0-flash")
            llm = ChatGoogleGenerativeAI(model=model_name, temperature=0, google_api_key=gemini_key)
            return create_react_agent(llm, tools=ALL_TOOLS, prompt=SYSTEM_PROMPT)
        except Exception as e:
            if provider in ("gemini", "google"):
                raise e

    # 4. Built-in Deterministic Simulator (Zero Key Required)
    return DeterministicSimulatorAgent()


def run_turn(agent, messages: list) -> list:
    """Invokes agent and handles message formatting seamlessly."""
    formatted_messages = []
    for m in messages:
        if isinstance(m, BaseMessage):
            formatted_messages.append(m)
        elif isinstance(m, dict):
            role = m.get("role")
            content = m.get("content", "")
            if role in ("user", "human"):
                formatted_messages.append(HumanMessage(content=content))
            elif role in ("assistant", "ai"):
                formatted_messages.append(AIMessage(content=content))
        else:
            formatted_messages.append(HumanMessage(content=str(m)))

    result = agent.invoke({"messages": formatted_messages})
    return result["messages"]
