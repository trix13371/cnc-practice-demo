const assert=require('node:assert/strict'),base=require('../shaft-project-model.js'),progress=require('../progress-model.js'),course=require('../course-model.js');
const {complete}=require('./shaft-variants-fixtures.cjs');
let s=complete(base);const legacy=base.snapshot(s);assert.equal(legacy.version,1);
for(const id of ['RF5-SHAFT-02','RF5-SHAFT-03']){s=base.transition(s,{type:'selectVariant',id});const m=base.forTask(id);assert.equal(s.machine.stock.diameter,m.task.base);assert(!s.complete);assert(base.restore(base.snapshot(s)));s=complete(m,s);assert(m.shape(s.machine.profile));assert(!base.shape(s.machine.profile));assert.deepEqual(base.restore(base.snapshot(s)),s);}
assert.equal(s.completedProjects.length,2);assert.throws(()=>base.transition(s,{type:'selectVariant',id:'RF5-SHAFT-01'}));const archive=progress.empty();archive.sections.coursePath.current=course.restorePath({version:1,selected:'verification',phases:{},explored:[],shaftProject:base.snapshot(s)});const restored=progress.parse(progress.stringify(archive));assert.equal(progress.summary(restored).shaftProject.accepted.length,3);
const partial=base.transition(base.create(),{type:'inspect',id:'A'});assert.throws(()=>base.transition(partial,{type:'selectVariant',id:'RF5-SHAFT-02'}));
for(const raw of [{version:2,taskId:'bad',events:[],previous:[]},{version:2,taskId:'RF5-SHAFT-02',events:[],previous:[{version:1,events:[]}]},{version:2,taskId:'RF5-SHAFT-02',events:[],previous:[],stock:{diameter:34}},{version:2,taskId:'RF5-SHAFT-02',events:[],previous:[{version:2,taskId:'RF5-SHAFT-03',events:[],previous:[legacy]}]}])assert.equal(base.restore(raw),null);
const wrong=base.forTask('RF5-SHAFT-02');assert(!wrong.shape(complete(base).machine.profile));assert.equal(progress.summary(restored).progress.done,3);
console.log('Shaft variants: three full cycles, legacy replay, dimension isolation, retained reports, strict portfolio schema and switch guards passed.');

const cachedRaw=base.snapshot(s),cachedState=base.restore(cachedRaw);cachedState.completedProjects.length=0;assert.equal(base.restore(cachedRaw).completedProjects.length,2,'Portfolio replay cache isolates caller mutations');
