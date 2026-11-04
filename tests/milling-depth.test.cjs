const assert = require("node:assert/strict");
const m = require("../milling-course-model.js");
const f = require("./milling-course-fixtures.cjs");
const old = f.complete(2);
assert.equal(old.done.length, 6);
assert.equal(m.snapshot(old).version, 2);
let s = m.transition(old, { type: "upgrade" });
assert.equal(s.current, 6);
assert.equal(s.profile, 3);
assert.equal(m.lessonCount(s), 10);
const run = (a) => (s = m.transition(s, a));
run({ type: "setup", key: "reference", value: true });
run({ type: "setup", key: "clamped", value: true });
const settings = { zero: { x: 120, y: 80, z: 50 }, length: 50, diameter: 6 };
run({ type: "configure", ...settings, zero: { x: 120, y: 80, z: 49 } });
run({ type: "verifySetup" });
assert(!m.prepared(s), "Wrong G54 must not enable cutting");
assert.equal(m.coordinates(s).work.z, s.position.z + 1);
run({ type: "configure", ...settings, length: 49 });
run({ type: "verifySetup" });
assert(!m.prepared(s), "Wrong tool length must not enable cutting");
run({ type: "configure", ...settings });
run({ type: "verifySetup" });
assert(m.prepared(s));
run({ type: "mount", top: 52 });
assert(!m.prepared(s), "Changing the physical setup invalidates verification");
assert(!s.setup.clamped);
assert.equal(m.coordinates(s).work.z, s.position.z + 2);
run({ type: "setup", key: "clamped", value: true });
run({ type: "configure", ...settings, zero: { x: 120, y: 80, z: 52 } });
run({ type: "verifySetup" });
assert(m.prepared(s));
run({ type: "setup", key: "door", value: true });
for (const [x, y, z] of m.lessons[6].points)
  run({ type: "move", x, y, z, mode: "G0" });
run({ type: "confirm" });
assert.equal(s.done.length, 7, s.feedback);
assert.deepEqual(m.restore(m.snapshot(s)), s);
assert.equal(m.snapshot(s).version, 3);
console.log(
  "Milling numerical setup: legacy journal, explicit upgrade, G54/H, setup revision and coordinate transform passed.",
);

const full = f.complete(3);
assert.equal(full.done.length, 10);
assert.deepEqual(m.restore(m.snapshot(full)), full);
for (const id of m.lessons.map((t) => t.id)) {
  const review = m.restore(m.review(m.snapshot(full), id));
  assert(review.done.some((d) => d.id === id));
}
function at(index) {
  let v = m.create(3);
  for (const action of full.events) {
    if (v.current === index && m.ready(v)) return v;
    v = m.transition(v, action);
  }
  throw Error("Fixture did not reach lesson");
}
let face = at(7);
function lanes(state, ys, depth = 1) {
  let v = state;
  const r = (a) => (v = m.transition(v, a)),
    move = (x, y, z, mode = "G0") => r({ type: "move", x, y, z, mode });
  r({ type: "spindle", value: true });
  for (const y of ys) {
    move(v.position.x, v.position.y, 12);
    move(-4, y, 12);
    move(-4, y, -depth, "G1");
    move(40, y, -depth, "G1");
    assert(!v.fault, v.feedback);
  }
  move(v.position.x, v.position.y, 12);
  r({ type: "spindle", value: false });
  r({ type: "setup", key: "door", value: false });
  for (const [x, y] of m.lessons[v.current].checks)
    r({ type: "surface", x, y });
  return v;
}
const missed = lanes(face, [1, 9]);
assert(
  m.coverage(missed).remaining > 0,
  "An 8mm stepover leaves an uncut strip",
);
assert.equal(m.transition(missed, { type: "confirm" }).done.length, 7);
const correct = lanes(face, [1, 5, 9]);
assert.equal(m.coverage(correct).percent, 100);
assert.equal(m.transition(correct, { type: "confirm" }).done.length, 8);
let extra = correct;
for (const a of [
  { type: "setup", key: "door", value: true },
  { type: "spindle", value: true },
  { type: "move", x: 40, y: 9, z: -1, mode: "G1" },
  { type: "move", x: 46, y: 9, z: -1, mode: "G1" },
  { type: "move", x: 46, y: 9, z: 12, mode: "G0" },
  { type: "spindle", value: false },
])
  extra = m.transition(extra, a);
assert(
  m.coverage(extra).overcut > 0,
  "Removal outside allowance must be visible",
);
assert.equal(m.transition(extra, { type: "confirm" }).done.length, 7);
const narrow = lanes(at(8), [7]);
assert(m.profileMatches(narrow, m.lessons[8]));
assert(m.inspected(narrow));
assert.equal(narrow.measurements["21,7"].value, -1);
let stale = m.transition(narrow, {
  type: "configure",
  zero: { x: 120, y: 80, z: 50 },
  length: 50,
  diameter: 6,
});
assert(
  !m.inspected(stale),
  "Even unchanged settings written again require new verification/control",
);
assert.deepEqual(
  stale.grid,
  narrow.grid,
  "Setup changes never recreate material",
);
assert.equal(m.transition(stale, { type: "confirm" }).done.length, 8);
assert.throws(
  () => m.transition(narrow, { type: "mount", top: 52 }),
  /до резания/,
);
let wide = at(9);
const pre = structuredClone(wide);
wide = m.transition(wide, { type: "spindle", value: true });
wide = m.transition(wide, { type: "move", x: -4, y: 5, z: 12, mode: "G0" });
wide = m.transition(wide, { type: "move", x: -4, y: 5, z: -2, mode: "G1" });
wide = m.transition(wide, { type: "move", x: 40, y: 5, z: -2, mode: "G1" });
assert.equal(wide.fault.code, "DEPTH");
assert.deepEqual(wide.grid, pre.grid, "Rejected excessive cut is atomic");
assert.deepEqual(m.restore(m.snapshot(wide)), wide);
assert.equal(m.restore({ version: 2, baseline: 3, events: [] }), null);
assert.equal(
  m.restore({
    ...m.snapshot(full),
    events: [...full.events, { type: "surface", x: 5, y: 3, complete: true }],
  }),
  null,
);
console.log(
  "Milling coverage: four new lessons, missed strip, overcut, true measurements, freshness, layers, atomic rejection and review passed.",
);
