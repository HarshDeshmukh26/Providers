import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const component = path.join(root, "runtime/http-webhook-converter");
const lock = JSON.parse(
  fs.readFileSync(path.join(component, "sources.lock.json")),
);
const { values } = parseArgs({
  options: {
    image: {
      type: "string",
      default: "fragai-http-webhook-converter:phase4-amd64",
    },
    platform: { type: "string", default: "linux/amd64" },
    report: { type: "string" },
  },
});
assert(["linux/amd64", "linux/arm64"].includes(values.platform));
const architecture = values.platform.split("/")[1];
const reportPath = path.resolve(
  root,
  values.report ?? `bin/independence/phase-4-webhook-${architecture}.json`,
);
assert(
  reportPath.startsWith(root + path.sep),
  "Keep validation reports in this checkout",
);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const run = `fragai-webhook-${randomUUID().slice(0, 12)}`;
const label = "ai.fragai.webhook-test";
const owned = new Set();
const report = {
  startedAt: new Date().toISOString(),
  image: values.image,
  baseline: lock.baselineImage,
  platform: values.platform,
  stages: [],
  cleanupErrors: [],
  passed: false,
  customerDataUsed: false,
  productionDeploymentChanged: false,
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function docker(...args) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `Docker ${args[0]} failed: ${result.stderr || result.error?.message}`,
  );
  return result.stdout.trim();
}
function inspect(kind, id) {
  return JSON.parse(
    docker(
      kind,
      "inspect",
      ...(kind === "image" ? ["--platform", values.platform] : []),
      id,
    ),
  )[0];
}
function remove(name) {
  const info = inspect("container", name);
  assert.equal(
    info.Config.Labels[label],
    run,
    "Refusing to remove an unrelated container",
  );
  docker("rm", "--force", "--volumes", name);
  owned.delete(name);
}
function inventory(image) {
  const info = inspect("image", image);
  assert.equal(`${info.Os}/${info.Architecture}`, values.platform);
  const name = `${run}-inventory-${randomUUID().slice(0, 6)}`;
  owned.add(name);
  const { provenance, ...installed } = JSON.parse(
    docker(
      "run",
      "--name",
      name,
      "--label",
      `${label}=${run}`,
      "--platform",
      values.platform,
      "--network",
      "none",
      "--mount",
      `type=bind,source=${path.join(component, "tests/inventory.cjs")},target=/inventory.cjs,readonly`,
      "--entrypoint",
      "node",
      image,
      "/inventory.cjs",
    ),
  );
  remove(name);
  return {
    id: info.Id,
    ...(provenance ? { provenance } : {}),
    contract: {
      user: info.Config.User ?? "",
      entrypoint: info.Config.Entrypoint,
      cmd: info.Config.Cmd,
      workdir: info.Config.WorkingDir,
      env: [...info.Config.Env].sort(),
      ports: info.Config.ExposedPorts ?? {},
      volumes: info.Config.Volumes ?? {},
    },
    installed,
  };
}
const receipts = [];
let status = 200;
let responseBody = "allowed";
let disconnect = false;
const receiver = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    receipts.push({
      path: req.url,
      method: req.method,
      body,
      signature: req.headers["x-obot-signature-256"],
      contentType: req.headers["content-type"],
    });
    if (disconnect) {
      req.socket.destroy();
      return;
    }
    res
      .writeHead(status, { "Content-Type": "application/json" })
      .end(responseBody);
  } catch {
    res.destroy();
  }
});
let fixtureBase;
let sequence = 0;
async function request(endpoint, method, body, session) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(session
        ? { "Mcp-Session-Id": session, "MCP-Protocol-Version": "2025-03-26" }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  return {
    status: response.status,
    session: response.headers.get("mcp-session-id"),
    text,
  };
}
async function rpc(endpoint, session, method, params = {}) {
  const reply = await request(
    endpoint,
    "POST",
    { jsonrpc: "2.0", id: ++sequence, method, params },
    session,
  );
  assert.equal(
    reply.status,
    200,
    `${method}: HTTP ${reply.status}: ${reply.text.slice(0, 300)}`,
  );
  const text = reply.text.trim().startsWith("{")
    ? reply.text
    : reply.text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
  const value = JSON.parse(text);
  assert(!value.error, `${method}: ${JSON.stringify(value.error)}`);
  return { result: value.result, session: reply.session ?? session };
}
async function initialized(endpoint) {
  return rpc(endpoint, undefined, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "fragai-webhook-validation", version: "1" },
  });
}
async function ready(name, port) {
  const deadline = Date.now() + 60000;
  let last;
  while (Date.now() < deadline) {
    const info = inspect("container", name);
    assert(info.State.Running, "Converter exited before initialization");
    const binding = info.NetworkSettings.Ports[`${port}/tcp`]?.[0];
    if (binding) {
      const endpoint = `http://127.0.0.1:${binding.HostPort}/mcp`;
      try {
        return { endpoint, init: await initialized(endpoint) };
      } catch (error) {
        last = error;
      }
    }
    await delay(500);
  }
  throw Error(`Converter readiness timeout: ${last?.message}`);
}
function launch(image, settings) {
  const name = `${run}-${randomUUID().slice(0, 7)}`;
  owned.add(name);
  docker(
    "run",
    "--detach",
    "--name",
    name,
    "--label",
    `${label}=${run}`,
    "--platform",
    values.platform,
    ...(process.platform === "linux"
      ? ["--add-host", "host.docker.internal:host-gateway"]
      : []),
    "--publish",
    `127.0.0.1::${settings.port}`,
    "--env",
    `WEBHOOK_URL=${fixtureBase}${settings.path}`,
    "--env",
    `PORT=${settings.port}`,
    ...(settings.secret ? ["--env", `WEBHOOK_SECRET=${settings.secret}`] : []),
    image,
  );
  return name;
}
let protocol;
async function verify(name, settings, stage, previousSession) {
  report.currentStage = stage;
  const { endpoint, init } = await ready(name, settings.port);
  assert(init.session, "Initialize must create a session");
  if (previousSession) {
    assert.notEqual(init.session, previousSession);
    const stale = await request(
      endpoint,
      "POST",
      { jsonrpc: "2.0", id: ++sequence, method: "tools/list" },
      previousSession,
    );
    assert.equal(
      stale.status,
      400,
      "A restarted process must reject a stale session",
    );
  }
  assert.equal((await request(endpoint, "GET")).status, 400);
  assert.equal((await request(endpoint, "DELETE")).status, 400);
  const invalid = await request(
    endpoint,
    "POST",
    { jsonrpc: "2.0", id: ++sequence, method: "tools/list" },
    "synthetic-invalid-session",
  );
  assert.equal(invalid.status, 400);
  const tools = await rpc(endpoint, init.session, "tools/list");
  assert.equal(tools.result.tools.length, 1);
  assert.equal(tools.result.tools[0].name, "fire-webhook");
  const currentProtocol = { initialize: init.result, tools: tools.result };
  if (!protocol) protocol = currentProtocol;
  else
    assert.deepEqual(
      currentProtocol,
      protocol,
      "MCP identity, capabilities or tool schema changed",
    );
  const checks = ["initialize", "tool-schema", "missing-and-invalid-sessions"];
  const cases = [
    200,
    201,
    204,
    299,
    400,
    401,
    403,
    429,
    500,
    503,
    "body-decision-ignored",
    "disconnect",
  ];
  for (const testCase of cases) {
    status = typeof testCase === "number" ? testCase : 200;
    responseBody =
      testCase === "body-decision-ignored"
        ? '{"accept":false}'
        : "synthetic policy decision";
    disconnect = testCase === "disconnect";
    const message = {
      jsonrpc: "2.0",
      id: sequence + 1,
      ...(status % 2
        ? {
            result: {
              content: [{ type: "text", text: "literal-$-value नमस्ते" }],
            },
          }
        : {
            method: "tools/call",
            params: {
              name: "synthetic-tool",
              arguments: { text: "literal-$-value नमस्ते" },
            },
          }),
    };
    const before = receipts.length;
    const call = await rpc(endpoint, init.session, "tools/call", {
      name: "fire-webhook",
      arguments: { accept: true, reason: "", message },
    });
    assert(
      !call.result.isError,
      `Webhook decision must be a structured result: ${testCase}`,
    );
    const decision = call.result.structuredContent;
    assert.deepEqual(JSON.parse(call.result.content[0].text), decision);
    assert.equal(decision.accept, !disconnect && status >= 200 && status < 300);
    if (disconnect)
      assert.match(decision.reason, /^Failed to send to webhook:/);
    else if (status >= 300)
      assert.equal(
        decision.reason,
        `Webhook returned error: ${status} synthetic policy decision`,
      );
    else assert.equal(decision.reason, "Message accepted by webhook");
    assert.equal(receipts.length, before + 1);
    const receipt = receipts.at(-1);
    assert.equal(receipt.path, settings.path);
    assert.equal(receipt.method, "POST");
    assert.equal(receipt.contentType, "application/json");
    assert.deepEqual(JSON.parse(receipt.body), message);
    assert.equal(
      receipt.signature,
      settings.secret
        ? createHmac("sha256", settings.secret)
            .update(receipt.body)
            .digest("hex")
        : undefined,
    );
    checks.push(String(testCase));
  }
  disconnect = false;
  const malformed = await rpc(endpoint, init.session, "tools/call", {
    name: "fire-webhook",
    arguments: { message: {} },
  });
  assert.equal(
    malformed.result.isError,
    true,
    "Missing required tool arguments must be rejected",
  );
  const sse = await fetch(endpoint, {
    headers: {
      Accept: "text/event-stream",
      "Mcp-Session-Id": init.session,
      "MCP-Protocol-Version": "2025-03-26",
    },
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(sse.status, 200);
  assert.match(sse.headers.get("content-type"), /^text\/event-stream/);
  await sse.body.cancel();
  const closed = await request(endpoint, "DELETE", undefined, init.session);
  assert.equal(closed.status, 200);
  const expired = await request(
    endpoint,
    "POST",
    { jsonrpc: "2.0", id: ++sequence, method: "tools/list" },
    init.session,
  );
  assert.equal(expired.status, 400);
  checks.push(
    "invalid-tool-input",
    "get-sse",
    "delete-session",
    "closed-session-rejected",
  );
  report.stages.push({
    name: stage,
    port: settings.port,
    signed: !!settings.secret,
    checks,
    passed: true,
  });
  console.log(`Passed webhook ${stage}: ${checks.length} checks.`);
  return init.session;
}
try {
  report.baselineInventory = inventory(lock.baselineImage);
  report.candidateInventory = inventory(values.image);
  const expected = JSON.parse(
    fs.readFileSync(path.join(component, lock.inventories[architecture].file)),
  );
  assert.deepEqual(
    report.baselineInventory.installed,
    expected,
    "Retained baseline differs from its recorded inventory",
  );
  assert.deepEqual(
    report.candidateInventory.installed,
    expected,
    "Candidate changed Node/npm, OS packages, dependencies or application files",
  );
  assert.deepEqual(
    report.candidateInventory.contract,
    report.baselineInventory.contract,
    "Container launch contract changed",
  );
  assert.deepEqual(
    report.candidateInventory.provenance?.lock,
    lock,
    "Candidate source record differs from this checkout",
  );
  assert.equal(
    report.candidateInventory.provenance.license,
    lock.source.files.LICENSE,
    "Candidate is missing the original license",
  );
  assert.equal(
    report.candidateInventory.provenance.notices,
    createHash("sha256")
      .update(fs.readFileSync(path.join(component, "THIRD_PARTY_NOTICES.md")))
      .digest("hex"),
    "Candidate notices differ from this checkout",
  );
  const missingName = `${run}-missing-url`;
  owned.add(missingName);
  docker(
    "create",
    "--name",
    missingName,
    "--label",
    `${label}=${run}`,
    "--platform",
    values.platform,
    "--network",
    "none",
    values.image,
  );
  docker("start", missingName);
  assert.equal(docker("wait", missingName), "1");
  const missing = inspect("container", missingName);
  assert.equal(
    missing.State.ExitCode,
    1,
    "Missing WEBHOOK_URL must fail startup",
  );
  remove(missingName);
  await new Promise((resolve) => receiver.listen(0, "0.0.0.0", resolve));
  fixtureBase = `http://host.docker.internal:${receiver.address().port}`;
  const signed = {
    port: 8099,
    path: "/policy/v1",
    secret: `synthetic-$-secret-${randomUUID()}`,
  };
  const updated = { port: 18099, path: "/policy/v2", secret: "" };
  let name = launch(lock.baselineImage, signed);
  await verify(name, signed, "baseline");
  remove(name);
  name = launch(values.image, signed);
  await verify(name, signed, "candidate");
  const beforeRestart = await ready(name, signed.port);
  docker("restart", "--time", "5", name);
  await verify(name, signed, "restart", beforeRestart.init.session);
  remove(name);
  name = launch(values.image, updated);
  await verify(name, updated, "reconfigure");
  remove(name);
  name = launch(lock.baselineImage, updated);
  await verify(name, updated, "rollback");
  remove(name);
  assert.equal(report.stages.length, 5);
  report.passed = true;
} catch (error) {
  report.error = error.message;
  console.error(error.message);
} finally {
  for (const name of owned) {
    try {
      remove(name);
    } catch (error) {
      report.cleanupErrors.push(error.message);
    }
  }
  receiver.closeAllConnections();
  if (receiver.listening)
    await new Promise((resolve) => receiver.close(resolve));
  if (report.cleanupErrors.length) report.passed = false;
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        report: path.relative(root, reportPath),
        passed: report.passed,
        stages: report.stages.length,
        error: report.error,
        cleanupErrors: report.cleanupErrors,
      },
      null,
      2,
    ),
  );
  if (!report.passed) process.exitCode = 1;
}
