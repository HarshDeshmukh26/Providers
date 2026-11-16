#!/usr/bin/env node
const readline = require("node:readline");
const output = (value) => process.stdout.write(JSON.stringify(value) + "\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  const params = request.params || {};
  const text = (value) => ({ content: [{ type: "text", text: value }] });
  let result;
  switch (request.method) {
    case "initialize":
      result = {
        protocolVersion: request.params.protocolVersion,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: "fragai-node-fixture", version: "0.0.1" },
      };
      break;
    case "ping":
      result = {};
      break;
    case "tools/list":
      result = {
        tools: [
          {
            name: "echo",
            description: "Return test input",
            inputSchema: {
              type: "object",
              properties: { message: { type: "string" } },
              required: ["message"],
            },
          },
        ],
      };
      break;
    case "tools/call":
      result = text(
        JSON.stringify({
          language: "node",
          message: params.arguments.message,
          configured: process.env.FRAGAI_FIXTURE_VALUE,
          secretLeaked: !!process.env.FRAGAI_UNFORWARDED_SECRET,
          cwd: process.cwd(),
        }),
      );
      break;
    case "resources/list":
      result = {
        resources: [
          {
            name: "fixture",
            uri: "fixture://node/data",
            mimeType: "text/plain",
          },
        ],
      };
      break;
    case "resources/templates/list":
      result = { resourceTemplates: [] };
      break;
    case "resources/read":
      result = {
        contents: [
          { uri: params.uri, mimeType: "text/plain", text: "node resource" },
        ],
      };
      break;
    case "prompts/list":
      result = { prompts: [{ name: "greeting", description: "Test prompt" }] };
      break;
    case "prompts/get":
      result = {
        messages: [
          { role: "user", content: { type: "text", text: "node prompt" } },
        ],
      };
      break;
    default:
      output({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: "Method not found" },
      });
      return;
  }
  output({ jsonrpc: "2.0", id: request.id, result });
});
