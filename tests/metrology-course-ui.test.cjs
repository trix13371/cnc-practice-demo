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
const decision = (view) =>
  view
    .all()
    .find(
      (el) =>
        el.tagName === "button" && el.textContent === "Подтвердить по размеру",
    );
assert.equal(
  decision(host),
  undefined,
  "No dimensional decision before measurements and limits",
);
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
let replay = m.create(),
  switched,
  coarse,
  revised,
  beforeFirstVerdict;
for (const event of complete.events.slice(1)) {
  if (!beforeFirstVerdict && event.type === "verdict")
    beforeFirstVerdict = m.snapshot(replay);
  replay = m.transition(replay, event);
  if (!coarse && m.tasks[replay.current].refine && replay.coarseReviewed)
    coarse = m.snapshot(replay);
  if (!revised && m.tasks[replay.current].revised && replay.revision === 1)
    revised = m.snapshot(replay);
  if (
    !switched &&
    m.tasks[replay.current].id === "bushing-transfer" &&
    replay.surface === "B" &&
    replay.records.length === 2
  )
    switched = m.snapshot(replay);
}
assert(
  decision(ui.create({ saved: beforeFirstVerdict })),
  "Complete fresh records and limits unlock decision",
);
const coarseView = ui.create({ saved: coarse }),
  revisedView = ui.create({ saved: revised });
assert.equal(
  decision(coarseView),
  undefined,
  "Coarse readings cannot unlock the refined decision",
);
assert.match(coarseView.textContent, /Уточняющий контроль/);
assert.equal(
  decision(revisedView),
  undefined,
  "Old revision cannot unlock the new decision",
);
assert.match(revisedView.textContent, /Деталь после доработки/);
assert.match(revisedView.textContent, /свежих замеров 0 из 2/);
assert.equal(
  ui.create({ saved: switched }).querySelector(".start-feedback").textContent,
  "",
  "A change of surface cannot retain a previous success message",
);
for (const id of ["section-hole", "bushing-transfer"]) {
  const diagram = ui
    .create({ saved: m.review(m.snapshot(complete), id) })
    .querySelector("figure").markup;
  assert(
    diagram.includes('fill="#fff"/><path'),
    "Opening removes the front edge before drawing only bore boundaries",
  );
  assert(
    !/<rect\b[^>]*fill="#fff"[^>]*stroke=/.test(diagram),
    "A closed rectangle must not cap the bore opening",
  );
}
console.log(
  "Metrology UI: surface-linked control, instrument passport, persistent selection and invalid-version protection passed.",
);
