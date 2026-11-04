const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  { Element } = require("./helpers/dom.cjs"),
  m = require("../metrology-course-model.js");
const context = {
  window: { CNCMetrologyCourse: m },
  document: { createElement: (tag) => new Element(tag) },
};
vm.runInNewContext(
  fs.readFileSync(require.resolve("../metrology-course-ui.js"), "utf8"),
  context,
);
const ui = context.window.CNCMetrologyCourseUI;
let saved = null;
const host = ui.create({
  headingTag: "h1",
  onChange: (value) => {
    saved = value;
    return true;
  },
});
assert.match(host.textContent, /Поверхность, прибор/);
assert(host.querySelector("figure").markup.includes('role="img"'));
host
  .all()
  .find((e) => e.tagName === "button" && e.textContent === "Сплошная")
  .onclick();
host
  .all()
  .find((e) => e.tagName === "button" && e.textContent === "A · Шейка")
  .onclick();
assert(m.restore(saved));
const select = host.querySelector("select");
assert(select.children.some((e) => e.textContent.includes("Микрометр")));
select.value = "outside";
select.onchange();
assert.match(host.textContent, /дискретность 0,010/);
const corrupt = structuredClone(saved);
corrupt.events[0].assignment.criteriaVersion = 99;
assert.match(ui.create({ saved: corrupt }).textContent, /не заменена новой/);
const complete = require("./metrology-course-fixtures.cjs").complete();
for (const id of ["section-hole", "bushing-transfer"]) {
  const diagram = ui
    .create({ saved: m.review(m.snapshot(complete), id) })
    .querySelector("figure").markup;
  assert(
    diagram.includes('fill="#fff"/><path'),
    "Opening removes the front edge before drawing only bore boundaries",
  );
  assert(
    !diagram.includes('fill="#fff" stroke='),
    "A closed rectangle must not cap the bore opening",
  );
}
console.log(
  "Metrology UI: surface-linked control, instrument passport, persistent selection and invalid-version protection passed.",
);
