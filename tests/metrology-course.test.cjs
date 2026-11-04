"use strict";
const assert = require("node:assert/strict"),
  m = require("../metrology-course-model.js");
assert.equal(m.tasks.length, 6);
assert.equal(m.aggregate(["accept", "reject"]), "reject");
assert.equal(m.aggregate(["accept", "uncertain"]), "uncertain");
let s = m.create();
assert(m.restore(m.snapshot(s)));
const raw = m.snapshot(s);
raw.events[0].assignment.criteriaVersion = 99;
assert.equal(m.restore(raw), null);
assert.throws(() => m.transition(s, { type: "verdict", value: "accept" }));
assert.throws(() => m.transition(s, { type: "surface", id: "constructor" }));
const copied = m.snapshot(s);
copied.done = [m.tasks[0].id];
assert.equal(m.restore(copied), null);
const full = require("./metrology-course-fixtures.cjs").complete();
assert.equal(full.done.length, 6);
assert(full.done.every((r) => r.independent));
assert.deepEqual(m.restore(m.snapshot(full)), full);
assert.equal(
  m.restore(m.review(m.snapshot(full), m.tasks[0].id)).done.length,
  1,
);
let helped = m.create();
helped = m.transition(helped, { type: "hint" });
assert(m.restore(m.snapshot(helped)).help.includes(m.tasks[0].id));
assert.throws(() => m.transition(s, { type: "contact", point: "1" }));
const acceptedFirst = m.review(m.snapshot(full), m.tasks[0].id);
const beforeVerdict = {
  ...acceptedFirst,
  events: acceptedFirst.events.slice(0, -1),
};
let first = m.restore(beforeVerdict);
first = m.transition(first, { type: "hint" });
first = m.transition(first, { type: "verdict", value: "accept" });
assert.equal(first.done[0].independent, false);
first = m.transition(m.restore(beforeVerdict), {
  type: "section",
  value: "through",
});
assert.throws(() => m.transition(first, { type: "verdict", value: "accept" }));
const missingPoint = structuredClone(acceptedFirst);
missingPoint.events.splice(
  missingPoint.events.findIndex((e) => e.type === "record"),
  1,
);
assert.equal(
  m.restore(missingPoint),
  null,
  "One recorded section cannot earn a two-section verdict",
);
first = m.restore(beforeVerdict);
first = m.transition(first, { type: "instrument", id: "inside" });
assert.equal(first.contact, null);
first = m.transition(first, { type: "zero" });
first = m.transition(first, { type: "contact", point: "1" });
assert.equal(
  first.contact,
  null,
  "Internal jaws cannot measure an external surface",
);
console.log(
  "Metrology: six conditions, versioned replay, strict evidence and per-surface verdict aggregation passed.",
);

const n = require("../normative-model.js");
const progress = require("../progress-model.js");
const local = progress.empty(),
  remote = progress.empty();
local.sections.coursePath.current.metrologyCourse =
  structuredClone(beforeVerdict);
local.sections.coursePath.current.metrologyCourse.draft.reading = "28,080";
local.sections.coursePath.current.activePractice = "metrologyCourse";
remote.sections.coursePath.current.metrologyCourse = m.snapshot(full);
const transferred = progress.parse(progress.stringify(local));
assert.equal(
  transferred.sections.coursePath.current.activePractice,
  "metrologyCourse",
);
assert.deepEqual(
  transferred.sections.coursePath.current.metrologyCourse,
  local.sections.coursePath.current.metrologyCourse,
);
const merged = progress.merge(local, remote);
assert.deepEqual(
  merged.sections.coursePath.current.metrologyCourse,
  local.sections.coursePath.current.metrologyCourse,
  "Local measurements and draft survive a conflicting import",
);
assert.equal(
  progress.summary(merged).progress.done,
  6,
  "Completed remote measurements remain as historical evidence",
);
const badArchive = structuredClone(local);
badArchive.sections.coursePath.current.metrologyCourse.events[0].assignment.profileVersion = 99;
assert.throws(() => progress.parse(JSON.stringify(badArchive)));
for (const task of m.tasks) {
  const refs = n.contentReviews.filter((r) => r.tasks.includes(task.id));
  assert(refs.length);
  for (const r of refs) for (const ref of r.sources) assert(n.source(ref.id));
}
assert(
  n.contentReviews
    .filter((r) => r.kind === "normative")
    .every((r) => r.status === "pending_clauses"),
);
assert.equal(m.classify(110, 10, 90, 100).verdict, "uncertain");
assert.equal(m.classify(111, 10, 90, 100).verdict, "reject");
assert.equal(m.classify(95, 5, 90, 100).verdict, "accept");
assert.equal(
  m.aggregate([
    m.classify(85, 1, 90, 110).verdict,
    m.classify(100, 1, 90, 110).verdict,
  ]),
  "reject",
);
