"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  { Element } = require("./helpers/dom.cjs");
const course = require("../course-model.js"),
  route = require("../learning-path-model.js");
const context = {
  window: { CNCCourse: course, CNCWorkshop: { home() {} } },
  document: { createElement: (t) => new Element(t) },
};
let rendered;
for (const name of [
  "CNCMillingCourseUI",
  "CNCOperationCourseUI",
  "CNCMetrologyCourseUI",
  "CNCDiagnosticCourseUI",
])
  context.window[name] = {
    create: (options) => {
      rendered = options;
      return new Element("section");
    },
  };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../course-route-ui.js"), "utf8"),
  context,
);
const ui = context.window.CNCCourseRouteUI;
function check(key, raw, nextId, expectedAction) {
  const engine = course[key],
    start = engine.restore(raw),
    before = JSON.stringify(raw),
    path = { [key]: structuredClone(raw) },
    article = new Element("article");
  let saves = 0;
  const step = route.steps.find(
    (s) => s.target === key && s.subtask === nextId,
  );
  assert(step, nextId);
  ui.render({
    article,
    step,
    path,
    save: () => {
      saves++;
    },
    available: () => true,
    histories: [],
  });
  const next = engine.restore(rendered.saved),
    expected = engine.transition(start, expectedAction);
  assert.equal(
    JSON.stringify(engine.snapshot(next)),
    JSON.stringify(engine.snapshot(expected)),
    key,
  );
  assert.equal(
    JSON.stringify(path[key]),
    JSON.stringify(engine.snapshot(expected)),
  );
  assert.equal(saves, 1);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(rendered.readOnly, false);
}
const mill = course.millingCourse;
check(
  "millingCourse",
  mill.snapshot(require("./milling-course-fixtures.cjs").complete(1)),
  mill.lessons[4].id,
  { type: "upgrade" },
);
check(
  "millingCourse",
  mill.snapshot(require("./milling-course-fixtures.cjs").complete(2)),
  mill.lessons[6].id,
  { type: "upgrade" },
);
check(
  "operationCourse",
  require("./fixtures/operation-v1.json"),
  course.operationCourse.tasks[5].id,
  {
    type: "upgrade",
    assignment: structuredClone(course.operationCourse.tasks[5].assignment),
  },
);
const metro = course.metrologyCourse,
  full = metro.snapshot(require("./metrology-course-fixtures.cjs").complete());
check(
  "metrologyCourse",
  metro.review(full, metro.tasks[0].id),
  metro.tasks[1].id,
  { type: "next", assignment: structuredClone(metro.tasks[1].assignment) },
);
// A not-yet-accepted task remains current and is explicitly explained, not discarded.
const path = { millingCourse: mill.snapshot(mill.create()) },
  article = new Element("article");
ui.render({
  article,
  step: route.steps.find((s) => s.subtask === "face-coverage"),
  path,
  save: () => {},
  available: () => true,
  histories: [],
});
assert.equal(mill.restore(rendered.saved).current, 0);
assert.match(article.textContent, /Завершите/);
assert.equal(
  course.operationCourse.restore({ version: 3, events: [], draft: "" }),
  null,
  "Unsupported serialized versions remain rejected",
);
console.log(
  "Course route UI: actual consumer upgrades legacy books, carries assignment identity, preserves pending work and explains unfinished prerequisites.",
);
