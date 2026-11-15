"use strict";
const assert=require("node:assert/strict"), machine=require("../real-machine-model"), internal=require("../internal-profile-model");
const midi=source=>({type:"mdi",source}), door=value=>({type:"door",value});
function runner(stock,tool){
  let work=machine.newWork("Работа",stock), state;
  function doIt(a,ok=true){
    const r=machine.execute(work,typeof a==="string"?midi(a):a);assert.equal(r.ok,ok,r.message);
    work=r.work;state=r.state;return r;
  }
  for(const action of [{type:"reference"},{type:"clamp",value:true},{type:"tool",tool},{type:"preset"},{type:"workOffset",z:100},door(true),{type:"mode",value:"MDI"}])doIt(action);
  return {doIt,get work(){return work;},get state(){return state;}};
}
const d=runner({internal:true},5), a=d.doIt;
a("G0 X1 Z3");
a("G97 S500 M3");
const wrongAxis=a("G99 G1 Z-22 F0.1",false);
assert.equal(wrongAxis.state.alarm.code,"DRILL_AXIS");
assert.equal(wrongAxis.state.profile.inner,undefined);
assert.equal(wrongAxis.state.position.z,3);
a({type:"reset"});a("G0 X0 Z3");a("G97 S500 M3");
const preview=machine.graphics(d.work,"G99 G1 Z-22 F0.1\nG1 Z3\nM30");
assert(preview.ok);
assert.equal(d.state.profile.inner,undefined);
a("G99 G1 Z-22 F0.1");
const profile=machine.internalGeometry(d.state.profile);
assert.deepEqual(profile.inner,[{length:20,diameter:8,endDiameter:8},{length:2,diameter:8,endDiameter:0}]);
assert(Math.abs(d.state.cuts[0].volume-16*Math.PI*(20+2/3))<1e-7);
a("G1 Z3");a("M5");a("G0 X44 Z12");a(door(false));
const read=(instrument,z,ok=true)=>a({type:"measure",instrument,z},ok);
assert.equal(read("depth-gauge",0).data.reading,20);
assert.equal(read("depth-probe",0).data.reading,22);
assert.equal(read("wall-gauge",-10).data.reading,12);
read("depth-probe",-2,false);read("bore-gauge",-24,false);read("inside-caliper",-18,false);
assert.deepEqual(machine.restoreWork(JSON.parse(JSON.stringify(d.work))).state.profile,d.state.profile);
const b=runner({internal:true,shape:"tube",bore:8},6), c=b.doIt;
c("G0 X12 Z3");c("G97 S500 M3");const fail=c("G99 G1 Z-16 F0.1",false);
assert.equal(fail.state.alarm.code,"BORE_ACCESS");assert(!fail.state.profile.inner);
c({type:"reset"});c("G0 X10 Z3");c("G97 S500 M3");c("G99 G1 Z-16 F0.1");
assert.equal(internal.hole(machine.internalGeometry(b.state.profile)).fullDepth,16);
const shoulder=c("G0 Z-18",false);assert.equal(shoulder.state.alarm.code,"BORE_ACCESS");assert.equal(b.state.position.z,-16);
const thin=runner({internal:true,diameter:10,shape:"tube",bore:8},6);
thin.doIt("G0 X9 Z3");thin.doIt("G97 S500 M3");assert.equal(thin.doIt("G99 G1 Z-10 F0.1",false).state.alarm.code,"WALL");
const legacy=runner({shape:"tube",bore:8},1);
const old=legacy.doIt("T0505",false);
assert(!old.state.stock.internal && !old.state.profile.inner && old.state.profile.bore===8);
assert.deepEqual(machine.restoreWork(old.work).state,old.state);
assert.equal(machine.restoreWork({...old.work,stock:{...old.work.stock,internal:false}}),null);
console.log("Internal machine: drill axis and cone, two depths, wall and reach, continuous approach, atomic alarms and legacy replay passed.");
