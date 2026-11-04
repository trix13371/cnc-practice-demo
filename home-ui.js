(function () {
  "use strict";
  let root, onStart;
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const groups = [
    {
      title: "Устройство станка",
      ids: ["meet", "size"],
      copy: "Знакомимся с узлами, инструментом и координатами.",
      art: "chuck",
    },
    {
      title: "Первый проход",
      ids: ["cut"],
      copy: "Задаём размер и наблюдаем, как меняется заготовка.",
      art: "part",
    },
    {
      title: "Обработка и контроль",
      ids: ["measure", "metrology", "cycle", "transfer"],
      copy: "Читаем разрезы, выбираем прибор и подтверждаем размеры детали.",
      art: "gauge",
    },
    {
      title: "G-код",
      ids: ["gcode", "codeFinal"],
      copy: "Читаем команды и выполняем наладку с программой.",
      art: "code",
    },
    {
      title: "Токарные операции",
      ids: ["operations", "turningDeep"],
      copy: "Торец, канавки, конус и самостоятельные программы.",
      art: "part",
    },
    {
      title: "Изделия по чертежам",
      ids: ["projects"],
      copy: "Четыре детали: маршрут, наладка, обработка и контроль.",
      art: "gauge",
    },
    {
      title: "Фрезерный станок XYZ",
      ids: ["milling"],
      copy: "Три оси, паз, глубина, державка и корпус.",
      art: "chuck",
    },
    {
      title: "Диагностика ошибок",
      ids: ["diagnostics"],
      copy: "Находим причины и проверяем исправления на копии.",
      art: "code",
    },
    {
      title: "Самостоятельное изделие",
      ids: ["independentProject"],
      copy: "Свой маршрут, программа с пустого редактора и полный контроль.",
      art: "gauge",
    },
  ];
  const artwork = {
    chuck:
      '<svg viewBox="0 0 150 100" fill="none" aria-hidden="true"><ellipse cx="67" cy="53" rx="34" ry="35" fill="#dde3e8" stroke="#8d9eae"/><ellipse cx="77" cy="51" rx="31" ry="35" fill="#edf0f2" stroke="#8d9eae"/><ellipse cx="79" cy="51" rx="12" ry="15" fill="#c0ccd5" stroke="#8497a7"/><path d="m72 18 13 2-1 21-11-1zM49 65l8-10 17 10-5 10zM99 60l-12-3 6-18 11 4z" fill="#b6c3cd" stroke="#8497a7"/><path d="M32 91h83" stroke="#a8b6c3"/></svg>',
    part: '<svg viewBox="0 0 150 100" fill="none" aria-hidden="true"><path d="m31 31 59-9v53l-59 9z" fill="#cfd8df" stroke="#8b9eae"/><ellipse cx="31" cy="57" rx="13" ry="26" fill="#e6ebef" stroke="#8b9eae"/><ellipse cx="90" cy="48" rx="12" ry="26" fill="#e6ebef" stroke="#8b9eae"/><path d="m89 31 35 7v37l-35-8z" fill="#c5d1db" stroke="#8b9eae"/><ellipse cx="124" cy="56" rx="10" ry="19" fill="#e8edf1" stroke="#8b9eae"/><path d="m24 45 62-10m-62 17 62-10m-61 17 61-10m-60 16 60-10" stroke="#f7f9fa"/></svg>',
    gauge:
      '<svg viewBox="0 0 150 100" fill="none" aria-hidden="true"><path d="M18 25h108v12H18z" fill="#dbe3ea" stroke="#8a9daf"/><path d="M28 12v49l19-11V37m35-23v46L64 49V37" fill="#e5ebf0" stroke="#8a9daf"/><rect x="66" y="21" width="29" height="21" rx="2" fill="#c8d4df" stroke="#8a9daf"/><path d="M36 28v6m8-6v4m8-4v6m8-6v4m43-4v6m8-6v4m8-4v6" stroke="#8a9daf"/><ellipse cx="58" cy="78" rx="24" ry="13" fill="#e2e8ed" stroke="#8a9daf"/><path d="M34 69v10m48-10v10" stroke="#8a9daf"/></svg>',
    code: '<div class="home-code-art" aria-hidden="true"><span>N10&nbsp; G21</span><span>N20&nbsp; G90</span><span>N30&nbsp; G01</span><span>N40&nbsp; M05</span></div>',
  };
  function render() {
    if (!root) return;
    const pending = window.CNCCourseUI?.pendingSession?.();
    const p = window.CNCLearningUI.progress();
    const currentSession = pending?.key === p.next?.target ? pending : null;
    root.replaceChildren();
    const hero = node("div", undefined, "home-hero"),
      intro = node("div", undefined, "home-start-copy");
    intro.append(
      node("p", "ПОШАГОВОЕ ОБУЧЕНИЕ · ОТ НУЛЯ ДО ПЕРВОЙ ДЕТАЛИ", "eyebrow"),
    );
    const phase = {
      independentProject: [
        "Свой маршрут.<br>Собственная программа.",
        "Изготовьте итоговый валик с дополнительным черновым проходом и подтвердите все размеры. Редактор программы — без шаблона.",
      ],
      operations: [
        "От простого прохода —<br>к сложной обработке.",
        "Торцевание, канавки и конус: выбирайте инструмент, создавайте программу и проверяйте результат.",
      ],
      projects: [
        "От отдельных операций —<br>к готовой детали.",
        "Четыре разных чертежа: наладка, программа, измерение и отчёт.",
      ],
      milling: [
        "Три оси.<br>Новые траектории.",
        "От перемещений в воздухе до обработки пазов и проверки столкновений всей сборки.",
      ],
      diagnostics: [
        "Найдите причину.<br>Исправьте программу.",
        "Десять неисправных вариантов: воспроизведите ошибку на копии и проверьте своё исправление.",
      ],
    }[p.next?.group];
    const heading = node("h1");
    heading.innerHTML = p.complete
      ? "Обработка и код.<br>Навыки подтверждены."
      : phase
        ? phase[0]
        : p.cycleComplete
          ? "От первой детали —<br>к программе ЧПУ."
          : p.introComplete
            ? "От первого прохода —<br>к полному циклу."
            : "От первого шага —<br>к первой детали.";
    intro.append(heading);
    intro.append(
      node(
        "p",
        p.complete
          ? "Вы прошли учебный путь. Возвращайтесь к сложным темам и закрепляйте навыки на новых деталях."
          : phase
            ? phase[1]
            : p.cycleComplete
              ? "Научитесь читать движения инструмента и составьте программу для другого чертежа."
              : p.introComplete
                ? "Подготовьте станок, выполните обработку и подтвердите результат измерением."
                : "Курс с нуля: токарная и фрезерная обработка, программы, контроль и диагностика. Практические задания включены в общий маршрут.",
        "home-copy",
      ),
    );
    const actions = node("div", undefined, "home-action-row"),
      start = node(
        "button",
        p.complete
          ? "Посмотреть результаты"
          : p.done || currentSession
            ? "Продолжить обучение"
            : "Начать обучение",
        "button primary",
      );
    start.type = "button";
    start.dataset.homeStart = "";
    start.append(node("span", "→", "button-arrow"));
    start.addEventListener(
      "click",
      p.complete ? () => window.CNCWorkshop.results() : onStart,
    );
    const meter = node("div", undefined, "home-progress"),
      caption = node(
        "p",
        "Выполнено " + p.done + " / " + p.total,
        "home-caption",
      ),
      bar = node("progress");
    bar.max = p.total;
    bar.value = p.done;
    bar.setAttribute("aria-label", "Шаги учебного пути");
    meter.append(caption, bar);
    actions.append(start, meter);
    intro.append(actions);
    if (p.done && window.CNCStartSessionUI) {
      const first = node(
        "button",
        "Первое знакомство со станком",
        "course-back",
      );
      first.type = "button";
      first.addEventListener("click", () =>
        window.CNCCourseUI.openIntroduction(),
      );
      intro.append(first);
    }
    if (window.CNCDrawingSessionUI) {
      const d = node("button", "Деталь и измерение", "course-back");
      d.type = "button";
      d.addEventListener("click", () => window.CNCCourseUI.openDrawing());
      intro.append(d);
    }
    if (window.CNCFirstProcessUI) {
      const f = node("button", "Координаты и первый процесс", "course-back");
      f.type = "button";
      f.addEventListener("click", () => window.CNCCourseUI.openFirstProcess());
      intro.append(f);
    }
    if (window.CNCProgramSetupUI) {
      const ps = node("button", "Программа и наладка", "course-back");
      ps.type = "button";
      ps.addEventListener("click", () => window.CNCCourseUI.openProgramSetup());
      intro.append(ps);
    }
    if (window.CNCShaftProjectUI) {
      const project = node(
        "button",
        "Проект: ступенчатый валик",
        "course-back",
      );
      project.type = "button";
      project.addEventListener("click", () =>
        window.CNCCourseUI.openShaftProject(),
      );
      intro.append(project);
    }
    if (window.CNCOperationCourseUI) {
      const op = node(
        "button",
        "Токарные операции · торец, канавки, конус",
        "course-back",
      );
      op.type = "button";
      op.onclick = () => window.CNCCourseUI.openOperations();
      intro.append(op);
    }
    if (window.CNCMillingCourseUI) {
      const mill = node(
        "button",
        "Фрезерный станок XYZ · траектории и ошибки",
        "course-back",
      );
      mill.type = "button";
      mill.onclick = () => window.CNCCourseUI.openMilling();
      intro.append(mill);
    }
    if (window.CNCDiagnosticCourseUI) {
      const d = node(
        "button",
        "Диагностика · причины и исправления",
        "course-back",
      );
      d.type = "button";
      d.onclick = () => window.CNCCourseUI.openDiagnostics();
      intro.append(d);
    }
    const preparation = node("details", undefined, "home-preparation");
    preparation.append(node("summary", "Занятия и проекты · выбрать тему"));
    for (const entry of [...intro.children].filter(
      (e) => e.className === "course-back",
    ))
      preparation.append(entry);
    if (preparation.children.length > 1) intro.append(preparation);
    if (!p.complete)
      intro.append(
        node(
          "p",
          currentSession
            ? "Продолжаем: " +
                currentSession.title +
                " · действие " +
                (currentSession.step + 1) +
                " из " +
                currentSession.total
            : "Следующий шаг: " + p.next.title,
          "home-next-step",
        ),
      );
    const art = node("figure", undefined, "home-product");
    art.setAttribute("role", "img");
    art.setAttribute(
      "aria-label",
      "Патрон токарного станка со ступенчатой заготовкой и резец",
    );
    art.append(
      node(
        "figcaption",
        "ТОЧНОСТЬ НАЧИНАЕТСЯ С ПРАКТИКИ",
        "home-product-caption",
      ),
    );
    hero.append(intro, art);
    root.append(hero);
    const route = node("div", undefined, "home-route");
    route.setAttribute("aria-label", "Разделы курса");
    for (const [i, g] of groups.entries()) {
      const items = p.items.filter((item) => g.ids.includes(item.group)),
        done = items.filter((item) => item.done).length,
        current = items.some((item) => item.id === p.next?.id),
        available = current || done > 0;
      const card = node("button", undefined, "home-route-card");
      card.type = "button";
      card.disabled = !available;
      card.dataset.current = String(current);
      card.dataset.done = String(done === items.length);
      card.setAttribute(
        "aria-label",
        g.title +
          ": " +
          done +
          " из " +
          items.length +
          " шагов" +
          (available ? "" : ", откроется позже"),
      );
      card.append(
        node(
          "span",
          done === items.length ? "✓" : String(i + 1).padStart(2, "0"),
          "home-route-number",
        ),
        node("strong", g.title),
        node("p", g.copy),
      );
      const picture = node("div", undefined, "home-route-art");
      picture.innerHTML = artwork[g.art];
      card.append(
        picture,
        node(
          "small",
          done === items.length
            ? "Пройдено"
            : current
              ? "Начать этот этап"
              : done
                ? done + " из " + items.length + " шагов"
                : "Откроется дальше",
          "home-route-status",
        ),
        node("span", available ? "↗" : "—", "home-route-arrow"),
      );
      card.addEventListener("click", () => {
        const item = current ? p.next : items.find((item) => item.done);
        if (item) window.CNCLearningUI.open(item.id);
      });
      route.append(card);
    }
    root.append(route);
    const outline = node("details", undefined, "course-outline");
    outline.append(node("summary", "Подробная программа · этапов: " + p.total));
    const list = node("ol", undefined, "home-path learning-path-cards");
    for (const [i, g] of p.groups.entries()) {
      const li = node("li");
      li.dataset.done = String(g.complete);
      li.append(
        node("span", g.complete ? "✓" : String(i + 1).padStart(2, "0")),
        node("strong", g.name),
        node("small", g.done + " из " + g.total + " шагов"),
      );
      const steps = node("ul");
      for (const item of p.items.filter((s) => s.group === g.id)) {
        const row = node("li"),
          b = node("button", (item.done ? "✓ " : "") + item.title);
        b.type = "button";
        b.disabled = !item.done && p.next?.id !== item.id;
        b.setAttribute(
          "aria-current",
          p.next?.id === item.id ? "step" : "false",
        );
        b.addEventListener("click", () => window.CNCLearningUI.open(item.id));
        row.append(b);
        steps.append(row);
      }
      li.append(steps);
      list.append(li);
    }
    outline.append(list);
    root.append(outline);
    root.append(
      node(
        "p",
        "Учебный тренажёр помогает разобраться в принципах обработки. Работа на реальном станке требует инструктажа и допуска.",
        "home-note",
      ),
    );
  }
  window.CNCHomeUI = {
    mount(parent, start) {
      onStart = start;
      root = node("section", undefined, "home-screen");
      root.hidden = true;
      parent.insertBefore(root, parent.querySelector("footer"));
      render();
      return root;
    },
    render,
  };
})();
