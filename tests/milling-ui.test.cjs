const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  { Element } = require("./helpers/dom.cjs"),
  m = require("../milling-course-model.js"),
  f = require("./milling-course-fixtures.cjs");
const context = {
  window: {
    CNCMillingCourse: m,
    CNCMillingCollision: require("../milling-collision-model.js"),
  },
  document: { createElement: (t) => new Element(t) },
};
vm.runInNewContext(
  fs.readFileSync(require.resolve("../milling-collision-ui.js"), "utf8"),
  context,
);
vm.runInNewContext(
  fs.readFileSync(require.resolve("../milling-course-ui.js"), "utf8"),
  context,
);
const ui = context.window.CNCMillingCourseUI;
let state = m.create();
const full = f.complete();
for (const a of full.events) {
  if (state.current === 7) break;
  state = m.transition(state, a);
}
let saved;
const host = ui.create({
  saved: m.snapshot(state),
  onChange: (s) => {
    saved = s;
    return true;
  },
});
assert.match(host.textContent, /Покрыто: 0%/);
assert(
  host
    .querySelectorAll("figure")
    .some((e) => e.markup.includes("Фактический поперечный профиль")),
);
assert(
  host
    .querySelectorAll("input")
    .some((e) => e.attributes["aria-label"] === "G54 Z, мм"),
);
assert(
  !host
    .querySelectorAll("button")
    .some((e) => e.textContent.includes("автоматическим щупом")),
);
assert.match(
  ui.create({ saved: { version: 99, events: [] } }).textContent,
  /не заменена новой/,
);
const readonly = ui.create({
  saved: m.review(m.snapshot(full), "face-coverage"),
  readOnly: true,
});
assert(!readonly.querySelectorAll("input").length);
const plate = ui.create({
  model: m.plate,
  routeMode: true,
  savedDraft: "План первой полосы",
});
assert.match(plate.textContent, /Самостоятельная плита · две глубины/);
assert.match(plate.textContent, /Покрыто: 0%/);
assert.equal(plate.querySelector("textarea").value, "План первой полосы");
assert(plate.querySelectorAll("button").some((b) => b.textContent === "Закрыть ограждение"));
console.log(
  "Milling UI: datum fields, coverage and actual section, corrupt-save guard and read-only review passed.",
);
