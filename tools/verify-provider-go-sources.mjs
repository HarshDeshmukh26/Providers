import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sources = "third_party/go";
const lock = JSON.parse(
  fs.readFileSync(path.join(root, sources, "sources.lock.json"), "utf8"),
);
assert.equal(lock.schemaVersion, 1);

const tracked = spawnSync("git", ["ls-files", "-z", "--", sources], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(
  tracked.status,
  0,
  tracked.stderr || "Cannot read tracked Go sources",
);
const files = new Set(tracked.stdout.split("\0"));

for (const snapshot of lock.modules) {
  assert.match(snapshot.directory, /^third_party\/go\/[a-z0-9-]+$/);
  assert.match(snapshot.revision, /^[a-f0-9]{40}$/);
  assert(snapshot.revision.startsWith(snapshot.version.split("-").at(-1)));
  const hashes = [];
  function visit(relative = "") {
    const folder = path.join(root, snapshot.directory, relative);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        visit(name);
        continue;
      }
      assert(entry.isFile(), `Unexpected source entry: ${name}`);
      const repositoryPath = `${snapshot.directory}/${name}`;
      assert(
        files.has(repositoryPath),
        `Source file is not tracked: ${repositoryPath}`,
      );
      const contents = fs.readFileSync(path.join(root, repositoryPath));
      hashes.push(
        `${createHash("sha256").update(contents).digest("hex")}  ${name}\n`,
      );
    }
  }
  visit();
  assert(files.has(`${snapshot.directory}/LICENSE`));
  assert(files.has(`${snapshot.directory}/go.mod`));
  assert.equal(hashes.length, snapshot.fileCount, snapshot.module);
  const hash = createHash("sha256")
    .update(hashes.sort().join(""))
    .digest("hex");
  assert.equal(
    hash,
    snapshot.treeSha256,
    `${snapshot.module}: source snapshot changed`,
  );
  console.log(
    `Verified ${snapshot.module} at ${snapshot.version} (${hashes.length} files).`,
  );
}
