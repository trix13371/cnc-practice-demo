'use strict';

// Tests for the pure CNC sandbox model (tests/sandbox.test.cjs).
// Run with: node tests/sandbox.test.cjs

const assert = require('node:assert');
const model = require('../sandbox-model.js');

const close = (actual, expected, eps = 1e-6) => {
  assert.ok(Math.abs(actual - expected) < eps, `expected number ${actual} to be close to ${expected}`);
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const geometryOf = (state) => ({ profile: state.profile, cuts: state.cuts, readings: state.readings });

function runWork(actions, config = { diameter: 40, length: 60 }) {
  let work = model.newWork('Тестовая деталь', config);
  let last = null;
  for (const action of actions) {
    last = model.execute(work, action);
    work = last.work;
  }
  return { work, last };
}

function makeWork(id, events, cursor) {
  return { id, version: 1, name: 'Моя деталь', stock: { diameter: 32, length: 60 }, events, cursor };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// --- public API -----------------------------------------------------------

test('public API surface', () => {
  for (const key of ['create', 'transition', 'remove', 'sample', 'newWork', 'restoreWork', 'execute', 'seek',
    'createBook', 'restoreBook', 'addWork', 'removeWork', 'isActive', 'stateOf', 'exportBook', 'parseBook', 'importBook']) {
    assert.strictEqual(typeof model[key], 'function');
  }
});

test('configuration limits are frozen constants', () => {
  assert.strictEqual(model.MAX_WORKS, 5);
  assert.strictEqual(model.MAX_EVENTS, 160);
  assert.ok(Object.isFrozen(model.limits));
  for (const key of ['diameter', 'length', 'x', 'feed', 'rpm']) {
    assert.ok(Array.isArray(model.limits[key]));
    assert.ok(Object.isFrozen(model.limits[key]), `limits.${key} must be frozen`);
  }
  assert.deepStrictEqual(model.limits.diameter, [5, 80]);
  assert.deepStrictEqual(model.limits.length, [10, 150]);
  assert.deepStrictEqual(model.limits.x, [1, 80]);
  assert.deepStrictEqual(model.limits.feed, [0.05, 0.3]);
  assert.deepStrictEqual(model.limits.rpm, [200, 1200]);
  assert.strictEqual(model.limits.maxDepth, 2);
});

test('normalize enforces parameter limits before any geometry changes', () => {
  assert.throws(() => model.normalize({ type: 'cut', start: -10, end: -5, x: 81, feed: 0.1, rpm: 800 }), /Проход/);
  assert.throws(() => model.normalize({ type: 'cut', start: -10, end: -5, x: 0.5, feed: 0.1, rpm: 800 }), /Проход/);
  assert.throws(() => model.normalize({ type: 'cut', start: -10, end: -5, x: 36, feed: 0.04, rpm: 800 }), /Проход/);
  assert.throws(() => model.normalize({ type: 'cut', start: -10, end: -5, x: 36, feed: 0.1, rpm: 1300 }), /Проход/);
  assert.throws(() => model.normalize({ type: 'drill', x: 36 }), /Действие не поддерживается/);
  assert.throws(() => model.create({ diameter: 81, length: 60 }), /Заготовка/);
  assert.throws(() => model.newWork(''), /Название/);
  assert.throws(() => model.newWork('x'.repeat(61)), /Название/);
});

// --- persistent cuts ------------------------------------------------------

test('cuts persist across later actions and journal replay', () => {
  const { work, last } = runWork([
    { type: 'spindle', value: true },
    { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 },
    { type: 'spindle', value: false },
    { type: 'measure', z: -25, instrument: 'caliper' },
  ]);
  assert.ok(last.ok);
  const state = model.restoreWork(work).state;
  assert.strictEqual(state.cuts.length, 1);
  assert.strictEqual(state.readings.length, 1);
  assert.strictEqual(state.cuts[0].index, 1);
  close(state.cuts[0].seconds, 7.5, 1e-9);
  close(state.cuts[0].volume, Math.PI / 4 * (1600 - 1296) * 10);
  assert.deepStrictEqual(state.profile.segments, [
    { length: 30, diameter: 40, endDiameter: 40, bore: 0 },
    { length: 10, diameter: 36, endDiameter: 36, bore: 0 },
    { length: 20, diameter: 40, endDiameter: 40, bore: 0 },
  ]);
  const m = state.readings[0];
  assert.strictEqual(m.z, -25);
  assert.strictEqual(m.u, 35);
  assert.strictEqual(m.actual, 36);
  assert.strictEqual(m.reading, 36);
  assert.strictEqual(m.afterCut, 1);
  assert.strictEqual(m.instrument, 'caliper');
});

// --- Z / u mapping --------------------------------------------------------

test('Z to u mapping for measurements', () => {
  const base = model.create({ diameter: 40, length: 60 });
  const at = model.transition(base, { type: 'measure', z: -10, instrument: 'caliper' });
  assert.ok(at.ok);
  assert.strictEqual(at.data.u, 50);
  assert.strictEqual(at.data.z, -10);

  const face = model.transition(base, { type: 'measure', z: 0, instrument: 'micrometer' });
  assert.ok(face.ok);
  assert.strictEqual(face.data.u, 60);

  const tail = model.transition(base, { type: 'measure', z: -60, instrument: 'caliper' });
  assert.ok(tail.ok);
  assert.strictEqual(tail.data.u, 0);

  assert.ok(!model.transition(base, { type: 'measure', z: 0.5, instrument: 'caliper' }).ok);
  assert.ok(!model.transition(base, { type: 'measure', z: -60.5, instrument: 'caliper' }).ok);
});

// --- volume math, checked independently -----------------------------------

test('remove() volume and profile math match independent formulas', () => {
  const profile = {
    segments: [
      { length: 20, diameter: 40, endDiameter: 40, bore: 0 },
      { length: 10, diameter: 30, endDiameter: 30, bore: 0 },
    ],
    bore: 0,
  };
  const original = clone(profile);
  const r = model.remove(profile, 15, 25, 20);
  close(r.volume, Math.PI / 4 * ((40 * 40 - 20 * 20) * 5 + (30 * 30 - 20 * 20) * 5));
  assert.strictEqual(r.maxDepth, 10);
  assert.deepStrictEqual(r.profile.segments, [
    { length: 15, diameter: 40, endDiameter: 40, bore: 0 },
    { length: 10, diameter: 20, endDiameter: 20, bore: 0 },
    { length: 5, diameter: 30, endDiameter: 30, bore: 0 },
  ]);
  assert.deepStrictEqual(profile, original);
});

// --- repeated overlapping cuts --------------------------------------------

test('repeated overlapping cuts recompute geometry without stacking segments', () => {
  const { work, last } = runWork([
    { type: 'spindle', value: true },
    { type: 'cut', start: -30, end: -20, x: 38, feed: 0.1, rpm: 800 },
  ]);
  assert.ok(last.ok);
  close(last.data.volume, Math.PI / 4 * (1600 - 1444) * 10);

  const cut2 = model.execute(work, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(cut2.ok);
  close(cut2.data.volume, Math.PI / 4 * (1444 - 1296) * 10);

  const noop = model.execute(cut2.work, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(!noop.ok);
  assert.match(noop.message, /Материал не снимается/);

  const cut3 = model.execute(noop.work, { type: 'cut', start: -20, end: -10, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(cut3.ok);
  close(cut3.data.volume, Math.PI / 4 * (1600 - 1296) * 10);

  const cut4 = model.execute(cut3.work, { type: 'cut', start: -45, end: -15, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(cut4.ok);
  close(cut4.data.volume, Math.PI / 4 * (1600 - 1296) * 15);

  const state = model.restoreWork(cut4.work).state;
  assert.strictEqual(state.cuts.length, 4);
  assert.strictEqual(state.journal.length, 6);
  assert.deepStrictEqual(state.profile.segments, [
    { length: 15, diameter: 40, endDiameter: 40, bore: 0 },
    { length: 35, diameter: 36, endDiameter: 36, bore: 0 },
    { length: 10, diameter: 40, endDiameter: 40, bore: 0 },
  ]);
});

// --- depth guards ---------------------------------------------------------

test('depth guard allows exactly 2 mm per side and rejects more', () => {
  const on = model.transition(model.create({ diameter: 40, length: 60 }), { type: 'spindle', value: true });
  const tooDeep = model.transition(on.state, { type: 'cut', start: -30, end: -20, x: 35.9, feed: 0.1, rpm: 800 });
  assert.ok(!tooDeep.ok);
  assert.match(tooDeep.message, /Здесь 2\.05 мм/);
  assert.deepStrictEqual(tooDeep.state.profile.segments, [
    { length: 60, diameter: 40, endDiameter: 40, bore: 0 },
  ]);
  assert.strictEqual(tooDeep.state.cuts.length, 0);
  assert.strictEqual(tooDeep.state.journal.length, 2);
  assert.strictEqual(tooDeep.state.journal[1].ok, false);

  const atLimit = model.transition(on.state, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(atLimit.ok);
  assert.strictEqual(atLimit.data.maxDepth, 2);
  close(atLimit.data.volume, Math.PI / 4 * (1600 - 1296) * 10);

  const spanning = model.transition(atLimit.state, { type: 'cut', start: -40, end: -10, x: 34, feed: 0.1, rpm: 800 });
  assert.ok(!spanning.ok);
  assert.match(spanning.message, /Здесь 3 мм/);
  assert.deepStrictEqual(spanning.state.profile.segments, [
    { length: 30, diameter: 40, endDiameter: 40, bore: 0 },
    { length: 10, diameter: 36, endDiameter: 36, bore: 0 },
    { length: 20, diameter: 40, endDiameter: 40, bore: 0 },
  ]);
  assert.strictEqual(spanning.state.cuts.length, 1);
});

// --- spindle gating -------------------------------------------------------

test('measuring requires the spindle stopped; cutting requires it on', () => {
  const base = model.create({ diameter: 40, length: 60 });
  const cutWhileStopped = model.transition(base, { type: 'cut', start: -10, end: -5, x: 38, feed: 0.1, rpm: 800 });
  assert.ok(!cutWhileStopped.ok);
  assert.match(cutWhileStopped.message, /включите вращение/);
  assert.strictEqual(cutWhileStopped.state.cuts.length, 0);

  const on = model.transition(base, { type: 'spindle', value: true });
  const measured = model.transition(on.state, { type: 'measure', z: -10, instrument: 'caliper' });
  assert.ok(!measured.ok);
  assert.match(measured.message, /остановите шпиндель/);
  assert.strictEqual(measured.state.readings.length, 0);

  const off = model.transition(measured.state, { type: 'spindle', value: false });
  const ok = model.transition(off.state, { type: 'measure', z: -10, instrument: 'caliper' });
  assert.ok(ok.ok);
  assert.strictEqual(ok.data.reading, 40);
});

// --- shoulder rejection ---------------------------------------------------

test('measure at a shoulder boundary is rejected', () => {
  const { last } = runWork([
    { type: 'spindle', value: true },
    { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 },
    { type: 'spindle', value: false },
  ]);
  const state = last.state;
  const at30 = model.transition(state, { type: 'measure', z: -30, instrument: 'caliper' });
  assert.ok(!at30.ok);
  assert.match(at30.message, /граница двух ступеней/);
  assert.strictEqual(at30.state.readings.length, 0);
  const at40 = model.transition(state, { type: 'measure', z: -20, instrument: 'caliper' });
  assert.ok(!at40.ok);
  assert.match(at40.message, /граница двух ступеней/);

  const justInside = model.transition(state, { type: 'measure', z: -30.1, instrument: 'caliper' });
  assert.ok(justInside.ok);
  assert.strictEqual(justInside.data.actual, 40);
  const otherSide = model.transition(state, { type: 'measure', z: -29.9, instrument: 'caliper' });
  assert.ok(otherSide.ok);
  assert.strictEqual(otherSide.data.actual, 36);
});

// --- instrument rounding --------------------------------------------------

test('caliper rounds to 0.1 mm, micrometer to 0.01 mm', () => {
  assert.strictEqual(model.create({ diameter: 40.1239, length: 60 }).stock.diameter, 40.124);
  const base = model.create({ diameter: 40.123, length: 60 });
  const cal = model.transition(base, { type: 'measure', z: -10, instrument: 'caliper' });
  assert.ok(cal.ok);
  assert.strictEqual(cal.data.resolution, 0.1);
  assert.strictEqual(cal.data.actual, 40.123);
  assert.strictEqual(cal.data.reading, 40.1);
  const mic = model.transition(base, { type: 'measure', z: -10, instrument: 'micrometer' });
  assert.ok(mic.ok);
  assert.strictEqual(mic.data.resolution, 0.01);
  assert.strictEqual(mic.data.actual, 40.123);
  assert.strictEqual(mic.data.reading, 40.12);
});

// --- undo / redo / branching ----------------------------------------------

test('undo, redo and branching from an earlier point', () => {
  let w = model.newWork('Ветвление', { diameter: 40, length: 60 });
  const on = model.execute(w, { type: 'spindle', value: true });
  w = on.work;
  const cutA = model.execute(w, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 });
  w = cutA.work;
  assert.strictEqual(w.events.length, 2);
  assert.strictEqual(w.cursor, 2);

  const undone = model.seek(w, 1);
  assert.strictEqual(undone.cursor, 1);
  assert.strictEqual(undone.events.length, 2);
  const undoneState = model.restoreWork(undone).state;
  assert.ok(undoneState.spindle);
  assert.strictEqual(undoneState.cuts.length, 0);
  assert.strictEqual(model.sample(undoneState.profile, 35), 40);

  const redone = model.seek(w, 2);
  const redoneState = model.restoreWork(redone).state;
  assert.strictEqual(redoneState.cuts.length, 1);
  assert.strictEqual(model.sample(redoneState.profile, 35), 36);

  const branch = model.execute(undone, { type: 'cut', start: -20, end: -10, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(branch.ok);
  assert.deepStrictEqual(branch.work.events, [
    { type: 'spindle', value: true },
    { type: 'cut', start: -20, end: -10, x: 36, feed: 0.1, rpm: 800 },
  ]);
  assert.strictEqual(branch.work.cursor, 2);
  const branchState = model.restoreWork(branch.work).state;
  assert.strictEqual(branchState.cuts.length, 1);
  assert.strictEqual(model.sample(branchState.profile, 45), 36);
  assert.strictEqual(model.sample(branchState.profile, 25), 40);

  assert.throws(() => model.seek(w, 3), /повреждена/);
  assert.throws(() => model.seek(w, -1), /повреждена/);
  assert.strictEqual(w.events.length, 2);
  assert.strictEqual(w.cursor, 2);
  assert.deepStrictEqual(w.events[1], { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 });
});

// --- replay rejects injected derived state ---------------------------------

test('replay refuses injected derived state and rebuilds from events only', () => {
  const { work } = runWork([
    { type: 'spindle', value: true },
    { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 },
  ]);
  const raw = {
    version: 1,
    name: work.name,
    stock: clone(work.stock),
    events: clone(work.events),
    cursor: work.cursor,
  };
  assert.strictEqual(model.restoreWork({ ...raw, profile: { segments: [], bore: 0 } }), null);
  assert.strictEqual(model.restoreWork({ ...raw, cuts: [{ index: 1, volume: 0 }] }), null);
  assert.strictEqual(model.restoreWork({ ...raw, journal: [{ number: 1, ok: true }] }), null);
  assert.strictEqual(model.restoreWork({ ...raw, readings: [{ z: 0 }] }), null);
  assert.strictEqual(model.restoreWork({ ...raw, cursor: raw.cursor + 1 }), null);
  assert.strictEqual(model.restoreWork({ ...raw, cursor: 1.5 }), null);
  assert.strictEqual(model.restoreWork({
    ...raw,
    events: [...raw.events, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800, maxDepth: 2 }],
  }), null);
  assert.strictEqual(model.restoreWork({
    ...raw,
    events: Array.from({ length: model.MAX_EVENTS + 1 }, (_, i) => ({ type: 'spindle', value: i % 2 === 0 })),
  }), null);

  const a = model.restoreWork(raw);
  const b = model.restoreWork(raw);
  assert.ok(a && b);
  assert.deepStrictEqual(a.state, b.state);
  assert.deepStrictEqual(a.work, b.work);
  assert.strictEqual(a.state.cuts.length, 1);
  assert.strictEqual(a.state.profile.segments.length, 3);
});

// --- export / import -------------------------------------------------------

test('export and parse round-trip preserves the book', () => {
  const book = model.createBook();
  const { id, ...saved } = book.works[0];
  let executed = model.execute(saved, { type: 'spindle', value: true });
  executed = model.execute(executed.work, { type: 'cut', start: -30, end: -20, x: 28, feed: 0.1, rpm: 800 });
  assert.ok(executed.ok);
  const book2 = {
    ...book,
    works: [{ id: 'work-1', ...executed.work }],
    drafts: { 'work-1': { operation: 'cut', x: '28' } },
    view: '3d',
  };
  const text = model.exportBook(book2);
  assert.ok(text.includes('cnc-free-workshop'));
  const back = model.parseBook(text);
  assert.deepStrictEqual(back, book2);
  assert.strictEqual(model.exportBook(back), text);
  assert.deepStrictEqual(model.parseBook('\uFEFF' + text), back);

  assert.throws(() => model.parseBook('not json'), /Некорректный JSON/);
  assert.throws(() => model.parseBook('{"format":"other","version":1,"book":{}}'), /не файл свободной мастерской/);
  assert.throws(() => model.parseBook(' '.repeat(model.MAX_FILE_BYTES + 1)), /512 КБ/);
  assert.throws(() => model.exportBook({ ...book2, works: [{ ...book2.works[0], cursor: 99 }] }), /повреждена/);
});

// --- capacity --------------------------------------------------------------

test('book capacity: at most five works', () => {
  let book = model.createBook();
  for (let i = 2; i <= model.MAX_WORKS; i += 1) {
    book = model.addWork(book, `Деталь ${i}`, { diameter: 20 + i, length: 60 });
  }
  assert.strictEqual(book.works.length, 5);
  assert.deepStrictEqual(book.works.map((w) => w.id), ['work-1', 'work-2', 'work-3', 'work-4', 'work-5']);
  assert.strictEqual(book.selected, 'work-5');
  assert.throws(() => model.addWork(book, 'Шестая', { diameter: 30, length: 60 }), /до пяти работ/);

  const removed = model.removeWork(book, 'work-3');
  assert.strictEqual(removed.works.length, 4);
  assert.ok(!removed.works.some((w) => w.id === 'work-3'));
  assert.strictEqual(removed.selected, 'work-5');

  const refilled = model.addWork(removed, 'Снова', { diameter: 30, length: 60 });
  assert.strictEqual(refilled.works.length, 5);
  assert.strictEqual(refilled.selected, 'work-3');

  assert.throws(() => model.removeWork(book, 'work-9'), /повреждена/);
  assert.deepStrictEqual(model.removeWork(model.createBook(), 'work-1'), model.createBook());
});

test('journal capacity: at most 160 events', () => {
  const events = Array.from({ length: model.MAX_EVENTS }, (_, i) => ({ type: 'spindle', value: i % 2 === 0 }));
  const full = {
    version: 1,
    name: 'Полный журнал',
    stock: { diameter: 32, length: 60 },
    events,
    cursor: model.MAX_EVENTS,
  };
  const restored = model.restoreWork(full);
  assert.ok(restored);
  assert.strictEqual(restored.state.journal.length, model.MAX_EVENTS);
  assert.throws(() => model.execute(full, { type: 'spindle', value: true }), /Журнал заполнен/);

  const trimmed = model.seek(full, model.MAX_EVENTS - 1);
  const extra = model.execute(trimmed, { type: 'spindle', value: true });
  assert.ok(extra.ok);
  assert.strictEqual(extra.work.events.length, model.MAX_EVENTS);
  assert.strictEqual(extra.work.cursor, model.MAX_EVENTS);
  assert.throws(() => model.execute(extra.work, { type: 'spindle', value: false }), /Журнал заполнен/);
});

// --- rejected actions leave physical geometry untouched ---------------------

test('rejected actions leave the physical geometry untouched', () => {
  const { last } = runWork([
    { type: 'spindle', value: true },
    { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 },
  ]);
  const onState = last.state;
  const onStateJson = JSON.stringify(onState);
  const onGeometry = JSON.stringify(geometryOf(onState));

  const cutRejects = [
    { type: 'cut', start: 5, end: -5, x: 36, feed: 0.1, rpm: 800 },      // outside Z range
    { type: 'cut', start: -20, end: -20.05, x: 36, feed: 0.1, rpm: 800 }, // too short
    { type: 'cut', start: -40, end: -10, x: 30, feed: 0.1, rpm: 800 },    // deeper than 2 mm per side
    { type: 'cut', start: -30, end: -20, x: 40, feed: 0.1, rpm: 800 },    // removes nothing
  ];
  for (const action of cutRejects) {
    const r = model.transition(onState, action);
    assert.ok(!r.ok, `expected rejection for ${JSON.stringify(action)}`);
    assert.strictEqual(JSON.stringify(geometryOf(r.state)), onGeometry);
    assert.strictEqual(r.state.journal.length, 3);
    assert.strictEqual(r.state.journal[2].ok, false);
  }
  assert.strictEqual(JSON.stringify(onState), onStateJson);
  assert.throws(() => model.transition(onState, { type: 'cut', start: -30, end: -20, x: 81, feed: 0.1, rpm: 800 }), /Проход/);
  assert.throws(() => model.transition(onState, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.31, rpm: 800 }), /Проход/);
  assert.throws(() => model.transition(onState, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 150 }), /Проход/);
  assert.strictEqual(JSON.stringify(onState), onStateJson);

  const off = model.transition(onState, { type: 'spindle', value: false });
  assert.ok(off.ok);
  const firstMeasure = model.transition(off.state, { type: 'measure', z: -25, instrument: 'caliper' });
  assert.ok(firstMeasure.ok);
  const offState = firstMeasure.state;
  assert.strictEqual(offState.readings.length, 1);
  const offGeometry = JSON.stringify(geometryOf(offState));

  const measureRejects = [
    { type: 'measure', z: -30, instrument: 'caliper' },    // shoulder
    { type: 'measure', z: -70, instrument: 'caliper' },    // out of range
    { type: 'measure', z: 0.5, instrument: 'micrometer' }, // out of range
  ];
  for (const action of measureRejects) {
    const r = model.transition(offState, action);
    assert.ok(!r.ok, `expected rejection for ${JSON.stringify(action)}`);
    assert.strictEqual(JSON.stringify(geometryOf(r.state)), offGeometry);
    assert.strictEqual(r.state.readings.length, 1);
  }
  assert.throws(() => model.transition(offState, { type: 'measure', z: -25, instrument: 'ruler' }), /повреждена/);
  const cutWhileStopped = model.transition(offState, { type: 'cut', start: -30, end: -20, x: 36, feed: 0.1, rpm: 800 });
  assert.ok(!cutWhileStopped.ok);
  assert.strictEqual(JSON.stringify(geometryOf(cutWhileStopped.state)), offGeometry);
  assert.strictEqual(JSON.stringify(onState), onStateJson);
});

// --- book helpers ----------------------------------------------------------

test('isActive and stateOf reflect the selected work', () => {
  const empty = model.createBook();
  assert.strictEqual(model.isActive(empty), false);
  const { id, ...saved } = empty.works[0];
  const executed = model.execute(saved, { type: 'spindle', value: true });
  assert.ok(executed.ok);
  const busy = { ...empty, works: [{ id: 'work-1', ...executed.work }] };
  assert.strictEqual(model.isActive(busy), true);
  const state = model.stateOf(busy);
  assert.strictEqual(state.spindle, true);
  assert.strictEqual(state.journal.length, 1);
});

// --- import dedup regression ------------------------------------------------
// Correction assumed before running: import dedup fingerprints include canonical
// per-work drafts with draft keys normalized in a fixed order; nested limits frozen.

test('import keeps works with identical history but different drafts; dedups identical drafts', () => {
  const spindleOn = { type: 'spindle', value: true };

  // Scenario A: identical histories, DIFFERENT drafts -> both works retained.
  const local = model.createBook();
  const incoming = model.restoreBook({
    version: 1,
    selected: 'work-1',
    works: [makeWork('work-1', [spindleOn], 1), makeWork('work-2', [spindleOn], 1)],
    drafts: { 'work-1': { operation: 'cut', x: '20' }, 'work-2': { operation: 'cut', x: '24' } },
    view: '2d',
  });
  assert.ok(incoming);
  const localSnapshot = clone(local);
  const incomingSnapshot = clone(incoming);

  const merged = model.importBook(local, incoming);
  assert.ok(merged);
  assert.ok(model.restoreBook(merged));
  assert.strictEqual(merged.works.length, 3);
  const localWork = merged.works.find((w) => w.id === 'work-1');
  assert.ok(localWork);
  assert.strictEqual(localWork.events.length, 0);
  assert.ok(merged.works.some((w) => w.id === merged.selected));
  const withDraft = (x) => merged.works.find((w) => merged.drafts[w.id] && merged.drafts[w.id].x === x);
  const w20 = withDraft('20');
  const w24 = withDraft('24');
  assert.ok(w20, 'work with draft x=20 must be retained');
  assert.ok(w24, 'work with draft x=24 must be retained');
  assert.deepStrictEqual(w20.events, [spindleOn]);
  assert.deepStrictEqual(w24.events, [spindleOn]);
  assert.deepStrictEqual(merged.drafts[w20.id], { operation: 'cut', x: '20' });
  assert.deepStrictEqual(merged.drafts[w24.id], { operation: 'cut', x: '24' });
  assert.deepStrictEqual(local, localSnapshot);
  assert.deepStrictEqual(incoming, incomingSnapshot);

  // Scenario B: identical histories AND identical drafts -> duplicates dropped.
  const makeLocalWithDraft = () => model.restoreBook({
    version: 1,
    selected: 'work-1',
    works: [makeWork('work-1', [spindleOn], 1)],
    drafts: { 'work-1': { operation: 'cut', x: '20' } },
    view: '2d',
  });
  const sameDraftIncoming = model.restoreBook({
    version: 1,
    selected: 'work-1',
    works: [makeWork('work-1', [spindleOn], 1), makeWork('work-2', [spindleOn], 1)],
    drafts: { 'work-1': { operation: 'cut', x: '20' }, 'work-2': { operation: 'cut', x: '20' } },
    view: '2d',
  });
  assert.ok(sameDraftIncoming);
  const deduped = model.importBook(makeLocalWithDraft(), sameDraftIncoming);
  assert.ok(deduped);
  assert.strictEqual(deduped.works.length, 1);
  assert.deepStrictEqual(deduped.works[0].events, [spindleOn]);
  assert.deepStrictEqual(deduped.drafts, { 'work-1': { operation: 'cut', x: '20' } });

  // Scenario C: draft key order must not affect the dedup fingerprint.
  const reorderedDraftIncoming = model.restoreBook({
    version: 1,
    selected: 'work-1',
    works: [makeWork('work-1', [spindleOn], 1)],
    drafts: { 'work-1': { x: '20', operation: 'cut' } },
    view: '2d',
  });
  assert.ok(reorderedDraftIncoming);
  const canonical = model.importBook(makeLocalWithDraft(), reorderedDraftIncoming);
  assert.ok(canonical);
  assert.strictEqual(canonical.works.length, 1);
  assert.deepStrictEqual(canonical.drafts, { 'work-1': { operation: 'cut', x: '20' } });
});

test('import never mutates its inputs when capacity is exceeded', () => {
  let full = model.createBook();
  for (let i = 2; i <= model.MAX_WORKS; i += 1) {
    full = model.addWork(full, `Деталь ${i}`, { diameter: 20 + i, length: 60 });
  }
  assert.strictEqual(full.works.length, model.MAX_WORKS);

  const incoming = model.restoreBook({
    version: 1,
    selected: 'work-1',
    works: [makeWork('work-1', [{ type: 'spindle', value: true }], 1)],
    drafts: { 'work-1': { operation: 'cut', x: '20' } },
    view: '2d',
  });
  assert.ok(incoming);
  const fullSnapshot = clone(full);
  const incomingSnapshot = clone(incoming);

  let threw = false;
  let result = null;
  try {
    result = model.importBook(full, incoming);
  } catch (error) {
    threw = true;
  }
  assert.ok(threw || (result && result.works.length <= model.MAX_WORKS));
  assert.deepStrictEqual(full, fullSnapshot);
  assert.deepStrictEqual(incoming, incomingSnapshot);
});

// --- runner ----------------------------------------------------------------

test('mixed step pass preserves smaller surfaces and explains the result',()=>{
  const {work}=runWork([{type:'spindle',value:true},{type:'cut',start:-10,end:0,x:36,feed:.1,rpm:500}]);
  const result=model.execute(work,{type:'cut',start:-20,end:0,x:38,feed:.1,rpm:500});
  assert.ok(result.ok);assert.match(result.message,/диаметр уже меньше/);
  assert.strictEqual(model.sample(result.state.profile,45),38);assert.strictEqual(model.sample(result.state.profile,55),36);
  close(result.data.volume,Math.PI/4*(40**2-38**2)*10);
});
test('half resolution readings round consistently at integer micrometre boundaries',()=>{
  const state=model.create({diameter:32.005,length:60});
  assert.strictEqual(model.transition(state,{type:'measure',z:-10,instrument:'micrometer'}).data.reading,32.01);
  assert.strictEqual(model.transition(model.create({diameter:32.05,length:60}),{type:'measure',z:-10,instrument:'caliper'}).data.reading,32.1);
});
test('imported invisible names and directional control drafts fail closed',()=>{
  assert.throws(()=>model.newWork('деталь\u202e!'));
  const book=model.createBook();book.drafts['work-1']={x:'28\u200b'};assert.strictEqual(model.restoreBook(book),null);
  assert.throws(()=>model.stateOf({works:[],selected:'work-1'}),/не найдена/);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL - ${name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}
console.log(`${tests.length - failed}/${tests.length} tests passed`);
if (failed) process.exitCode = 1;
