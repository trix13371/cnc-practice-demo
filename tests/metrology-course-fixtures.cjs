const assert = require("node:assert/strict"),
  m = require("../metrology-course-model.js");
function complete() {
  let s = m.create();
  const run = (a) => (s = m.transition(s, a));
  for (const t of m.tasks) {
    run({ type: "section", value: t.section });
    function measure(precise = false) {
      for (const id of t.required) {
        const v = t.surfaces.find((v) => v.id === id);
        run({ type: "surface", id });
        run({
          type: "instrument",
          id:
            v.kind === "inner" ? "inside" : precise ? "micrometer" : "outside",
        });
        run({ type: "zero" });
        for (const p of v.points) {
          run({ type: "contact", point: p.id });
          run({ type: "record", value: String(s.contact.reading / 1000) });
        }
        run({
          type: "limits",
          lower: String(v.lower / 1000),
          upper: String(v.upper / 1000),
        });
      }
    }
    measure();
    const value =
      t.id === "two-sections" || t.revised
        ? "reject"
        : t.refine
          ? "uncertain"
          : "accept";
    run({ type: "verdict", value });
    if (t.refine) {
      assert(!s.done.some((r) => r.id === t.id));
      measure(true);
      run({ type: "verdict", value: "accept" });
    }
    if (t.revised) {
      assert(!s.done.some((r) => r.id === t.id));
      run({ type: "revision" });
      assert.throws(() => run({ type: "verdict", value: "accept" }));
      measure();
      run({ type: "verdict", value: "accept" });
    }
    assert(
      s.done.some((r) => r.id === t.id),
      s.feedback,
    );
    if (s.current < 5)
      run({ type: "next", assignment: m.tasks[s.current + 1].assignment });
  }
  return s;
}
module.exports = { complete };
