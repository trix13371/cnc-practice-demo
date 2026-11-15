"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { Element } = require("./helpers/dom.cjs");
let pending = null,
  starts = 0;
const window = {
  CNCLearningUI: {
    progress: () => require("../learning-path-model.js").status(),
  },
  CNCCourseUI: { pendingSession: () => pending },
  CNCWorkshop: { results() {} },
};
vm.runInNewContext(fs.readFileSync(require.resolve("../home-ui.js"), "utf8"), {
  window,
  document: { createElement: (tag) => new Element(tag) },
});
const root = window.CNCHomeUI.mount(new Element("main"), () => starts++);
const primary = () => root.all().find((e) => e.dataset.homeStart !== undefined);
assert.match(primary().textContent, /Начать обучение/);
pending = {
  key: "firstSession",
  title: "Первое знакомство",
  step: 1,
  total: 9,
};
window.CNCHomeUI.render();
assert.match(primary().textContent, /Продолжить обучение/);
assert.match(root.textContent, /2 из 9/);
primary().click();
assert.equal(starts, 1, "Continue still follows the main route");
const cards = root.querySelectorAll(".home-route-card");
const outline = root.querySelector(".course-outline");
const outlineSteps = outline.querySelectorAll("button");
assert.equal(outlineSteps.length, require("../learning-path-model.js").steps.length);
assert(outlineSteps.every((button) => !button.disabled));
assert.match(outlineSteps[0].textContent, /Первое знакомство/);
let direct;
window.CNCLearningUI.openDirect = (id) => (direct = id);
outlineSteps.find((button) => /Обход корпуса станка/.test(button.textContent)).click();
assert.equal(direct, "milling-machine-column");
assert.equal(
  cards.reduce(
    (n, c) => n + Number(c.attributes["aria-label"].match(/из (\d+) шагов/)[1]),
    0,
  ),
  require("../learning-path-model.js").steps.length,
  "Every course step appears in exactly one home section",
);
let opened = null;
for (const group of ["metrology", "turningDeep"]) {
  const step = require("../learning-path-model.js").steps.find(
    (s) => s.group === group,
  );
  window.CNCLearningUI.progress = () => ({
    ...require("../learning-path-model.js").status(),
    next: step,
  });
  window.CNCLearningUI.open = (id) => (opened = id);
  window.CNCHomeUI.render();
  const current = root
    .querySelectorAll(".home-route-card")
    .find((c) => c.dataset.current === "true");
  assert(current && !current.disabled, "New block has an available home card");
  current.click();
  assert.equal(opened, step.id);
}
console.log(
  "Home: fresh start and saved introductory action have distinct labels and resume the route.",
);
