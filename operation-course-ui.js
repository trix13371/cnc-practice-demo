(function (root) {
  "use strict";
  const m = root.CNCOperationCourse,
    e = (tag, text, cls) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      if (cls) n.className = cls;
      return n;
    };
  function create({
    headingTag = "h3",
    saved,
    readOnly = false,
    routeMode = false,
    onChange = () => true,
    onDone = () => {},
  } = {}) {
    let s = m.restore(saved) || m.create(),
      view = "target",
      notice = "";
    const host = e("section", undefined, "start-session shaft-project-session");
    if (saved && !m.restore(saved)) {
      host.append(
        e(headingTag, "Сохранённое условие недоступно"),
        e(
          "p",
          "Версия задания не поддерживается или журнал повреждён. Сохранённая работа не заменена новой. Экспортируйте её через раздел прогресса.",
        ),
      );
      const back = e("button", "Вернуться к курсу", "course-back");
      back.onclick = onDone;
      host.append(back);
      return host;
    }
    function persist() {
      if (onChange(m.snapshot(s)) === false)
        notice = "Сохранение недоступно. Не закрывайте страницу.";
    }
    function run(a) {
      try {
        s = m.transition(s, a);
        notice = "";
        persist();
      } catch (err) {
        notice = err.message;
      }
      render();
    }
    function b(label, action) {
      const n = e("button", label, "button secondary");
      n.type = "button";
      n.onclick = () => run(typeof action === "function" ? action() : action);
      return n;
    }
    function input(parent, label, value, submit, button) {
      const form = e("form", undefined, "start-answer"),
        wrap = e("label", label, "field"),
        i = e("input");
      i.type = "text";
      i.inputMode = "decimal";
      i.maxLength = 32;
      i.value = value;
      i.setAttribute("aria-label", label);
      wrap.append(i);
      const n = e("button", button, "button secondary");
      n.type = "submit";
      form.append(wrap, n);
      form.onsubmit = (ev) => {
        ev.preventDefault();
        run(submit(i.value));
      };
      parent.append(form);
    }
    function draw(profile, task) {
      let u = 0,
        upper = "",
        lower = [];
      const x = (u) => 50 + u * 8,
        y = (d) => 130 - d * 2.5;
      for (const p of profile.segments) {
        const a = x(u),
          bb = x(u + p.length);
        upper +=
          "L" +
          a +
          " " +
          y(p.diameter) +
          "L" +
          bb +
          " " +
          y(p.endDiameter ?? p.diameter);
        lower.unshift(
          "L" +
            bb +
            " " +
            (260 - y(p.endDiameter ?? p.diameter)) +
            "L" +
            a +
            " " +
            (260 - y(p.diameter)),
        );
        u += p.length;
      }
      const marks = (task.surfaces || [])
        .map(
          (surface) =>
            '<text x="' +
            x(60 + (surface.z0 + surface.z1) / 2) +
            '" y="218" text-anchor="middle">' +
            surface.id +
            '</text><path d="M' +
            x(60 + surface.z1) +
            ' 35V202" stroke="#8199ab" stroke-dasharray="3 4"/>',
        )
        .join("");
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 290" role="img" aria-label="' +
        (view === "target" ? "Требуемый профиль" : "Фактический профиль") +
        '"><g fill="#24465f" font-family="Arial,sans-serif"><path d="M50 130' +
        upper +
        lower.join("") +
        'Z" fill="#cadce8" stroke="#45677e" stroke-width="2"/><path d="M30 130H570" stroke="#8199ab" stroke-dasharray="6 5"/><text x="50" y="245">Z−60</text><text x="550" y="245" text-anchor="end">Z0 · прежний торец</text><text x="35" y="25">' +
        (view === "target" ? "Целевой профиль" : "Снятый металл сохраняется") +
        "</text>" +
        marks +
        '<text x="35" y="278">Размеры — в условии; вид сбоку, не 3D-модель</text></g></svg>'
      );
    }
    function render() {
      const t = m.tasks[s.current],
        st = s.machine,
        accepted = s.done.some((d) => d.id === t.id);
      host.replaceChildren(
        e("p", "ПРАКТИКУМ ОПЕРАЦИЙ · ТОКАРНЫЙ СТАНОК", "eyebrow"),
        e(headingTag, t.title),
        e(
          "p",
          "Задание " +
            (s.current + 1) +
            " из " +
            m.taskCount(s) +
            " · уровень " +
            t.level +
            " · принято " +
            s.done.length,
          "start-value",
        ),
      );
      const list = e("ol");
      m.tasks
        .slice(0, m.taskCount(s))
        .forEach((task, i) =>
          list.append(
            e(
              "li",
              (i < s.current
                ? "✓ "
                : i === s.current
                  ? "Сейчас: "
                  : "Далее: ") + task.title,
            ),
          ),
        );
      const route = e("details", undefined, "course-reading");
      route.append(e("summary", "Темы практикума"), list);
      host.append(
        route,
        e("p", t.goal),
        e("p", t.learn),
        e(
          "p",
          "Заготовка Ø32, вылет 60 мм; зажатые 15 мм отдельно. G54: известный машинный Z торца 100. Требуется T0" +
            t.tool +
            "0" +
            t.tool +
            ". S800, F0.1 / F0.08 — условия упражнения, не рекомендации для материала.",
          "start-note",
        ),
      );
      const views = e("div", undefined, "start-controls");
      for (const [key, label] of [
        ["target", "Чертёж задания"],
        ["actual", "Моя деталь"],
      ]) {
        const n = e("button", label, "button secondary");
        n.type = "button";
        n.setAttribute("aria-pressed", String(view === key));
        n.onclick = () => {
          view = key;
          render();
        };
        views.append(n);
      }
      host.append(views);
      const figure = e("figure", undefined, "shaft-drawing start-board");
      figure.innerHTML = draw(
        view === "target" ? m.expected(t) : st.profile,
        t,
      );
      host.append(figure);
      if (t.surfaces) {
        const surfaceList = e("ul");
        for (const surface of t.surfaces)
          surfaceList.append(
            e(
              "li",
              surface.id +
                " · " +
                surface.title +
                ": Z" +
                surface.z0 +
                "…" +
                surface.z1 +
                ", Ø" +
                surface.diameter +
                (surface.endDiameter !== surface.diameter
                  ? " → Ø" + surface.endDiameter
                  : ""),
            ),
          );
        host.append(surfaceList);
      }
      if (!accepted) {
        if (!s.executed) {
          if (t.forecast) {
            const plan = e("section");
            plan.append(
              e(
                headingTag === "h1" ? "h2" : "h4",
                "1. Разберите чертёж и спрогнозируйте",
              ),
              e(
                "p",
                "Выберите ниже поверхности, обозначенные на схеме, которые должны сохранить исходный диаметр Ø32.",
              ),
            );
            const surfaces = e("div", undefined, "start-controls");
            surfaces.setAttribute("role", "group");
            surfaces.setAttribute("aria-label", "Сохраняемые поверхности");
            for (const surface of t.surfaces) {
              const choice = b(surface.id + " · " + surface.title, {
                type: "surface",
                id: surface.id,
              });
              choice.setAttribute(
                "aria-pressed",
                String(s.selectedSurfaces.includes(surface.id)),
              );
              surfaces.append(choice);
            }
            plan.append(surfaces);
            input(
              plan,
              t.forecast.prompt,
              s.predictionInput,
              (value) => ({ type: "predict", value }),
              "Проверить план",
            );
            if (s.prediction)
              plan.append(
                e(
                  "p",
                  "План согласован. Подтвердите его реальной обработкой модели.",
                  "start-value",
                ),
              );
            if (s.prediction) {
              const completed = e("details", undefined, "course-reading");
              completed.append(
                e("summary", "План согласован · посмотреть или изменить"),
                plan,
              );
              host.append(completed);
            } else host.append(plan);
          }
          if (!t.forecast || s.prediction) {
            const prepared =
              st.referenced &&
              st.clamped &&
              st.tool === t.tool &&
              st.offsets[String(st.tool)]?.calibrated &&
              st.workOffset.confirmed &&
              st.workOffset.z === 100 &&
              st.doorClosed;
            const setupPanel = e("section");
            setupPanel.append(
              e(
                headingTag === "h1" ? "h2" : "h4",
                (t.forecast ? "2" : "1") + ". Подготовьте установку",
              ),
            );
            const setup = e("div", undefined, "start-controls");
            setup.append(
              b("Референс", { type: "machine", action: { type: "reference" } }),
              b("Закрепить", {
                type: "machine",
                action: { type: "clamp", value: true },
              }),
            );
            const toolLabel = e("label", "Инструмент", "field"),
              toolSelect = e("select");
            toolSelect.setAttribute("aria-label", "Инструмент практикума");
            const placeholder = e("option", "Выберите инструмент");
            placeholder.value = "0";
            placeholder.disabled = true;
            placeholder.selected = st.tool === 0;
            toolSelect.append(placeholder);
            for (const [tool, title] of [
              [1, "T0101 · Продольный"],
              [2, "T0202 · Чистовой"],
              [3, "T0303 · Торцевой"],
              [4, "T0404 · Канавочный 2 мм"],
            ]) {
              const option = e("option", title);
              option.value = String(tool);
              option.selected = st.tool === tool;
              toolSelect.append(option);
            }
            toolSelect.onchange = () =>
              run({
                type: "machine",
                action: { type: "tool", tool: Number(toolSelect.value) },
              });
            toolLabel.append(toolSelect);
            setupPanel.append(toolLabel);
            setup.append(
              b("Измерить инструмент щупом", {
                type: "machine",
                action: { type: "preset" },
              }),
              b("Закрыть ограждение", {
                type: "machine",
                action: { type: "door", value: true },
              }),
            );
            setupPanel.append(setup);
            input(
              setupPanel,
              "G54 · машинный Z торца, мм",
              String(st.workOffset.z),
              (v) => ({
                type: "machine",
                action: { type: "workOffset", z: Number(v.replace(",", ".")) },
              }),
              "Подтвердить G54",
            );
            setupPanel.append(
              e(
                "p",
                "Референс " +
                  (st.referenced ? "✓" : "—") +
                  " · заготовка " +
                  (st.clamped ? "✓" : "—") +
                  " · T" +
                  st.tool +
                  " · инструмент " +
                  (st.offsets[String(st.tool)]?.calibrated
                    ? "измерен"
                    : "не измерен") +
                  " · G54 " +
                  st.workOffset.z +
                  " · ограждение " +
                  (st.doorClosed ? "закрыто" : "открыто"),
                "start-value",
              ),
            );
            if (t.forecast && prepared) {
              const completed = e("details", undefined, "course-reading");
              completed.append(
                e(
                  "summary",
                  "Установка подготовлена · посмотреть или изменить",
                ),
                setupPanel,
              );
              host.append(completed);
            } else host.append(setupPanel);
            if (!t.forecast || prepared) {
              host.append(
                e(
                  headingTag === "h1" ? "h2" : "h4",
                  (t.forecast ? "3" : "2") + ". Составьте программу",
                ),
              );
              const label = e("label", "Программа задания", "field"),
                code = e("textarea");
              code.rows = 12;
              code.maxLength = 4000;
              code.spellcheck = false;
              code.value = s.draft;
              code.setAttribute("aria-label", "Программа задания");
              code.oninput = () => {
                s.draft = code.value;
                persist();
                const start = host.querySelector("[data-op-start]");
                if (start)
                  start.disabled = !s.approval || code.value !== s.source;
              };
              label.append(code);
              host.append(
                label,
                b("Проверить на копии", () => ({
                  type: "preview",
                  source: s.draft,
                })),
              );
              const start = b("Запустить проверенную программу", () => ({
                type: "start",
                source: s.draft,
              }));
              start.dataset.opStart = "";
              start.disabled = !s.approval || s.draft !== s.source;
              host.append(start);
            }
          }
        } else {
          host.append(
            e(
              headingTag === "h1" ? "h2" : "h4",
              (t.forecast ? "4" : "3") + ". Выполните и проконтролируйте",
            ),
          );
          host.append(
            e(
              "p",
              "Программа: " +
                st.program.status +
                " · проходов " +
                st.cuts.length +
                " · шпиндель " +
                (st.spindle ? "включён" : "выключен"),
            ),
          );
          if (st.program.status === "running")
            host.append(b("Выполнить до остановки", { type: "run" }));
          host.append(
            b("RESET · прервать цикл", {
              type: "machine",
              action: { type: "reset" },
            }),
          );
          if (st.program.status === "done") {
            if (st.doorClosed)
              host.append(
                b("Открыть ограждение", {
                  type: "machine",
                  action: { type: "door", value: false },
                }),
              );
            host.append(
              e(
                "p",
                "Карта контроля: " +
                  t.points.map(([z, d]) => "Z" + z + ": Ø" + d).join("; "),
              ),
            );
            input(
              host,
              "Сечение Z для микрометра, мм",
              "",
              (v) => ({
                type: "machine",
                action: {
                  type: "measure",
                  z: Number(v.replace(",", ".")),
                  instrument: "micrometer",
                },
              }),
              "Измерить",
            );
            const readings = e("ul");
            for (const r of st.readings)
              readings.append(
                e(
                  "li",
                  "Z" +
                    r.z +
                    " · Ø" +
                    r.reading +
                    " · " +
                    (r.afterCut === st.cuts.length
                      ? "свежий замер"
                      : "устарел"),
                ),
              );
            host.append(readings);
            if (t.depth) {
              host.append(b("Получить осевой отсчёт торца", { type: "depth" }));
              if (s.depthReading !== null)
                host.append(
                  e(
                    "output",
                    "Отсчёт от прежнего торца: " + s.depthReading + " мм",
                  ),
                );
              input(
                host,
                "Запишите осевой съём, мм",
                "",
                (v) => ({ type: "recordDepth", value: v }),
                "Записать отсчёт",
              );
            }
            host.append(b("Принять операцию по контролю", { type: "confirm" }));
          }
          if (!st.spindle && !["running", "hold"].includes(st.program.status))
            host.append(
              b("Новая заготовка · ошибки сохраняются", { type: "restart" }),
            );
        }
        const hint = b(
          s.help.includes(t.id) ? "Разбор открыт" : "Нужен разбор",
          { type: "hint" },
        );
        hint.disabled = s.help.includes(t.id);
        host.append(hint);
        if (s.help.includes(t.id)) host.append(e("p", t.hint, "start-hint"));
      } else {
        host.append(
          e(
            "p",
            "Изготовление и контроль приняты. Разбор " +
              (s.help.includes(t.id) ? "открывался" : "не открывался") +
              "; ошибок " +
              s.errors[s.current] +
              ".",
            "start-value",
          ),
        );
        const record = s.done.find((row) => row.id === t.id);
        host.append(
          e(
            "p",
            record.legacy
              ? "Зачёт прежней версии. Самостоятельность по новым критериям не присваивается."
              : record.independent
                ? "По действующим критериям · без открытия разбора."
                : "По действующим критериям · с разбором.",
          ),
        );
        if (!readOnly && !routeMode && s.version === 1 && s.current === 4)
          host.append(
            b("Продолжить · шесть новых условий", {
              type: "upgrade",
              assignment: m.tasks[5].assignment,
            }),
          );
        else if (!readOnly && !routeMode && s.current < m.taskCount(s) - 1)
          host.append(
            b("Следующая операция", {
              type: "next",
              ...(s.version === 2
                ? { assignment: m.tasks[s.current + 1].assignment }
                : {}),
            }),
          );
        else if (s.current === m.taskCount(s) - 1)
          host.append(
            e(
              "p",
              "Условия этого выпуска пройдены. Результаты и использование разбора сохранены.",
            ),
          );
      }
      const assessment = m.assessment(s);
      if (assessment) {
        const criteria = e("details", undefined, "course-reading"),
          checks = e("ul");
        criteria.append(e("summary", "Что требуется для зачёта"));
        for (const check of assessment.checks)
          checks.append(e("li", (check.passed ? "✓ " : "○ ") + check.title));
        criteria.append(checks);
        host.append(criteria);
      }
      const feedback = e("p", notice || s.feedback, "start-feedback");
      feedback.setAttribute("role", "status");
      host.append(feedback);
      const limits = e("details", undefined, "course-reading");
      limits.append(
        e("summary", "Ограничения проверки"),
        e(
          "p",
          "Общий токарный движок: T0303 торцевание, T0404 канавка 2 мм, T0101 линейный конус. Щуп автоматический. Контроль конуса идеальный; угловая погрешность, шероховатость, усилия и выбег не моделируются. Осевой отсчёт вычислен по геометрии. Это учебная геометрическая проверка, не подтверждение ГОСТ или допуска к оборудованию.",
        ),
      );
      host.append(limits);
      const back = e("button", "Вернуться к курсу", "course-back");
      back.onclick = onDone;
      host.append(back);
    }
    render();
    return host;
  }
  root.CNCOperationCourseUI = Object.freeze({ create });
})(window);
