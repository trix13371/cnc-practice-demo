const assert = require("node:assert/strict"),
  m = require("../operation-course-model.js");
function complete() {
  let s = m.create();
  const run = (a) => (s = m.transition(s, a));
  for (const t of m.tasks) {
    assert.equal(m.tasks[s.current].id, t.id);
    if (t.surfaces) {
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
    const before = JSON.stringify(s.work);
    run({ type: "preview", source: t.reference });
    assert(s.approval, s.feedback);
    assert.equal(JSON.stringify(s.work), before);
    assert.throws(() => run({ type: "start", source: t.reference + "\n" }));
    run({ type: "start", source: t.reference });
    run({ type: "run" });
    assert.equal(s.machine.program.status, "done", s.feedback);
    run({ type: "confirm" });
    assert(!s.done.some((d) => d.id === t.id), "No credit without control");
    run({ type: "machine", action: { type: "door", value: false } });
    for (const [z] of t.points)
      run({
        type: "machine",
        action: { type: "measure", z, instrument: "micrometer" },
      });
    if (t.depth) {
      run({ type: "recordDepth", value: String(t.depth) });
      assert(!s.depthRecorded);
      run({ type: "depth" });
      run({ type: "recordDepth", value: String(t.depth) });
    }
    run({ type: "confirm" });
    assert(
      s.done.some((d) => d.id === t.id),
      s.feedback,
    );
    if (s.current < m.tasks.length - 1)
      run({ type: "next", assignment: m.tasks[s.current + 1].assignment });
  }
  return s;
}
module.exports = { complete };
