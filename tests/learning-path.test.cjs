'use strict';
const assert = require('node:assert/strict');
const path = require('../learning-path-model.js');
const lessons = ['machine', 'safety', 'tool', 'diameter', 'axes', 'control', 'tolerance'];
const prep=['practice-firstSession','practice-firstProcess','practice-drawingSession'];
const beforeCut = { lessons: lessons.slice(0, 5),courseSteps:prep };
assert.equal(path.next().id, 'practice-firstSession');
assert.equal(path.next(beforeCut).id, 'first-cut');
const afterCut = { ...beforeCut, basic: { task: 'diameter', finished: true, controlled: false } };
assert.equal(path.next(afterCut).id, 'control');
assert.equal(path.status({ ...afterCut, lessons }).next.id, 'first-control');
assert.equal(path.status({ lessons,courseSteps:prep, basic: { task: 'diameter', finished: true, controlled: true } }).introComplete, true);
assert.equal(path.status({ lessons }).done, 7, 'quizzes do not complete practice');
assert.equal(path.status({ basic: { task: 'diameter', finished: false, controlled: true } }).done, 0);
assert.equal(path.status({ basic: { task: 'offset', finished: true, controlled: true } }).done, 0);
const record = { controlVersion: 1, assisted: true, at: '2026-10-24T10:00:00Z' };
assert.equal(path.status({ lessons,courseSteps:prep, records: { diameter: record } }).introComplete, true);
for (const bad of [{ ...record, controlVersion: 0 }, { ...record, at: 'broken' }, { ...record, assisted: 'false' }]) {
  assert.equal(path.status({ records: { diameter: bad } }).done, 0);
}
assert.equal(path.following('axes').id, 'practice-firstProcess');
assert.equal(path.following('self-code').id, 'operation-face-first');
assert.equal(path.resume({ version: 1, active: true, selected: 'first-control' }, {}).id, 'practice-firstSession');
assert.equal(path.resume({ version: 1, active: true, selected: 'first-cut' }, beforeCut).id, 'first-cut');
assert.equal(path.next({ lessons: [...lessons].reverse(),courseSteps:prep }).id, 'first-cut');
for (const bad of [null, [], 3, { version: 2, active: true, selected: 'axes' }]) {
  assert.deepEqual(path.restore(bad), { version: 1, active: false, selected: 'machine' });
  assert.doesNotThrow(() => path.status(bad));
}
assert.equal(path.get('__proto__'), null);
assert.equal(path.restore({ version: 1, active: 'true', selected: '__proto__', complete: true }).active, false);
assert.equal(path.status({ lessons: ['machine', 'machine', null], basic: [], records: [] }).done, 1);
console.log('Learning path: early practice, fresh control, historical records, prerequisites and recovery passed.');
const cycleLessons=[...lessons,'setup','rough-finish','feed','pass-count'];
const readyCycle={lessons:cycleLessons,courseSteps:[...prep,...require('../metrology-course-model.js').tasks.map(t=>'metrology-'+t.id)],records:{diameter:record}};
assert.equal(path.next(readyCycle).id,'full-cycle');
assert.equal(path.next({...readyCycle,training:{guidedPassed:true}}).id,'self-cycle');
assert.equal(path.status({...readyCycle,training:{guidedPassed:true,transferPassed:true}}).cycleComplete,true);
assert.equal(path.status({...readyCycle,training:{guidedPassed:true,transferPassed:false}}).complete,false);
assert.equal(path.resume({version:1,active:true,selected:'self-cycle'},readyCycle).id,'full-cycle');
assert.equal(path.following('first-control').id,'metrology-outer-control');
assert.equal(path.steps.length,64);

const readyCode={...readyCycle,courseSteps:[...readyCycle.courseSteps,'practice-programSetup'],training:{guidedPassed:true,transferPassed:true},gcode:{core:['coordinates','motion','modal','feed','spindle','retract'],final:false}};
assert.equal(path.next(readyCode).id,'self-code');
assert.equal(path.status({...readyCode,gcode:{...readyCode.gcode,final:true}}).complete,false);
assert.equal(path.status({...readyCode,gcode:{core:[],final:true}}).complete,false);
assert.equal(path.following('self-cycle').id,'code-coordinates');
