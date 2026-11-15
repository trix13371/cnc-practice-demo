"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const c = require("../course-model.js"),
  registry = require("../practice-registry-model.js");
assert.deepEqual(
  registry.books.map((b) => b.key),
  ["metrologyCourse", "operationCourse", "millingCourse", "diagnosticCourse"],
);
for (const b of registry.books) {
  assert.equal(b.engine, c[b.key]);
  assert.equal(b.definitions, b.engine.tasks || b.engine.lessons);
  assert(Object.isFrozen(b));
  assert.equal(b.hasWork(undefined), false);
}
assert(Object.isFrozen(registry.books));
assert.equal(registry.get("__proto__"), null);
const metro = registry.get("metrologyCourse"),
  diag = registry.get("diagnosticCourse");
assert.equal(
  metro.hasWork({ events: [{ type: "begin" }], draft: { answer: "42" } }),
  false,
  "Activity semantics must remain distinct from merge ownership",
);
assert.equal(
  metro.hasWork({ events: [{ type: "begin" }, { type: "measure" }] }),
  true,
);
assert.equal(diag.hasWork({ events: [], draft: { route: "X10" } }), true);
assert.equal(diag.hasWork({ events: [], draft: { program: "" } }), false);
const context = { CNCCourse: c };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../practice-registry-model.js"), "utf8"),
  context,
);
assert.equal(
  context.CNCPracticeRegistry.get("millingCourse").engine,
  c.millingCourse,
);
const p = require("../progress-model.js");
assert.equal(p.ROUTE_VERSION, 9);
assert.equal(p.summary(p.empty()).routeVersion, p.ROUTE_VERSION);
console.log(
  "Practice registry: immutable four-book descriptors, legacy activity semantics, Node/browser parity and canonical summary version passed.",
);
