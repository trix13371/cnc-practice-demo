"use strict";
const assert=require("node:assert/strict");
const model=require("../mounting-plate-model.js"),fixture=require("./mounting-plate-fixture.cjs");
const progress=require("../progress-model.js");
assert.deepEqual(require("../docs/project-plate.json"),model.task);
const {pocket,contour,holes}=model.task.operations, radius=model.task.tool.diameter/2;
const part=contour.area;
assert(pocket.area.minX>part.minX && pocket.area.maxX<part.maxX &&
  pocket.area.minY>part.minY && pocket.area.maxY<part.maxY);
for(const center of holes.holeCenters){
  assert(center.x-radius>part.minX && center.x+radius<part.maxX &&
    center.y-radius>part.minY && center.y+radius<part.maxY,"The drilled disk must remain inside the retained part");
  assert(Math.hypot(Math.max(pocket.area.minX-center.x,0,center.x-pocket.area.maxX),
    Math.max(pocket.area.minY-center.y,0,center.y-pocket.area.maxY))>radius,
    "Pocket and drilling zones must not touch");
}
assert(Math.hypot(holes.holeCenters[0].x-holes.holeCenters[1].x,holes.holeCenters[0].y-holes.holeCenters[1].y)>2*radius);
const draft=(programs,order="pocket-first")=>model.transition(model.create(),{type:"draft",programs,order});
const execute=state=>model.transition(state,{type:"execute"});
const readAll=state=>model.task.checks.reduce((s,p)=>model.transition(s,{type:"measure",id:p.id}),state);
assert(Object.values(model.create().programs).every(source=>source===""));
assert.equal(execute(model.create()).result.incident.code,"COMMAND");
assert.equal(model.transition(model.create(),{type:"measure",id:"p1"}),null);
for(const reverse of [false,true]){
  const complete=fixture.complete(reverse);
  assert(complete.confirmed && model.grade(complete).independent);
  const archive=progress.empty();
  archive.sections.coursePath.current.mountingPlate=model.snapshot(complete);
  assert(progress.summary(progress.validate(archive)).rows.find(row=>row.id===model.id).done);
}
const valid=fixture.programs();
const oneLane=fixture.passes([[19,13],[25,13]],2);
const sparse=readAll(execute(draft({...valid,pocket:oneLane})));
assert(sparse.result.ok,"Sparse path is safe");
assert(model.grade(sparse).checks.find(check=>check.id==="shape").passed,"All witness depths can match despite uncut area");
assert(!model.grade(sparse).checks.find(check=>check.id==="pocket").passed);
assert.equal(model.transition(sparse,{type:"confirm"}),null,"Area checks reject a path that only passes sample points");
assert.equal(model.restore({...model.snapshot(sparse),confirmed:true}),null);

const leftHole=fixture.holes([[12,13]]);
const omitted=readAll(execute(draft({...valid,holes:leftHole})));
assert.equal(omitted.result.surfaces.h2,0);
assert.equal(model.transition(omitted,{type:"confirm"}),null);
const offCenter=execute(draft({...valid,holes:fixture.holes([[12.1,13],[34,13]])}));
assert.equal(offCenter.result.incident.code,"HOLE_CENTER");
assert.equal(model.transition(offCenter,{type:"measure",id:"h1"}),null);
const outer=execute(draft({...valid,contour:fixture.passes([[4,4],[41,4]],1)}));
assert.equal(outer.result.incident.code,"CONTOUR_WINDOW");
const intersects=execute(draft({...valid,contour:fixture.passes([[5,13],[41,13]],1)}));
assert.equal(intersects.result.incident.code,"PART_GOUGE");

const run=readAll(execute(draft(valid)));
assert(model.grade(run).passed && !run.confirmed);
const edit=model.transition(run,{type:"draft",programs:{...valid,pocket:oneLane},order:run.order});
assert.equal(edit.result,null);
assert.deepEqual(edit.measured,[]);
assert.deepEqual(execute(run).measured,[]);
const archived=model.snapshot(run);
assert.equal(model.restore({...archived,measured:["p1","p1"]}),null);
assert.equal(model.restore({...archived,measured:["__proto__"]}),null);
assert.equal(model.restore({...archived,assignment:{...archived.assignment,profileVersion:2}}),null);
console.log("Mounting plate: two valid routes, geometry/area, both blind holes, evidence freshness, archive proof and fixture isolation passed.");
