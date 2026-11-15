"use strict";
const project=require("../mounting-plate-model.js");
const xyz=(mode,[x,y],z)=>mode+" X"+x+" Y"+y+" Z"+z;
function passes(points,layers) {
  const start=points[0], end=points.at(-1);
  const lines=[xyz("G0",start,20),xyz("G0",start,2),"M03"];
  for(let i=0;i<layers;i++){
    const path=i%2===0?points:[...points].reverse();
    for(const point of path)lines.push(xyz("G1",point,-i-1));
  }
  lines.push(xyz("G0",layers%2===0?start:end,20),"M05");
  return lines.join("\n");
}
function holes(centers) {
  const lines=["M03"];
  for(const p of centers)
    lines.push(xyz("G0",p,20),xyz("G0",p,2),xyz("G1",p,-1),xyz("G1",p,-2),xyz("G0",p,20));
  return [...lines,"M05"].join("\n");
}
function programs(reverse=false) {
  const pocket=[[19,12],[25,12],[25,14],[19,14],[19,12],[19,13],[25,13]];
  const contour=[[5,4],[41,4],[41,22],[5,22],[5,4]];
  const centers=[[12,13],[34,13]];
  return {
    pocket:passes(reverse?pocket.reverse():pocket,2),
    contour:passes(reverse?contour.reverse():contour,1),
    holes:holes(reverse?centers.reverse():centers),
  };
}
function complete(reverse=false) {
  let s=project.transition(project.create(),{type:"draft",programs:programs(reverse),order:reverse?"contour-first":"pocket-first"});
  s=project.transition(s,{type:"execute"});
  if(!s.result.ok) throw Error(JSON.stringify(s.result.incident));
  for(const {id} of project.task.checks)s=project.transition(s,{type:"measure",id});
  const confirmed=project.transition(s,{type:"confirm"});
  if(!confirmed) throw Error(JSON.stringify({grade:project.grade(s),slices:s.result.slices,surfaces:s.result.surfaces}));
  return confirmed;
}
module.exports={complete,programs,passes,holes};
