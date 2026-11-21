"""Exercise the real HTTP MCP server against an isolated, per-user API fixture."""

import asyncio
import json
import sys
import threading
from contextlib import asynccontextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import httpx
from mcp import ClientSession, types
from mcp.client.streamable_http import streamablehttp_client


def entry(identifier, name, runtime="remote", **manifest):
    return {"id": identifier, "manifest": {"name": name, "runtime": runtime, **manifest}}


entries = [
    entry("c-title", "Alpha tools", shortDescription="fixture", remoteConfig={"fixedURL": "https://fixture.invalid/mcp"}),
    entry("c-short", "Beta tools", "npx", shortDescription="alpha fixture"),
    entry("c-description", "Gamma tools", "uvx", description="alpha fixture"),
    entry("c-config", "Configuration fixture", env=[{"key": "SECRET", "name": "API key", "required": True, "sensitive": True}, {"key": "OPTIONAL", "name": "Optional"}, {"key": "STATIC", "name": "Static", "value": "preset"}], remoteConfig={"fixedURL": "https://fixture.invalid/mcp"}),
    entry("c-host", "Hostname fixture", remoteConfig={"hostname": "*.fixture.invalid"}),
    entry("c-template", "Template fixture", remoteConfig={"urlTemplate": "https://${HOST}/mcp"}),
    entry("c-oauth", "OAuth fixture", icon="https://fixture.invalid/icon.svg", remoteConfig={"fixedURL": "https://fixture.invalid/mcp"}),
    entry("c-composite", "Composite fixture", "composite"),
    entry("c-admin", "Administrator OAuth fixture", remoteConfig={"staticOAuthRequired": True}),
    entry("c-launch-fail", "Launch failure fixture", "npx"),
]
multi = [
    {**entry("mu-simple", "Shared fixture"), "configured": True},
    {**entry("mu-config", "Shared header fixture", multiUserConfig={"userDefinedHeaders": [{"key": "X-User-Key", "name": "User key", "required": True, "sensitive": True}]}), "configured": True},
]
state = {}
checks = []


def reset():
    state.clear()
    state.update(servers=[], instances=[], receipts=[], oauth_done=False)


class API(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.respond()

    def do_POST(self):
        self.respond()

    def respond(self):
        principal = self.headers.get("Authorization", "").removeprefix("Bearer fixture-")
        if principal not in ("alice", "bob"):
            return self.reply({"error": "fixture authorization required"}, 401)
        route = urlparse(self.path).path
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
        state["receipts"].append({"method": self.command, "path": route, "principal": principal, "body": body})
        catalog = entries + [entry(f"c-{principal}", f"Visible only to {principal}", "npx")]
        if route == "/api/all-mcps/entries":
            return self.reply({"items": catalog})
        if route.startswith("/api/all-mcps/entries/"):
            found = next((e for e in catalog if e["id"] == route.rsplit("/", 1)[-1]), None)
            return self.reply(found or {}, 200 if found else 404)
        if route == "/api/all-mcps/servers":
            return self.reply({"items": multi})
        if route.startswith("/api/all-mcps/servers/"):
            found = next((e for e in multi if e["id"] == route.rsplit("/", 1)[-1]), None)
            return self.reply(found or {}, 200 if found else 404)
        if route == "/api/mcp-servers" and self.command == "GET":
            return self.reply({"items": state["servers"]})
        if route == "/api/mcp-servers" and self.command == "POST":
            server = {"id": "ms-" + body["catalogEntryID"], "catalogEntryID": body["catalogEntryID"], "manifest": body.get("manifest", {}), "configured": False}
            state["servers"].append(server)
            return self.reply(server)
        if route == "/api/mcp-server-instances" and self.command == "GET":
            return self.reply({"items": state["instances"]})
        if route == "/api/mcp-server-instances" and self.command == "POST":
            instance = {"id": "instance-" + body["mcpServerID"], "mcpServerID": body["mcpServerID"]}
            state["instances"].append(instance)
            return self.reply(instance)
        if route.endswith("/oauth-url"):
            url = "https://fixture.invalid/oauth" if "c-oauth" in route and not state["oauth_done"] else ""
            return self.reply({"oauthURL": url})
        if route.endswith("/launch"):
            return self.reply({"error": "synthetic launch failure"}, 503) if "launch-fail" in route else self.reply({})
        if route.endswith("/configure") or route.endswith("/update-url"):
            return self.reply({})
        return self.reply({"error": "unknown fixture route"}, 404)

    def reply(self, value, status=200):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


@asynccontextmanager
async def connect(principal="alice", action="accept", content=None, elicitations=None):
    async def elicit(_context, params):
        data = params.model_dump(by_alias=True, exclude_none=True)
        data.pop("elicitationId", None)
        if elicitations is not None:
            elicitations.append(data)
        if getattr(params, "mode", None) == "url" and action == "accept":
            state["oauth_done"] = True
        return types.ElicitResult(action=action, content=content if action == "accept" else None)

    headers = {"Authorization": f"Bearer fixture-{principal}"} if principal else {}
    async with streamablehttp_client(sys.argv[1], headers=headers) as (reader, writer, _):
        async with ClientSession(reader, writer, elicitation_callback=elicit) as session:
            initialized = await session.initialize()
            yield session, initialized


async def tool(session, name, arguments=None):
    result = await session.call_tool(name, arguments or {})
    assert not result.isError, f"Tool {name} unexpectedly failed"
    return result.structuredContent or json.loads(result.content[0].text)


async def scenario(name, identifier, status, *, action="accept", content=None, servers=None, instances=None):
    reset()
    state["servers"] = servers or []
    state["instances"] = instances or []
    elicited = []
    async with connect(action=action, content=content, elicitations=elicited) as (session, _):
        result = await tool(session, "obot_connect_to_mcp_server", {"server_id": identifier})
    assert result["status"] == status, f"{name}: unexpected status {result.get('status')}"
    assert all(r["principal"] == "alice" for r in state["receipts"]), "Forwarded authorization was lost"
    if result.get("connect_url"):
        assert result["connect_url"].startswith("http://api-fixture:9000/mcp-connect/")
    checks.append({"name": name, "result": result, "elicitations": elicited})
    return state["receipts"], elicited


async def main():
    reset()
    async with httpx.AsyncClient() as client:
        health = await client.get(sys.argv[1].removesuffix("/mcp") + "/healthz")
        assert health.status_code == 200 and health.json() == {"status": "ok"}
    checks.append({"name": "health endpoint"})
    async with connect() as (session, initialized):
        capabilities = initialized.capabilities.model_dump(exclude_none=True)
        assert "tools" in capabilities and "resources" not in capabilities and "prompts" not in capabilities
        tools = (await session.list_tools()).model_dump(by_alias=True, exclude_none=True)
        assert sorted(t["name"] for t in tools["tools"]) == sorted(["obot_list_mcp_servers", "obot_list_connected_mcp_servers", "obot_search_mcp_servers", "obot_connect_to_mcp_server"])
        checks.append({"name": "initialize and exact four-tool schemas", "capabilities": capabilities, "tools": tools})
        listed = await tool(session, "obot_list_mcp_servers")
        assert listed["total_count"] == len(entries) + 1 + len(multi)
        assert any(e["id"] == "c-alice" for e in listed["catalog_entries"])
        filtered = await tool(session, "obot_list_mcp_servers", {"include_servers": False, "runtime_filter": "NPX", "limit": 2})
        # The retained API client truncates before applying the runtime filter.
        assert [e["id"] for e in filtered["catalog_entries"]] == ["c-short"] and not filtered["multi_user_servers"]
        none = await tool(session, "obot_list_mcp_servers", {"include_entries": False, "include_servers": False})
        assert none["total_count"] == 0
        searched = await tool(session, "obot_search_mcp_servers", {"query": "ALPHA"})
        assert [e["id"] for e in searched["catalog_entries"]] == ["c-title", "c-short", "c-description"]
        limited = await tool(session, "obot_search_mcp_servers", {"query": "alpha", "limit": 1})
        assert len(limited["catalog_entries"]) == 1
        checks.append({"name": "listing, runtime filters, limits and ranked search", "listed": listed, "filtered": filtered, "none": none, "searched": searched, "limited": limited})
        state["servers"] = [
            {"id": "ms-ready", "catalogEntryID": "c-title", "configured": True},
            {"id": "ms-unconfigured", "catalogEntryID": "c-short", "configured": False},
            {"id": "ms1nba-agent", "configured": True},
        ]
        state["instances"] = [{"id": "instance-ready", "mcpServerID": "mu-simple"}]
        connected = await tool(session, "obot_list_connected_mcp_servers")
        assert [e["id"] for e in connected["connected_servers"]] == ["ms-ready", "instance-ready"]
        checks.append({"name": "connected personal/shared inventory and agent exclusion", "result": connected})
    await scenario("unknown server", "missing", "not_found")
    await scenario("composite rejection", "c-composite", "error")
    await scenario("administrator OAuth prerequisite", "c-admin", "error")
    await scenario("create and launch personal server", "c-title", "configured")
    await scenario("reuse configured personal server", "c-title", "already_configured", servers=[{"id": "ms-existing", "catalogEntryID": "c-title", "configured": True}])
    await scenario("launch failure remains an error", "c-launch-fail", "error")
    receipts, elicited = await scenario("configuration form acceptance", "c-config", "configured", content={"SECRET": "synthetic-key", "OPTIONAL": ""})
    assert next(r for r in receipts if r["path"].endswith("/configure"))["body"] == {"SECRET": "synthetic-key"}
    assert elicited[0]["requestedSchema"]["properties"]["SECRET"]["format"] == "password"
    assert "STATIC" not in elicited[0]["requestedSchema"]["properties"]
    for action in ("decline", "cancel"):
        receipts, _ = await scenario(f"configuration form {action}", "c-config", "cancelled", action=action)
        assert not any(r["method"] == "POST" for r in receipts)
    receipts, _ = await scenario("hostname URL creation", "c-host", "configured", content={"url": "https://tenant.fixture.invalid/mcp"})
    assert next(r for r in receipts if r["path"] == "/api/mcp-servers" and r["method"] == "POST")["body"]["manifest"]["remoteConfig"]["url"] == "https://tenant.fixture.invalid/mcp"
    await scenario("hostname URL mismatch", "c-host", "error", content={"url": "https://wrong.invalid/mcp"})
    receipts, _ = await scenario("existing hostname URL update", "c-host", "configured", content={"url": "https://tenant.fixture.invalid/mcp"}, servers=[{"id": "ms-existing", "catalogEntryID": "c-host", "configured": False}])
    assert any(r["path"].endswith("/update-url") for r in receipts)
    await scenario("URL template configuration", "c-template", "configured", content={"HOST": "tenant.fixture.invalid"})
    await scenario("new shared connection", "mu-simple", "available")
    await scenario("existing shared connection", "mu-simple", "already_connected", instances=[{"id": "instance-existing", "mcpServerID": "mu-simple", "configured": True}])
    receipts, _ = await scenario("shared user-specific header configuration", "mu-config", "configured", content={"X-User-Key": "synthetic-user-key"})
    assert next(r for r in receipts if r["path"].endswith("/configure"))["body"] == {"X-User-Key": "synthetic-user-key"}
    await scenario("reuse unconfigured shared instance", "mu-config", "configured", content={"X-User-Key": "synthetic-user-key"}, instances=[{"id": "instance-existing", "mcpServerID": "mu-config", "configured": False}])
    _, elicited = await scenario("OAuth URL acceptance and completion polling", "c-oauth", "configured")
    assert elicited[0]["mode"] == "url"
    assert elicited[0]["_meta"]["ai.nanobot.meta/oauth-url"] == "https://fixture.invalid/oauth"
    for action in ("decline", "cancel"):
        await scenario(f"OAuth URL {action}", "c-oauth", "cancelled", action=action)
    reset()
    async def user_inventory(principal):
        async with connect(principal) as (session, _):
            result = await tool(session, "obot_list_mcp_servers")
            ids = [e["id"] for e in result["catalog_entries"]]
            assert f"c-{principal}" in ids
            assert f"c-{'bob' if principal == 'alice' else 'alice'}" not in ids
    await asyncio.gather(user_inventory("alice"), user_inventory("bob"))
    assert {r["principal"] for r in state["receipts"]} == {"alice", "bob"}
    checks.append({"name": "concurrent users retain separate forwarded authorization"})
    async with connect(None) as (session, _):
        result = await session.call_tool("obot_list_mcp_servers", {})
        assert result.isError, "Missing forwarded credentials must not expose inventory"
    checks.append({"name": "missing credentials cannot read inventory"})
    print(json.dumps({"passed": True, "checks": checks}))


if __name__ == "__main__":
    reset()
    fixture = ThreadingHTTPServer(("0.0.0.0", 9000), API)
    threading.Thread(target=fixture.serve_forever, daemon=True).start()
    try:
        # QEMU ARM64 execution is substantially slower than native AMD64.
        asyncio.run(asyncio.wait_for(main(), timeout=480))
    finally:
        fixture.shutdown()
