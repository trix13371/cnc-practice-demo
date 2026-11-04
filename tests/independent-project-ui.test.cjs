"use strict";
const assert = require("node:assert/strict"),
  vm = require("node:vm"),
  fs = require("node:fs"),
  { Element } = require("./helpers/dom.cjs");
const base = require("../shaft-project-model.js"),
  m = base.forTask("RF5-SHAFT-05");
const window = { CNCShaftProject: base };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../shaft-project-ui.js"), "utf8"),
  { window, document: { createElement: (t) => new Element(t) } },
);
const ui = window.CNCShaftProjectUI,
  host = ui.create({ saved: m.snapshot(m.create()), headingTag: "h1" });
assert.match(host.textContent, /Документы задания/);
assert.match(host.textContent, /Лист наладки/);
assert.match(host.textContent, /Карта контроля/);
assert.match(host.textContent, /критерии приёмки/);
const done = require("./shaft-variants-fixtures.cjs").complete(m);
let partial = m.create();
for (const event of done.events) {
  if (partial.step === 3) break;
  partial = m.transition(partial, event);
}
const view = ui.create({ saved: m.snapshot(partial) });
assert.equal(view.querySelector("textarea").value, "");
assert.match(view.textContent, /Пустой редактор/);
assert.match(
  ui.create({ saved: { version: 99 } }).textContent,
  /не заменена новой/,
);
console.log(
  "Independent project UI: drawing/setup/control/acceptance packet, empty editor and invalid-journal protection passed.",
);
