(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./real-machine-model"), require("./internal-profile-model"), require("./assignment-model"), require("./replay-cache-model"));
  else root.CNCHoleCourse = factory(root.CNCRealMachine, root.CNCInternalProfile, root.CNCAssignment, root.CNCReplayCache);
})(typeof globalThis !== "undefined" ? globalThis : this, function (machine, geometry, assignment, cacheModel) {
  "use strict";
  const VERSION = 1, MAX_EVENTS = 24;
  const tasks = [
    { id: "read", title: "Наружный диаметр и отверстие", type: "observe", stockBore: 8,
      prompt: "На разрезе голубым показан металл. Найдите свободный канал, выберите прибор для его диаметра и сделайте замер в сечении Z−8 мм.",
      help: "Для двух диаметров одного сечения нужны разные поверхности. Сопоставьте, к каким стенкам прикасается прибор." },
    { id: "depth", title: "Две глубины глухого отверстия", type: "predict", tool: 5, depth: 18,
      prompt: "Вершина сверла уйдёт на 18 мм от торца. Коническая часть сверла занимает 2 мм. До запуска спрогнозируйте длину цилиндрической части отверстия, затем проверьте обе глубины.",
      help: "Проследите на разрезе, где заканчивается цилиндр и начинается конус. Координата вершины относится ко всему отверстию." },
    { id: "drill", title: "Первое глухое отверстие", type: "guided", tool: 5,
      prompt: "В сплошной заготовке получите Ø8 мм на глубину полного диаметра 20 мм. Ход задаётся по вершине сверла. Проверьте диаметр при Z−10 и полную глубину от торца.",
      help: "У сверла Ø8 вершина выступает на 2 мм относительно цилиндрической части. Подача и подвод уже заданы для этой учебной операции." },
    { id: "bore", title: "Расточка сквозного отверстия", type: "independent", tool: 6, stockBore: 8,
      prompt: "Расточите вход трубы до Ø12 мм на длине 16 мм. Оставьте остальной канал Ø8 мм. Допустимый съём за проход — до 1 мм на сторону. Проверьте оба участка при Z−8 и Z−22.",
      help: "X задаёт диаметр. Разница между диаметрами распределяется по двум сторонам, а длина прохода отсчитывается от торца." },
    { id: "diagnosis", title: "Резец задевает дно", type: "diagnose", tool: 6, seeded: 18,
      prompt: "В заготовке есть глухое отверстие Ø8 мм. Выполните проверку исходного прохода до Z−20 в копии станка, определите причину отказа и скорректируйте проход: получите Ø10 мм на длине 12 мм. Проверьте диаметр при Z−6.",
      help: "Посмотрите, какую ширину должен пропустить канал. У вершины сверла диаметр отверстия постепенно уменьшается." },
    { id: "sleeve", title: "Проект: втулка с двумя ступенями", type: "project", tool: 6, stockBore: 10,
      prompt: "На заготовке Ø32 мм получите отверстие Ø14 от торца до Z−8, Ø12 от Z−8 до Z−20 и сохраните Ø10 дальше. Проверьте сечения Z−4, Z−14 и Z−24, наружный Ø32 и стенку у входа при Z−4. Выполните проект самостоятельно.",
      help: "Составьте последовательность проходов по двум ступеням. Подумайте, какой диаметр получится на каждом участке после каждого прохода." },
  ].map(Object.freeze);
  Object.freeze(tasks);
  const taskById = (id) => tasks.find(task => task.id === id);
  const cache = cacheModel.create({ maxEntries: 32, maxBytes: 1024 * 1024 });
  const identity = id => ({id:"hole-"+id,contentVersion:1,criteriaVersion:1,profileId:"lathe-internal",profileVersion:1,seed:"hole-"+id+"-01"});
  const mdi = source => ({type:"mdi",source});
  const door = value => ({type:"door",value});
  const instruments = Object.freeze({
    caliper:"Штангенциркуль · наружный Ø", micrometer:"Микрометр · наружный Ø",
    "inside-caliper":"Внутренние губки · Ø", "bore-gauge":"Нутромер · внутренний Ø",
    "depth-gauge":"Глубиномер · полный Ø", "depth-probe":"Щуп · до вершины", "wall-gauge":"Стенка · по двум поверхностям",
  });
  const choices = Object.freeze({ bottom:"На пути державки конус и дно", feed:"Слишком низкая подача", outer:"Мешает наружный диаметр" });
  function stock(task) {
    return {internal:true,diameter:32,length:60,grip:15,...(task.stockBore?{shape:"tube",bore:task.stockBore}:{})};
  }
  function batch(start, actions) {
    let state = start;
    for (const action of actions) {
      const result = machine.transition(state, action);
      if (!result.ok) return {state:start,ok:false,message:result.message,alarm:result.state.alarm?.code??null};
      // The lesson journal retains learner intent. Individual machine moves are derived.
      state = result.state;
      state.journal = [];
    }
    return {state,ok:true};
  }
  function cutCommands(tool, depth, diameter) {
    const isDrill = tool===5;
    return [
      {type:"tool",tool},{type:"preset"},{type:"workOffset",z:100},door(true),{type:"mode",value:"MDI"},
      mdi("G0 X"+(isDrill?0:diameter)+" Z3"),mdi("G97 S500 M3"),mdi("G99 G1 Z-"+depth+" F0.1"),
      ...(isDrill?[mdi("G1 Z3")]:[mdi("G0 X6"),mdi("G0 Z3")]),
      mdi("M5"),mdi("G0 X44 Z12"),door(false),
    ];
  }
  function create(id) {
    const task = taskById(id);
    if (!task) return null;
    const base = batch(machine.create(stock(task)), [{type:"reference"},{type:"clamp",value:true}]).state;
    const seed = task.seeded ? batch(base,cutCommands(5,task.seeded)) : {ok:true,state:base};
    if (!seed.ok) throw Error("Недопустимая исходная геометрия Б5.");
    return {id,machine:seed.state,events:[],preview:false,prediction:null,cause:null,assisted:false,complete:false,feedback:"",lastProgram:[]};
  }
  const exact = (value, keys) => value && typeof value==="object" && !Array.isArray(value) &&
    Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key));
  const mm = (n,min,max) => Number.isFinite(n) && n>=min && n<=max && Number(n.toFixed(2))===n;
  function validAction(task, a) {
    switch (a?.type) {
      case "predict": return task.type==="predict" && exact(a,["type","value"]) && mm(a.value,0,45);
      case "preview": return task.type==="diagnose" && exact(a,["type"]);
      case "diagnose": return task.type==="diagnose" && exact(a,["type","cause"]) && typeof a.cause==="string" && Object.hasOwn(choices,a.cause);
      case "drill": return task.tool===5 && (task.type==="predict" ? exact(a,["type"]) : exact(a,["type","depth"]) && mm(a.depth,1,45));
      case "bore": return task.tool===6 && exact(a,["type","diameter","depth"]) && mm(a.diameter,6,31) && mm(a.depth,1,45);
      case "measure": return exact(a,["type","z","instrument"]) && mm(a.z,-60,0) && typeof a.instrument==="string" && Object.hasOwn(instruments,a.instrument);
      case "restart": case "confirm": case "hint": return exact(a,["type"]);
      default: return false;
    }
  }
  const close = (a,b) => Number.isFinite(a) && Math.abs(a-b)<.0001;
  function grade(s) {
    const m=s.machine, profile=machine.internalGeometry(m.profile), hole=geometry.hole(profile), checks=[];
    const check=(id,title,passed)=>checks.push({id,title,passed:!!passed});
    const read=(metric,z,value,allowed)=>m.readings.some(r=>r.metric===metric && close(r.z,z) && close(r.reading,value) &&
      r.afterCut===m.cuts.length && (!allowed || allowed.includes(r.instrument)));
    const diameter=(z,d)=>read("innerDiameter",z,d,["inside-caliper","bore-gauge"]);
    const bore=(d,l)=>m.cuts.some(c=>c.tool===6) && close(hole.mouth,d) && close(hole.fullDepth,l);
    const bands=(expected)=>profile.inner.length===expected.length && expected.every(([len,d],i)=>{
      const p=profile.inner[i];return close(p.length,len) && close(p.diameter,d) && close(p.endDiameter,d);
    });
    if(s.id==="read") check("surface","Свежий замер внутреннего Ø в нужном сечении",diameter(-8,8));
    if(s.id==="depth" || s.id==="drill") {
      const predict=s.id==="depth", full=predict?16:20, tip=full+2;
      if(predict) check("prediction","Прогноз записан до запуска и подтверждён замерами",close(s.prediction,full));
      check("drilled","Обработано глухое отверстие нужной геометрии",m.cuts.some(c=>c.tool===5) &&
        hole.kind==="blind" && close(hole.mouth,8) && close(hole.fullDepth,full) && close(hole.boreDepth,tip));
      check("full","Свежий замер глубины полного диаметра",read("fullDepth",0,full));
      if(predict) check("tip","Свежий замер глубины до вершины",read("tipDepth",0,tip));
      else check("diameter","Свежий замер Ø в сечении Z−10",diameter(-10,8));
    }
    if(s.id==="bore") {
      check("shape","Расточка по чертежу, остальной канал сохранён",bore(12,16) && bands([[16,12],[44,8]]));
      check("checks","Свежие замеры Ø обоих участков",diameter(-8,12) && diameter(-22,8));
    }
    if(s.id==="diagnosis") {
      check("reason","Проверка исходного прохода и выбор причины",s.preview && s.cause==="bottom");
      check("fix","Проход исправлен, дно и исходная глубина сохранены",bore(10,12) && hole.kind==="blind" &&
        close(hole.boreDepth,18) && profile.inner.length===3 && close(profile.inner[1].diameter,8) && close(profile.inner[1].length,4));
      check("checks","Свежий замер исправленного участка",diameter(-6,10));
    }
    if(s.id==="sleeve") {
      check("shape","Обе ступени и исходный канал соответствуют чертежу",bore(14,8) && bands([[8,14],[12,12],[40,10]]));
      check("checks","Свежие замеры в трёх сечениях",diameter(-4,14) && diameter(-14,12) && diameter(-24,10));
      check("wall","Свежий наружный замер и замер стенки у входа",read("outerDiameter",-4,32) && read("wall",-4,9));
    }
    return assignment.evaluate(identity(s.id),identity(s.id),checks,s.assisted);
  }
  function transition(state, action) {
    const task=taskById(state?.id);
    if (!task || state.complete || state.events.length>=MAX_EVENTS || !validAction(task,action)) return null;
    const events=[...state.events,{...action}], next={...state,events,feedback:""};
    if (action.type==="restart") return {...create(task.id),events,assisted:state.assisted,feedback:"Заготовка заменена. Предыдущие действия сохранены в журнале."};
    if (action.type==="hint") return {...next,assisted:true,feedback:task.help};
    if (action.type==="confirm") {
      next.complete=grade(state).passed;
      next.feedback=next.complete?"Зачёт подтверждён по журналу обработки и контроля.":"Проверьте условия зачёта и выполните недостающие действия.";
    }
    if (action.type==="predict") {
      if(state.machine.cuts.length) next.feedback="Прогноз записывают до обработки. Для новой попытки замените заготовку.";
      else { next.prediction=action.value; next.feedback="Прогноз записан. Теперь выполните проход."; }
    }
    if (action.type==="preview" || action.type==="bore" || action.type==="drill") {
      const preview=action.type==="preview", drill=action.type==="drill";
      if (task.type==="predict" && state.prediction===null) return {...next,feedback:"Сначала запишите прогноз."};
      if (task.type==="diagnose" && !preview && !state.preview) return {...next,feedback:"Сначала проверьте исходный проход."};
      const commands=cutCommands(drill?5:6,preview?20:(task.depth??action.depth),preview?10:action.diameter);
      const result=batch(preview?create(task.id).machine:state.machine,commands);
      next.lastProgram=commands.filter(command=>command.type==="mdi").map(command=>command.source);
      if (preview) {
        next.preview=result.alarm==="BORE_ACCESS";
        next.feedback="Проверка в копии: "+(next.preview?"кадр G01 не выполнен. Внутреннему инструменту не хватает свободного прохода.":(result.message??"пройдена"));
      } else {
        next.machine=result.state;
        next.feedback=result.ok?(result.state.cuts.length>state.machine.cuts.length?"Проход выполнен. Сделайте новые замеры.":"Проход выполнен по воздуху. Размеры не изменились."):"Проход отклонён. "+result.message;
      }
    }
    if (action.type==="diagnose") {
      if(!state.preview) next.feedback="Сначала выполните проверку в копии.";
      else { next.cause=action.cause; next.feedback=action.cause==="bottom"?"Причина подтверждена. Исправьте проход.":"Сопоставьте отказ с внутренним профилем и попробуйте снова."; }
    }
    if (action.type==="measure") {
      const result=machine.transition(state.machine,action);
      next.machine=result.ok?result.state:state.machine;
      if (result.ok) next.machine.journal=[];
      next.feedback=result.message;
    }
    return next;
  }
  const snapshot = state => ({version:VERSION,assignment:identity(state.id),events:state.events.map(event=>({...event}))});
  function restore(raw,id) {
    if (!taskById(id) || !exact(raw,["version","assignment","events"]) || raw.version!==VERSION ||
      !assignment.matches(raw.assignment,identity(id)) || !Array.isArray(raw.events) || raw.events.length>MAX_EVENTS) return null;
    const hit=cache.get(raw);
    if(hit) return hit;
    let state=create(id);
    for (const action of raw.events) { state=transition(state,action); if (!state) return null; }
    return cache.remember(raw,state);
  }
  function restoreBook(raw) {
    if (!exact(raw,["version","works"]) || raw.version!==VERSION || !raw.works || typeof raw.works!=="object" || Array.isArray(raw.works)) return null;
    const works={};
    for(const [id,entry] of Object.entries(raw.works)){
      const state=restore(entry,id);
      if(!state) return null;
      if(state.events.length) works[id]=snapshot(state);
    }
    return {version:VERSION,works};
  }
  function summary(book) {
    return tasks.flatMap(task=>{
      const s=restore(book?.works?.[task.id],task.id);
      return s?.complete?[{id:task.id,independent:grade(s).independent}]:[];
    });
  }
  return Object.freeze({tasks,instruments,choices,create,transition,snapshot,restore,restoreBook,summary,grade,MAX_EVENTS});
});
