(function (root) {
  "use strict";
  const model=root.CNCMountingPlate, task=model.task;
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==undefined) node.textContent=text;
    if(cls) node.className=cls;
    return node;
  };
  const svg=(tag,attributes,text)=>{
    const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
    for(const [name,value] of Object.entries(attributes)) node.setAttribute(name,value);
    if(text!==undefined) node.textContent=text;
    return node;
  };
  const fmt=(v,max=2)=>v.toLocaleString("ru-RU",{maximumFractionDigits:max});
  const button=(label,action,primary=false)=>{
    const node=el("button",label,"button "+(primary?"primary":"secondary"));
    node.type="button";node.addEventListener("click",action);return node;
  };
  function drawing(result) {
    const {operations,fixture}=task;
    const fig=el("figure",undefined,"mounting-plate-drawing");
    const chart=svg("svg",{viewBox:"-4 -4 68 48",role:"img",
      "aria-label":"Вид сверху. Карман в центре, два отверстия по бокам, крепление сзади. Координаты приведены в таблице."});
    const rect=(r,fill,stroke,dash="none")=>svg("rect",{x:r.minX,y:40-r.maxY,
      width:r.maxX-r.minX,height:r.maxY-r.minY,fill,stroke,"stroke-width":.25,"stroke-dasharray":dash});
    chart.append(rect(task.blank,"#eef2f7","#496584"));
    chart.append(rect(operations.contour.window,"#f7e5c5","#8c651e","1 .6"));
    chart.append(rect(operations.contour.area,"#dde7f0","#315375"));
    chart.append(rect(operations.pocket.area,"#c6dbfa","#285aae"));
    chart.append(rect({minX:fixture.x0,maxX:fixture.x1,minY:fixture.y0,maxY:fixture.y1},"#b7c4d4","#526278"));
    if(result){
      for(const [key,operation] of Object.entries(result.operations)){
        const fill={pocket:"#3978d7",contour:"#b37318",holes:"#247a71"}[key];
        for(const {from,to,z} of operation.cuts){
          if(z>operations[key].floor) continue;
          chart.append(from.x===to.x&&from.y===to.y
            ? svg("circle",{cx:from.x,cy:40-from.y,r:task.tool.diameter/2,fill,opacity:.35})
            : svg("line",{x1:from.x,y1:40-from.y,x2:to.x,y2:40-to.y,stroke:fill,
              "stroke-width":task.tool.diameter,"stroke-linecap":"round",opacity:.35}));
        }
      }
      if(result.incident?.fraction!==undefined&&result.incident.point)
        chart.append(svg("circle",{cx:result.incident.point.x,cy:40-result.incident.point.y,r:1,fill:"#ae2828"}));
    }
    const text=(x,y,label)=>svg("text",{x,y,fill:"#152d4e","font-size":1.75,"text-anchor":"middle"},label);
    for(const [index,{x,y}] of operations.holes.holeCenters.entries()){
      chart.append(svg("circle",{cx:x,cy:40-y,r:task.tool.diameter/2,fill:"#fff",stroke:"#285aae","stroke-width":.25}));
      chart.append(text(x,40-y+.58,index===0?"А":"Б"));
    }
    chart.append(text(22,40-13+.55,"Карман"),text(30,2.7,"Крепление"),text(58,42.5,"X →"),text(1,-1.2,"Y ↑"),text(0,42.4,"0"));
    fig.append(chart,el("figcaption",result
      ? "Следы инструмента на заданной глубине. Показана обработка по выполненным кадрам."
      : "MP-01 · вид сверху. Жёлтым показана полоса вокруг детали. Серая рамка за полосой остаётся на заготовке."));
    return fig;
  }
  function dimensions() {
    const table=el("table",undefined,"mounting-plate-table");
    const {blank,operations}=task, ranges=r=>"X"+r.minX+"…"+r.maxX+", Y"+r.minY+"…"+r.maxY;
    const hole=(point)=>"Центр X"+point.x+" Y"+point.y+". Ø"+task.tool.diameter+" мм, глубина "+(-operations.holes.floor)+" мм.";
    const data=[
      ["Заготовка",blank.maxX+" × "+blank.maxY+" × "+blank.thickness+" мм. Z0 — верх, X0 Y0 — нижний левый угол на чертеже."],
      ["Сохраняемая деталь",ranges(operations.contour.area)+". Сохраняйте верх вне кармана и отверстий."],
      ["Полоса контура","Внешняя граница "+ranges(operations.contour.window)+". Глубина "+(-operations.contour.floor)+" мм. Рама за полосой остаётся."],
      ["Карман",ranges(operations.pocket.area)+". Глубина "+(-operations.pocket.floor)+" мм."],
      ["Отверстие А",hole(operations.holes.holeCenters[0])],
      ["Отверстие Б",hole(operations.holes.holeCenters[1])],
    ];
    const body=el("tbody");
    for(const [title,description] of data){
      const row=el("tr"),head=el("th",title);head.scope="row";
      row.append(head,el("td",description));body.append(row);
    }
    table.append(body);return table;
  }
  function create({saved,onChange=()=>true,onDone=()=>{},readOnly=false}={}) {
    const host=el("section",undefined,"start-session mounting-plate");
    let state=model.restore(saved)||model.create();
    if(saved&&!model.restore(saved)){
      host.append(el("p","Журнал проекта не удалось открыть."));
      host.append(button("Вернуться к курсу",onDone));return host;
    }
    const locked=readOnly||state.confirmed;
    const notice=el("p","");notice.setAttribute("role","status");
    const evidence=el("section",undefined,"mounting-plate-evidence");
    const order=el("select"), orderLabel=el("label","Порядок операций");
    const programs={};
    for(const [value,title] of [["pocket-first","Сначала карман"],["contour-first","Сначала контур"]]){
      const option=el("option",title);option.value=value;order.append(option);
    }
    order.value=state.order;orderLabel.append(order);order.disabled=locked;
    host.append(el("p","САМОСТОЯТЕЛЬНАЯ РАБОТА · MP-01","eyebrow"),
      el("h1",task.title),el("p","Обработайте деталь по чертежу, затем проверьте дно, обе стороны и сохранённые поверхности."),
      drawing(),dimensions(),el("p","Фреза Ø6 мм, осевой съём до 1 мм за проход. Старт X−10 Y5 Z20, шпиндель остановлен. Для G0 и G1 указывайте X, Y и Z в каждом кадре. M03 и M05 пишите отдельными строками. Заканчивайте каждую операцию на Z12 или выше с остановленным шпинделем. Каждый прогон начинается с чистой заготовки."),
      orderLabel);
    for(const key of model.keys){
      const label=el("label",task.operations[key].title, "mounting-plate-source"),input=el("textarea");
      input.rows=6;input.maxLength=4096;input.spellcheck=false;input.autocapitalize="off";
      input.value=state.programs[key];input.readOnly=locked;programs[key]=input;
      label.append(input);host.append(label);
      input.addEventListener("input",draft);
    }
    order.addEventListener("change",draft);
    const run=button("Выполнить программу",()=>apply({type:"execute"},"Прогон завершён. Проверьте результаты."),true);
    if(!locked) host.append(run);
    host.append(notice,evidence,button("Вернуться к курсу",onDone));
    function update(value) {
      state=value;
      return onChange(model.snapshot(state))!==false;
    }
    function draft() {
      const programsValue=Object.fromEntries(model.keys.map(key=>[key,programs[key].value]));
      const next=model.transition(state,{type:"draft",order:order.value,programs:programsValue});
      if(!next) {notice.textContent="Проверьте текст программы. Вставленный текст содержит недопустимый символ.";return false;}
      if(next.order===state.order&&model.keys.every(key=>next.programs[key]===state.programs[key])) return true;
      notice.textContent=update(next)?"Черновик обновлён. Выполните программу, чтобы получить новые замеры.":"Не удалось сохранить черновик.";
      render();
      return true;
    }
    function apply(action,message) {
      if(action.type==="execute"&&!draft()) return;
      const next=model.transition(state,action);
      if(!next) {notice.textContent="Остались незакрытые критерии. Проверьте список ниже.";return;}
      const feedback=action.type==="execute"&&next.result?.incident?"Прогон остановлен. Причина указана ниже.":message;
      notice.textContent=update(next)?feedback:"Не удалось сохранить работу.";
      if(state.confirmed) {
        for(const input of Object.values(programs)) input.readOnly=true;
        order.disabled=true;
        run.hidden=true;
      }
      render();
      if(action.type==="measure"){
        const row=evidence.querySelector('[data-point="'+action.id+'"]');
        row?.querySelector("button")?.focus();
      }
    }
    function render() {
      evidence.replaceChildren(el("h2","Обработка и контроль"));
      const {result}=state;
      if(!result) {evidence.append(el("p","Замеры станут доступны после прогона всех операций."));return;}
      if(result.incident) {
        const i=result.incident;
        evidence.append(el("p",task.operations[i.key].title+(i.line?" · строка "+i.line:"")+" — "+i.title,"start-note"));
        if(i.advice) evidence.append(el("p",i.advice));
      }
      if(Object.keys(result.operations).length) evidence.append(drawing(result));
      for(const [key,{min,max}] of Object.entries(result.slices)){
        const limit=task.operations[key].maxResidual;
        const lower=Math.floor((min+1e-8)*100)/100, upper=Math.ceil((max-1e-8)*100)/100;
        evidence.append(el("p",task.operations[key].title+" · доступный остаток "+fmt(lower)+"–"+fmt(upper)+" мм². Учебный предел верхней оценки "+limit+" мм²."));
      }
      const table=el("table",undefined,"mounting-plate-table"),head=el("thead"),headRow=el("tr");
      for(const name of ["Место контроля","По чертежу, Z","Замер, Z"]){
        const th=el("th",name);th.scope="col";headRow.append(th);
      }
      head.append(headRow);
      const body=el("tbody");
      for(const point of task.checks){
        const row=el("tr"), reading=el("td");
        row.dataset.point=point.id;
        if(state.measured.includes(point.id)) reading.append(el("span",fmt(result.surfaces[point.id])+" мм"));
        else if(!result.ok||locked||state.confirmed) reading.append(el("span","—"));
        if(result.ok&&!locked&&!state.confirmed) {
          const probe=button("Измерить",()=>apply({type:"measure",id:point.id},
            point.title+" — измерено Z"+fmt(result.surfaces[point.id])+" мм."));
          probe.setAttribute("aria-label","Измерить: "+point.title);
          reading.append(probe);
        }
        const place=el("th",point.title+" · X"+point.x+" Y"+point.y);place.scope="row";
        row.append(place,el("td",fmt(point.z)+" мм"),reading);body.append(row);
      }
      table.append(head,body);evidence.append(table);
      const criteria=el("ul");
      for(const item of model.grade(state).checks)
        criteria.append(el("li",(item.passed?"Выполнено: ":"Осталось: ")+item.title));
      evidence.append(criteria);
      if(state.confirmed) evidence.append(el("p","Проект зачтён.","start-note"));
      else if(!locked&&result.ok) evidence.append(button("Подтвердить результат",()=>apply({type:"confirm"},"Проект зачтён."),true));
    }
    render();return host;
  }
  root.CNCMountingPlateUI=Object.freeze({create});
})(window);
