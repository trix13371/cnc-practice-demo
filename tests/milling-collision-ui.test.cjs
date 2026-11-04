"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  { Element } = require("./helpers/dom.cjs");
const m = require("../milling-course-model.js"),
  model = require("../milling-collision-model.js"),
  full = require("./milling-course-fixtures.cjs").complete();
const context = {
  window: { CNCMillingCourse: m, CNCMillingCollision: model },
  document: { createElement: (t) => new Element(t) },
};
for (const file of ["milling-collision-ui.js", "milling-course-ui.js"])
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../" + file), "utf8"),
    context,
  );
let s = m.create();
for (const a of full.events) {
  if (s.current === 4 && m.ready(s)) break;
  s = m.transition(s, a);
}
s = m.transition(s, { type: "preview", x: 60, y: 43.5, z: -1, mode: "G0" });
const before = JSON.stringify(m.snapshot(s)),
  host = context.window.CNCMillingCourseUI.create({ saved: m.snapshot(s) });
assert.match(host.textContent, /Почему путь заблокирован/);
assert.match(host.textContent, /Державка → Крепление/);
assert.match(host.textContent, /не точка физического контакта/);
assert.match(host.textContent, /Весь отвергнутый ход не выполнен/);
assert.match(host.textContent, /Z7…27/);
assert.match(host.textContent, /X13 Y43,5 Z-1/);
const drawings = host
  .querySelectorAll("figure")
  .filter((f) => f.className === "milling-collision-figure");
assert.equal(drawings.length, 2);
assert(drawings[0].markup.includes("XY · вид сверху"));
assert(drawings[1].markup.includes("XZ · вид сбоку"));
for (const f of drawings) {
  assert(f.markup.includes('role="img"'));
  assert.doesNotMatch(f.markup, /NaN|undefined|Infinity/);
}
assert.equal(
  JSON.stringify(m.snapshot(s)),
  before,
  "Viewing cannot change journal/material or award credit",
);
s = m.transition(s, { type: "move", x: -20, y: 43.5, z: 12, mode: "G0" });
const history = context.window.CNCMillingCourseUI.create({
  saved: m.snapshot(s),
});
assert.match(history.textContent, /Предыдущий отказ/);
assert.match(history.textContent, /Разбор предыдущего отказа/);
const fake = { ...s, position: { x: 30, y: 43.5, z: 12 } },
  check = m.collision(fake, { x: 30, y: 43.5, z: -1, mode: "G0" }),
  from = fake.position,
  to = { x: 30, y: 43.5, z: -1 };
const vertical = model.describe({
  ...fake,
  lastCheck: { ...check, from, to, preview: true },
  incidents: [
    { ...check, from, to, preview: true, lesson: m.lessons[s.current].id },
  ],
});
const panel = context.window.CNCMillingCollisionUI.create({ report: vertical });
assert(
  panel.querySelectorAll("figure")[0].markup.includes("A/B/P"),
  "Coincident XY markers must share one label rather than overlap",
);
const side = panel.querySelectorAll("figure")[1].markup;
const labelY = (name) =>
  Number(
    side.match(
      new RegExp('data-marker-label="' + name + '"[^>]*y="([^"]+)"'),
    )[1],
  );
assert(
  Math.abs(labelY("B") - labelY("P")) >= 20,
  "Nearby endpoints need separated text labels, not overlapping B and P",
);
const top = drawings[0].markup;
assert(
  top.indexOf('data-obstacle="stock"') < top.indexOf('data-obstacle="fixture"'),
  "Stock must not occlude the colliding fixture",
);
const oldBook=m.snapshot(require('./milling-course-fixtures.cjs').complete(2));
let previous=m.restore({...oldBook,events:oldBook.events.slice(0,-1)});
previous=m.transition(previous,{type:'preview',x:-20,y:-15,z:20,mode:'G0'});
previous=m.transition(previous,{type:'confirm'});
assert.equal(previous.done.length,6);
assert.equal(model.describe(previous).historical,true,'An accepted task displays its rejected preview as history');
previous=m.transition(previous,{type:'upgrade'});
const nextView=context.window.CNCMillingCourseUI.create({saved:m.snapshot(previous)});
assert.doesNotMatch(nextView.textContent,/Отвергнутый путь:/,'A stale lastCheck must not appear as a failed command in the next lesson');
console.log(
  "Milling collision UI: XY/XZ, explicit non-contact reference, rejected whole path, heights/coordinates, immutable viewing and historical/overlapping projections passed.",
);
