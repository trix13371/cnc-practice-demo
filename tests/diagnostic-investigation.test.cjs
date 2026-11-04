"use strict";
const assert = require("node:assert/strict");
const m = require("../diagnostic-course-model.js");
const rapid = m.original(m.tasks[0]);
assert(rapid.incident, "First rejected block has a reproducible frame");
assert.equal(rapid.incident.row, 5);
assert.equal(rapid.incident.raw, "G0 Z-20");
assert.equal(rapid.incident.before.coordinates.work.z, 2);
assert.equal(rapid.incident.command.work.z, -20);
assert.equal(rapid.incident.command.motion, 0);
assert.deepEqual(
  rapid.position,
  rapid.incident.before.coordinates.actual,
  "Rejected movement has not been applied",
);
const zero = m.original(m.tasks.find((t) => t.id === "diag-zero"));
assert.equal(zero.incident.row, 4);
assert.equal(zero.incident.before.workOffset.z, 98);
assert.equal(zero.incident.command.work.z, 2);
assert.equal(
  zero.incident.command.actual.z,
  0,
  "Wrong G54 changes the actual point even with the same programmed coordinate",
);
for (const t of m.tasks) {
  const original = m.original(t);
  assert(
    original.incident && original.incident.row > 0,
    t.id + " has its first rejected source line",
  );
  const fixed = {
    ...m.draftFor(t),
    program: t.kind === "lathe" ? t.reference : "",
    route: t.kind === "mill" ? t.reference : "",
    zero: "100",
    tool: String(t.correctTool ?? t.tool ?? 1),
    spindle: true,
    cause: t.cause,
  };
  const check = m.evaluate(t, fixed);
  assert(m.matches(t, check), t.id + " accepts a verified repair");
  assert.equal(check.incident, null);
}
const t = m.tasks.find((t) => t.id === "diag-zero");
const masked = {
  ...m.draftFor(t),
  program: t.reference.replaceAll("Z2", "Z4").replaceAll("Z-20", "Z-18"),
  cause: "zero",
};
assert(
  !m.matches(t, m.evaluate(t, masked)),
  "Moving program coordinates does not repair G54",
);
const holder = m.original(m.tasks.find((t) => t.id === "diag-holder"));
assert.equal(holder.incident.part, "Державка");
assert.equal(holder.incident.obstacle, "Крепление");
assert.equal(holder.incident.row,1);
assert.equal(holder.incident.raw,'60 43.5 -1 G0');
assert.deepEqual(holder.incident.before.position,{x:-20,y:43.5,z:-1});
const completed=require('./diagnostic-course-fixtures.cjs').complete();
let wrongCause=m.transition(m.create(),{type:'inspect'});
const fixedFirst={...m.draftFor(m.tasks[0]),program:m.tasks[0].reference,cause:'depth'};
wrongCause=m.transition(wrongCause,{type:'repair',draft:fixedFirst});
assert.equal(wrongCause.done.length,0);
assert.equal(wrongCause.errors[0],1);
assert.deepEqual(wrongCause.originalResult,rapid,'A failed repair does not erase the original incident');
let zeroState=m.create();for(const event of completed.events){if(zeroState.current===4)break;zeroState=m.transition(zeroState,event);}
zeroState=m.transition(zeroState,{type:'inspect'});
zeroState=m.transition(zeroState,{type:'repair',draft:masked});
assert(!zeroState.done.some(d=>d.id==='diag-zero'));
for(const item of completed.done){const reviewed=m.restore(m.review(m.snapshot(completed),item.id));assert(reviewed.done.some(d=>d.id===item.id),'Historical review remains executable');}
let spindleState=m.create();for(const event of completed.events){if(spindleState.current===9)break;spindleState=m.transition(spindleState,event);}
spindleState=m.transition(spindleState,{type:'inspect'});
spindleState=m.transition(spindleState,{type:'repair',draft:{...spindleState.draft,cause:'spindle',route:'10 10 -1 G0\n10 10 5 G0'}});
assert(!spindleState.done.some(d=>d.id==='diag-spindle'));
const originalCopy = m.original(m.tasks[0]);
originalCopy.incident.row = 999;
assert.equal(
  m.original(m.tasks[0]).incident.row,
  5,
  "Derived incident cache does not leak mutable state",
);
console.log(
  "Diagnostic investigation: first failed row, atomic position, work/actual coordinates, wrong-zero masking, assembly identity and corrected replay passed.",
);
