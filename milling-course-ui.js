(function (root) {
  "use strict";
  const engine = root.CNCMillingCourse,
    el = (tag, text, cls) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      if (cls) n.className = cls;
      return n;
    };
  function routePreview() {
    const route = engine.route25d, panel = el("details", undefined, "course-reading milling-route-preview");
    const choice = el("select"), field = el("label", "Форма обработки");
    for (const [kind,feature] of Object.entries(route.features)) {
      const option = el("option",feature.title);
      option.value=kind;
      choice.append(option);
    }
    choice.value="pocket";
    field.append(choice);
    const caption = el("p",route.features.pocket.caption), form = el("form"),
      program = el("textarea"), sourceLabel = el("label","Кадры маршрута"), actions = el("div",undefined,"milling-route-actions"),
      check = el("button","Проверить маршрут","button primary"), sample = el("button","Подставить пример","button secondary"),
      result = el("div",undefined,"milling-route-result");
    program.rows=8;
    program.maxLength=4096;
    program.required=true;
    program.spellcheck=false;
    program.autocapitalize="off";
    sourceLabel.append(program);
    check.type="submit";
    sample.type="button";
    result.setAttribute("role","status");
    const example=(x,y)=>[
      "G0 X"+x+" Y"+y+" Z20","G0 X"+x+" Y"+y+" Z2","M03",
      "G1 X"+x+" Y"+y+" Z-1","G1 X"+x+" Y"+(y-2)+" Z-1",
      "G1 X"+x+" Y"+(y-2)+" Z-2","G1 X"+x+" Y"+y+" Z-2",
      "G0 X"+x+" Y"+y+" Z12","M05",
    ].join("\n");
    sample.onclick=()=>{
      program.value=choice.value==="pocket"?example(10,8):example(2,8);
      result.replaceChildren();
      program.focus();
    };
    choice.onchange=()=>{
      caption.textContent=route.features[choice.value].caption;
      result.replaceChildren();
    };
    program.oninput=()=>result.replaceChildren();
    const area = ({min,max}) => {
      const lower=Math.floor((min+1e-8)*10)/10, upper=Math.ceil((max-1e-8)*10)/10;
      return lower===upper?lower.toLocaleString("ru-RU"):lower.toLocaleString("ru-RU")+"–"+upper.toLocaleString("ru-RU");
    };
    form.onsubmit=event=>{
      event.preventDefault();
      const run=route.preview(choice.value,program.value);
      const incident=run.incident;
      result.replaceChildren(el("strong",run.ok?"Маршрут допустим":"Маршрут остановлен"+(incident.line?" на строке "+incident.line:"")));
      if(incident) result.append(el("p",incident.title+(incident.part?" · "+incident.part+" / "+incident.obstacle:"")));
      if(incident?.advice) result.append(el("p",incident.advice));
      if(incident?.fraction!==undefined&&incident.point) {
        const {x,y,z}=incident.point, n=(v)=>v.toLocaleString("ru-RU",{maximumFractionDigits:2});
        result.append(el("p","Вход опорной точки в зону препятствия: X"+n(x)+" Y"+n(y)+" Z"+n(z)+"."));
      }
      if(run.material) {
        result.append(
          el("p","Пройдено перемещений: "+run.path.length+". На Z−2 снято "+area(run.material.removedArea)+" мм²."),
          el("p","Доступный остаток: "+area(run.material.reachableRemainingArea)+" мм². Недоступно этой фрезе: "+run.material.unreachableArea.toLocaleString("ru-RU",{maximumFractionDigits:2})+" мм²."),
          routeDrawing(route.features[choice.value],run),
        );
      }
    };
    actions.append(check,sample);
    form.append(field,caption,sourceLabel,actions);
    panel.append(el("summary","Проверка маршрута 2.5D"),el("p",
      "Проверка на отдельной чистой плите. Фреза Ø6, начало X−10 Y5 Z20. Наладка выполнена, шпиндель остановлен. Введите G0 или G1 с X, Y, Z в каждой строке. M03 и M05 задаются отдельно. Подача и инструмент фиксированы."),form,result);
    return panel;
  }

  function routeDrawing(feature,run) {
    const {area}=feature, c=engine.config.clamp, column=engine.config.body;
    const figure=el("figure"), svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","-23 -23 106 86");
    svg.setAttribute("role","img");
    svg.setAttribute("aria-label","Вид сверху: исходная плита, область детали, крепление, колонна и пройденная часть маршрута.");
    const add=(tag,attributes)=>{
      const shape=document.createElementNS("http://www.w3.org/2000/svg",tag);
      for (const [key,value] of Object.entries(attributes)) shape.setAttribute(key,String(value));
      svg.append(shape);
    };
    const rect=(x,y,width,height,fill,stroke)=>add("rect",{x,y,width,height,fill,stroke,"stroke-width":.3});
    rect(0,0,60,40,"#f1f6fa","#56708b");
    rect(area.minX,area.minY,area.maxX-area.minX,area.maxY-area.minY,"#d7e8fc","#406b99");
    rect(c.x0,c.y0,c.x1-c.x0,c.y1-c.y0,"#f4c988","#936920");
    rect(column.x0,column.y0,column.x1-column.x0,column.y1-column.y0,"#bfcbd7","#586b80");
    for(const {from,to,mode} of run.path)
      add("line",{x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:mode==="G0"?"#526379":"#2157bc",
        "stroke-width":.65,"stroke-dasharray":mode==="G0"?"1.25 .85":"none"});
    if(run.incident?.point && run.incident.fraction!==undefined)
      add("circle",{cx:run.incident.point.x,cy:run.incident.point.y,r:1.25,fill:"#bc3025"});
    figure.append(svg,el("figcaption","Синяя область — "+(feature.kind==="pocket"?"карман":"сохраняемая деталь")+
      ". Жёлтая — крепление. Серая — колонна. Пунктир — G0, синяя линия — G1, красная метка — вход в зону препятствия."));
    return figure;
  }

  function create({
    model = engine,
    headingTag = "h3",
    saved,
    savedDraft = "",
    readOnly = false,
    routeMode = false,
    onChange = () => true,
    onDraft = () => true,
    onDone = () => {},
  } = {}) {
    const m = model === engine ? engine : { ...engine, ...model };
    let s = m.restore(saved) || m.create(),
      notice = "",
      movementMode = "G0",
      routeDraft = savedDraft,
      sectionsOpen = false,
      previewPanel;
    const host = el(
      "section",
      undefined,
      "start-session shaft-project-session milling-course",
    );
    if (saved && !m.restore(saved)) {
      host.append(
        el(
          "p",
          "Сохранённая попытка повреждена и не заменена новой. Вернитесь к курсу.",
        ),
      );
      return host;
    }
    function run(a) {
      if (readOnly) return;
      try {
        s = m.transition(s, a);
        notice = "";
        if (onChange(m.snapshot(s)) === false)
          notice = "Не удалось сохранить. Не закрывайте страницу.";
      } catch (e) {
        notice = e.message;
      }
      render();
    }
    function button(text, a) {
      const b = el("button", text, "button secondary");
      b.type = "button";
      b.setAttribute("aria-label", text);
      b.onclick = () => run(typeof a === "function" ? a() : a);
      return b;
    }
    function numericalSetup(parent) {
      parent.append(
        el(
          "p",
          "Паспорт: плита 60×40×10 мм; машинный угол X120 Y80; верх Z" +
            s.mountTop +
            "; измеренная длина фрезы 50 мм, Ø6. Рабочий ноль — угол на верхней поверхности.",
        ),
      );
      const form = el("form", undefined, "shaft-measure-controls"),
        inputs = {};
      for (const [key, label, value] of [
        ["x", "G54 X, мм", s.settings.zero.x],
        ["y", "G54 Y, мм", s.settings.zero.y],
        ["z", "G54 Z, мм", s.settings.zero.z],
        ["length", "Длина фрезы, мм", s.settings.length],
      ]) {
        const labelEl = el("label", label, "field"),
          input = el("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.value = String(value);
        input.setAttribute("aria-label", label);
        labelEl.append(input);
        form.append(labelEl);
        inputs[key] = input;
      }
      const save = el("button", "Записать G54 и длину", "button secondary");
      save.type = "submit";
      form.append(save);
      form.onsubmit = (e) => {
        e.preventDefault();
        try {
          const v = {};
          for (const [k, input] of Object.entries(inputs)) {
            if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(input.value.trim()))
              throw Error("Введите числа без выражений.");
            v[k] = Number(input.value.replace(",", "."));
          }
          run({
            type: "configure",
            zero: { x: v.x, y: v.y, z: v.z },
            length: v.length,
            diameter: 6,
          });
        } catch (e) {
          notice = e.message;
          render();
        }
      };
      parent.append(
        form,
        button("Проверить наладку по паспорту", { type: "verifySetup" }),
        el(
          "p",
          m.prepared(s)
            ? "Наладка подтверждена для текущей установки."
            : "Наладка требует проверки.",
          "start-note",
        ),
      );
      const change = el("details");
      change.append(el("summary", "Изменить исходную установку"));
      change.append(
        el(
          "p",
          "До резания можно переустановить плиту на другую высоту. Закрепление, проверка G54 и контроль после этого требуются заново.",
        ),
      );
      change.append(
        button("Установить верх на Z" + (s.mountTop === 50 ? 52 : 50), {
          type: "mount",
          top: s.mountTop === 50 ? 52 : 50,
        }),
      );
      parent.append(change);
    }
    function materialBoard() {
      const t = m.lessons[s.current],
        zones = t.zones || [t],
        target = engine.target(t),
        x = (n) => 80 + n * 8,
        y = (n) => 250 - n * 4;
      let svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 350" role="img" aria-label="Покрытие плиты: обязательная зона, разрешённый выход, оставшийся материал и глубина"><g font-family="Arial,sans-serif" font-size="15" fill="#24465f"><text x="24" y="25">Вид сверху · X → · Y ↑ · верх Z0</text>';
      for (let i = 0; i < 600; i++) {
        const z = s.grid[i],
          wanted = target[i],
          allowedDepth = zones.find((zone) => engine.inside(i, zone.allow))?.depth || 0;
        svg +=
          '<rect x="' +
          x((i % 30) * 2) +
          '" y="' +
          y(Math.floor(i / 30) * 2 + 2) +
          '" width="16" height="8" fill="' +
          (z < -allowedDepth
            ? "#d35b50"
            : z < 0
              ? wanted === 0 || z === wanted
                ? "#398aa3"
                : "#9dc5d1"
              : wanted < 0
                ? "#fff0c9"
                : "#dbe3e9") +
          '"/>';
      }
      for (const zone of zones)
        for (const [box, color, dash] of [
          [zone.allow, "#5e7186", "7 4"],
          [zone.area, "#a66e18", ""],
        ])
        svg +=
          '<rect x="' +
          x(box.x0) +
          '" y="' +
          y(box.y1) +
          '" width="' +
          (box.x1 - box.x0) * 8 +
          '" height="' +
          (box.y1 - box.y0) * 4 +
          '" fill="none" stroke="' +
          color +
          '" stroke-width="2" stroke-dasharray="' +
          dash +
          '"/>';
      svg +=
        '<rect x="' +
        x(25) +
        '" y="' +
        y(32) +
        '" width="80" height="32" fill="#bd8761"/><text x="' +
        x(25) +
        '" y="' +
        (y(32) - 10) +
        '">Крепление · Z8</text>';
      t.checks.forEach(([a, b], i) => {
        svg +=
          '<circle cx="' +
          x(a) +
          '" cy="' +
          y(b) +
          '" r="5" fill="white" stroke="#173b50"/><text x="' +
          x(a) +
          '" y="' +
          (y(0) + 24) +
          '" text-anchor="middle">' +
          (i + 1) +
          "</text>";
      });
      svg +=
        '<text x="24" y="307">Жёлтый: осталось снять · синий: обработано · красный: лишний съём</text>' +
        '<text x="24" y="332">Сплошная рамка: цель · пунктир: допустимый выход · цифры: точки контроля</text></g></svg>';
      return svg;
    }
    function sectionBoard(t, sectionX = 21) {
      const column = Math.floor(sectionX / 2),
        x = (n) => 70 + n * 12,
        y = (z) => 50 - z * 25;
      let d = "M " + x(0) + " " + y(s.grid[column]);
      for (let iy = 0; iy < 20; iy++) {
        const z = s.grid[iy * 30 + column];
        d += " L " + x(iy * 2) + " " + y(z) + " H " + x(iy * 2 + 2);
      }
      d += " L " + x(40) + " 150 H " + x(0) + " Z";
      return (
        '<svg viewBox="0 0 640 200" role="img" aria-label="Фактический поперечный профиль по Y в сечении X' + sectionX +
        '"><g font-family="Arial,sans-serif" font-size="15" fill="#24465f"><text x="20" y="24">Сечение X' + sectionX + ' · Y → · глубина увеличена для наглядности</text><path d="' +
        d +
        '" fill="#dbe3e9" stroke="#24465f"/><path d="M ' +
        x(t.area.y0) +
        " " +
        y(-t.depth) +
        " H " +
        x(t.area.y1) +
        '" stroke="#146c93" stroke-width="3" stroke-dasharray="6 4"/><text x="20" y="184">Пунктир: требуемое дно Z−' +
        t.depth +
        " · линия: фактический материал</text></g></svg>"
      );
    }
    function failedCheck(){
      return s.lastCheck?.ok===false&&s.incidents.at(-1)?.lesson===m.lessons[s.current].id?s.lastCheck:null;
    }
    function board() {
      if (m.lessons[s.current].area || m.lessons[s.current].zones) return materialBoard();
      const x = (n) => 70 + (n + 20) * 4,
        y = (n) => 240 - (n + 20) * 3;
      let svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 350" role="img" aria-label="Фрезерная установка: вид сверху, инструмент, крепление и траектории"><g font-family="Arial,sans-serif" font-size="13"><rect x="70" y="0" width="400" height="240" fill="#f0f5f8" stroke="#91a7b7"/>';
      for (let i = 0; i < 600; i++) {
        const px = x((i % 30) * 2),
          py = y(Math.floor(i / 30) * 2 + 2),
          z = s.grid[i];
        svg +=
          '<rect x="' +
          px +
          '" y="' +
          py +
          '" width="8" height="6" fill="' +
          (z < 0 ? "#79b9d4" : "#cbd7e0") +
          '"/>';
      }
      svg +=
        '<rect x="' +
        x(25) +
        '" y="' +
        y(32) +
        '" width="40" height="24" fill="#bd8761" stroke="#704522"/><text x="' +
        x(24) +
        '" y="' +
        (y(32) - 8) +
        '" fill="#704522">Крепление · верх Z8</text>';
      if (s.profile >= 2) {
        const body = m.config.body;
        svg +=
          '<rect x="' +
          x(body.x0) +
          '" y="' +
          y(body.y1) +
          '" width="' +
          (body.x1 - body.x0) * 4 +
          '" height="' +
          (body.y1 - body.y0) * 3 +
          '" fill="#a99dbf" stroke="#625373"/><text x="' +
          (x(body.x0) - 25) +
          '" y="' +
          (y(body.y1) - 6) +
          '" fill="#625373">Корпус · колонна</text><ellipse cx="' +
          x(s.position.x) +
          '" cy="' +
          y(s.position.y) +
          '" rx="48" ry="36" fill="none" stroke="#ad6d24" stroke-width="2" stroke-dasharray="6 4"/>';
      }
      for (const p of s.path)
        svg +=
          '<line x1="' +
          x(p.from.x) +
          '" y1="' +
          y(p.from.y) +
          '" x2="' +
          x(p.to.x) +
          '" y2="' +
          y(p.to.y) +
          '" stroke="' +
          (p.cutting ? "#146c93" : "#7392ae") +
          '" stroke-width="2"/>';
      const last = failedCheck();
      if (last && !last.ok) {
        svg +=
          '<line x1="' +
          x(last.from.x) +
          '" y1="' +
          y(last.from.y) +
          '" x2="' +
          x(last.to.x) +
          '" y2="' +
          y(last.to.y) +
          '" stroke="#c54b4b" stroke-width="3" stroke-dasharray="5 3"/>';
        if (last.point)
          svg +=
            '<circle cx="' +
            x(last.point.x) +
            '" cy="' +
            y(last.point.y) +
            '" r="5" fill="#bc2f3b"/>';
      }
      svg +=
        '<ellipse cx="' +
        x(s.position.x) +
        '" cy="' +
        y(s.position.y) +
        '" rx="12" ry="9" fill="none" stroke="#2456d8" stroke-width="3"/><text x="80" y="300" fill="#24465f">X → · Y ↑ · Z: ' +
        s.position.z +
        ' мм · верх плиты Z0</text><text x="80" y="325" fill="#24465f">' +
        (s.profile >= 2
          ? "Синий — фреза Ø6; оранжевый — державка Ø24; голубой — съём"
          : "Синий — фреза Ø6; голубой — съём") +
        "</text></g></svg>";
      return svg;
    }
    function render() {
      const t = m.lessons[s.current],
        plate = !!t.zones,
        hasSurface = !!(t.area || plate),
        accepted = s.done.some((d) => d.id === t.id);
      host.replaceChildren(
        el("p", "ФРЕЗЕРНЫЙ СТАНОК XYZ · УЧЕБНЫЙ ПРОФИЛЬ", "eyebrow"),
        el(headingTag, t.title),
        el(
          "p",
          plate ? "Попытка " + s.attempt + " · " + s.events.length + " из " + m.eventLimit + " действий" : "Задание " +
            (s.current + 1) +
            " из " +
            m.lessonCount(s) +
            " · уровень " +
            t.level +
            " · принято " +
            s.done.length,
          "start-value",
        ),
        el("p", t.goal),
        el("p", t.learn),
      );
      const report = root.CNCMillingCollision.describe(s, t),
        primaryReport = !!report && !report.historical && !accepted;
      if (primaryReport)
        host.append(root.CNCMillingCollisionUI.create({ report }));
      else {
        const figure = el("figure", undefined, "shaft-drawing start-board");
        figure.innerHTML = board();
        host.append(figure);
      }
      if (hasSurface) {
        const sections = plate ? el("details", undefined, "course-reading") : host;
        if (plate) {
          sections.open = sectionsOpen;
          sections.ontoggle = () => { sectionsOpen = sections.open; };
          sections.append(el("summary", "Поперечные сечения X11 и X47"));
          host.append(sections);
        }
        for (const [index, zone] of (t.zones || [t]).entries()) {
          const section = el("figure", undefined, "shaft-drawing");
          section.innerHTML = sectionBoard(zone, plate ? [11, 47][index] : 21);
          sections.append(section);
        }
        const c = m.coverage(s);
        host.append(
          el(
            "p",
            "Покрыто: " +
              c.percent +
              "% · ячеек с остатком: " +
              c.remaining +
              " · лишний съём: " +
              c.overcut,
            "start-value",
          ),
        );
      }
      if (plate && !accepted && !readOnly) {
        const label = el("label", "Черновик маршрута", "field");
        const draft = el("textarea");
        draft.rows = 4;
        draft.maxLength = 2000;
        draft.value = routeDraft;
        const status = el("p", "Запишите порядок проходов и координаты. Движения выполняются через поля XYZ ниже.", "start-note");
        status.setAttribute("role", "status");
        draft.oninput = () => {
          routeDraft = draft.value;
          status.textContent = onDraft(routeDraft) === false
            ? "Черновик не удалось сохранить."
            : "Черновик сохранён. Движения выполняются через поля XYZ ниже.";
        };
        label.append(draft);
        host.append(label, status);
      }
      if (t.numerical) {
        const c = m.coordinates(s);
        host.append(
          el(
            "p",
            "Машинные координаты базовой точки шпинделя: X" +
              c.machine.x +
              " Y" +
              c.machine.y +
              " Z" +
              c.machine.z,
          ),
          el(
            "p",
            "Рабочие координаты вершины по введённым G54/H: X" +
              c.work.x +
              " Y" +
              c.work.y +
              " Z" +
              c.work.z,
          ),
          el(
            "p",
            "Z рабочая = Z машинная − длина фрезы − G54 Z. Движения доступны после проверки наладки.",
            "start-note",
          ),
        );
      }
      if (s.profile >= 2)
        host.append(
          el(
            "p",
            "Высоты сборки: фреза Z" +
              s.position.z +
              "…" +
              (s.position.z + 15) +
              "; державка Z" +
              (s.position.z + 8) +
              "…" +
              (s.position.z + 28) +
              " мм. Проекции на вид сверху перекрываются даже при разных высотах.",
            "start-note",
          ),
        );
      host.append(
        el(
          "p",
          "X" +
            s.position.x +
            " Y" +
            s.position.y +
            " Z" +
            s.position.z +
            " · шпиндель " +
            (s.spindle ? "включён" : "выключен") +
            " · съёмов " +
            s.cuts,
          "start-value",
        ),
      );
      const message = el("p", notice || s.feedback, "start-feedback");
      message.setAttribute("role", "status");
      host.append(message);
      if (report && !primaryReport) {
        const history = el("details", undefined, "course-reading");
        history.append(
          el(
            "summary",
            "Предыдущий отказ: " +
              report.part.title +
              " → " +
              report.obstacle.title,
          ),
          root.CNCMillingCollisionUI.create({ report }),
        );
        host.append(history);
      }
      if (!accepted) {
        const setup = el("details", undefined, "course-reading");
        setup.open = !m.ready(s);
        setup.append(el("summary", "Наладка и ограждение"));
        for (const [key, label] of [
          ["reference", "Референс"],
          ["clamped", "Заготовка закреплена"],
          ["tool", "Фреза Ø6 измерена автоматическим щупом"],
          ["zero", "G54: X/Y — угол плиты, Z — верх"],
          ["door", "Ограждение закрыто"],
        ].filter(([key]) =>
          (!t.numerical || !["tool", "zero"].includes(key)) &&
          (!plate || key !== "door"),
        ))
          setup.append(
            button((s.setup[key] ? "✓ " : "— ") + label, {
              type: "setup",
              key,
              value: !s.setup[key],
            }),
          );
        if (t.numerical) numericalSetup(setup);
        host.append(setup);
        const controls = el("div", undefined, "start-controls");
        if (plate) controls.append(button(s.setup.door ? "Открыть ограждение" : "Закрыть ограждение", {
          type: "setup", key: "door", value: !s.setup.door,
        }));
        controls.append(
          button(s.spindle ? "Остановить шпиндель" : "Включить шпиндель", {
            type: "spindle",
            value: !s.spindle,
          }),
          button("RESET · сбросить ошибку и остановить", { type: "reset" }),
        );
        if (plate) {
          const restart = button("Установить новую заготовку", { type: "restart" });
          restart.disabled = s.spindle;
          controls.append(restart);
        }
        host.append(controls);
        const form = el("form", undefined, "shaft-measure-controls"),
          inputs = {};
        for (const k of ["x", "y", "z"]) {
          const label = el(
              "label",
              "Конечный " + k.toUpperCase() + ", мм",
              "field",
            ),
            i = el("input");
          i.type = "text";
          i.inputMode = "decimal";
          i.maxLength = 24;
          i.value = String(s.position[k]);
          i.setAttribute("aria-label", "Конечный " + k.toUpperCase() + ", мм");
          inputs[k] = i;
          label.append(i);
          form.append(label);
        }
        const wrap = el("label", "Движение", "field"),
          mode = el("select");
        mode.setAttribute("aria-label", "Движение");
        for (const [value, text] of [
          ["G0", "G0 · быстрый ход"],
          ["G1", "G1 · рабочая подача"],
        ]) {
          const o = el("option", text);
          o.value = value;
          mode.append(o);
        }
        mode.value = movementMode;
        mode.onchange = () => {
          movementMode = mode.value;
        };
        wrap.append(mode);
        form.append(wrap);
        const action = (type) => {
          const out = { type, mode: mode.value };
          for (const k of ["x", "y", "z"]) {
            const v = inputs[k].value.trim();
            if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(v))
              throw Error("Введите числовые X/Y/Z без выражений.");
            out[k] = Number(v.replace(",", "."));
          }
          return out;
        };
        for (const [type, label] of [
          ["preview", "Проверить путь на копии"],
          ["move", "Выполнить движение"],
        ]) {
          const b = el("button", label, "button secondary");
          b.type = "button";
          b.onclick = () => {
            try {
              run(action(type));
            } catch (e) {
              notice = e.message;
              render();
            }
          };
          form.append(b);
        }
        form.onsubmit = (e) => e.preventDefault();
        host.append(form);
        if (t.points.length)
          host.append(
            el("p", "Точек выполнено: " + s.visited + " из " + t.points.length),
          );
        if (t.required)
          host.append(
            el(
              "p",
              "Диагностика " +
                t.required +
                ": " +
                (s.probes.includes(t.required)
                  ? "обнаружена на копии"
                  : "предстоит"),
              "start-note",
            ),
          );
        if (hasSurface) {
          const controls = el("div", undefined, "start-controls");
          controls.append(
            el(
              "p",
              "Контроль: Z≥12, остановить шпиндель, открыть ограждение. Измеряется фактическая поверхность, не целевая.",
            ),
          );
          for (const [x, y] of t.checks)
            controls.append(
              button("Контроль X" + x + " Y" + y, { type: "surface", x, y }),
            );
          for (const r of Object.values(s.measurements))
            controls.append(
              el("p", "X" + r.x + " Y" + r.y + ": Z" + r.value + " мм"),
            );
          host.append(controls);
        }
        if (t.slot) {
          const control = el("div", undefined, "start-controls");
          control.append(
            el(
              "p",
              "Контроль дна: отведите Z≥12, выключите шпиндель, откройте ограждение. Отсчёты — центры ячеек Y11.",
            ),
          );
          for (const x of [13, 31, 49])
            control.append(button("Контроль X" + x, { type: "measure", x }));
          host.append(control);
          for (const r of Object.values(s.measurements))
            host.append(
              el(
                "p",
                "X" +
                  r.x +
                  " Y" +
                  r.y +
                  " · Z" +
                  r.value +
                  " · " +
                  (r.afterCut === s.cuts ? "свежий отсчёт" : "устарел"),
              ),
            );
        }
        const help = button(
          s.help.includes(t.id) ? "Разбор открыт" : "Нужен разбор",
          { type: "hint" },
        );
        help.disabled = s.help.includes(t.id);
        host.append(
          help,
          button("Проверить выполнение задания", { type: "confirm" }),
        );
        if (s.help.includes(t.id)) host.append(el("p", t.hint, "start-hint"));
      } else {
        host.append(
          el(
            "p",
            "Задание принято: маршрут и условия подтверждены в учебной модели.",
            "start-value",
          ),
        );
        if (plate) {
          const result = s.done[0];
          host.append(el("p", result.independent
            ? "Работа выполнена самостоятельно."
            : "Работа выполнена с разбором."));
          const measurements = el("ul");
          for (const { x, y, value } of Object.values(result.measurements))
            measurements.append(el("li", "X" + x + " Y" + y + " · Z" + value + " мм"));
          host.append(measurements);
        }
        if (!plate && !readOnly && !routeMode && s.current < m.lessonCount(s) - 1)
          host.append(button("Следующее фрезерное задание", { type: "next" }));
        else if (!plate && !readOnly && !routeMode && s.profile < 3)
          host.append(
            button(
              s.profile === 1
                ? "Продолжить · державка и корпус"
                : "Продолжить · наладка и покрытие",
              { type: "upgrade" },
            ),
          );
      }
      if (failedCheck())
        host.append(
          el(
            "p",
            "Отвергнутый путь: X" +
              s.lastCheck.from.x +
              " Y" +
              s.lastCheck.from.y +
              " Z" +
              s.lastCheck.from.z +
              " → X" +
              s.lastCheck.to.x +
              " Y" +
              s.lastCheck.to.y +
              " Z" +
              s.lastCheck.to.z +
              (s.lastCheck.part
                ? " · часть: " +
                  s.lastCheck.part +
                  "; препятствие: " +
                  s.lastCheck.obstacle
                : "") +
              (s.lastCheck.point
                ? " · граница зоны при X" +
                  s.lastCheck.point.x.toFixed(2) +
                  " Y" +
                  s.lastCheck.point.y.toFixed(2) +
                  " Z" +
                  s.lastCheck.point.z.toFixed(2)
                : ""),
            "start-hint",
          ),
        );
      const log = el("details", undefined, "course-reading");
      log.append(
        el("summary", "Журнал траекторий с ошибками · " + s.incidents.length),
      );
      for (const event of s.incidents)
        log.append(
          el(
            "p",
            event.lesson +
              " · " +
              event.code +
              (event.part ? " · " + event.part + " / " + event.obstacle : "") +
              " · " +
              (event.preview ? "найдено на копии" : "движение заблокировано") +
              " · X" +
              event.from.x +
              " Y" +
              event.from.y +
              " Z" +
              event.from.z +
              " → X" +
              event.to.x +
              " Y" +
              event.to.y +
              " Z" +
              event.to.z,
          ),
        );
      host.append(log);
      const limits = el("details", undefined, "course-reading");
      limits.append(
        el("summary", "Геометрия и ограничения профиля"),
        el(
          "p",
          "Плита 60×40×10 мм, фреза Ø6 с осевым врезанием. Сетка 2 мм: снимается материал в центрах ячеек, точная форма стенок и объём не вычисляются. Зона крепления консервативно расширена на радиус фрезы: это запас, а не точный контакт цилиндра в углах. Проверяется весь отрезок движения. G0 внутри исходного габарита запрещён и после снятия материала, кроме вертикального выхода вверх без изменения X/Y. G1 ниже верха допускает только горизонтальный ход или отдельное вертикальное врезание. Максимум 1 мм нового съёма на ячейку. Пределы X−20…80, Y−20…60, Z−12…40. Щуп, контроль поверхности и остановка идеализированы. " +
            (s.profile === 1
              ? "Прежний профиль: державка и корпус не проверяются; после четырёх заданий доступно продолжение."
              : "Новый профиль: державка Ø24 занимает Z вершины +8…+28. Колонна корпуса: X54…62, Y−18…−8, Z−10…35. Фреза, державка, крепление, заготовка и колонна проверяются непрерывно по отрезку, выбирается самый ранний вход. Корпус ограничен одной условной колонной, все остальные узлы станка не моделируются.") +
            " Стойка, G-код, усилия и точная метрология не моделируются. Это вводная ветка, не полный фрезерный симулятор и не допуск к оборудованию.",
        ),
      );
      host.append(limits);
      if (m.task?.id === engine.plate.task.id) host.append(previewPanel ??= routePreview());
      const back = el("button", "Вернуться к курсу", "course-back");
      back.onclick = onDone;
      host.append(back);
    }
    render();
    return host;
  }
  root.CNCMillingCourseUI = Object.freeze({ create });
})(window);
