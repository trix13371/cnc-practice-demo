"use strict";
const assert=require("node:assert/strict");
const p=require("../progress-model.js"),mill=require("../milling-course-model.js"),
  mounting=require("../mounting-plate-model.js"), route=require("../milling-route-model.js");
const fixture=require("./mounting-plate-fixture.cjs"),legacy=require("./milling-plate-fixtures.cjs");
const conf=require("../progress-config.js"),spec=require("../model-spec-model.js");
const archive=p.empty(), path=archive.sections.coursePath;
const snapshot=(reverse)=>mounting.snapshot(fixture.complete(reverse));
const m0=snapshot(false),m1=snapshot(true);
const grid=mill.plate.snapshot(legacy.complete());
path.current.mountingPlate=m0;
path.current.millingPlate=grid;
path.current.millingPlateDraft="План со стороны X0";
const old={...path.current,mountingPlate:m1};
path.history.push(old,{...old,selected:"diameter"});
const portable=(key)=>p.parseTransfer("\uFEFF"+p.stringifyMillingWork(archive,key)).milling;
const model=portable("mountingPlate"), gridWork=portable("millingPlate");
assert.equal(model.history.length,1,"Same project in different course snapshots exports once");
assert.deepEqual(model.current.journal,m0);
assert.deepEqual(model.history[0].journal,m1);
assert.equal(gridWork.profileId,"milling-xyz");
assert.equal(model.profileId,"milling-25d-project");
assert.equal(gridWork.current.draft,"План со стороны X0");
assert(!JSON.stringify(model).includes("с X0"));
assert.deepEqual(p.parseTransfer(p.stringify(archive)).archive,p.validate(archive));
const input=p.empty();
input.sections.coursePath.current.mountingPlate=mounting.snapshot(mounting.create());
input.sections.library.current.read=["start"];
const expected=p.validate(input);
const one=p.mergeMillingWork(input,model);
assert.deepEqual(one.sections.library,expected.sections.library);
assert.deepEqual(one.sections.coursePath.current.mountingPlate,m0,"Empty placeholder cannot hide imported project");
assert.equal(p.summary(one).rows.find(r=>r.id==="mounting-plate").done,true);
const both=p.mergeMillingWork(one,gridWork);
assert.deepEqual(both.sections.coursePath.current.millingPlate,grid);
assert.deepEqual(both.sections.coursePath.current.mountingPlate,m0);
assert.equal(p.summary(both).rows.find(r=>r.id==="milling-plate-two-depths").done,true);
assert.deepEqual(p.fromRaw(p.toRaw(both,{})).sections,both.sections,"Offline storage round-trip");
assert.deepEqual(p.mergeMillingWork(both,model).sections,both.sections,"Repeat import is idempotent");
assert.deepEqual(p.merge(input,archive).sections.coursePath.current.mountingPlate,m0,"Whole account merge also ignores empty placeholder");
const promotion={...model,current:model.history[0],history:[]};
const promoted=p.mergeMillingWork(both,promotion,{useImportedCurrent:true});
assert.deepEqual(promoted.sections.coursePath.current.mountingPlate,m1);
assert.deepEqual(p.getMillingWork(promoted,"mountingPlate").history,[{journal:m0}]);
assert.deepEqual(p.mergeMillingWork(promoted,promotion,{useImportedCurrent:true}).sections,promoted.sections);
const incomplete=mounting.snapshot(mounting.transition(mounting.create(),{type:"draft",programs:fixture.programs(),order:"pocket-first"}));
const draftArchive=p.empty();draftArchive.sections.coursePath.current.mountingPlate=incomplete;
const retained=p.mergeMillingWork(draftArchive,model);
assert.deepEqual(retained.sections.coursePath.current.mountingPlate,incomplete);
assert.equal(p.summary(retained).rows.find(r=>r.id==="mounting-plate").done,true,"Historical proof remains visible");
assert.equal(p.getMillingWork(retained,"mountingPlate").history.length,2);
for(const mutate of [
  raw=>{raw.profileVersion=99;},
  raw=>{raw.current.journal.measured.pop();},
  raw=>{raw.current.journal.result={ok:true};},
  raw=>{raw.kind="millingPlate";},
  raw=>{raw.extra=true;},
  raw=>{raw.history=Array(41).fill(raw.current);},
  raw=>{Object.defineProperty(raw,"__proto__",{value:{unsafe:true},enumerable:true});},
]){
  const raw=structuredClone(model);mutate(raw);
  assert.throws(()=>p.parseTransfer(JSON.stringify(raw)));
}
assert.throws(()=>p.parseTransfer(" ".repeat(p.MAX_BYTES+1)),/до 4 МБ/);
assert.throws(()=>p.stringifyMillingWork(p.empty(),"mountingPlate"),/начните/);
assert.throws(()=>p.ensureSyncSize({sample:"я".repeat(p.MAX_BYTES/2)}),/превысил бы 4 МБ/);
const capped=p.empty(),emptyPath=capped.sections.coursePath.current;
capped.sections.coursePath.history=Array.from({length:p.MAX_HISTORY},(_,i)=>({...emptyPath,millingPlate:grid,millingPlateDraft:"Вариант "+i}));
assert.throws(()=>p.mergeMillingWork(capped,model),/много сохранённых/);
assert.equal(capped.sections.coursePath.history.length,p.MAX_HISTORY);
const [gridPassport,platePassport]=spec.manifest().millingPassports;
assert.deepEqual(gridPassport.assignment,grid.assignment);
assert.equal(gridPassport.measurement.cell,mill.config.cell);
assert.equal(gridPassport.journal.maxEvents,mill.plate.eventLimit);
assert.deepEqual(platePassport.assignment,m0.assignment);
assert.deepEqual(platePassport.limits,route.rules);
assert.equal(platePassport.measurement.sliceResolution.pocket,mounting.task.operations.pocket.resolution);
assert.equal(conf.ROUTE_VERSION,p.ROUTE_VERSION);
console.log("Milling transfer: both formats, replay, scope, promotion, idempotency, capacity and passport parity passed.");
