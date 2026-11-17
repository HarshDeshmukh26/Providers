const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const packages = {};
function visit(directory, relative = "") {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) visit(file, name);
    else if (entry.name === "package.json") {
      const json = JSON.parse(fs.readFileSync(file));
      if (json.name && json.version)
        packages[name] = `${json.name}@${json.version}`;
    }
  }
}
visit("/app/node_modules");
console.log(
  JSON.stringify({
    node: process.version,
    npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
    apk: execFileSync("apk", ["info", "-v"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .sort(),
    nodeModules: Object.fromEntries(Object.entries(packages).sort()),
    files: Object.fromEntries(
      ["server.js", "package.json", "package-lock.json"].map((name) => [
        name,
        createHash("sha256")
          .update(fs.readFileSync(`/app/${name}`))
          .digest("hex"),
      ]),
    ),
    ...(fs.existsSync("/licenses/sources.lock.json")
      ? {
          provenance: {
            lock: JSON.parse(fs.readFileSync("/licenses/sources.lock.json")),
            license: createHash("sha256")
              .update(fs.readFileSync("/licenses/mcp-images-LICENSE"))
              .digest("hex"),
            notices: createHash("sha256")
              .update(fs.readFileSync("/licenses/THIRD_PARTY_NOTICES.md"))
              .digest("hex"),
          },
        }
      : {}),
  }),
);
