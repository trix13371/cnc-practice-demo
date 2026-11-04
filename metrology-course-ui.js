(function (root) {
  "use strict";
  const m = root.CNCMetrologyCourse,
    mm = (n) => (n / 1000).toFixed(3).replace(".", ","),
    e = (tag, text, cls) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (cls) el.className = cls;
      return el;
    };
  function create({
    headingTag = "h3",
    saved,
    readOnly = false,
    routeMode = false,
    onChange = () => true,
    onDone = () => {},
  } = {}) {
    const host = e("section", undefined, "start-session shaft-project-session");
    let s = saved ? m.restore(saved) : m.create(),
      view = "section",
      notice = "";
    if (!s) {
      host.append(
        e(headingTag, "Сохранённый контроль недоступен"),
        e(
          "p",
          "Неизвестная версия или повреждённый журнал. Исходная работа не заменена новой.",
        ),
      );
      return host;
    }
    function persist() {
      if (onChange(m.snapshot(s)) === false)
        notice = "Не удалось сохранить. Не закрывайте страницу.";
    }
    function run(a) {
      try {
        s = m.transition(s, a);
        notice = "";
        persist();
      } catch (error) {
        notice = error.message;
      }
      render();
    }
    function button(label, a) {
      const b = e("button", label, "button secondary");
      b.type = "button";
      b.onclick = () => run(typeof a === "function" ? a() : a);
      return b;
    }
    function field(label, key) {
      const wrap = e("label", label, "field"),
        input = e("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.maxLength = 32;
      input.value = s.draft[key];
      input.setAttribute("aria-label", label);
      input.oninput = () => {
        s.draft[key] = input.value;
        persist();
      };
      wrap.append(input);
      return wrap;
    }
    function form(labels, action, label) {
      const f = e("form", undefined, "start-answer");
      for (const [name, key] of labels) f.append(field(name, key));
      const b = e("button", label, "button secondary");
      b.type = "submit";
      f.append(b);
      f.onsubmit = (ev) => {
        ev.preventDefault();
        run(action());
      };
      return f;
    }
    function art(t) {
      const section = view === "section",
        hole = t.section !== "solid" && section,
        blind = t.section === "blind",
        stepped = t.surfaces.filter((v) => v.kind === "outer").length > 1;
      const outer = t.surfaces.find((v) => v.kind === "outer"),
        inner = t.surfaces.find((v) => v.kind === "inner"),
        half = inner ? (65 * inner.nominal) / outer.nominal : 0,
        holeStart = blind ? 550 - (460 * 20) / 55 : 90;
      const outline = stepped
        ? "M90 90H390V98H550V212H390V220H90Z"
        : "M90 90H550V220H90Z";
      return (
        '<svg viewBox="0 0 660 ' +
        (hole ? 330 : 290) +
        '" role="img" aria-label="Учебная схема: ' +
        (section ? "продольный разрез" : "вид сбоку") +
        (hole
          ? "; штриховка — материал, светлая область — полость; B указывает на внутреннюю поверхность отверстия"
          : "") +
        '"><defs><marker id="met-leader" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#365b76"/></marker><pattern id="met-hatch" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10L10 0" stroke="#a9bdca"/></pattern></defs><path d="' +
        outline +
        '" fill="' +
        (section ? "url(#met-hatch)" : "#d7e3ed") +
        '" stroke="#365b76" stroke-width="2"/>' +
        (hole
          ? '<rect x="' +
            (holeStart - (blind ? 0 : 1)) +
            '" y="' +
            (155 - half) +
            '" width="' +
            (551 - holeStart + (blind ? 0 : 1)) +
            '" height="' +
            2 * half +
            '" fill="#fff"/><path d="M' +
            holeStart +
            " " +
            (155 - half) +
            "H550M" +
            holeStart +
            " " +
            (155 + half) +
            "H550" +
            (blind
              ? "M" + holeStart + " " + (155 - half) + "V" + (155 + half)
              : "") +
            '" fill="none" stroke="#365b76" stroke-width="2"/>'
          : "") +
        '<path d="M60 155H590" stroke="#8299aa" stroke-dasharray="7 5"/>' +
        (stepped
          ? '<text x="160" y="75">B · база</text><text x="400" y="75">A · шейка</text>'
          : '<text x="145" y="65">A · наружная поверхность</text><path d="M300 72V90" fill="none" stroke="#365b76" stroke-width="1.5" marker-end="url(#met-leader)"/>') +
        (hole
          ? '<path d="M400 282V258L480 ' +
            (155 + half) +
            '" fill="none" stroke="#365b76" stroke-width="1.5" marker-end="url(#met-leader)"/><text x="400" y="307" text-anchor="middle">B · поверхность отверстия</text>'
          : "") +
        '<text x="90" y="260">Z−55</text><text x="550" y="260" text-anchor="end">Z0 · торец</text><text x="90" y="28">' +
        (section ? "Продольный разрез" : "Вид сбоку · внутренность скрыта") +
        "</text></svg>"
      );
    }
    function render() {
      const t = m.tasks[s.current],
        accepted = s.done.some((r) => r.id === t.id),
        surface = t.surfaces.find((v) => v.id === s.surface),
        g = m.instruments[s.instrument];
      host.replaceChildren(
        e(
          "p",
          "ЧЕРТЁЖ И КОНТРОЛЬ · " + (s.current + 1) + " / " + m.tasks.length,
          "eyebrow",
        ),
        e(headingTag, t.title),
        e("p", t.goal),
      );
      const reading = e("details", undefined, "course-reading");
      reading.append(e("summary", "Как рассуждать"), e("p", t.reading));
      if (t.mode === "guided")
        reading.append(
          e(
            "p",
            "Пример на других числах: разрешено 9,80…10,20 мм; отсчёт 10,05 при границе ошибки ±0,03 даёт 10,02…10,08. Этот интервал внутри допуска. В своём задании используйте его размеры и прибор.",
          ),
        );
      host.append(reading);
      const views = e("div", undefined, "start-controls");
      for (const [key, label] of [
        ["side", "Вид сбоку"],
        ["section", "Разрез"],
      ]) {
        const b = e("button", label, "button secondary");
        b.type = "button";
        b.setAttribute("aria-pressed", String(view === key));
        b.onclick = () => {
          view = key;
          render();
        };
        views.append(b);
      }
      const figure = e("figure", undefined, "shaft-drawing start-board");
      figure.innerHTML = art(t);
      if (t.surfaces.some((v) => v.kind === "inner"))
        figure.append(
          e(
            "figcaption",
            view === "section"
              ? "Штриховка — материал детали. Светлая область — полость отверстия. Стрелка B указывает на внутреннюю поверхность, по которой измеряют диаметр."
              : "На виде сбоку внутренняя поверхность скрыта. Чтобы увидеть отверстие, выберите «Разрез».",
          ),
        );
      host.append(views, figure);
      const requirements = e("ul");
      for (const v of t.surfaces)
        requirements.append(
          e(
            "li",
            v.id +
              " · " +
              v.title +
              ": Ø" +
              mm(v.nominal) +
              "; отклонения " +
              mm(v.lower - v.nominal) +
              " / +" +
              mm(v.upper - v.nominal) +
              " мм",
          ),
        );
      host.append(requirements);
      if (!accepted && !readOnly) {
        host.append(
          e("p", "Определите по разрезу внутреннее устройство детали."),
        );
        const kinds = e("div", undefined, "start-controls");
        for (const [value, label] of [
          ["solid", "Сплошная"],
          ["blind", "Глухое отверстие"],
          ["through", "Сквозное отверстие"],
        ]) {
          const b = button(label, { type: "section", value });
          b.setAttribute("aria-pressed", String(s.section === value));
          kinds.append(b);
        }
        host.append(kinds);
        if (s.section === t.section) {
          const choices = e("div", undefined, "start-controls");
          for (const v of t.surfaces) {
            const b = button(v.id + " · " + v.title, {
              type: "surface",
              id: v.id,
            });
            b.setAttribute("aria-pressed", String(s.surface === v.id));
            choices.append(b);
          }
          host.append(
            e("p", "Выберите поверхность для текущего контроля."),
            choices,
          );
          if (surface) {
            const label = e("label", "Измерительный прибор", "field"),
              select = e("select");
            select.setAttribute("aria-label", "Прибор контроля");
            const empty = e("option", "Выберите прибор");
            empty.value = "";
            empty.disabled = true;
            empty.selected = !g;
            select.append(empty);
            for (const [id, tool] of Object.entries(m.instruments)) {
              const o = e("option", tool.title);
              o.value = id;
              o.selected = s.instrument === id;
              select.append(o);
            }
            select.onchange = () =>
              run({ type: "instrument", id: select.value });
            label.append(select);
            host.append(label);
            if (g) {
              host.append(
                e(
                  "p",
                  "Учебный паспорт: диапазон " +
                    mm(g.range[0]) +
                    "…" +
                    mm(g.range[1]) +
                    " мм; дискретность " +
                    mm(g.resolution) +
                    "; заданная граница ошибки ±" +
                    mm(g.error) +
                    " мм.",
                  "start-note",
                ),
                button("Убрать контролируемую деталь", { type: "release" }),
                button(
                  g.reference
                    ? "Проверить установку по эталону " +
                        mm(g.reference) +
                        " мм"
                    : "Проверить ноль без детали",
                  { type: "zero" },
                ),
              );
              if (s.zeroed.includes(s.instrument))
                host.append(
                  e("p", "Установка прибора проверена.", "start-value"),
                );
              const points = e("div", undefined, "start-controls");
              for (const p of surface.points)
                points.append(
                  button(
                    "Контакт · " +
                      surface.id +
                      " · сечение " +
                      p.id +
                      " · Z" +
                      p.z +
                      " мм",
                    { type: "contact", point: p.id },
                  ),
                );
              host.append(points);
              if (s.contact)
                host.append(
                  e(
                    "output",
                    "Дисплей: " +
                      mm(s.contact.reading) +
                      " мм · " +
                      s.contact.surface +
                      " / " +
                      s.contact.point,
                    "start-value",
                  ),
                  form(
                    [["Запишите отсчёт, мм", "reading"]],
                    () => ({ type: "record", value: s.draft.reading }),
                    "Записать измерение",
                  ),
                );
            }
            host.append(
              form(
                [
                  ["Нижний предел, мм", "lower"],
                  ["Верхний предел, мм", "upper"],
                ],
                () => ({
                  type: "limits",
                  lower: s.draft.lower,
                  upper: s.draft.upper,
                }),
                "Записать пределы " + surface.id,
              ),
            );
          }
        }
        if (t.revised && s.initialReviewed && !s.revision)
          host.append(
            button("Получить деталь после доработки", { type: "revision" }),
          );
      }
      if (s.records.length) {
        const log = e("ul");
        for (const r of s.records)
          log.append(
            e(
              "li",
              r.surface +
                " / сечение " +
                r.point +
                " · " +
                mm(r.reading) +
                " мм · " +
                m.instruments[r.instrument].title +
                " · редакция " +
                r.revision +
                (r.revision !== s.revision ? " · устарело" : ""),
            ),
          );
        host.append(e("p", "Протокол измерений"), log);
      }
      if (!accepted && !readOnly) {
        const decisions = e("div", undefined, "start-controls");
        for (const [value, label] of [
          ["accept", "Подтвердить по размеру"],
          ["reject", "Отклонить по размеру"],
          ["uncertain", "Требуется уточнение"],
        ])
          decisions.append(button(label, { type: "verdict", value }));
        const hint = button(
          s.help.includes(t.id) ? "Разбор открыт" : "Нужен разбор",
          { type: "hint" },
        );
        hint.disabled = s.help.includes(t.id);
        host.append(decisions, hint);
        if (s.help.includes(t.id)) host.append(e("p", t.hint, "start-hint"));
      }
      if (accepted) {
        const record = s.done.find((r) => r.id === t.id);
        host.append(
          e(
            "p",
            "Контроль принят · " +
              (record.independent ? "без открытия разбора" : "с разбором"),
            "start-value",
          ),
        );
        if (!readOnly && !routeMode && s.current < m.tasks.length - 1)
          host.append(
            button("Следующее условие", {
              type: "next",
              assignment: m.tasks[s.current + 1].assignment,
            }),
          );
      }
      const status = e("p", notice || s.feedback, "start-feedback");
      status.setAttribute("role", "status");
      host.append(status);
      const scope = e("details", undefined, "course-reading");
      scope.append(
        e("summary", "Границы учебной проверки"),
        e(
          "p",
          "Здесь измеряются заданные размеры учебных редакций. Границы ошибки приборов и правило интервалов заданы моделью, не нормативной методикой ГОСТ 8.051. Температура, усилие, форма и шероховатость не моделируются. Постатейная проверка источников и предметная приёмка преподавателем ещё требуются.",
        ),
      );
      host.append(scope);
      root.CNCNormativeUI?.appendLesson(host, "control");
      const back = e("button", "Вернуться к курсу", "course-back");
      back.onclick = onDone;
      host.append(back);
    }
    render();
    return host;
  }
  root.CNCMetrologyCourseUI = Object.freeze({ create });
})(window);
