"use strict";
const hole = require("../hole-course-model");
const m=(z,instrument="bore-gauge")=>({type:"measure",z,instrument});
const b=(diameter,depth)=>({type:"bore",diameter,depth});
const actions={
  read:[m(-8)],
  depth:[{type:"predict",value:16},{type:"drill"},m(0,"depth-gauge"),m(0,"depth-probe")],
  drill:[{type:"drill",depth:22},m(-10),m(0,"depth-gauge")],
  bore:[b(10,16),b(12,16),m(-8),m(-22)],
  diagnosis:[{type:"preview"},{type:"diagnose",cause:"bottom"},b(10,12),m(-6)],
  sleeve:[b(12,20),b(14,8),m(-4),m(-14),m(-24),m(-4,"micrometer"),m(-4,"wall-gauge")],
};
function run(id,items){
  return items.reduce((state,action)=>{
    const next=hole.transition(state,action);
    if(!next) throw Error("Invalid fixture action: "+JSON.stringify(action));
    return next;
  },hole.create(id));
}
function book(){
  return {version:1,works:Object.fromEntries(Object.entries(actions).map(([id,list])=>[id,hole.snapshot(run(id,[...list,{type:"confirm"}]))]))};
}
module.exports={actions,run,book,m,b};
