const fs = require("node:fs");
const path = require("node:path");
const directory = path.join(process.argv[2], "npm");
const packages = {};
function visit(relative = "") {
  for (const entry of fs.readdirSync(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) visit(name);
    else if (entry.name === "package.json") {
      const json = JSON.parse(
        fs.readFileSync(path.join(directory, name), "utf8"),
      );
      if (json.name && json.version)
        packages[name] = `${json.name}@${json.version}`;
    }
  }
}
visit();
console.log(
  JSON.stringify(Object.fromEntries(Object.entries(packages).sort())),
);
