const assert = require("node:assert/strict"),
  m = require("../milling-course-model.js");
function complete(baseline = 3) {
  let s = m.create(baseline);
  const r = (a) => (s = m.transition(s, a)),
    move = (x, y, z, mode = "G0", type = "move") => r({ type, x, y, z, mode });
  for (const [i, t] of m.lessons.slice(0, m.lessonCount(s)).entries()) {
    if (i >= 6) {
      for (const key of ["reference", "clamped"])
        r({ type: "setup", key, value: true });
      r({
        type: "configure",
        zero: { x: 120, y: 80, z: 50 },
        length: 50,
        diameter: 6,
      });
      r({ type: "verifySetup" });
      r({ type: "setup", key: "door", value: true });
    } else
      for (const key of ["reference", "clamped", "tool", "zero", "door"])
        r({ type: "setup", key, value: true });
    if (i === 0 || i === 6) {
      for (const [x, y, z] of t.points) move(x, y, z);
    }
    if (i === 1) {
      const before = structuredClone(s);
      move(70, 28, 5, "G0", "preview");
      assert.equal(s.lastCheck.code, "FIXTURE");
      assert.deepEqual(s.position, before.position);
      assert.deepEqual(s.grid, before.grid);
      move(-10, 28, 12);
      move(70, 28, 12);
    }
    if (i === 4) {
      move(60, 43.5, -1, "G0", "preview");
      assert.equal(s.lastCheck.code, "HOLDER_FIXTURE");
      move(-20, 43.5, 12);
      move(60, 43.5, 12);
    }
    if (i === 5) {
      move(80, -15, 20, "G0", "preview");
      assert.equal(s.lastCheck.code, "MACHINE_BODY");
      move(-20, 12, 20);
      move(80, 12, 20);
      move(80, -15, 20);
    }
    if (i === 2 || i === 3) {
      if (i === 2) {
        move(10, 10, -1, "G0", "preview");
        assert.equal(s.lastCheck.code, "RAPID_STOCK");
      }
      move(10, 10, 5);
      r({ type: "spindle", value: true });
      if (i === 3) {
        move(10, 10, -2, "G1", "preview");
        assert.equal(s.lastCheck.code, "DEPTH");
      }
      move(10, 10, -1, "G1");
      move(50, 10, -1, "G1");
      if (i === 3) {
        move(50, 10, -2, "G1");
        move(10, 10, -2, "G1");
      }
      move(s.position.x, 10, 12);
      r({ type: "spindle", value: false });
      r({ type: "setup", key: "door", value: false });
      r({ type: "confirm" });
      assert.equal(s.done.length, i, "No credit before fresh surface checks");
      for (const x of [13, 31, 49]) r({ type: "measure", x });
    }
    if (i >= 7) {
      const lanes = i === 7 ? [1, 5, 9] : i === 8 ? [7] : [5, 9];
      r({ type: "spindle", value: true });
      for (let depth = 1; depth <= t.depth; depth++)
        for (const y of lanes) {
          move(s.position.x, s.position.y, 12);
          move(-4, y, 12);
          move(-4, y, -depth, "G1");
          move(40, y, -depth, "G1");
        }
      move(s.position.x, s.position.y, 12);
      r({ type: "spindle", value: false });
      r({ type: "setup", key: "door", value: false });
      for (const [x, y] of t.checks) r({ type: "surface", x, y });
    }
    r({ type: "confirm" });
    assert.equal(s.done.length, i + 1, s.feedback);
    if (i < m.lessonCount(s) - 1) r({ type: "next" });
  }
  return s;
}
module.exports = { complete };
