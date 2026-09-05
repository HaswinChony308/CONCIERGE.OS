"""
MCP server for Concierge.

Two reasons this exists, not one:

1. Dev workflow: point Claude Code, Claude Desktop, or any other MCP
   client at this and you (or an agent) can keep building/poking the
   storefront from outside the Streamlit app — same guardrails, same
   audit log, nothing bypassed.

2. It's actually the Track 01 story, made literal: "agent-readable
   catalog" and "makes a merchant transactable by an AI buyer end to
   end" is exactly what an MCP server *is* — a machine-readable
   interface another agent can call. Point any MCP-capable AI buyer at
   this and it can browse the catalog and check out on its own,
   through the same spend-ceiling / confirmation / audit path a human
   buyer goes through in app.py. Worth a line in the pitch video.

Run: python mcp_server.py   (stdio transport — works with Claude
Desktop / Claude Code's local MCP config out of the box)
"""

from mcp.server.mcpserver import MCPServer

from agent.tools import (
    catalog_search,
    get_product,
    create_order,
    create_payment_link,
    check_payment_status,
    escalate_to_human,
    get_cross_sell_recommendations,
)
from agent.audit import read_trail

server = MCPServer(
    name="concierge",
    description=(
        "Merchant storefront agent for a Razorpay-test-mode shop: search the "
        "catalog, place orders, and pay via payment links, gated by a spend "
        "ceiling and a buyer-confirmation step, with every action audited."
    ),
)

# Reuse the exact same, already-tested functions the LangGraph agent and
# the smoke test use — `.func` is the plain callable LangChain's @tool
# decorator wraps. No logic is duplicated or re-implemented here.
server.add_tool(catalog_search.func, name="catalog_search", description=catalog_search.description)
server.add_tool(get_product.func, name="get_product", description=get_product.description)
server.add_tool(create_order.func, name="create_order", description=create_order.description)
server.add_tool(create_payment_link.func, name="create_payment_link", description=create_payment_link.description)
server.add_tool(check_payment_status.func, name="check_payment_status", description=check_payment_status.description)
server.add_tool(escalate_to_human.func, name="escalate_to_human", description=escalate_to_human.description)
server.add_tool(get_cross_sell_recommendations.func, name="get_cross_sell_recommendations", description=get_cross_sell_recommendations.description)


@server.tool()
def read_audit_trail(last_n: int = 20) -> list:
    """Return the most recent audit log records (intents and outcomes) for
    inspection — useful for a human or agent reviewing what Concierge has
    done so far."""
    trail = read_trail()
    return trail[-last_n:]


if __name__ == "__main__":
    server.run(transport="stdio")
