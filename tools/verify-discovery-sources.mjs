import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const component = path.join(root, "runtime/mcp-discovery");
const lock = JSON.parse(
  fs.readFileSync(path.join(component, "sources.lock.json")),
);
assert.equal(lock.schemaVersion, 1);
assert.equal(lock.source.revision, "5051acefdceb073c32ea4ca78683d3922aea643b");
assert.match(
  lock.candidateImage,
  /^ghcr\.io\/harshdeshmukh26\/fragai-mcp-server:v[\w.-]+$/,
);
const sourceRoot = path.join(component, lock.source.directory);
function list(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), "Source snapshots cannot contain symlinks");
    return entry.isDirectory()
      ? list(target)
      : [path.relative(sourceRoot, target).split(path.sep).join("/")];
  });
}
assert.deepEqual(
  list(sourceRoot).sort(),
  Object.keys(lock.source.files).sort(),
  "Snapshot file set differs from its lock",
);
for (const [name, expected] of Object.entries(lock.source.files)) {
  assert(!name.split("/").includes("..") && !path.isAbsolute(name));
  assert.equal(
    createHash("sha256")
      .update(fs.readFileSync(path.join(sourceRoot, name)))
      .digest("hex"),
    expected,
    `Source changed: ${name}`,
  );
}
const dockerfile = fs.readFileSync(path.join(component, "Dockerfile"), "utf8");
for (const [key, reference] of Object.entries(lock.inputs)) {
  assert.match(reference, /@sha256:[a-f0-9]{64}$/);
  assert(
    dockerfile.includes(`ARG ${key}=${reference}`),
    `Dockerfile input differs: ${key}`,
  );
}
assert(!/^FROM .*obot-platform/m.test(dockerfile));
if (process.argv.includes("--publication")) {
  const redistribution = lock.redistribution;
  const ownerAttested =
    redistribution.status === "owner-attested-pending-terms";
  assert(
    redistribution.status === "approved" || ownerAttested,
    "Publication blocked: no reviewed terms or release-specific owner instruction",
  );
  if (ownerAttested) {
    assert.equal(
      redistribution.authorizedImage,
      lock.candidateImage,
      "Owner instruction does not cover this release version",
    );
    assert(
      dockerfile.includes(
        'ai.fragai.redistribution="owner-attested-terms-pending"',
      ),
      "Owner-attested publication must disclose outstanding terms",
    );
    assert(
      dockerfile.includes("PUBLICATION_AUTHORIZATION.md /licenses/"),
      "Image must include the owner publication record",
    );
  }
  const permission = ownerAttested
    ? redistribution.authorizationFile
    : redistribution.permissionFile;
  assert(
    permission &&
      !permission.split("/").includes("..") &&
      !path.isAbsolute(permission),
  );
  assert.equal(
    createHash("sha256")
      .update(fs.readFileSync(path.join(component, permission)))
      .digest("hex"),
    ownerAttested
      ? redistribution.authorizationSha256
      : redistribution.permissionSha256,
    "Publication authority record is missing or differs from its lock",
  );
  assert(!dockerfile.includes("pending-terms-local-review-only"));
}
console.log(
  `Verified ${Object.keys(lock.source.files).length} exact source files and digest-pinned build inputs. Publication status: ${lock.redistribution.status}.`,
);
