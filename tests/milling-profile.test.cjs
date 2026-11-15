"use strict";
const assert = require("node:assert/strict");
const model = require("../milling-profile-model.js");
const rect = (minX,minY,maxX,maxY)=>({minX,minY,maxX,maxY});
const move = (x1,y1,x2,y2)=>({from:{x:x1,y:y1},to:{x:x2,y:y2}});
const contains = (range,known) => {
  assert(range.min <= known+1e-8 && known <= range.max+1e-8,
    known+" falls outside "+JSON.stringify(range));
};
const stock=rect(-10,-10,30,30), feature=rect(0,0,20,12);
const pocket=(resolution=.5)=>model.create({kind:"pocket",stock,feature,diameter:6,resolution});
const course=pocket(), lane=move(3,6,17,6);
assert.equal(course.resolution,.5);
assert.equal(course.check(lane),null);
assert.equal(course.check(move(2.9,6,17,6)),"POCKET_WALL");
const empty=course.assess([]);
assert.equal(empty.targetArea,240);
assert.deepEqual(empty.removedArea,{min:0,max:0});
assert.deepEqual(empty.remainingArea,{min:240,max:240});
const single=course.assess([lane]);
const exactCapsule=14*6+Math.PI*3**2;
contains(single.removedArea,exactCapsule);
contains(single.remainingArea,240-exactCapsule);
const fine=pocket(.25).assess([lane]);
contains(fine.removedArea,exactCapsule);
assert(fine.removedArea.min>=single.removedArea.min && fine.removedArea.max<=single.removedArea.max);
assert(fine.removedArea.max-fine.removedArea.min<single.removedArea.max-single.removedArea.min);

const full=course.assess([
  move(3,3,17,3),lane,move(3,9,17,9),move(3,3,3,9),move(17,3,17,9)
]);
const cornerLoss=9*(4-Math.PI);
assert(Math.abs(full.unreachableArea-cornerLoss)<1e-8);
contains(full.remainingArea,cornerLoss);
contains(full.reachableRemainingArea,0);
assert(single.reachableRemainingArea.min>0);
assert(full.cells.some(c=>c.access==="inaccessible"&&c.status==="left"));
assert(full.cells.some(c=>c.access==="reachable"&&c.status==="cleared"));

const narrow=model.create({kind:"pocket",stock,feature:rect(0,0,20,5),diameter:6});
assert.deepEqual(narrow.assess([move(3,2.5,17,2.5)]),{ok:false,error:"TOOL_TOO_WIDE",index:0});
assert.equal(narrow.assess([]).unreachableArea,100);
const exactWidth=model.create({kind:"pocket",stock,feature:rect(0,0,20,6),diameter:6});
assert.equal(exactWidth.check(move(3,3,17,3)),null,"exact fit has a valid center line");
contains(exactWidth.assess([move(3,3,17,3)]).removedArea,exactCapsule);

const part=rect(0,0,20,20);
const contour=model.create({kind:"contour",stock,feature:part,diameter:6});
const side=move(-3,1,-3,19);
assert.equal(contour.check(side),null);
assert.deepEqual(contour.assess([side,move(-4,1,24,19)]),{ok:false,error:"PART_GOUGE",index:1},"safe endpoints do not make a safe segment");
const outside=contour.assess([side]);
assert.equal(outside.targetArea,1200);
assert.equal(outside.unreachableArea,0);
contains(outside.removedArea,18*6+Math.PI*9);
part.minX=-5;
assert.equal(contour.check(side),null,"model is isolated from later input mutation");
const translated=model.create({kind:"pocket",stock:rect(-40,-40,-1,-1),
  feature:rect(-22,-15,-2,-3),diameter:6});
contains(translated.assess([move(-19,-9,-5,-9)]).removedArea,exactCapsule);
assert.throws(()=>model.create({kind:"pocket",stock:rect(0,0,200,200),feature:rect(0,0,200,200),diameter:6,resolution:.25}),/ячеек/);
assert.throws(()=>course.assess(Array(81).fill(lane)),/проходов/);
console.log("Milling profile: exact capsule and inaccessible corner references, grid bounds, narrow fit and swept contour guards passed.");
