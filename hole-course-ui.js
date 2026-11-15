(function (window) {
  "use strict";
  const model = window.CNCHoleCourse;
  function node(tag, text, cls) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  }
  function svg(tag, attributes, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg",tag);
    for(const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
    if(text) element.textContent=text;
    return element;
  }
  const fmt = n => n.toLocaleString("ru-RU",{maximumFractionDigits:2});
  function section(profile,lastReading) {
    const length=profile.outer.reduce((sum,p)=>sum+p.length,0), x=d=>460-d/length*412;
    const y=(d,sign)=>88+sign*d*2, maxD=Math.max(...profile.outer.flatMap(p=>[p.diameter,p.endDiameter]));
    const points=(parts,sign)=>{
      let depth=0;
      return parts.flatMap(p=>{const a=[x(depth),y(p.diameter,sign)];depth+=p.length;return [a,[x(depth),y(p.endDiameter,sign)]];});
    };
    const polygon=(parts,fill,stroke)=>svg("polygon",{points:[...points(parts,-1),...points(parts,1).reverse()].map(p=>p.join(",")).join(" "),fill,stroke,"stroke-width":1.5});
    const chart=svg("svg",{viewBox:"0 0 508 185",role:"img","aria-label":profile.inner.length?"Продольный разрез: светлый канал внутри голубой заготовки, торец справа.":"Продольный разрез сплошной заготовки, торец справа."});
    chart.append(polygon(profile.outer,"#cbdbe9","#4b708e"));
    if(profile.inner.length) chart.append(polygon(profile.inner,"#fbfdff","#416b8c"));
    chart.append(svg("path",{d:"M28 88H480",stroke:"#6f879d","stroke-dasharray":"6 5"}));
    if(lastReading){
      const a=x(profile.frontZ-lastReading.z);
      chart.append(svg("path",{d:"M"+a+" 19V"+(y(maxD,1)+4),stroke:"#2453dc","stroke-width":2,"stroke-dasharray":"4 3"}));
      chart.append(svg("text",{x:a>430?a-6:a+6,y:16,fill:"#2246a4","text-anchor":a>430?"end":"start","font-size":14},"Z "+fmt(lastReading.z)));
    }
    chart.append(svg("text",{x:460,y:174,fill:"#365976","text-anchor":"end","font-size":14},"Свободный торец · Z0"));
    const fig=node("figure",undefined,"hole-course-diagram");
    fig.append(chart,node("figcaption","Продольный разрез · голубое — металл, светлое — отверстие."));
    return fig;
  }
  function create({id,saved,readOnly=false,onChange,onDone}) {
    const task=model.tasks.find(item=>item.id===id), host=node("section",undefined,"hole-course");
    let state=model.restore(saved,id)||model.create(id);
    let invalidInput=false;
    const button=(label,handler,primary=false)=>{
      const b=node("button",label,"button "+(primary?"primary":"secondary"));b.type="button";b.addEventListener("click",handler);return b;
    };
    function render(focus=false) {
      const m=state.machine, completed=state.complete||readOnly, limited=state.events.length>=model.MAX_EVENTS;
      const status=node("p",invalidInput?"Проверьте заполнение полей и точность до 0,01 мм.":state.feedback||"Установлен учебный ноль на свободном торце.","start-note");
      status.tabIndex=-1;status.setAttribute("role","status");
      host.replaceChildren(node("p","ТОКАРНЫЙ СТАНОК · ОТВЕРСТИЯ","eyebrow"),node("h1",task.title),node("p",task.prompt),
        section(window.CNCRealMachine.internalGeometry(m.profile),m.readings.at(-1)));
      if(!completed && !limited) {
        const controls=node("div",undefined,"hole-course-controls");
        const number=(label,name,value,min,max)=>{
          const wrapper=node("label",label), input=node("input");input.name=name;input.type="number";
          input.step=".01";input.min=min;input.max=max;input.required=true;input.value=value;wrapper.append(input);return wrapper;
        };
        const select=(label,name,options)=>{
          const wrapper=node("label",label), input=node("select");input.name=name;
          for(const [value,text] of Object.entries(options)){const option=node("option",text);option.value=value;input.append(option);}
          wrapper.append(input);return wrapper;
        };
        const form=(legend,fields,label,getAction)=>{
          const f=node("form",undefined,"hole-course-form");
          const group=node("fieldset");group.append(node("legend",legend),...fields);
          const submit=button(label,()=>{},true);submit.type="submit";group.append(submit);f.append(group);
          f.addEventListener("submit",event=>{event.preventDefault();apply(getAction(f.elements));});controls.append(f);
        };
        if(task.type==="predict" && !m.cuts.length) form("Прогноз",[number("Полный диаметр сохраняется на длине, мм","value",state.prediction??"",0,45)],"Записать",e=>({type:"predict",value:e.value.valueAsNumber}));
        if(task.type==="diagnose") {
          if(!state.preview) controls.append(button("Проверить исходный проход",()=>apply({type:"preview"})));
          else form("Причина отказа",[select("Что мешает ходу?","cause",{ "":"Выберите причину", ...model.choices })],"Проверить причину",e=>({type:"diagnose",cause:e.cause.value}));
        }
        const lastCut=state.events.findLast(event=>event.type==="drill"||event.type==="bore");
        if(task.tool===5) {
          if(task.type==="predict"){
            if(!m.cuts.length) {
              const start=button("Выполнить проход сверлом Ø8",()=>apply({type:"drill"}),true);
              start.disabled=state.prediction===null;controls.append(start);
            }
          } else form("Сверление · T0505",[number("Глубина до вершины, мм","depth",lastCut?.depth??"",1,45)],"Выполнить проход",e=>({type:"drill",depth:e.depth.valueAsNumber}));
        }
        if(task.tool===6 && (task.type!=="diagnose"||state.preview)) form("Расточка · T0606",[
          number("Диаметр X, мм","diameter",lastCut?.diameter??"",6,31),
          number("Длина от торца, мм","depth",lastCut?.depth??"",1,45),
        ],"Выполнить проход",e=>({type:"bore",diameter:e.diameter.valueAsNumber,depth:e.depth.valueAsNumber}));
        const lastMeasure=state.events.findLast(event=>event.type==="measure");
        const instrument=select("Прибор","instrument",{"":"Выберите прибор",...model.instruments});
        instrument.lastElementChild.value=lastMeasure?.instrument??"";
        instrument.lastElementChild.required=true;
        form("Контроль детали",[
          number("Координата Z, мм","z",lastMeasure?.z??"",-60,0),instrument,
        ],"Измерить",e=>({type:"measure",z:e.z.valueAsNumber,instrument:e.instrument.value}));
        host.append(controls);
      }
      host.append(status);
      if(m.readings.length) {
        const details=node("details"), list=node("ul");
        details.open=true;details.append(node("summary","Журнал замеров"),list);
        for(const r of [...m.readings].reverse()) list.append(node("li",model.instruments[r.instrument]+" · Z "+fmt(r.z)+
          " · "+fmt(r.reading)+" мм"+(r.afterCut!==m.cuts.length?" · до последнего прохода":"")));
        host.append(details);
      }
      if(state.lastProgram.length) {
        const details=node("details");details.append(node("summary","Кадры последней операции"),node("pre",state.lastProgram.join("\n")));
        host.append(details);
      }
      if(completed || state.events.some(event=>event.type==="confirm")){
        const list=node("ul");for(const check of model.grade(state).checks) list.append(node("li",(check.passed?"Выполнено: ":"Осталось: ")+check.title));
        host.append(node("h2","Критерии зачёта"),list);
      }
      const actions=node("div",undefined,"hole-course-actions");
      if(completed) actions.append(button("К маршруту курса",onDone,true));
      else if(!limited) actions.append(button("Проверить работу",()=>apply({type:"confirm"}),true),
        button("Показать подсказку",()=>apply({type:"hint"})),button("Заменить заготовку",()=>apply({type:"restart"})));
      else {
        host.append(node("p","В журнале 24 действия. Начните новую попытку, чтобы продолжить."));
        actions.append(button("Начать новую попытку",()=>{state=model.create(id);onChange(null);render(true);},true));
      }
      host.append(actions,node("p","Наладка и подвод в задании заданы. Значения и команды относятся к учебной модели.","hole-course-note"));
      if(focus) status.focus();
    }
    function apply(action) {
      const next=model.transition(state,action);
      if(!next) {invalidInput=true;render(true);return;}
      invalidInput=false;state=next;onChange(model.snapshot(state));render(true);
    }
    render();
    return host;
  }
  window.CNCHoleCourseUI=Object.freeze({create});
})(window);
