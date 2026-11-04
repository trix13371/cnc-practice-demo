"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const m = require("../operation-course-model.js");
assert.equal(m.tasks.length, 11);
assert.equal(m.create().version, 2);
assert.equal(m.snapshot(m.create()).events[0].type, "begin");
const legacyRaw = JSON.parse(
  fs.readFileSync(require.resolve("./fixtures/operation-v1.json"), "utf8"),
);
const legacy = m.restore(legacyRaw);
assert(legacy);
assert.equal(legacy.done.length, 5);
assert(legacy.done.every((r) => r.legacy === true && r.independent === null));
assert.deepEqual(
  m.snapshot(legacy),
  legacyRaw,
  "Legacy events and draft are preserved verbatim",
);
assert.throws(() => m.transition(legacy, { type: "next" }));
let upgraded = m.transition(legacy, {
  type: "upgrade",
  assignment: m.tasks[5].assignment,
});
assert.equal(upgraded.current, 5);
assert.equal(upgraded.version, 2);
assert.equal(upgraded.done.length, 5, "Upgrade must not grant any new credit");
assert(m.restore(m.snapshot(upgraded)));
for (const field of [
  "contentVersion",
  "criteriaVersion",
  "profileVersion",
  "seed",
]) {
  const broken = m.snapshot(upgraded);
  broken.events.at(-1).assignment[field] =
    typeof m.tasks[5].assignment[field] === "number" ? 99 : "unknown";
  assert.equal(
    m.restore(broken),
    null,
    "Unknown " + field + " must fail closed",
  );
}
for (const t of m.tasks.slice(5)) {
  assert(t.forecast && t.surfaces.length >= 2);
  assert(t.surfaces.some((s) => s.role === "preserve"));
  assert.deepEqual(
    m.expected(t),
    t.targetProfile,
    "Geometry criteria are explicit, independent of the reference program",
  );
  assert(t.surfaces.every((s) => s.control.length));
}
assert.throws(() =>
  m.transition(upgraded, { type: "surface", id: "constructor" }),
);
upgraded = m.transition(upgraded, { type: "predict", value: "2" });
assert.equal(
  upgraded.prediction,
  null,
  "Number alone cannot replace selecting the protected surface",
);
upgraded = m.transition(upgraded, { type: "surface", id: "B" });
upgraded = m.transition(upgraded, { type: "predict", value: "2" });
assert(upgraded.prediction);
const forged = m.snapshot(upgraded);
forged.independent = true;
assert.equal(m.restore(forged), null);
const engine = require("../real-machine-model.js");
for (const t of m.tasks.slice(5)) {
  let work = engine.newWork(t.title, { diameter: 32, length: 60, grip: 15 });
  for (const a of [
    { type: "reference" },
    { type: "clamp", value: true },
    { type: "tool", tool: t.tool },
    { type: "preset" },
    { type: "workOffset", z: 100 },
    { type: "door", value: true },
  ])
    work = engine.execute(work, a).work;
  const preview = engine.graphics(work, t.reference);
  assert(preview.ok, t.id + ": " + preview.message);
  assert(m.shape(preview.profile, t.targetProfile));
}
const run = (a) => {
  upgraded = m.transition(upgraded, a);
};
for (const t of m.tasks.slice(5)) {
  if (!upgraded.prediction) {
    for (const surface of t.surfaces.filter(
      (surface) => surface.role === "preserve",
    ))
      run({ type: "surface", id: surface.id });
    run({ type: "predict", value: String(t.forecast.value) });
  }
  for (const action of [
    { type: "reference" },
    { type: "clamp", value: true },
    { type: "tool", tool: t.tool },
    { type: "preset" },
    { type: "workOffset", z: 100 },
    { type: "door", value: true },
  ])
    run({ type: "machine", action });
  const before = JSON.stringify(upgraded.work);
  if (t.id === "allowance-plan") {
    run({ type: "preview", source: t.reference.replace("X28", "X24") });
    assert.equal(
      upgraded.approval,
      null,
      "A too-deep route is rejected before changing material",
    );
  }
  if (t.id === "relief-band") {
    run({
      type: "preview",
      source: t.reference.replace("G0 X34\nZ-12", "Z-12"),
    });
    assert.equal(
      upgraded.approval,
      null,
      "Axial blade transfer inside metal is rejected",
    );
  }
  if (t.id === "finish-limit") {
    run({ type: "preview", source: t.reference.replace("X31", "X30") });
    assert.equal(
      upgraded.approval,
      null,
      "The finishing tool cannot take the roughing allowance at once",
    );
    const overcut = t.reference.replace(
      "G0 X40 Z5",
      "G0 Z2\nG0 X29\nG1 Z-20 F0.1\nG0 X34\nG0 X40 Z5",
    );
    run({ type: "preview", source: overcut });
    assert.equal(
      upgraded.approval,
      null,
      "Even legal-depth extra passes must not overcut the target profile",
    );
  }
  if (t.id === "taper-land") {
    const wrong = t.reference.replace(
      "G0 X32 Z2\nG1 Z0 F0.1\nX28 Z-16",
      "G0 X28 Z2\nG1 Z-16 F0.1",
    );
    run({ type: "preview", source: wrong });
    assert.equal(
      upgraded.approval,
      null,
      "A cylinder with matching endpoint diameters is not a cone",
    );
  }
  const alternate =
    t.id === "transfer-two-lands"
      ? "G21 G18 G40 G54 G99\nG50 S1200\nG97 S800 M3\nG0 X28 Z2\nG1 Z-14 F0.1\nG0 X34\nZ2\nX30\nG1 Z-30 F0.1\nG0 X34\nG0 X40 Z5\nM5\nM30"
      : t.reference;
  run({ type: "preview", source: alternate });
  assert(upgraded.approval, upgraded.feedback);
  assert.equal(
    JSON.stringify(upgraded.work),
    before,
    "All previews are isolated",
  );
  if (t.id === "shoulder-control") run({ type: "hint" });
  run({ type: "start", source: alternate });
  run({ type: "run" });
  assert.equal(upgraded.machine.program.status, "done");
  run({ type: "machine", action: { type: "door", value: false } });
  const [firstZ] = t.points[0];
  run({
    type: "machine",
    action: { type: "measure", z: firstZ, instrument: "micrometer" },
  });
  run({ type: "confirm" });
  assert(
    !upgraded.done.some((d) => d.id === t.id),
    "One measurement is insufficient",
  );
  for (const [z] of t.points)
    run({
      type: "machine",
      action: { type: "measure", z, instrument: "caliper" },
    });
  run({ type: "confirm" });
  assert(
    !upgraded.done.some((d) => d.id === t.id),
    "Wrong instrument does not satisfy surface control",
  );
  for (const [z] of t.points)
    run({
      type: "machine",
      action: { type: "measure", z, instrument: "micrometer" },
    });
  run({ type: "confirm" });
  const record = upgraded.done.find((d) => d.id === t.id);
  assert(record, upgraded.feedback);
  assert(record.criteria.every((c) => c.passed));
  assert.deepEqual(record.assignment, t.assignment);
  assert.equal(record.independent, t.id !== "shoulder-control");
  if (upgraded.current < m.tasks.length - 1)
    run({ type: "next", assignment: m.tasks[upgraded.current + 1].assignment });
}
assert.equal(upgraded.done.length, 11);
assert.deepEqual(m.restore(m.snapshot(upgraded)), upgraded);
const downgrade = {
  version: 1,
  draft: upgraded.draft,
  events: m
    .snapshot(upgraded)
    .events.filter(
      (event) => event.type !== "begin" && event.type !== "upgrade",
    )
    .map((event) => {
      if (event.type !== "next") return event;
      return { type: "next" };
    }),
};
assert.equal(
  m.restore(downgrade),
  null,
  "Downgrading the envelope cannot grant new conditions under legacy rules",
);
const progress = require("../progress-model.js"),
  course = require("../course-model.js");
const archive = progress.empty();
archive.sections.coursePath.current = course.restorePath({
  ...archive.sections.coursePath.current,
  operationCourse: m.snapshot(upgraded),
});
const restored = progress.parse(progress.stringify(archive));
assert.equal(progress.summary(restored).operationCourse.done.length, 11);
const old = progress.empty();
old.sections.coursePath.current = course.restorePath({
  ...old.sections.coursePath.current,
  operationCourse: legacyRaw,
});
const merged = progress.merge(old, archive);
assert.equal(progress.summary(merged).progress.done, 11);
assert.equal(
  progress.summary(progress.merge(merged, archive)).progress.done,
  11,
);
console.log(
  "Deep turning: six substantive conditions, v1 preservation, explicit upgrade, strict version binding and action-linked planning passed.",
);
