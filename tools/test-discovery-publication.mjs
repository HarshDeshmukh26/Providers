import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(
  root,
  "bin/independence",
  `discovery-publication-${randomUUID()}`,
);
const source = path.join(root, "runtime/mcp-discovery");
const component = path.join(fixture, "runtime/mcp-discovery");
const original = JSON.parse(
  fs.readFileSync(path.join(source, "sources.lock.json")),
);
assert.equal(original.redistribution.status, "owner-attested-pending-terms");
let count = 0;
try {
  fs.mkdirSync(path.join(fixture, "tools"), { recursive: true });
  fs.cpSync(source, component, { recursive: true });
  fs.copyFileSync(
    path.join(root, "tools/verify-discovery-sources.mjs"),
    path.join(fixture, "tools/verify-discovery-sources.mjs"),
  );
  const lockPath = path.join(component, "sources.lock.json");
  const recordPath = path.join(
    component,
    original.redistribution.authorizationFile,
  );
  const record = fs.readFileSync(recordPath);
  function check(name, mutate, expected) {
    const lock = structuredClone(original);
    fs.writeFileSync(recordPath, record);
    mutate(lock);
    fs.writeFileSync(lockPath, JSON.stringify(lock));
    const result = spawnSync(
      process.execPath,
      [
        path.join(fixture, "tools/verify-discovery-sources.mjs"),
        "--publication",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, expected, `${name}: unexpected guard decision`);
    count++;
    console.log(`PASS ${name}`);
  }
  check("exact owner-authorized candidate", () => {}, 0);
  check(
    "different release version remains blocked",
    (lock) => {
      lock.candidateImage = lock.candidateImage.replace("-rc.1", "-rc.2");
    },
    1,
  );
  check(
    "pending terms without owner instruction remains blocked",
    (lock) => {
      lock.redistribution.status = "pending-terms";
    },
    1,
  );
  check(
    "unknown authority state remains blocked",
    (lock) => {
      lock.redistribution.status = "unverified";
    },
    1,
  );
  check(
    "changed instruction record remains blocked",
    () => {
      fs.appendFileSync(recordPath, "changed");
    },
    1,
  );
  check(
    "missing instruction record remains blocked",
    () => {
      fs.unlinkSync(recordPath);
    },
    1,
  );
  console.log(`Verified ${count} publication authority decisions.`);
} finally {
  if (fs.existsSync(fixture)) {
    const resolved = fs.realpathSync(fixture);
    const intended =
      path.join(fs.realpathSync(root), "bin/independence") + path.sep;
    assert(
      resolved.startsWith(intended),
      "Refusing cleanup outside the test directory",
    );
    fs.rmSync(resolved, { recursive: true });
  }
}
