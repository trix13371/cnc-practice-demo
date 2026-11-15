(function (root, factory) {
  const node=typeof module==="object" && module.exports;
  const api=factory(
    node?require("./milling-course-model.js"):root.CNCMillingCourse,
    node?require("./milling-route-model.js"):root.CNCMillingRoute,
    node?require("./assignment-model.js"):root.CNCAssignment,
    node?require("./replay-cache-model.js"):root.CNCReplayCache,
  );
  if(node) module.exports=api; else root.CNCMountingPlate=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(mill,routes,assignment,cacheModel){
  "use strict";
  const keys=["pocket","contour","holes"], EPS=1e-8;
  const freeze=value=>{
    if(value && typeof value==="object") {Object.values(value).forEach(freeze);Object.freeze(value);}
    return value;
  };
  const task=freeze({
    title:"Проект: монтажная плита",
    assignment:{id:"mounting-plate",contentVersion:1,criteriaVersion:1,
      profileId:"milling-25d-project",profileVersion:1,seed:"MP-01"},
    code:"MP-01", units:"мм",
    blank:{minX:0,minY:0,maxX:60,maxY:40,thickness:10},
    fixture:{x0:25,x1:35,y0:36,y1:39,z0:-10,z1:8},
    tool:{diameter:6,maxStep:routes.rules.maxStep}, start:{x:-10,y:5,z:20}, safeZ:routes.rules.safeZ,
    operations:{
      pocket:{title:"Карман",kind:"pocket",area:{minX:16,minY:9,maxX:28,maxY:17},floor:-2,
        resolution:.25,maxResidual:12},
      contour:{title:"Наружный контур",kind:"contour",area:{minX:8,minY:7,maxX:38,maxY:19},floor:-1,
        window:{minX:2,minY:1,maxX:44,maxY:25},boundedContour:true,resolution:.25,maxResidual:55},
      holes:{title:"Два глухих отверстия Ø6",floor:-2,holeCenters:[{x:12,y:13},{x:34,y:13}]},
    },
    checks:[
      {id:"p1",title:"Карман, левая часть",x:17,y:13,z:-2},
      {id:"p2",title:"Карман, правая часть",x:27,y:13,z:-2},
      {id:"c1",title:"Контур слева",x:5,y:13,z:-1},
      {id:"c2",title:"Контур справа",x:41,y:13,z:-1},
      {id:"c3",title:"Контур снизу",x:23,y:4,z:-1},
      {id:"c4",title:"Контур сверху",x:23,y:22,z:-1},
      {id:"h1",title:"Отверстие А",x:12,y:13,z:-2},
      {id:"h2",title:"Отверстие Б",x:34,y:13,z:-2},
      {id:"top",title:"Сохранённая верхняя поверхность",x:23,y:8,z:0},
      {id:"frame",title:"Сохранённая рама за полосой",x:46,y:13,z:0},
    ],
  });
  const id=task.assignment.id;
  const orders=freeze({
    "pocket-first":["pocket","contour","holes"],
    "contour-first":["contour","pocket","holes"],
  });
  const geometry=freeze({
    parts:mill.geometry.parts,
    obstacles:mill.geometry.obstacles.map(o=>o.id==="fixture"?{...o,...task.fixture}:o),
  });
  const engines=Object.fromEntries(keys.map(key=>{
    const feature=task.operations[key];
    return [key,routes.create({stock:feature.window||task.blank,diameter:task.tool.diameter,
      limits:mill.config.limits,feature,collision:(position,command)=>mill.collision({position},command,geometry)})];
  }));
  const journalCache=cacheModel.create({maxEntries:24,maxBytes:1024*1024});
  const simulationCache=cacheModel.create({maxEntries:16,maxBytes:768*1024});
  const objectKeys=(value,expected)=>value && typeof value==="object" && !Array.isArray(value) &&
    Object.keys(value).length===expected.length && expected.every(key=>Object.hasOwn(value,key));
  const validSource=source=>typeof source==="string" && source.length<=routes.rules.maxSource &&
    !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(source);
  const validPrograms=programs=>objectKeys(programs,keys) && keys.every(key=>validSource(programs[key]));
  function simulate(programs,order) {
    const cacheKey={programs,order};
    const hit=simulationCache.get(cacheKey);
    if(hit) return hit;
    let position=task.start, incident=null;
    const operations={}, slices={};
    for(const key of orders[order]) {
      const parsed=routes.parse(programs[key]);
      if(!parsed.ok) {incident={key,code:parsed.code,line:parsed.line,title:parsed.message};break;}
      const result=engines[key].simulate(position,parsed.commands);
      operations[key]=result;
      if(key!=="holes") {
        const slice=engines[key].section(result,task.operations[key].floor,{includeCells:false});
        slices[key]=slice.reachableRemainingArea;
      }
      if(!result.ok) {
        incident={key,...result.incident,line:parsed.lines[result.incident.index]??null};
        break;
      }
      position=result.position;
    }
    const surfaces=Object.fromEntries(task.checks.map(point=>[point.id,
      Math.min(0,...Object.entries(operations).map(([key,result])=>engines[key].measure(result,point)))]));
    const result={ok:!incident,incident,slices,surfaces,operations};
    return simulationCache.remember(cacheKey,result);
  }
  function create() {
    return {order:"pocket-first",programs:{pocket:"",contour:"",holes:""},
      executed:false, measured:[],confirmed:false,result:null};
  }
  function grade(state) {
    const {result}=state;
    const check=(id,title,passed)=>({id,title,passed:!!passed});
    return assignment.evaluate(task.assignment,task.assignment,[
      check("route","Все операции выполнены с безопасным отводом",result?.ok),
      ...["pocket","contour"].map(key=>check(key,task.operations[key].title+" в пределах допуска по остатку",
        result?.slices[key]?.max<=task.operations[key].maxResidual+EPS)),
      check("shape","Выполнены заданные глубины, сохранены рама и верх плиты",
        result && task.checks.every(p=>Math.abs(result.surfaces[p.id]-p.z)<=EPS)),
      check("control","Проведён контроль всех точек после последнего прогона",state.measured.length===task.checks.length),
    ],false);
  }
  function snapshot(state) {
    return {version:1,assignment:{...task.assignment},order:state.order,programs:{...state.programs},
      executed:state.executed,measured:[...state.measured],confirmed:state.confirmed};
  }
  function restore(raw) {
    if(!objectKeys(raw,["version","assignment","order","programs","executed","measured","confirmed"]) ||
        raw.version!==1 || !assignment.matches(raw.assignment,task.assignment) ||
        typeof raw.order!=="string" || !Object.hasOwn(orders,raw.order) || !validPrograms(raw.programs) ||
        typeof raw.executed!=="boolean" || typeof raw.confirmed!=="boolean" ||
        !Array.isArray(raw.measured) || raw.measured.length>task.checks.length ||
        new Set(raw.measured).size!==raw.measured.length ||
        !raw.measured.every(id=>task.checks.some(point=>point.id===id))) return null;
    const hit=journalCache.get(raw);
    if(hit) return hit;
    const state={order:raw.order,programs:{...raw.programs},executed:raw.executed,measured:[...raw.measured],
      confirmed:raw.confirmed,result:raw.executed?simulate(raw.programs,raw.order):null};
    if((state.measured.length&&!state.result?.ok) || (state.confirmed&&!grade(state).passed)) return null;
    return journalCache.remember(raw,state);
  }
  function transition(state,action) {
    const previous=restore(snapshot(state));
    if(!previous || previous.confirmed) return null;
    if(action.type==="draft" && validPrograms(action.programs) && typeof action.order==="string" && Object.hasOwn(orders,action.order)) {
      if(action.order===previous.order && keys.every(key=>action.programs[key]===previous.programs[key])) return previous;
      return {...create(),programs:{...action.programs},order:action.order};
    }
    if(action.type==="execute")
      return {...previous,executed:true,measured:[],result:simulate(previous.programs,previous.order)};
    if(action.type==="measure" && previous.result?.ok && task.checks.some(point=>point.id===action.id))
      return {...previous,measured:[...new Set([...previous.measured,action.id])]};
    if(action.type==="confirm" && grade(previous).passed) return {...previous,confirmed:true};
    return null;
  }
  return Object.freeze({id,task,orders,keys:Object.freeze(keys),create,restore,snapshot,transition,grade});
});
