"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { Element } = require("./helpers/dom.cjs"),
  m = require("../diagnostic-course-model.js");
const window = {
  CNCDiagnosticCourse: m,
  CNCMillingCourse: require("../milling-course-model.js"),
};
vm.runInNewContext(
  fs.readFileSync(require.resolve("../diagnostic-course-ui.js"), "utf8"),
  { window, document: { createElement: (t) => new Element(t) } },
);
const ui = window.CNCDiagnosticCourseUI;
const invalid = ui.create({
  saved: { version: 99, events: [], draft: m.draftFor(m.tasks[0]) },
});
assert.match(
  invalid.textContent,
  /не заменена/,
  "Unknown journal cannot silently restart",
);
let s = m.transition(m.create(), { type: "inspect" });
s = m.transition(s, {
  type: "repair",
  draft: {
    ...m.draftFor(m.tasks[0]),
    cause: "rapid",
    program: m.tasks[0].reference,
  },
});
const view = ui.create({ saved: m.snapshot(s), readOnly: true });
assert.match(view.textContent, /Исходная проверка/);
assert.match(view.textContent, /Последняя проверка исправления/);
assert.match(view.textContent, /Строка 5/);
assert.match(view.textContent, /G0 Z-20/);
assert(s.originalResult.incident);
assert.equal(s.repairResult.incident, null);
assert(
  view.querySelectorAll("figure").length >= 2,
  "Original frame and repaired result remain separately visible",
);
console.log(
  "Diagnostic UI: unknown-version protection, failed source row and preserved original/repaired views passed.",
);
