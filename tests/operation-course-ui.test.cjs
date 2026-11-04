"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { Element } = require("./helpers/dom.cjs");
const m = require("../operation-course-model.js");
const legacy = m.restore(require("./fixtures/operation-v1.json"));
const state = m.transition(legacy, {
  type: "upgrade",
  assignment: m.tasks[5].assignment,
});
const context = {
  window: { CNCOperationCourse: m },
  document: { createElement: (tag) => new Element(tag) },
};
vm.runInNewContext(
  fs.readFileSync(require.resolve("../operation-course-ui.js"), "utf8"),
  context,
);
const ui = context.window.CNCOperationCourseUI;
let saved = null;
const host = ui.create({
  headingTag: "h1",
  saved: m.snapshot(state),
  onChange: (value) => {
    saved = value;
    return true;
  },
});
assert.equal(host.querySelector("h1").textContent, m.tasks[5].title);
assert.equal(
  host.querySelectorAll("select").length,
  0,
  "Setup follows the plan instead of competing with it",
);
assert.equal(host.querySelectorAll("textarea").length, 0);
assert(host.querySelector("figure").markup.includes(">A</text>"));
assert(host.querySelector("figure").markup.includes(">B</text>"));
assert(
  host
    .querySelectorAll("details")
    .some((d) => d.children[0].textContent === "Темы практикума"),
);
const protectedButton = host
  .all()
  .find((e) => e.tagName === "button" && e.textContent === "B · База");
assert.equal(protectedButton.attributes["aria-pressed"], "false");
protectedButton.onclick();
assert(saved);
const forecast = host
  .querySelectorAll("form")
  .find((f) => f.textContent.includes("припуск"));
forecast.querySelector("input").value = "2";
forecast.onsubmit({ preventDefault() {} });
assert(m.restore(saved).prediction);
assert.equal(
  host.querySelectorAll("textarea").length,
  0,
  "Code follows preparation",
);
assert(ui.create({ saved }).textContent.includes("План согласован"));
const select = host.querySelector("select");
assert(
  select.children.some((o) => o.textContent.includes("T0202")),
  "Finishing tool is selectable",
);
assert(
  host
    .querySelectorAll("details")
    .some((d) => d.children[0].textContent === "Что требуется для зачёта"),
);
const broken = structuredClone(saved);
broken.events.at(-3).assignment.profileVersion = 99;
let writes = 0;
const failed = ui.create({
  saved: broken,
  onChange: () => {
    writes++;
  },
});
assert.match(failed.textContent, /Сохранённое условие недоступно/);
assert.equal(writes, 0);
assert.equal(failed.querySelectorAll("textarea").length, 0);
console.log(
  "Operation UI: surface-linked diagram, persistent forecast, four tool options, criteria and non-destructive version error passed.",
);
