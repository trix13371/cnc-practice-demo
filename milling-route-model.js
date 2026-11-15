(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./milling-profile-model.js") : root.CNCMillingProfile);
  if (node) module.exports = api;
  else root.CNCMillingRoute = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (profiles) {
  "use strict";
  const EPS = 1e-8;
  const rules=Object.freeze({rapidZ:2,safeZ:12,maxStep:1,maxSource:4096,maxBlocks:profiles.MAX_MOVES});
  const messages = Object.freeze({
    START: "Для проверки нужна чистая заготовка, подтверждённая наладка, Z не ниже 12 и остановленный шпиндель.",
    COMMAND: "Поддерживаются отдельные команды M03, M05 и линейные G0/G1.",
    TRAVEL: "Целевая точка за пределами перемещения учебной установки.",
    RAPID_DEPTH: "На высоте ниже Z2 быстрым ходом разрешён только вертикальный отвод вверх.",
    SPINDLE_CLEARANCE: "Переключайте шпиндель после отвода на высоту Z2 или выше.",
    INCLINED: "Задайте перемещение по Z отдельно от движения в плоскости XY.",
    SPINDLE: "Включите шпиндель перед рабочим ходом в материале.",
    DEPTH: "Предел прохода — 1 мм нового съёма. Для более глубокого хода сначала обработайте всю его линию на предыдущем слое.",
    FLOOR: "Фреза пересекла бы заданное дно или нижнюю поверхность заготовки.",
    POCKET_WALL: "Радиус фрезы выводит её за стенку кармана.",
    PART_GOUGE: "Фреза пересекает наружный контур сохраняемой детали.",
    CONTOUR_WINDOW: "Фреза выходит за пределы размеченной полосы наружного контура.",
    HOLE_CENTER: "Под поверхностью разрешено только осевое врезание в заданных центрах отверстий.",
    TOOL_TOO_WIDE: "Фреза шире кармана.",
    END_UNSAFE: "Завершите программу отводом на Z не ниже 12 и остановкой шпинделя.",
  });
  const xyz = ["x","y","z"];
  const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));

  function parse(source) {
    if (typeof source !== "string" || source.length > rules.maxSource ||
        /[^\x09\x0A\x0D\x20-\x7E]/.test(source))
      return {ok:false,code:"COMMAND",line:null,message:"Введите до 4096 символов программы. Допустима латиница."};
    const rows = source.split(/\r\n|\r|\n/), commands = [], lines = [];
    if (rows.length > rules.maxBlocks)
      return {ok:false,code:"COMMAND",line:null,message:"Допускается до "+profiles.MAX_MOVES+" строк."};
    const number = "([+-]?(?:\\d+(?:\\.\\d{1,3})?|\\.\\d{1,3}))";
    const motion = new RegExp("^G0?([01])[ \\t]+X"+number+"[ \\t]+Y"+number+"[ \\t]+Z"+number+"$","i");
    for (const [i, row] of rows.entries()) {
      const value = row.trim();
      if (!value) continue;
      const match = value.match(motion);
      if (/^M0?[35]$/i.test(value)) commands.push({type:"spindle",value:value.at(-1)==="3"});
      else if (match && match.slice(2).every(v=>Number.isFinite(Number(v))))
        commands.push({type:"move",mode:"G"+match[1],x:Number(match[2]),y:Number(match[3]),z:Number(match[4])});
      else return {ok:false,code:"COMMAND",line:i+1,message:"Нужен кадр G0/G1 X… Y… Z… или отдельная команда M03/M05. В числах используйте точку и до трёх знаков после неё."};
      lines.push(i+1);
    }
    return commands.length?{ok:true,commands,lines}:{ok:false,code:"COMMAND",line:null,message:"Добавьте хотя бы один кадр."};
  }

  // At a deeper layer, prove that each point of the new center line lies on a
  // previously cut center line. The radius is constant, so this also proves
  // containment of the swept disk. Merge adjacent collinear prior passes.
  function priorLayerCovers(move, cuts, threshold) {
    const {from,to} = move, dx=to.x-from.x, dy=to.y-from.y, length=Math.hypot(dx,dy);
    const prior=cuts.filter(cut=>cut.z<=threshold+EPS);
    if (length<=EPS) return prior.some(cut=>profiles.centerDistance2(from,cut)<=EPS**2);
    const ux=dx/length, uy=dy/length;
    const project=p=>(p.x-from.x)*ux+(p.y-from.y)*uy;
    const onLine=p=>Math.abs((p.x-from.x)*uy-(p.y-from.y)*ux)<=EPS;
    const ranges=prior.filter(cut=>onLine(cut.from)&&onLine(cut.to)).map(cut=>{
      const a=project(cut.from), b=project(cut.to);
      return [Math.min(a,b),Math.max(a,b)];
    }).sort((a,b)=>a[0]-b[0]);
    let reached=0;
    for(const [min,max] of ranges) {
      if(min>reached+EPS) break;
      reached=Math.max(reached,max);
      if(reached>=length-EPS) return true;
    }
    return false;
  }

  function create({stock,diameter,limits,collision,feature}) {
    const holeCenters=feature.holeCenters;
    const profile=holeCenters?null:profiles.create({stock,diameter,kind:feature.kind,feature:feature.area,
      resolution:feature.resolution,boundedContour:feature.boundedContour});
    const floor=feature.floor;
    function simulate(start,commands) {
      let position={...start}, spindle=false;
      const path=[], cuts=[];
      const finish = (incident) => ({ok:!incident,position,spindle,path,cuts,incident});
      const fail=(code,index,point=null)=>finish({code,index,point,title:messages[code]});
      if (!start || !xyz.every(axis=>Number.isFinite(start[axis]) &&
          start[axis]>=limits[axis][0] && start[axis]<=limits[axis][1]) || start.z<rules.safeZ)
        return fail("START",null);
      if (!Array.isArray(commands) || commands.length<1 || commands.length>rules.maxBlocks)
        return fail("COMMAND",null);
      for(const [index,command] of commands.entries()) {
        if (command?.type==="spindle" && exact(command,["type","value"]) && typeof command.value==="boolean") {
          if (position.z<rules.rapidZ && spindle!==command.value) return fail("SPINDLE_CLEARANCE",index,position);
          spindle=command.value;
          continue;
        }
        if (command?.type!=="move" || !exact(command,["type","mode",...xyz]) ||
            !["G0","G1"].includes(command.mode) || !xyz.every(axis=>Number.isFinite(command[axis])))
          return fail("COMMAND",index);
        const from=position, to={x:command.x,y:command.y,z:command.z}, mode=command.mode;
        if (xyz.some(axis=>to[axis]<limits[axis][0] || to[axis]>limits[axis][1]))
          return fail("TRAVEL",index,to);
        const vertical=Math.hypot(to.x-from.x,to.y-from.y)<=EPS;
        const changingZ=Math.abs(to.z-from.z)>EPS;
        const z=Math.min(from.z,to.z), rising=vertical&&to.z>from.z+EPS;
        if (!changingZ && vertical) continue;
        if (changingZ && !vertical) return fail("INCLINED",index,from);
        const hit=collision(position,command);
        if(hit) return finish({...hit,index});
        if(mode==="G0" && to.z<rules.rapidZ && !rising) return fail("RAPID_DEPTH",index,from);
        if(z<floor) return fail("FLOOR",index,to);
        let cutting=false;
        if(mode==="G1" && z<0 && !rising) {
          const sweep={from:{x:from.x,y:from.y},to:{x:to.x,y:to.y}};
          const inHole=holeCenters?.some(point=>[sweep.from,sweep.to].every(p=>Math.hypot(p.x-point.x,p.y-point.y)<=EPS));
          const shapeFault=holeCenters?(inHole?null:"HOLE_CENTER"):profile.check(sweep);
          if(shapeFault) return fail(shapeFault,index,from);
          if(holeCenters||profile.touchesStock(sweep)) {
            if(!spindle) return fail("SPINDLE",index,from);
            if(z < -rules.maxStep-EPS && !priorLayerCovers(sweep,cuts,z+rules.maxStep))
              return fail("DEPTH",index,to);
            cuts.push({...sweep,z});
            cutting=true;
          }
        }
        path.push({from,to,mode,cutting});
        position=to;
      }
      return position.z>=rules.safeZ && !spindle ? finish(null) : fail("END_UNSAFE",null,position);
    }
    function section(result,depth=floor,options) {
      if(!Number.isFinite(depth) || depth>=0 || depth<floor)
        throw Error("Сечение должно быть между заданным дном и верхом заготовки.");
      return profile.assess(result.cuts.filter(cut=>cut.z<=depth+EPS),options);
    }
    function measure(result,point) {
      let depth=0;
      for(const cut of result.cuts)
        if(profiles.centerDistance2(point,cut)<=(diameter/2)**2+EPS) depth=Math.min(depth,cut.z);
      return depth;
    }
    return Object.freeze({simulate,section,measure});
  }
  return Object.freeze({create,parse,messages,rules});
});
