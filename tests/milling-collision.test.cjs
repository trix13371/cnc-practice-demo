"use strict";
const assert = require("node:assert/strict"),
  m = require("../milling-course-model.js"),
  view = require("../milling-collision-model.js");
function stateAt(index, baseline = 3) {
  const full = require("./milling-course-fixtures.cjs").complete(baseline);
  let s = m.create(baseline);
  for (const a of full.events) {
    if (s.current === index && m.ready(s)) return s;
    s = m.transition(s, a);
  }
  throw Error("Lesson not reached");
}
function withCheck(s, check) {
  return {
    ...s,
    lastCheck: check,
    incidents: [...s.incidents, { ...check, lesson: m.lessons[s.current].id }],
  };
}
let s = stateAt(4),
  before = JSON.stringify(m.snapshot(s));
s = m.transition(s, { type: "preview", x: 60, y: 43.5, z: -1, mode: "G0" });
const trusted = JSON.stringify(s),
  report = view.describe(s);
assert.equal(report.part.id, "holder");
assert.equal(report.obstacle.id, "fixture");
assert.deepEqual(report.point, { x: 13, y: 43.5, z: -1 });
assert.equal(report.partBox.z0, 7);
assert.equal(report.partBox.z1, 27);
assert.equal(report.keepOut.x0, 13);
assert.equal(report.keepOut.y1, 44);
assert.equal(report.overlap.z, 1);
assert.equal(report.overlap.x, 0);
assert.equal(report.fraction, 33 / 80);
assert.equal(report.historical, false);
assert.equal(
  JSON.stringify(s),
  trusted,
  "Reading explanation cannot mutate state",
);
assert.deepEqual(
  s.grid,
  m.restore(JSON.parse(before)).grid,
  "Preview preserves original material",
);
assert.deepEqual(
  s.path,
  m.restore(JSON.parse(before)).path,
  "Preview executes no part of the path",
);
assert.deepEqual(s.position, { x: -20, y: 43.5, z: -1 });
s = m.transition(s, { type: "move", x: -20, y: 43.5, z: 12, mode: "G0" });
const history = view.describe(s);
assert(history.historical);
assert.deepEqual(history.point, report.point);
assert.deepEqual(
  history.from,
  report.from,
  "History retains original start, not the current tool position",
);
assert.deepEqual(view.describe(m.restore(m.snapshot(s))), history);
let col = stateAt(5);
col = m.transition(col, { type: "preview", x: 80, y: -15, z: 20, mode: "G0" });
const c = view.describe(col);
assert.equal(c.part.id, "holder");
assert.equal(c.obstacle.id, "column");
assert.equal(c.point.x, 42);
const cutterBody = m.collision(
  { ...col, position: { x: 58, y: -15, z: 40 } },
  { x: 58, y: -15, z: 20, mode: "G0" },
);
const cutterReport = view.describe(
  withCheck(col, {
    ...cutterBody,
    from: { x: 58, y: -15, z: 40 },
    to: { x: 58, y: -15, z: 20 },
    preview: true,
  }),
);
assert.equal(
  cutterReport.part.id,
  "cutter",
  "A body collision can select the cutter rather than the holder",
);
assert.equal(cutterReport.point.z, 35);
const reverse = m.collision(
  { ...col, position: { x: 80, y: -15, z: 20 } },
  { x: -20, y: -15, z: 20, mode: "G0" },
);
const cr = view.describe(
  withCheck(col, {
    ...reverse,
    from: { x: 80, y: -15, z: 20 },
    to: { x: -20, y: -15, z: 20 },
    preview: true,
  }),
);
assert.equal(cr.point.x, 74);
const down = m.collision(
  { ...col, position: { x: 30, y: 43.5, z: 12 } },
  { x: 30, y: 43.5, z: -1, mode: "G0" },
);
const d = view.describe(
  withCheck(col, {
    ...down,
    from: { x: 30, y: 43.5, z: 12 },
    to: { x: 30, y: 43.5, z: -1 },
    preview: true,
  }),
);
assert.equal(d.point.z, 0);
assert.equal(d.overlap.z, 0);
const inside = m.collision(
  { ...col, position: { x: 55, y: -15, z: 20 } },
  { x: 55, y: -15, z: 20, mode: "G0" },
);
assert.equal(
  view.describe(
    withCheck(col, {
      ...inside,
      from: { x: 55, y: -15, z: 20 },
      to: { x: 55, y: -15, z: 20 },
    }),
  ).fraction,
  0,
);
assert.equal(
  view.describe({
    ...col,
    lastCheck: { ok: false, code: "DEPTH", point: { x: 1, y: 1, z: -2 } },
    incidents: [],
  }),
  null,
);
assert.equal(
  view.describe({
    ...col,
    lastCheck: { ok: false, code: "TRAVEL", point: { x: 100, y: 1, z: 1 } },
    incidents: [],
  }),
  null,
);
assert.equal(
  view.describe({ ...col, current: 6, lastCheck: { ok: true } }),
  null,
  "No previous-lesson failure leaks into new setup",
);
let old = stateAt(1, 1);
old = m.transition(old, { type: "preview", x: 70, y: 28, z: 5, mode: "G0" });
const legacy = view.describe(old);
assert.equal(legacy.part.id, "cutter");
assert.equal(legacy.obstacle.id, "fixture");
assert.equal(legacy.point.x, 22);
assert.equal(
  legacy.assembly.length,
  1,
  "Legacy profile never implies holder/body checks",
);
assert(m.geometry.parts.every(Object.isFrozen));
assert(Object.isFrozen(m.geometry.obstacles));
let alarm = stateAt(4);
alarm = m.transition(alarm, {
  type: "move",
  x: 60,
  y: 43.5,
  z: -1,
  mode: "G0",
});
alarm = m.transition(alarm, {
  type: "preview",
  x: -20,
  y: 43.5,
  z: 12,
  mode: "G0",
});
assert.equal(alarm.lastCheck.code, "ALARM");
assert.equal(
  view.describe(alarm).historical,
  false,
  "A live collision remains the current cause after an ALARM-only preview",
);
assert.equal(view.describe(alarm).code, "HOLDER_FIXTURE");
alarm = m.transition(alarm, { type: "reset" });
assert.equal(
  view.describe(alarm).historical,
  true,
  "After RESET the old cause is history if the last preview was ALARM",
);
console.log(
  "Milling collision explanation: reference point vs contact, assembly/obstacle identity, reverse/vertical/touch/start-inside, immutable preview/history and legacy scope passed.",
);
