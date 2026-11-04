"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  zlib = require("node:zlib");
const root = path.resolve(__dirname, ".."),
  { create } = require("../server/client-assets.cjs");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const modules = [
  ...html.matchAll(/<script src="([\w-]+\.js)"><\/script>/g),
].map((m) => m[1]);
const result = create(),
  groups = result.groups;
assert.deepEqual(
  groups.map((g) => g.kind),
  ["bootstrap", "models", "interface"],
);
assert.deepEqual(groups[0].modules, [
  "progress-config.js",
  "progress-store.js",
  "server/public/account-storage.js",
]);
assert.deepEqual(
  [...groups.flatMap((g) => g.modules)].sort(),
  [
    ...modules.filter(
      (n) => !["progress-config.js", "progress-store.js"].includes(n),
    ),
    "progress-config.js",
    "progress-store.js",
    "server/public/account-storage.js",
  ].sort(),
  "Every module must occur exactly once",
);
assert.equal(
  groups[1].modules.at(-1),
  "pilot-model.js",
  "Pure models must exist before restoring progress",
);
assert.equal(
  groups[2].modules.at(-1),
  "workshop.js",
  "The workshop starts only after its dependencies",
);
for (const g of groups) {
  assert.match(
    g.url,
    new RegExp("^/assets/js/" + g.kind + "\\.[a-f0-9]{16}\\.js$"),
  );
  new vm.Script(g.bytes.toString("utf8"), { filename: g.url });
  assert.deepEqual(
    g.modules,
    modules
      .filter((n) => g.modules.includes(n))
      .concat(
        g.kind === "bootstrap" ? ["server/public/account-storage.js"] : [],
      ),
    "Source order must survive bundling",
  );
}
const context = vm.createContext({ window: {}, structuredClone });
context.window = context;
vm.runInContext(groups[0].bytes.toString("utf8"), context);
assert(context.CNCAccountStorage && context.CNCProgressStore);
vm.runInContext(groups[1].bytes.toString("utf8"), context);
assert.equal(
  context.CNCProgress.summary(context.CNCProgress.empty()).progress.total,
  63,
);
assert.equal(context.CNCPilot.empty().version, 1);
assert.deepEqual(
  create().groups.map((g) => g.url),
  groups.map((g) => g.url),
  "Identical releases have stable content addresses",
);
const original = [...modules, "server/public/account-storage.js"].map((f) =>
  fs.readFileSync(path.join(root, f)),
);
assert(
  groups.reduce((n, g) => n + zlib.gzipSync(g.bytes, { level: 6 }).length, 0) <
    original.reduce((n, b) => n + zlib.gzipSync(b, { level: 6 }).length, 0),
  "Bundling must reduce compressed payload, not only request count",
);
console.log(
  "Client assets: three ordered phases, complete coverage, content addresses, executable models and reduced gzip size passed.",
);
