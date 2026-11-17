import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "runtime/http-webhook-converter");
const lock = JSON.parse(
  fs.readFileSync(path.join(directory, "sources.lock.json")),
);
assert.equal(lock.schemaVersion, 1);
assert.equal(lock.component, "http-webhook-converter");
assert.match(
  lock.candidateImage,
  /^ghcr\.io\/harshdeshmukh26\/fragai-http-webhook-converter:v[\w.-]+$/,
);
assert.match(
  lock.baselineImage,
  /^ghcr\.io\/obot-platform\/mcp-images\/http-webhook-mcp-converter@sha256:[a-f0-9]{64}$/,
);
assert.match(lock.inputs.NODE_IMAGE, /^node:20-alpine@sha256:[a-f0-9]{64}$/);
assert.match(lock.source.revision, /^[a-f0-9]{40}$/);
assert.equal(lock.source.directory, "source/mcp-images");
assert.equal(lock.source.license, "Apache-2.0");
assert(lock.source.files.LICENSE);
const names = [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function visit(relative = "") {
  for (const entry of fs.readdirSync(
    path.join(directory, lock.source.directory, relative),
    { withFileTypes: true },
  )) {
    assert(!entry.isSymbolicLink(), "Unexpected source symlink");
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) visit(name);
    else {
      assert.equal(
        sha256(
          fs.readFileSync(path.join(directory, lock.source.directory, name)),
        ),
        lock.source.files[name],
        `Changed upstream source: ${name}`,
      );
      names.push(name);
    }
  }
}
visit();
assert.deepEqual(names.sort(), Object.keys(lock.source.files).sort());
const recipe = fs.readFileSync(path.join(directory, "Dockerfile"), "utf8");
assert(recipe.includes(`ARG NODE_IMAGE=${lock.inputs.NODE_IMAGE}\n`));
assert(!/^FROM.*obot-platform/im.test(recipe));
assert(recipe.includes("RUN npm ci --no-audit --no-fund"));
const packageLock = JSON.parse(
  fs.readFileSync(
    path.join(
      directory,
      lock.source.directory,
      "http-webhook-mcp-converter/package-lock.json",
    ),
  ),
);
for (const [name, item] of Object.entries(packageLock.packages)) {
  if (!name) continue;
  assert.match(
    item.resolved,
    /^https:\/\/registry\.npmjs\.org\//,
    `Unpinned registry source: ${name}`,
  );
  assert.match(
    item.integrity,
    /^sha512-/,
    `Missing package integrity: ${name}`,
  );
}
const expected = names.map(
  (name) => `runtime/http-webhook-converter/${lock.source.directory}/${name}`,
);
assert.deepEqual(Object.keys(lock.inventories).sort(), ["amd64", "arm64"]);
for (const [arch, inventory] of Object.entries(lock.inventories)) {
  assert(["amd64", "arm64"].includes(arch));
  assert.equal(inventory.file, `inventories/${arch}.json`);
  assert.equal(
    sha256(fs.readFileSync(path.join(directory, inventory.file))),
    inventory.sha256,
    `${arch}: baseline inventory changed`,
  );
  expected.push(`runtime/http-webhook-converter/${inventory.file}`);
}
if (fs.existsSync(path.join(root, ".git"))) {
  const ignored = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    cwd: root,
    encoding: "utf8",
    input: expected.join("\n") + "\n",
  });
  assert.equal(
    ignored.status,
    1,
    `Pinned files are ignored by Git: ${ignored.stdout}`,
  );
  if (process.argv.includes("--require-tracked")) {
    const tracked = spawnSync(
      "git",
      [
        "ls-files",
        "--cached",
        "-z",
        "--",
        "runtime/http-webhook-converter/source",
        "runtime/http-webhook-converter/inventories",
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(tracked.status, 0, tracked.stderr);
    assert.deepEqual(
      tracked.stdout.split("\0").filter(Boolean).sort(),
      expected.sort(),
      "Pinned sources/inventories differ from the Git index",
    );
  }
}
console.log(
  `Verified ${names.length} exact webhook source files, original license, pinned base, npm integrity and baseline inventories.`,
);
