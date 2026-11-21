import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const component = path.join(root, "runtime/mcp-discovery");
const lock = JSON.parse(
  fs.readFileSync(path.join(component, "sources.lock.json")),
);
const { values } = parseArgs({
  options: {
    image: { type: "string", default: "fragai-mcp-server:phase4-amd64" },
    platform: { type: "string", default: "linux/amd64" },
    "baseline-only": { type: "boolean", default: false },
    "unit-report": { type: "string" },
  },
});
assert(["linux/amd64", "linux/arm64"].includes(values.platform));
const arch = values.platform.split("/")[1];
const run = `fragai-discovery-${randomUUID().slice(0, 12)}`;
const label = "ai.fragai.discovery-test";
const network = `${run}-network`;
const owned = new Set();
const reportRoot = path.join(root, "bin/independence");
fs.mkdirSync(reportRoot, { recursive: true });
const reportPath = path.join(
  reportRoot,
  `phase-4-discovery-${arch}${values["baseline-only"] ? "-baseline-only" : ""}.json`,
);
const clientImage = values["baseline-only"] ? lock.baselineImage : values.image;
const report = {
  startedAt: new Date().toISOString(),
  image: values.image,
  baseline: lock.baselineImage,
  platform: values.platform,
  validationMode: values["baseline-only"] ? "baseline-only" : "compatibility",
  passed: false,
  customerDataUsed: false,
  productionDeploymentChanged: false,
  stages: [],
  cleanupErrors: [],
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function docker(...args) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: args[0] === "run" ? 600000 : 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `Docker ${args[0]} failed: ${(result.stderr || result.error?.message || "").slice(-6000)}`,
  );
  return result.stdout.trim();
}
function remove(name) {
  const info = JSON.parse(docker("inspect", name))[0];
  assert.equal(
    info.Config.Labels[label],
    run,
    "Refusing to remove an unrelated container",
  );
  docker("rm", "--force", "--volumes", name);
  owned.delete(name);
}
function container(args) {
  const name = `${run}-${randomUUID().slice(0, 6)}`;
  owned.add(name);
  return {
    name,
    output: docker(
      "run",
      "--name",
      name,
      "--label",
      `${label}=${run}`,
      "--platform",
      values.platform,
      ...args,
    ),
  };
}
function inventory(image) {
  const info = JSON.parse(
    docker("image", "inspect", "--platform", values.platform, image),
  )[0];
  assert.equal(`${info.Os}/${info.Architecture}`, values.platform);
  const code =
    "import importlib.metadata as m,json,platform,pathlib; print(json.dumps({'python':platform.python_version(),'packages':{p.metadata['Name']:p.version for p in m.distributions()},'provenance':json.loads(pathlib.Path('/licenses/sources.lock.json').read_text()) if pathlib.Path('/licenses/sources.lock.json').exists() else None}))";
  const c = container([
    "--network",
    "none",
    "--entrypoint",
    "python",
    image,
    "-c",
    code,
  ]);
  remove(c.name);
  const data = JSON.parse(c.output);
  return {
    imageId: info.Id,
    contract: {
      user: info.Config.User || "",
      entrypoint: info.Config.Entrypoint,
      cmd: info.Config.Cmd || null,
      workdir: info.Config.WorkingDir,
      env: [...info.Config.Env].sort(),
      ports: info.Config.ExposedPorts || {},
      volumes: info.Config.Volumes || {},
    },
    ...data,
  };
}
function unitTests(image, stage) {
  const c = container([
    "--network",
    "none",
    "--mount",
    `type=bind,source=${path.join(component, "source/obot-mcp-server/test_server.py")},target=/checks/test_server.py,readonly`,
    "--entrypoint",
    "python",
    image,
    "-m",
    "pytest",
    "/checks/test_server.py",
    "-q",
    "-p",
    "no:cacheprovider",
  ]);
  remove(c.name);
  fs.writeFileSync(
    path.join(reportRoot, `discovery-${arch}-${stage}-unit.log`),
    c.output + "\n",
  );
  const result = c.output.match(/(\d+) passed/);
  assert(result, "Upstream unit tests did not report success");
  return Number(result[1]);
}
async function ready(name) {
  const deadline = Date.now() + (arch === "arm64" ? 300000 : 60000);
  while (Date.now() < deadline) {
    try {
      docker(
        "exec",
        name,
        "python",
        "-c",
        "import socket; s=socket.create_connection(('127.0.0.1',8080),timeout=2); s.sendall(b'GET /healthz HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n'); assert b'200' in s.recv(1024).split(b'\\r\\n')[0]",
      );
      return;
    } catch {
      await pause(2000);
    }
  }
  throw new Error("Discovery health endpoint did not become ready");
}
async function start(image) {
  const c = container([
    "--detach",
    "--network",
    network,
    "--network-alias",
    "discovery",
    "--env",
    "OBOT_URL=http://api-fixture:9000",
    image,
  ]);
  await ready(c.name);
  return c.name;
}
function protocol(stage) {
  const c = container([
    "--network",
    network,
    "--network-alias",
    "api-fixture",
    "--mount",
    `type=bind,source=${path.join(component, "tests")},target=/checks,readonly`,
    "--entrypoint",
    "python",
    clientImage,
    "/checks/protocol.py",
    "http://discovery:8080/mcp",
  ]);
  remove(c.name);
  const result = JSON.parse(c.output);
  assert.equal(result.passed, true);
  fs.writeFileSync(
    path.join(reportRoot, `discovery-${arch}-${stage}-protocol.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  return result;
}
let networkCreated = false;
// Concurrent architecture runs own disposable containers with this label.
// Preserve unrelated applications, not another verifier's temporary fixtures.
const originalContainers = docker(
  "ps",
  "--format",
  `{{.ID}}|{{.Label "${label}"}}`,
)
  .split("\n")
  .map((line) => line.split("|"))
  .filter(([id, owner]) => id && !owner)
  .map(([id]) => id);
try {
  const baseline = inventory(lock.baselineImage);
  const candidate = values["baseline-only"]
    ? baseline
    : inventory(values.image);
  report.inventories = { baseline, candidate };
  assert.deepEqual(
    candidate.contract,
    baseline.contract,
    "Runtime launch contract differs from retained baseline",
  );
  assert.equal(
    candidate.python,
    baseline.python,
    "Python runtime version changed",
  );
  const differences = [
    ...new Set([
      ...Object.keys(candidate.packages),
      ...Object.keys(baseline.packages),
    ]),
  ].filter((name) => candidate.packages[name] !== baseline.packages[name]);
  assert.equal(
    differences.length,
    0,
    `Installed package versions differ: ${differences.join(", ")}`,
  );
  if (!values["baseline-only"])
    assert.deepEqual(
      candidate.provenance,
      lock,
      "Candidate provenance differs from source lock",
    );
  report.stages.push({
    name: "runtime/dependency/provenance parity",
    packages: Object.keys(candidate.packages).length,
  });
  console.log(
    `PASS ${values.platform}: launch contract, Python and ${Object.keys(candidate.packages).length} package versions`,
  );
  let unitEvidence;
  if (values["unit-report"]) {
    const evidencePath = path.resolve(root, values["unit-report"]);
    assert(
      evidencePath.startsWith(root + path.sep),
      "Unit evidence must be in this checkout",
    );
    unitEvidence = JSON.parse(fs.readFileSync(evidencePath));
    assert.equal(unitEvidence.inventories.baseline.imageId, baseline.imageId);
    assert.equal(unitEvidence.inventories.candidate.imageId, candidate.imageId);
    assert.deepEqual(unitEvidence.inventories.candidate.provenance, lock);
    report.unitEvidence = path.relative(root, evidencePath);
  }
  for (const [stage, image] of values["baseline-only"]
    ? [["baseline", lock.baselineImage]]
    : [
        ["baseline", lock.baselineImage],
        ["candidate", values.image],
      ]) {
    const saved = unitEvidence?.stages.find(
      (item) => item.name === `${stage} existing unit tests`,
    );
    if (unitEvidence)
      assert(saved?.checks > 0, `Missing passed ${stage} unit evidence`);
    const count = saved?.checks ?? unitTests(image, stage);
    report.stages.push({ name: `${stage} existing unit tests`, checks: count });
    console.log(
      `PASS ${values.platform}: ${stage} ${count} existing unit tests`,
    );
  }
  docker(
    "network",
    "create",
    "--internal",
    "--label",
    `${label}=${run}`,
    network,
  );
  networkCreated = true;
  let baselineProtocol;
  for (const [stage, image] of values["baseline-only"]
    ? [["baseline", lock.baselineImage]]
    : [
        ["baseline", lock.baselineImage],
        ["candidate", values.image],
        ["rollback", lock.baselineImage],
      ]) {
    const name = await start(image);
    const result = protocol(stage);
    if (stage === "baseline") baselineProtocol = result;
    else
      assert.deepEqual(
        result,
        baselineProtocol,
        `${stage} protocol results differ from baseline`,
      );
    report.stages.push({
      name: `${stage} live MCP protocol`,
      checks: result.checks.length,
    });
    console.log(
      `PASS ${values.platform}: ${stage} ${result.checks.length} live MCP scenarios`,
    );
    if (stage === "candidate") {
      docker("restart", name);
      await ready(name);
      const restarted = protocol("candidate-restart");
      assert.deepEqual(
        restarted,
        baselineProtocol,
        "Restart changed discovery behavior",
      );
      report.stages.push({
        name: "candidate restart",
        checks: restarted.checks.length,
      });
      console.log(
        `PASS ${values.platform}: restart ${restarted.checks.length} live MCP scenarios`,
      );
    }
    remove(name);
  }
  const currentContainers = docker("ps", "--quiet").split("\n");
  assert(
    originalContainers.every((id) => currentContainers.includes(id)),
    "An existing running container disappeared",
  );
  report.passed = true;
} catch (error) {
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const name of [...owned]) {
    try {
      remove(name);
    } catch (error) {
      report.cleanupErrors.push(error.message);
    }
  }
  if (networkCreated) {
    try {
      const info = JSON.parse(docker("network", "inspect", network))[0];
      assert.equal(info.Labels[label], run);
      docker("network", "rm", network);
    } catch (error) {
      report.cleanupErrors.push(error.message);
    }
  }
  if (report.cleanupErrors.length) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`Report: ${path.relative(root, reportPath)}`);
}
