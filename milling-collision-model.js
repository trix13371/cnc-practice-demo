(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./milling-course-model.js")
      : root.CNCMillingCourse,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCMillingCollision = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (base) {
  "use strict";
  const axes = ["x", "y", "z"],
    eps = 1e-8;
  const rules = Object.freeze({
    FIXTURE: ["cutter", "fixture"],
    HOLDER_FIXTURE: ["holder", "fixture"],
    RAPID_STOCK: ["cutter", "stock"],
    HOLDER_STOCK: ["holder", "stock"],
    MACHINE_BODY: [null, "column"],
  });
  const point = (p) =>
    !!p && axes.every((k) => typeof p[k] === "number" && Number.isFinite(p[k]));
  const copyPoint = (p) => ({ x: p.x, y: p.y, z: p.z });
  const same = (a, b) =>
    point(a) && point(b) && axes.every((k) => Math.abs(a[k] - b[k]) <= eps);
  function pair(check) {
    const rule = check && Object.hasOwn(rules, check.code) && rules[check.code];
    if (!rule || !point(check.from) || !point(check.to) || !point(check.point))
      return null;
    const part = base.geometry.parts.find((p) =>
      check.part == null ? p.id === rule[0] : p.title === check.part,
    );
    const obstacle = base.geometry.obstacles.find((o) =>
      check.obstacle == null ? o.id === rule[1] : o.title === check.obstacle,
    );
    if (
      !part ||
      !obstacle ||
      obstacle.id !== rule[1] ||
      (rule[0] && part.id !== rule[0])
    )
      return null;
    return { part, obstacle };
  }
  function box(part, p) {
    return {
      x0: p.x - part.radius,
      x1: p.x + part.radius,
      y0: p.y - part.radius,
      y1: p.y + part.radius,
      z0: p.z + part.z0,
      z1: p.z + part.z1,
    };
  }
  function describe(state, lesson = state && base.lessons[state.current]) {
    if (!lesson) return null;
    const log = (state.incidents || []).filter((i) => i.lesson === lesson.id),
      latest = log.at(-1),
      check = state.lastCheck;
    let source = null,
      historical = true;
    // lastCheck survives next/upgrade. An incident of this lesson must corroborate it.
    if (
      check?.ok === false &&
      latest &&
      latest.code === check.code &&
      same(latest.from, check.from) &&
      same(latest.to, check.to) &&
      same(latest.point, check.point) &&
      pair(check)
    ) {
      source = check;
      historical = false;
    }
    if (!source && state.fault) {
      const active = log.findLast(
        (i) =>
          i.code === state.fault.code &&
          same(i.point, state.fault.point) &&
          pair(i),
      );
      if (active) {
        source = active;
        historical = false;
      }
    }
    if (!source) source = log.findLast((i) => pair(i));
    if (!source) return null;
    if(state.done?.some(d=>d.id===lesson.id))historical=true;
    const { part, obstacle } = pair(source),
      p = source.point,
      keepOut = base.keepOut(part, obstacle),
      partBox = box(part, p);
    // Reject inconsistent presentation data; never invent a contact from a code alone.
    const entry = base.segmentBox(
      source.from,
      source.to,
      { x: keepOut.x0, y: keepOut.y0, z: keepOut.z0 },
      { x: keepOut.x1, y: keepOut.y1, z: keepOut.z1 },
    );
    if (!same(entry, p)) return null;
    let length2 = 0,
      dot = 0;
    for (const k of axes) {
      const delta = source.to[k] - source.from[k];
      length2 += delta * delta;
      dot += (p[k] - source.from[k]) * delta;
    }
    const overlap = Object.fromEntries(
      axes.map((k) => [
        k,
        Math.min(partBox[k + "1"], obstacle[k + "1"]) -
          Math.max(partBox[k + "0"], obstacle[k + "0"]),
      ]),
    );
    const inside = axes.every(
      (k) =>
        source.from[k] >= keepOut[k + "0"] - eps &&
        source.from[k] <= keepOut[k + "1"] + eps,
    );
    return {
      lesson: lesson.id,
      code: source.code,
      title: base.faults[source.code][0],
      advice: base.faults[source.code][1],
      historical,
      preview: !!source.preview,
      from: copyPoint(source.from),
      to: copyPoint(source.to),
      point: copyPoint(p),
      positionNow: copyPoint(state.position),
      physicalContact: false,
      fraction: length2 ? Math.max(0, Math.min(1, dot / length2)) : 0,
      startInside: inside,
      part: { id: part.id, title: part.title, radius: part.radius },
      obstacle: { ...obstacle },
      partBox,
      keepOut,
      overlap,
      assembly: base.geometry.parts
        .filter((c) => state.profile !== 1 || c.id === "cutter")
        .map((c) => ({
          id: c.id,
          title: c.title,
          radius: c.radius,
          box: box(c, p),
        })),
    };
  }
  return Object.freeze({ describe });
});
