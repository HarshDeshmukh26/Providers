import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(
  fs.readFileSync(
    path.join(root, "runtime/stdio-wrapper/sources.lock.json"),
    "utf8",
  ),
);
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(
    args[index + 1] && !args[index + 1].startsWith("--"),
    `Missing ${name} value`,
  );
  return args[index + 1];
}
const image = option("--image", "fragai-stdio-wrapper:phase4-amd64");
const baseline = option("--baseline", lock.baselineImage);
const platform = option("--platform", "linux/amd64");
assert(["linux/amd64", "linux/arm64"].includes(platform));
const reportPath = path.resolve(
  option(
    "--report",
    `bin/independence/phase-4-stdio-${platform.split("/")[1]}.json`,
  ),
);
const run = `fragai-stdio-${randomUUID().slice(0, 12)}`;
const label = "ai.fragai.stdio-test";
const containers = new Set();
const volumes = new Set();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fragai-stdio-test-"));
const configFile = path.join(temp, "mmmcp.yaml");
const nodeFixture = path.join(temp, "node");
fs.mkdirSync(nodeFixture, { mode: 0o755 });
for (const name of ["package.json", "server.cjs"]) {
  fs.copyFileSync(
    path.join(root, "runtime/stdio-wrapper/tests/node", name),
    path.join(nodeFixture, name),
  );
}
// Windows Git checkouts do not retain POSIX executable bits. Set the fixture's
// bin mode on this disposable copy so Linux CI does not depend on Git mode.
fs.chmodSync(path.join(nodeFixture, "server.cjs"), 0o755);
const report = {
  startedAt: new Date().toISOString(),
  image,
  baseline,
  platform,
  stages: [],
  passed: false,
  liveKubernetesTested: false,
  productionDeploymentChanged: false,
};
function docker(...values) {
  const result = spawnSync("docker", values, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180000,
  });
  assert.equal(
    result.status,
    0,
    `docker ${values[0]} failed: ${result.stderr}\n${result.stdout}\n${result.error || ""}`,
  );
  return (
    values[0] === "logs" ? result.stdout + result.stderr : result.stdout
  ).trim();
}
function inspect(kind, id) {
  return JSON.parse(
    docker(
      kind,
      "inspect",
      ...(kind === "image" ? ["--platform", platform] : []),
      id,
    ),
  )[0];
}
function removeContainer(id) {
  assert.equal(
    inspect("container", id).Config.Labels[label],
    run,
    "Refusing to remove an unrelated container",
  );
  docker("rm", "--force", "--volumes", id);
  containers.delete(id);
}
function inventoryRun(...values) {
  const name = `${run}-inventory-${randomUUID().slice(0, 8)}`;
  containers.add(name);
  const output = docker(
    "run",
    "--name",
    name,
    "--label",
    `${label}=${run}`,
    "--network",
    "none",
    "--platform",
    platform,
    ...values,
  );
  removeContainer(name);
  return output;
}
function inventory(reference) {
  const info = inspect("image", reference);
  assert.equal(
    `${info.Os}/${info.Architecture}`,
    platform,
    "Image architecture differs from selected platform; pull/build it first",
  );
  const config = info.Config;
  const shell = (command) =>
    inventoryRun("--entrypoint", "sh", reference, "-ec", command);
  const npmRoot = shell("npm root -g");
  const packages = JSON.parse(
    inventoryRun(
      "--entrypoint",
      "node",
      reference,
      "-e",
      `const fs=require('fs'); const root=${JSON.stringify(npmRoot)}+'/npm'; const names=['npm','brace-expansion','ip-address','tar','undici']; console.log(JSON.stringify(Object.fromEntries(names.map(n=>[n,JSON.parse(fs.readFileSync(n==='npm'?root+'/package.json':root+'/node_modules/'+n+'/package.json')).version]))));`,
    ),
  );
  const npmTree = JSON.parse(
    inventoryRun(
      "--mount",
      `type=bind,source=${path.join(root, "runtime/stdio-wrapper/tests/npm-inventory.cjs")},target=/inventory.cjs,readonly`,
      "--entrypoint",
      "node",
      reference,
      "/inventory.cjs",
      npmRoot,
    ),
  );
  return {
    id: info.Id,
    contract: {
      user: config.User,
      entrypoint: config.Entrypoint,
      cmd: config.Cmd,
      workdir: config.WorkingDir,
      volumes: config.Volumes,
      ports: config.ExposedPorts,
      env: [...config.Env].sort(),
    },
    identity: shell(
      "id -u; id -g; printf '%s\\n' \"$HOME\"; stat -c '%u:%g:%a' /var/lib/mmmcp /home/mmmcp",
    ),
    apk: shell("apk info -v").split("\n").sort(),
    apkControls: shell("cat /lib/apk/db/installed")
      .split(/\n\n+/)
      .filter((record) => record.includes("\nP:"))
      .map((record) => {
        const fields = Object.fromEntries(
          record.split("\n").map((line) => [line.slice(0, 1), line.slice(2)]),
        );
        return `${fields.P} ${fields.V} ${fields.C}`;
      })
      .sort(),
    apkPolicy: {
      world: shell("cat /etc/apk/world"),
      repositories: shell("cat /etc/apk/repositories"),
    },
    versions: shell(
      "node --version; npm --version; pnpm --version; python3 --version; uv --version; uvx --version; git --version; make --version | head -n 1",
    ),
    npm: packages,
    npmTree,
    help: shell("mmmcp --help 2>&1"),
  };
}
let sequence = 0;
async function rpc(endpoint, method, params = {}, session) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method, params }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.text();
  assert(response.ok, `${method}: HTTP ${response.status}: ${body}`);
  let message;
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    message = body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()))
      .find((entry) => entry.id === sequence);
  } else message = JSON.parse(body);
  assert(message && !message.error, `${method}: ${JSON.stringify(message)}`);
  return {
    result: message.result,
    session: response.headers.get("mcp-session-id") || session,
  };
}
async function exercise(reference, language, volume, stage) {
  const config = {
    name: "fragai-compatibility-test",
    version: "0.0.1",
    servers: [
      {
        name: "fixture",
        command: language === "node" ? "npx" : "uvx",
        args:
          language === "node"
            ? [
                "--offline",
                "--yes",
                "--package",
                "/fixtures/node",
                "fragai-fixture",
              ]
            : [
                "--offline",
                "--no-build-isolation",
                "--from",
                "/fixtures/python",
                "fragai-fixture",
              ],
        env: { FRAGAI_FIXTURE_VALUE: "synthetic-value-$-retained" },
      },
    ],
  };
  // JSON is also valid YAML and retains literal dollars via MMMCP's $$ escape.
  fs.writeFileSync(
    configFile,
    JSON.stringify(config).replaceAll("$", () => "$$"),
  );
  const fixtures = path.join(root, "runtime/stdio-wrapper/tests");
  const id = docker(
    "run",
    "--detach",
    "--platform",
    platform,
    "--label",
    `${label}=${run}`,
    "--name",
    `${run}-${language}-${stage}`,
    "--publish",
    "127.0.0.1::8099",
    "--mount",
    `type=bind,source=${configFile},target=/config/mmmcp.yaml,readonly`,
    "--mount",
    `type=bind,source=${fixtures},target=/fixtures,readonly`,
    "--mount",
    `type=bind,source=${nodeFixture},target=/fixtures/node,readonly`,
    "--mount",
    `type=volume,source=${volume},target=/var/lib/mmmcp`,
    "--env",
    "FRAGAI_UNFORWARDED_SECRET=synthetic-must-not-leak",
    reference,
    "--listen",
    ":8099",
    "--config",
    "/config/mmmcp.yaml",
  );
  containers.add(id);
  try {
    const bound = inspect("container", id).NetworkSettings.Ports["8099/tcp"][0];
    const endpoint = `http://127.0.0.1:${bound.HostPort}`;
    const deadline = Date.now() + 120000;
    let ready = false;
    while (Date.now() < deadline) {
      if (!inspect("container", id).State.Running) break;
      try {
        ready = (
          await fetch(endpoint + "/readyz", {
            signal: AbortSignal.timeout(2000),
          })
        ).ok;
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert(ready, `${stage}/${language} did not start: ${docker("logs", id)}`);
    const init = await rpc(endpoint, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "fragai-wrapper-check", version: "1" },
    });
    const session = init.session;
    const tools = (await rpc(endpoint, "tools/list", {}, session)).result.tools;
    const echo = tools.find((tool) => tool.name.endsWith("echo"));
    assert(echo, "Fixture echo tool was not discovered");
    const called = (
      await rpc(
        endpoint,
        "tools/call",
        { name: echo.name, arguments: { message: `hello-${stage}` } },
        session,
      )
    ).result;
    assert(!called.isError, JSON.stringify(called));
    const value = JSON.parse(called.content[0].text);
    assert.equal(value.language, language);
    assert.equal(value.message, `hello-${stage}`);
    assert.equal(value.configured, "synthetic-value-$-retained");
    assert.equal(
      value.secretLeaked,
      false,
      "Wrapper leaked an unforwarded environment variable",
    );
    assert.equal(value.cwd, "/var/lib/mmmcp");
    const resource = (await rpc(endpoint, "resources/list", {}, session)).result
      .resources[0];
    assert(resource, "Resource was not discovered");
    assert.equal(
      (await rpc(endpoint, "resources/read", { uri: resource.uri }, session))
        .result.contents[0].text,
      `${language} resource`,
    );
    const prompt = (await rpc(endpoint, "prompts/list", {}, session)).result
      .prompts[0];
    assert(prompt, "Prompt was not discovered");
    assert.equal(
      (await rpc(endpoint, "prompts/get", { name: prompt.name }, session))
        .result.messages[0].content.text,
      `${language} prompt`,
    );
    docker("exec", id, "sh", "-ec", "test -s /var/lib/mmmcp/mmmcp.db");
    if (stage === "baseline")
      docker(
        "exec",
        id,
        "sh",
        "-ec",
        "printf retained > /var/lib/mmmcp/fragai-test-marker",
      );
    assert.equal(
      docker("exec", id, "cat", "/var/lib/mmmcp/fragai-test-marker"),
      "retained",
    );
    const started = Date.now();
    docker("stop", "--time", "15", id);
    const state = inspect("container", id).State;
    assert.equal(
      state.ExitCode,
      0,
      `Wrapper did not shut down cleanly: ${docker("logs", id)}`,
    );
    assert(
      Date.now() - started < 15000,
      "Wrapper exceeded the shutdown grace period",
    );
    report.stages.push({
      stage,
      language,
      reference,
      imageId: inspect("container", id).Image,
      tools: tools.length,
      initialized: true,
      toolsResourcesPrompts: true,
      environmentIsolation: true,
      databaseAndMarkerRetained: true,
      gracefulShutdown: true,
    });
    console.log(
      `Passed ${language}: ${stage} (MCP tools/resources/prompts, environment, state, shutdown)`,
    );
  } catch (error) {
    console.error(docker("logs", id));
    throw error;
  } finally {
    removeContainer(id);
  }
}
try {
  report.baselineInventory = inventory(baseline);
  report.candidateInventory = inventory(image);
  for (const key of [
    "contract",
    "identity",
    "apk",
    "apkControls",
    "apkPolicy",
    "versions",
    "npm",
    "help",
    "npmTree",
  ]) {
    assert.deepEqual(
      report.candidateInventory[key],
      report.baselineInventory[key],
      `Baseline mismatch: ${key}`,
    );
  }
  for (const language of ["node", "python"]) {
    const volume = `${run}-${language}-data`;
    docker("volume", "create", "--label", `${label}=${run}`, volume);
    volumes.add(volume);
    for (const [stage, reference] of [
      ["baseline", baseline],
      ["candidate", image],
      ["restart", image],
      ["rollback", baseline],
    ]) {
      await exercise(reference, language, volume, stage);
    }
  }
  report.passed = true;
} catch (error) {
  report.error = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  const cleanupErrors = [];
  for (const id of containers) {
    try {
      removeContainer(id);
    } catch (error) {
      cleanupErrors.push(error.message);
    }
  }
  for (const volume of volumes) {
    try {
      assert.equal(
        inspect("volume", volume).Labels[label],
        run,
        "Refusing to remove an unrelated volume",
      );
      docker("volume", "rm", volume);
    } catch (error) {
      cleanupErrors.push(error.message);
    }
  }
  if (fs.existsSync(configFile)) fs.unlinkSync(configFile);
  for (const name of ["package.json", "server.cjs"])
    fs.unlinkSync(path.join(nodeFixture, name));
  fs.rmdirSync(nodeFixture);
  fs.rmdirSync(temp);
  report.cleanupErrors = cleanupErrors;
  if (cleanupErrors.length) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report: ${reportPath}`);
}
