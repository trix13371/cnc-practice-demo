"use strict";
const assert = require("node:assert/strict");
const course = require("../course-model.js");
const mill = course.millingCourse,
  op = course.operationCourse,
  metro = course.metrologyCourse,
  diag = course.diagnosticCourse;
function expected(key, s, defs) {
  if (!s.done.some((d) => d.id === defs[s.current].id)) return null;
  if (key === "millingCourse")
    return (s.profile === 1 && s.current === 3) ||
      (s.profile === 2 && s.current === 5)
      ? { type: "upgrade" }
      : s.current < mill.lessonCount(s) - 1
        ? { type: "next" }
        : null;
  if (key === "operationCourse")
    return s.version === 1 && s.current === 4
      ? { type: "upgrade", assignment: structuredClone(op.tasks[5].assignment) }
      : s.current < op.taskCount(s) - 1
        ? {
            type: "next",
            ...(s.version === 2
              ? { assignment: structuredClone(defs[s.current + 1].assignment) }
              : {}),
          }
        : null;
  return s.current < defs.length - 1
    ? {
        type: "next",
        ...(key === "metrologyCourse"
          ? { assignment: structuredClone(defs[s.current + 1].assignment) }
          : {}),
      }
    : null;
}
function walk(key, raw) {
  const engine = course[key],
    defs = engine.tasks || engine.lessons;
  let checked = 0;
  for (let n = 0; n <= raw.events.length; n++) {
    const s = engine.restore({ ...raw, events: raw.events.slice(0, n) });
    if (!s) continue;
    const before = JSON.stringify(s),
      a = engine.advanceAction(s),
      ref = expected(key, s, defs);
    assert.deepEqual(a, ref, key + " at event " + n);
    assert.equal(JSON.stringify(s), before, "Planning must not mutate state");
    if (a) {
      const next = engine.transition(s, a);
      assert.equal(next.current, s.current + 1);
      assert.deepEqual(
        engine.snapshot(next),
        engine.snapshot(engine.transition(s, ref)),
      );
      checked++;
      if (a.assignment) {
        a.assignment.criteriaVersion = 999;
        assert.notEqual(defs[s.current + 1].assignment.criteriaVersion, 999);
      }
    }
  }
  assert(checked > 0, key + " covered accepted boundaries");
}
assert.equal(typeof mill.advanceAction, "function");
for (const baseline of [1, 2, 3])
  walk(
    "millingCourse",
    mill.snapshot(require("./milling-course-fixtures.cjs").complete(baseline)),
  );
walk("operationCourse", require("./fixtures/operation-v1.json"));
walk(
  "operationCourse",
  op.snapshot(require("./operation-course-fixtures.cjs").complete()),
);
walk(
  "metrologyCourse",
  metro.snapshot(require("./metrology-course-fixtures.cjs").complete()),
);
walk(
  "diagnosticCourse",
  diag.snapshot(require("./diagnostic-course-fixtures.cjs").complete()),
);
for (const key of [
  "operationCourse",
  "millingCourse",
  "metrologyCourse",
  "diagnosticCourse",
])
  assert.equal(course[key].advanceAction(course[key].create()), null);
console.log(
  "Course progression: engine-owned actions match former route behavior across legacy/current books, preserve snapshots and return independent assignment copies.",
);
