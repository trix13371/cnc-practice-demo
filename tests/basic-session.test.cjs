'use strict';
const assert = require('node:assert/strict');
const model = require('../model.js'), session = require('../basic-session-model.js');
const task = model.tasks[0];
const raw = { version: 1, task: 'diameter', settings: { ...task.defaults, x: 28 }, finished: true,
  measurement: { surface: 'worked', reading: 28, resolution: .01 }, verdict: 'ok', assisted: true, hintLevel: 0 };
const restored = session.restore(raw, task);
assert.equal(restored.inspection.passed, true);
assert.deepEqual(session.restore(session.snapshot(restored), task), restored);
assert.equal(session.snapshot(restored).inspection, undefined);
for (const measurement of [{ ...raw.measurement, reading: 27.8 }, { ...raw.measurement, resolution: .05 }]) {
  const s = session.restore({ ...raw, measurement }, task);
  assert.equal(s.measurement, null); assert.equal(s.inspection, null);
}
assert.equal(session.restore({ ...raw, finished: false }, task).measurement, null);
assert.equal(session.restore({ ...raw, settings: { ...raw.settings, x: 29 } }, task).measurement, null);
assert.equal(session.restore({ ...raw, measurement: { ...raw.measurement, surface: 'stock', reading: 32 } }, task).inspection.passed, false);
assert.equal(session.restore({ ...raw, verdict: 'large' }, task).inspection.passed, false);
assert.equal(session.restore({ ...raw, settings: { ...raw.settings, x: 1, offset: -2 } }, task), null);
assert.equal(session.restore({ ...raw, finished: false, settings: { ...raw.settings, x: NaN } }, task), null);
for (const bad of [null, [], {}, { ...raw, version: 2 }, { ...raw, task: 'offset' }]) assert.equal(session.restore(bad, task), null);
assert.equal(session.restore(raw, null), null);
assert.equal(session.restore({ ...raw, assisted: false, hintLevel: 1 }, task).assisted, true);
assert.equal(session.restore({ ...raw, verdict: 'large', inspection: { passed: true } }, task).inspection.passed, false);
console.log('Basic session: completed part, measured reading, verdict, changed settings and recovery passed.');
