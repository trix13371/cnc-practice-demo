(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCMillingProfile = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EPS = 1e-8;
  const DEFAULT_RESOLUTION = 0.5;
  const MAX_CELLS = 60000;
  const MAX_MOVES = 80;

  const finiteCoordinate = (v) => Number.isFinite(v) && Math.abs(v) <= 200;
  const rectangle = (r) => r &&
    [r.minX,r.minY,r.maxX,r.maxY].every(finiteCoordinate) &&
    r.maxX-r.minX >= .001 && r.maxY-r.minY >= .001;
  const point = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    Math.abs(p.x) <= 300 && Math.abs(p.y) <= 300;
  const area = (r) => (r.maxX-r.minX)*(r.maxY-r.minY);
  const inside = (p,r) => p.x >= r.minX-EPS && p.x <= r.maxX+EPS &&
    p.y >= r.minY-EPS && p.y <= r.maxY+EPS;
  const corners = (r) => [
    {x:r.minX,y:r.minY},{x:r.minX,y:r.maxY},{x:r.maxX,y:r.minY},{x:r.maxX,y:r.maxY},
  ];
  const rect = (minX,minY,maxX,maxY) => ({minX,minY,maxX,maxY});
  const copyRect = (r) => rect(r.minX,r.minY,r.maxX,r.maxY);

  function pointRectDistance2(p,r) {
    return Math.max(r.minX-p.x,0,p.x-r.maxX)**2 +
      Math.max(r.minY-p.y,0,p.y-r.maxY)**2;
  }
  function pointMoveDistance2(p,move) {
    const {from,to} = move, dx=to.x-from.x, dy=to.y-from.y, length2=dx*dx+dy*dy;
    const t=length2===0?0:Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.y-from.y)*dy)/length2));
    return (p.x-from.x-t*dx)**2 + (p.y-from.y-t*dy)**2;
  }
  function intersects(move,r) {
    let enter=0, leave=1;
    for(const [axis,min,max] of [["x",r.minX,r.maxX],["y",r.minY,r.maxY]]){
      const origin=move.from[axis], delta=move.to[axis]-origin;
      if(delta===0) {
        if(origin<min || origin>max) return false;
        continue;
      }
      const a=(min-origin)/delta, b=(max-origin)/delta;
      enter=Math.max(enter,Math.min(a,b));
      leave=Math.min(leave,Math.max(a,b));
      if(enter>leave) return false;
    }
    return true;
  }
  function moveRectDistance2(move,r,vertices) {
    if(intersects(move,r)) return 0;
    // For disjoint convex segment and rectangle, a closest pair includes
    // an endpoint or rectangle vertex (also when two edges are parallel).
    return Math.min(pointRectDistance2(move.from,r),pointRectDistance2(move.to,r),
      ...vertices.map(p=>pointMoveDistance2(p,move)));
  }
  function contourStrips(stock,part) {
    return [
      rect(stock.minX,stock.minY,part.minX,stock.maxY),
      rect(part.maxX,stock.minY,stock.maxX,stock.maxY),
      rect(part.minX,stock.minY,part.maxX,part.minY),
      rect(part.minX,part.maxY,part.maxX,stock.maxY),
    ].filter(r=>area(r)>0);
  }
  function create({kind,stock,feature,diameter,resolution=DEFAULT_RESOLUTION,boundedContour=false}={}) {
    if(!["pocket","contour"].includes(kind) || !rectangle(stock) || !rectangle(feature) ||
      !corners(feature).every(p=>inside(p,stock)) || !Number.isFinite(diameter) || diameter<.1 || diameter>80 ||
      ![.25,.5,1].includes(resolution))
      throw Error("Недопустимые размеры или точность фрезерного профиля.");
    stock=copyRect(stock);
    feature=copyRect(feature);
    const featureCorners=corners(feature), stockCorners=corners(stock);
    const radius=diameter/2, radius2=radius**2;
    const {minX,minY,maxX,maxY}=feature, width=maxX-minX, height=maxY-minY;
    const fits=width>=diameter && height>=diameter;
    const centerDomain=kind==="pocket"&&fits?rect(minX+radius,minY+radius,maxX-radius,maxY-radius):null;
    const window=boundedContour?rect(stock.minX+radius,stock.minY+radius,stock.maxX-radius,stock.maxY-radius):null;
    if(window && (kind!=="contour" || minX-stock.minX<diameter || minY-stock.minY<diameter ||
        stock.maxX-maxX<diameter || stock.maxY-maxY<diameter)) throw Error("Полоса контура слишком узкая для фрезы.");
    const accessDomain=centerDomain||window;
    const regions=kind==="pocket"?[copyRect(feature)]:contourStrips(stock,feature);
    const count=(min,max)=>Math.ceil((max-min)/resolution);
    const cellCount=regions.reduce((n,r)=>n+count(r.minX,r.maxX)*count(r.minY,r.maxY),0);
    if(cellCount>MAX_CELLS) throw Error("Слишком много ячеек для выбранного шага.");
    const targetArea=regions.reduce((n,r)=>n+area(r),0);
    const unreachableArea=kind==="contour"?(window?(4-Math.PI)*radius2:0):fits?(4-Math.PI)*radius2:targetArea;

    function check(move) {
      if(!point(move?.from) || !point(move?.to)) return "INVALID_MOVE";
      if(kind==="pocket") {
        if(!centerDomain) return "TOOL_TOO_WIDE";
        // The inset is convex, so an accepted line stays inside it.
        if(!inside(move.from,centerDomain) || !inside(move.to,centerDomain)) return "POCKET_WALL";
      } else {
        if(window && (!inside(move.from,window) || !inside(move.to,window))) return "CONTOUR_WINDOW";
        if(moveRectDistance2(move,feature,featureCorners)<radius2-EPS) return "PART_GOUGE";
      }
      return null;
    }

    function assess(moves,{includeCells=true}={}) {
      if(!Array.isArray(moves) || moves.length>MAX_MOVES) throw Error("Слишком много проходов или неверный формат.");
      const sweeps=[];
      for(const [index,move] of moves.entries()){
        const error=check(move);
        if(error) return {ok:false,error,index};
        const {from,to}=move;
        sweeps.push({from,to,bounds:rect(
          Math.min(from.x,to.x)-radius,Math.min(from.y,to.y)-radius,
          Math.max(from.x,to.x)+radius,Math.max(from.y,to.y)+radius,
        )});
      }
      let guaranteed=0,possible=0;
      const cells=[];
      for(const r of regions){
        const cols=count(r.minX,r.maxX), rows=count(r.minY,r.maxY);
        for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
          const cell=rect(r.minX+i*resolution,r.minY+j*resolution,
            Math.min(r.minX+(i+1)*resolution,r.maxX),Math.min(r.minY+(j+1)*resolution,r.maxY));
          const vertices=corners(cell);
          let status="left";
          for(const move of sweeps){
            const b=move.bounds;
            if(cell.minX>b.maxX+EPS || cell.maxX<b.minX-EPS || cell.minY>b.maxY+EPS || cell.maxY<b.minY-EPS) continue;
            if(vertices.every(p=>pointMoveDistance2(p,move)<radius2-EPS)){ status="cleared"; break; }
            if(status==="left" && moveRectDistance2(move,cell,vertices)<=radius2+EPS) status="boundary";
          }
          if(status==="cleared") guaranteed+=area(cell);
          if(status!=="left") possible+=area(cell);

          if(!includeCells) continue;
          let access="reachable";
          if(kind==="pocket" || window){
            if(!accessDomain) access="inaccessible";
            else{
              const closest=pointRectDistance2(
                {x:Math.max(cell.minX,Math.min(cell.maxX,accessDomain.minX)),
                 y:Math.max(cell.minY,Math.min(cell.maxY,accessDomain.minY))}, accessDomain);
              if(closest>radius2+EPS) access="inaccessible";
              else if(vertices.some(p=>pointRectDistance2(p,accessDomain)>radius2-EPS)) access="boundary";
            }
          }
          cells.push({...cell,status,access});
        }
      }
      const reachableArea=targetArea-unreachableArea;
      const min=Math.min(guaranteed,reachableArea), max=Math.max(min,Math.min(possible,reachableArea));
      return {ok:true,targetArea,unreachableArea,removedArea:{min,max},
        remainingArea:{min:targetArea-max,max:targetArea-min},
        reachableRemainingArea:{min:reachableArea-max,max:reachableArea-min},
        resolution,cells};
    }
    const touchesStock=move=>moveRectDistance2(move,stock,stockCorners)<=radius2+EPS;
    return Object.freeze({check,assess,touchesStock,resolution,centerDomain:centerDomain&&Object.freeze(centerDomain)});
  }
  return Object.freeze({create,DEFAULT_RESOLUTION,MAX_CELLS,MAX_MOVES,centerDistance2:pointMoveDistance2});
});
