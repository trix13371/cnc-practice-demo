"use strict";
const assert = require("node:assert/strict"),
  base = require("../shaft-project-model.js");
assert(
  base.variants.some((t) => t.id === "RF5-SHAFT-05"),
  "Independent assignment has its own fixed identity",
);
const m = base.forTask("RF5-SHAFT-05"),
  fixtures = require("./shaft-variants-fixtures.cjs");
assert.equal(
  m.create().source,
  "",
  "No program scaffold in independent assignment",
);
assert.equal(
  base.create().source,
  base.template,
  "Historical program scaffold is unchanged",
);
const packet = m.documents();
assert.equal(packet.drawing.surfaces.A.diameter, 30);
assert.equal(packet.drawing.surfaces.B.length, 26);
assert.equal(packet.setup.stock.length, 74);
assert.equal(packet.control.length, 6);
assert(packet.acceptance.every((row) => row.required));
assert(
  !JSON.stringify(packet).includes("G1 Z-"),
  "Student packet does not contain a solution",
);
let invalid = m.create();
for (const id of ["A", "B", "C"])
  invalid = m.transition(invalid, { type: "inspect", id });
invalid = m.transition(invalid, { type: "next", source: "" });
invalid = m.transition(invalid, { type: "append", id: "reduce" });
invalid = m.transition(invalid, { type: "checkPlan" });
assert(
  !invalid.planReady,
  "A 2.5 mm radial pass needs an intermediate diameter",
);
const plans = [
  ["bulkRough", "reduce", "frontFinish"],
  ["frontPreRough", "frontRough", "frontFinish", "bulkRough", "reduce"],
];
for (const plan of plans) {
  const complete = fixtures.complete(m, m.create(), plan);
  assert(complete.complete);
  assert(m.shape(complete.machine.profile));
  assert.deepEqual(base.restore(base.snapshot(complete)), complete);
  assert(m.report(complete).includes("RF5-SHAFT-05"));
}
const complete = fixtures.complete(m, m.create(), plans[0]);
let prefix = m.create();
for (const event of complete.events) {
  if (event.type === "record" && event.id === "lB") break;
  prefix = m.transition(prefix, event);
}
assert.equal(prefix.step, 5);
assert.throws(() =>
  m.transition(prefix, { type: "next", source: prefix.source }),
);
const wrong = m.transition(prefix, { type: "record", id: "lB", value: "25" });
assert(!wrong.records.lB);
assert(!wrong.complete);
const correct = m.transition(prefix, { type: "record", id: "lB", value: "26" });
assert(m.recordsReady(correct));
const p = require("../progress-model.js"),
  a = p.empty();
a.sections.coursePath.current.shaftProject = base.snapshot(complete);
assert.equal(
  p.summary(p.parse(p.stringify(a))).shaftProject.accepted.length,
  1,
);
const fake = base.snapshot(complete);
fake.taskId = "RF5-SHAFT-99";
assert.equal(base.restore(fake), null);
console.log(
  "Independent project: empty code, canonical documents, two feasible plans, extra roughing, full fresh control, cloud replay and unknown identity passed.",
);
