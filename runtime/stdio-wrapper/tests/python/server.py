import json
import os
import sys


def main():
    for line in sys.stdin:
        request = json.loads(line)
        if "id" not in request:
            continue
        params = request.get("params", {})
        method = request["method"]
        if method == "initialize":
            result = {"protocolVersion": params["protocolVersion"], "capabilities": {"tools": {}, "resources": {}, "prompts": {}}, "serverInfo": {"name": "fragai-python-fixture", "version": "0.0.1"}}
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": [{"name": "echo", "description": "Return test input", "inputSchema": {"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}}]}
        elif method == "tools/call":
            result = {"content": [{"type": "text", "text": json.dumps({"language": "python", "message": params["arguments"]["message"], "configured": os.environ.get("FRAGAI_FIXTURE_VALUE"), "secretLeaked": bool(os.environ.get("FRAGAI_UNFORWARDED_SECRET")), "cwd": os.getcwd()})}]}
        elif method == "resources/list":
            result = {"resources": [{"name": "fixture", "uri": "fixture://python/data", "mimeType": "text/plain"}]}
        elif method == "resources/templates/list":
            result = {"resourceTemplates": []}
        elif method == "resources/read":
            result = {"contents": [{"uri": params["uri"], "mimeType": "text/plain", "text": "python resource"}]}
        elif method == "prompts/list":
            result = {"prompts": [{"name": "greeting", "description": "Test prompt"}]}
        elif method == "prompts/get":
            result = {"messages": [{"role": "user", "content": {"type": "text", "text": "python prompt"}}]}
        else:
            print(json.dumps({"jsonrpc": "2.0", "id": request["id"], "error": {"code": -32601, "message": "Method not found"}}), flush=True)
            continue
        print(json.dumps({"jsonrpc": "2.0", "id": request["id"], "result": result}), flush=True)
