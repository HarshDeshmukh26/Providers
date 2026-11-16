import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "runtime/stdio-wrapper");
const lock = JSON.parse(
  fs.readFileSync(path.join(directory, "sources.lock.json"), "utf8"),
);
assert.equal(lock.schemaVersion, 1);
assert.equal(lock.component, "stdio-wrapper");
const dockerfile = fs.readFileSync(path.join(directory, "Dockerfile"), "utf8");
assert.equal(
  lock.artifactRepository,
  "https://github.com/HarshDeshmukh26/Providers",
);
assert(
  dockerfile.includes(
    `org.opencontainers.image.source="${lock.artifactRepository}"`,
  ),
  "Image source must identify the publishing Providers repository",
);
for (const [name, value] of Object.entries(lock.inputs)) {
  assert.match(value, /@sha256:[a-f0-9]{64}$/);
  assert(!value.includes("obot-platform/"), `Unmigrated build input: ${value}`);
  assert(
    dockerfile.includes(`ARG ${name}=${value}\n`),
    `${name}: Dockerfile differs from lock`,
  );
}
assert(
  !/^FROM.*obot-platform/im.test(dockerfile),
  "Runtime still inherits an Obot image",
);
let count = 0;
const names = [];
for (const source of lock.sources) {
  assert.match(source.revision, /^[a-f0-9]{40}$/);
  assert.equal(source.directory, `source/${source.name}`);
  assert(source.files.LICENSE, `${source.name}: license missing`);
  const actual = [];
  function visit(relative = "") {
    for (const entry of fs.readdirSync(
      path.join(directory, source.directory, relative),
      { withFileTypes: true },
    )) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      assert(!entry.isSymbolicLink(), `Unexpected symlink: ${name}`);
      if (entry.isDirectory()) visit(name);
      else {
        actual.push(name);
        const hash = createHash("sha256")
          .update(fs.readFileSync(path.join(directory, source.directory, name)))
          .digest("hex");
        assert.equal(
          hash,
          source.files[name],
          `${source.name}: modified source ${name}`,
        );
        names.push(`runtime/stdio-wrapper/${source.directory}/${name}`);
      }
    }
  }
  visit();
  assert.deepEqual(
    actual.sort(),
    Object.keys(source.files).sort(),
    `${source.name}: missing or extra sources`,
  );
  count += actual.length;
}
assert.equal(
  fs
    .readFileSync(path.join(directory, "source/mcp-images/MMMCP_IMAGE"), "utf8")
    .trim(),
  "ghcr.io/obot-platform/mmmcp:v0.1.2",
);
assert.equal(
  fs
    .readFileSync(path.join(directory, "source/mcp-images/UV_IMAGE"), "utf8")
    .trim(),
  "ghcr.io/astral-sh/uv:0.12.5",
);
assert(dockerfile.includes(`npm install -g npm@${lock.npm.version}`));
for (const [name, version] of Object.entries(lock.npm.overrides)) {
  assert(
    dockerfile.includes(`${name}@${version}`),
    `Missing npm override: ${name}`,
  );
}
assert.equal(lock.runtimePackages.baseline, lock.baselineImage);
assert.deepEqual(Object.keys(lock.runtimePackages.architectures).sort(), [
  "amd64",
  "arm64",
]);
const packageFiles = [];
for (const [arch, packages] of Object.entries(
  lock.runtimePackages.architectures,
)) {
  assert.equal(packages.count, 60);
  const expectedFiles = ["controls", "repositories", "sha256", "world"].map(
    (extension) => `${arch}.${extension}`,
  );
  assert.deepEqual(Object.keys(packages.files).sort(), expectedFiles);
  const contents = {};
  for (const [name, hash] of Object.entries(packages.files)) {
    const bytes = fs.readFileSync(path.join(directory, "packages", name));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      hash,
      `Modified runtime package lock: ${name}`,
    );
    contents[name.split(".")[1]] = bytes.toString("utf8");
    assert(
      !contents[name.split(".")[1]].includes("\r"),
      `Package lock must retain LF endings: ${name}`,
    );
    packageFiles.push(name);
    names.push(`runtime/stdio-wrapper/packages/${name}`);
  }
  const controls = contents.controls
    .trim()
    .split("\n")
    .map((line) => {
      assert.match(line, /^\S+ \S+ Q1[A-Za-z0-9+/]+=*$/);
      const [name, version] = line.split(" ");
      return `${name}-${version}.apk`;
    });
  const payloads = contents.sha256
    .trim()
    .split("\n")
    .map((line) => {
      assert.match(line, /^[a-f0-9]{64}  [A-Za-z0-9._+-]+\.apk$/);
      return line.slice(66);
    });
  assert.equal(new Set(payloads).size, packages.count);
  assert.deepEqual(
    payloads.sort(),
    controls.sort(),
    `${arch}: payload/control inventory mismatch`,
  );
  assert(contents.world.trim(), `${arch}: empty APK world`);
  assert.equal(contents.repositories.trim(), "https://apk.cgr.dev/chainguard");
}
assert.deepEqual(
  fs.readdirSync(path.join(directory, "packages")).sort(),
  packageFiles.sort(),
);
if (fs.existsSync(path.join(root, ".git"))) {
  const ignored = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    cwd: root,
    input: names.join("\n") + "\n",
    encoding: "utf8",
  });
  assert.equal(
    ignored.status,
    1,
    `Pinned source is ignored by Git:\n${ignored.stdout}\n${ignored.stderr}`,
  );
  if (process.argv.includes("--require-tracked")) {
    const tracked = spawnSync(
      "git",
      [
        "ls-files",
        "--cached",
        "-z",
        "--",
        "runtime/stdio-wrapper/source",
        "runtime/stdio-wrapper/packages",
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(tracked.status, 0, tracked.stderr);
    assert.deepEqual(
      tracked.stdout.split("\0").filter(Boolean).sort(),
      names.sort(),
      "Pinned sources differ from the Git index",
    );
  }
}
console.log(
  `Verified ${count} exact source files, original licenses, pinned build images, npm overrides and 60 locked runtime packages per architecture.`,
);
