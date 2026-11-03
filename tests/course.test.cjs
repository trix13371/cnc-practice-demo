'use strict';
const assert = require('node:assert/strict');
const course = require('../course-model.js');

const { lessons, evaluate, restore } = course;
const byId = Object.fromEntries(lessons.map(l => [l.id, l]));

// Every lesson: correct answer accepted, wrong answers rejected.
for (const l of lessons) {
  if (l.choices) {
    const r = evaluate(l.id, l.answer);
    assert.equal(r.valid, true, l.id + ' correct valid');
    assert.equal(r.correct, true, l.id + ' correct');
    for (let i = 0; i < l.choices.length; i++) {
      if (i === l.answer) continue;
      const w = evaluate(l.id, i);
      assert.equal(w.valid, true, l.id + ' wrong valid');
      assert.equal(w.correct, false, l.id + ' wrong ' + i);
    }
  } else {
    const r = evaluate(l.id, l.value);
    assert.equal(r.valid, true, l.id + ' correct valid');
    assert.equal(r.correct, true, l.id + ' correct');
    const w = evaluate(l.id, l.value + 1);
    assert.equal(w.valid, true, l.id + ' wrong valid');
    assert.equal(w.correct, false, l.id + ' wrong');
  }
}

// Nonnumeric / nonfinite / string / null inputs are invalid everywhere.
const bad = [NaN, Infinity, -Infinity, '0', '2', null, undefined, {}, [], true, false];
for (const l of lessons) {
  for (const v of bad) {
    const r = evaluate(l.id, v);
    assert.equal(r.valid, false, l.id + ' invalid ' + String(v));
    assert.equal(r.correct, false, l.id + ' not correct ' + String(v));
  }
}

// Missing / invalid lesson IDs.
for (const id of ['', 'nope', 'MACHINE', null, undefined, 0, {}]) {
  const r = evaluate(id, 0);
  assert.equal(r.valid, false, 'bad id ' + String(id));
  assert.equal(r.correct, false, 'bad id correct ' + String(id));
}

// Restore: forged / malformed answers and unknown lessons rejected.
const forged = restore({ version: 1, answers: { machine: 1, diameter: 999, axes: '26', nope: 0 } });
assert.deepEqual(forged, { version: 1, answers: {} });
assert.deepEqual(restore(null), { version: 1, answers: {} });
assert.deepEqual(restore({ version: 2, answers: { machine: 0 } }), { version: 1, answers: {} });
assert.deepEqual(restore({ version: 1, answers: 'x' }), { version: 1, answers: {} });

// Restore preserves independently valid correct answers.
const mixed = restore({ version: 1, answers: { machine: 0, safety: 0, diameter: 2, axes: 26, nope: 0 } });
assert.deepEqual(mixed, { version: 1, answers: { machine: 0, diameter: 2, axes: 26 } });

// JSON round-trip.
const round = restore(JSON.parse(JSON.stringify(mixed)));
assert.deepEqual(round, mixed);
assert.deepEqual(restore(JSON.parse(JSON.stringify({ version: 1, answers: {} }))), { version: 1, answers: {} });

// Sanity: lesson metadata intact.
assert.equal(lessons.length, 24);
assert.equal(byId.machine.answer, 0);
assert.equal(byId.diameter.value, 2);

console.log('Course checks passed: answers, invalid inputs, partial recovery and round-trip.');

// A first visit has a gentle four-lesson introduction before any numeric question.
assert.deepEqual(lessons.slice(0,4).map(l=>l.id),['machine','safety','tool','control']);
assert.ok(lessons.slice(0,4).every(l=>Array.isArray(l.choices)));
assert.ok(lessons.findIndex(l=>l.id==='feed')>lessons.findIndex(l=>l.id==='diameter'));
assert.deepEqual(require('../course-discovery.js').order,lessons.map(l=>l.id));
assert.deepEqual(Object.keys(require('../course-discovery.js').units).sort(),[...course.discoveryIds].sort());

// Reading and exploration have their own state; neither grants a correct quiz answer.
const reading=course.restorePath({version:1,selected:'machine',phases:{machine:1},explored:[]});
assert.equal(course.canCheck('machine',reading,{}),false);
const explored=course.restorePath({...reading,explored:['machine','machine','unknown'],phases:{machine:2}});
assert.deepEqual(explored.explored,['machine']);
assert.equal(explored.phases.machine,2);
assert.equal(course.canCheck('machine',explored,{}),true);
assert.deepEqual(restore(explored).answers,{});
assert.equal(course.canCheck('machine',reading,{machine:0}),true,'old completion allows review');
assert.equal(course.canCheck('setup',reading,{}),true,'reading-only advanced lessons remain available');
assert.equal(course.canCheck('unknown',reading,{}),false);
assert.deepEqual(course.restorePath(JSON.parse(JSON.stringify(explored))),explored);
const corrupt=course.restorePath({version:1,selected:'unknown',explored:'machine',phases:{machine:2,safety:NaN,setup:1,tool:'1',axes:-1,nope:0}});
assert.deepEqual(corrupt,{version:1,selected:'machine',phases:{},explored:[]});
assert.deepEqual(course.restorePath(null),{version:1,selected:'machine',phases:{},explored:[]});
assert.deepEqual(course.restorePath({version:2,selected:'feed'}),course.restorePath(null));

// All historical lesson answers still restore regardless of the new order.
const allOldAnswers=Object.fromEntries(lessons.map(l=>[l.id,l.choices?l.answer:l.value]));
assert.deepEqual(restore({version:1,answers:allOldAnswers}).answers,allOldAnswers);
console.log('Guided course checks passed: progression, recovery, exploration gates, legacy progress.');