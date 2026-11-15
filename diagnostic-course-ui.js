(function (root) {
  "use strict";
  const engine = root.CNCDiagnosticCourse;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const mm = (n) =>
    Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
  const coords = (p) =>
    p
      ? Object.entries(p)
          .map(([k, v]) => k.toUpperCase() + " " + mm(v))
          .join(" · ")
      : "нет движения";
  function create({
    model: m = engine,
    headingTag = "h3",
    saved,
    readOnly = false,
    routeMode = false,
    onChange = () => true,
    onDone = () => {},
  } = {}) {
    let s = saved ? m.restore(saved) : m.create(),
      notice = "";
    const host = el(
      "section",
      undefined,
      "start-session shaft-project-session diagnostic-course",
    );
    const focusTargets = {};
    if (!s) {
      host.append(
        el(headingTag, "Сохранённая диагностика недоступна"),
        el(
          "p",
          "Неизвестная версия или повреждённый журнал. Исходная работа не заменена новой.",
        ),
      );
      return host;
    }
    function save() {
      if (onChange(m.snapshot(s)) === false)
        notice = "Сохранение недоступно. Не закрывайте страницу.";
    }
    function run(a) {
      let target = "status";
      try {
        s = m.transition(s, a);
        notice = "";
        save();
        target =
          a.type === "inspect"
            ? "original"
            : a.type === "repair"
              ? "repair"
              : a.type === "next"
                ? "title"
                : "status";
      } catch (e) {
        notice = e.message;
      }
      render(target);
    }
    function button(text, a, primary = false) {
      const n = el(
        "button",
        text,
        "button " + (primary ? "primary" : "secondary"),
      );
      n.type = "button";
      n.onclick = () => run(typeof a === "function" ? a() : a);
      return n;
    }
    function select(label, key, options) {
      const wrap = el("label", label, "field"),
        input = el("select");
      input.setAttribute("aria-label", label);
      for (const [value, title] of options) {
        const o = el("option", title);
        o.value = value;
        o.selected = s.draft[key] === value;
        input.append(o);
      }
      input.value = s.draft[key];
      input.onchange = () => {
        s.draft[key] = input.value;
        save();
      };
      wrap.append(input);
      return wrap;
    }
    function input(label, key) {
      const wrap = el("label", label, "field"),
        n = el("input");
      n.type = "text";
      n.inputMode = "decimal";
      n.maxLength = 32;
      n.value = s.draft[key];
      n.setAttribute("aria-label", label);
      n.oninput = () => {
        s.draft[key] = n.value;
        save();
      };
      wrap.append(n);
      return wrap;
    }
    function sourceList(source, row) {
      const list = el("ol", undefined, "ps-code");
      source.split(/\r?\n/).forEach((line, i) => {
        const item = el("li", line || " ");
        if (i + 1 === row) {
          item.className = "is-current";
          item.setAttribute(
            "aria-label",
            "Строка " + row + " · первый отказ: " + line,
          );
        }
        list.append(item);
      });
      return list;
    }
    function latheArt(result) {
      const x = (z) => 520 + z * 7,
        y = (v) => 180 - v * 2.2;
      let u = 0,
        d = "M" + x(-60) + " 180",
        lower = [];
      const profile = result.profile;
      for (const seg of profile?.segments || [{ length: 60, diameter: 32 }]) {
        const a = x(-60 + u),
          b = x(-60 + u + seg.length);
        d +=
          "L" +
          a +
          " " +
          y(seg.diameter) +
          "L" +
          b +
          " " +
          y(seg.endDiameter ?? seg.diameter);
        lower.unshift(
          "L" +
            b +
            " " +
            (360 - y(seg.endDiameter ?? seg.diameter)) +
            "L" +
            a +
            " " +
            (360 - y(seg.diameter)),
        );
        u += seg.length;
      }
      let svg =
        '<svg viewBox="0 0 640 330" role="img" aria-label="Токарная проверка: профиль и отвергнутое движение; X по диаметру, Z вдоль детали"><rect x="55" y="95" width="45" height="170" fill="#a9bdca"/><path d="' +
        d +
        lower.join("") +
        'Z" fill="#d7e3ed" stroke="#365b76" stroke-width="2"/><path d="M80 180H610" stroke="#8299aa" stroke-dasharray="6 5"/>';
      for (const p of result.path || [])
        svg +=
          '<path d="M' +
          x(p.from.z) +
          " " +
          y(p.from.x) +
          "L" +
          x(p.to.z) +
          " " +
          y(p.to.x) +
          '" fill="none" stroke="#2c7453" stroke-width="2"/>';
      const f = result.incident,
        from = f?.before.coordinates.actual,
        to = f?.command?.actual;
      if (from) {
        svg +=
          '<circle cx="' +
          x(from.z) +
          '" cy="' +
          y(from.x) +
          '" r="5" fill="#2458ee"/>';
        if (to)
          svg +=
            '<path d="M' +
            x(from.z) +
            " " +
            y(from.x) +
            "L" +
            x(to.z) +
            " " +
            y(to.x) +
            '" fill="none" stroke="#b83245" stroke-width="3" stroke-dasharray="7 4"/><circle cx="' +
            x(to.z) +
            '" cy="' +
            y(to.x) +
            '" r="5" fill="#fff" stroke="#b83245" stroke-width="2"/>';
      }
      return (
        svg +
        '<text x="105" y="298">Z −60</text><text x="520" y="298" text-anchor="end">Z 0 · исходный торец</text><text x="105" y="30">X — диаметр; Z — длина, мм</text></svg>'
      );
    }
    function millArt(result, projection) {
      const c = root.CNCMillingCourse.config,
        x = (v) => 80 + (v + 20) * 4.2;
      const yz = projection === "XY",
        y = (v) => (yz ? 225 - (v + 20) * 2.2 : 245 - (v + 12) * 2.8);
      const axes = yz ? ["x", "y"] : ["x", "z"];
      const rect = (x0, x1, y0, y1, color) =>
        '<rect x="' +
        x(x0) +
        '" y="' +
        y(y1) +
        '" width="' +
        (x1 - x0) * 4.2 +
        '" height="' +
        Math.abs(y(y0) - y(y1)) +
        '" fill="' +
        color +
        '" stroke="#365b76"/>';
      let svg =
        '<svg viewBox="0 0 640 320" role="img" aria-label="Фрезерная проверка, проекция ' +
        projection +
        '">' +
        rect(0, 60, yz ? 0 : -10, yz ? 40 : 0, "#d7e3ed") +
        rect(
          c.clamp.x0,
          c.clamp.x1,
          yz ? c.clamp.y0 : c.clamp.z0,
          yz ? c.clamp.y1 : c.clamp.z1,
          "#d9c3aa",
        ) +
        rect(
          c.body.x0,
          c.body.x1,
          yz ? c.body.y0 : c.body.z0,
          yz ? c.body.y1 : c.body.z1,
          "#c8bbd7",
        );
      for (const p of result.log || [])
        svg +=
          '<path d="M' +
          x(p.from.x) +
          " " +
          y(p.from[axes[1]]) +
          "L" +
          x(p.to.x) +
          " " +
          y(p.to[axes[1]]) +
          '" fill="none" stroke="' +
          (p.code ? "#b83245" : "#2c7453") +
          '" stroke-width="3"' +
          (p.code ? ' stroke-dasharray="7 4"' : "") +
          "/>";
      const f = result.incident,
        from = f?.before.position;
      if (from) {
        svg +=
          '<circle cx="' +
          x(from.x) +
          '" cy="' +
          y(from[axes[1]]) +
          '" r="5" fill="#2458ee"/>';
        if (yz)
          svg +=
            '<ellipse cx="' +
            x(from.x) +
            '" cy="' +
            y(from.y) +
            '" rx="' +
            c.radius * 4.2 +
            '" ry="' +
            c.radius * 2.2 +
            '" fill="none" stroke="#2458ee"/>';
        else
          svg +=
            rect(
              from.x - c.radius,
              from.x + c.radius,
              from.z,
              from.z + 15,
              "#b5ccde",
            ) +
            rect(
              from.x - c.holder.radius,
              from.x + c.holder.radius,
              from.z + c.holder.z0,
              from.z + c.holder.z1,
              "#aab8ce",
            );
        if (yz)
          svg +=
            '<ellipse cx="' +
            x(from.x) +
            '" cy="' +
            y(from.y) +
            '" rx="' +
            c.holder.radius * 4.2 +
            '" ry="' +
            c.holder.radius * 2.2 +
            '" fill="none" stroke="#526c90" stroke-dasharray="5 3"/>';
        svg +=
          '<circle cx="' +
          x(from.x) +
          '" cy="' +
          y(from[axes[1]]) +
          '" r="5" fill="#2458ee"/>';
      }
      return (
        svg +
        '<text x="80" y="28">' +
        (yz ? "Вид сверху · X/Y" : "Вид сбоку · X/Z") +
        '</text><text x="80" y="282">Светлый — заготовка; бежевый — крепление</text><text x="80" y="306">Фиолетовый — колонна корпуса</text></svg>'
      );
    }
    function panel(t, result, label, source, key) {
      const wrap = el("section"),
        title = el("h3", label);
      title.tabIndex = -1;
      title.dataset.diagnosticPanel = key;
      focusTargets[key] = title;
      wrap.append(title);
      const f = result.incident;
      if (f) {
        wrap.append(
          el(
            "p",
            "Строка " + f.row + " · первый отказ [" + f.code + "]",
            "start-value",
          ),
          el("pre", f.raw),
          el("p", result.message),
        );
        const info = el("dl", undefined, "diagnostic-facts");
        const add = (a, b) => {
          info.append(el("dt", a), el("dd", b));
        };
        if (t.kind === "lathe") {
          add(
            "До строки · рабочие координаты",
            coords(f.before.coordinates.work),
          );
          add(
            "До строки · фактическая вершина",
            coords(f.before.coordinates.actual),
          );
          add("Запрошено программой", coords(f.command?.work));
          add("Запрошенное фактическое положение", coords(f.command?.actual));
          add(
            "Исходная наладка",
            "T0" +
              f.before.tool +
              "0" +
              f.before.tool +
              " · G54 Z" +
              mm(f.before.workOffset.z) +
              " · вращение " +
              (f.before.spindle ? "включено" : "выключено"),
          );
        } else {
          add("Положение до отвергнутого отрезка", coords(f.before.position));
          add("Запрошенная точка", coords(f.command.actual));
          if (f.part || f.obstacle)
            add(
              "Часть сборки / препятствие",
              [f.part, f.obstacle].filter(Boolean).join(" / "),
            );
          add("Вращение", f.before.spindle ? "включено" : "выключено");
        }
        wrap.append(info);
      } else
        wrap.append(
          el(
            "p",
            result.ok
              ? "Все движения проверки допустимы. Итог также сравнивается с заданием."
              : result.message,
            "start-value",
          ),
        );
      for (const projection of t.kind === "mill" ? ["XY", "XZ"] : ["XZ"]) {
        const figure = el("figure", undefined, "shaft-drawing start-board");
        figure.innerHTML =
          t.kind === "mill" ? millArt(result, projection) : latheArt(result);
        figure.append(
          el(
            "figcaption",
            f
              ? "Синяя точка — положение до отказа. Красный пунктир — отвергнутое движение, оно не выполнено. Зелёный — выполненные движения копии."
              : "Показан результат отдельной проверки, он не заменяет изготовление изделия.",
          ),
        );
        wrap.append(figure);
      }
      if (t.kind === "mill")
        wrap.append(
          el(
            "p",
            "Сравнивайте оба вида: в каждой проекции скрыта одна координата. Габариты фрезы/державки показаны до отвергнутого движения.",
            "start-note",
          ),
        );
      const code = el("details", undefined, "course-reading");
      code.append(
        el("summary", "Полный текст проверенного варианта"),
        sourceList(source, f?.row),
      );
      wrap.append(code);
      return wrap;
    }
    function render(focus) {
      const t = m.tasks[s.current],
        accepted = s.done.some((d) => d.id === t.id),
        title = el(headingTag, t.title);
      title.tabIndex = -1;
      host.replaceChildren(
        el(
          "p",
          "ДИАГНОСТИКА · " +
            (t.kind === "lathe" ? "ТОКАРНЫЙ" : "ФРЕЗЕРНЫЙ") +
            " СТАНОК",
          "eyebrow",
        ),
        title,
        el(
          "p",
          "Задание " +
            (s.current + 1) +
            " из " +
            m.tasks.length +
            " · принято " +
            s.done.length,
          "start-value",
        ),
        el("p", t.goal),
      );
      const theory = el("details", undefined, "course-reading");
      theory.append(
        el("summary", "Что нужно знать перед проверкой"),
        el("p", t.learn),
      );
      host.append(theory);
      const originalCode = el("details", undefined, "course-reading");
      originalCode.open = !s.inspected;
      originalCode.append(
        el("summary", "Исходный вариант с ошибкой"),
        sourceList(t.bad, s.originalResult?.incident?.row),
      );
      originalCode.append(
        el(
          "p",
          t.kind === "lathe"
            ? "Исходно: T0" +
                t.tool +
                "0" +
                t.tool +
                " · G54 Z" +
                t.zero +
                "; заготовка Ø32, вылет 60 мм и отдельный зажим 15 мм."
            : "Исходная точка: " +
                coords({ x: t.start[0], y: t.start[1], z: t.start[2] }) +
                ". Координаты XYZ линейные, Z0 — верх заготовки.",
        ),
      );
      if (!s.inspected) host.append(originalCode);
      if (!s.inspected && !accepted && !readOnly)
        host.append(
          button(
            s.inspected
              ? "Повторить исходную проверку"
              : "1. Проверить исходный вариант на копии",
            { type: "inspect" },
            !s.inspected,
          ),
        );
      if (s.originalResult)
        host.append(
          panel(t, s.originalResult, "Исходная проверка", t.bad, "original"),
        );
      if (s.inspected && !accepted && !readOnly) {
        host.append(
          el("h3", "2. Укажите причину и исправьте вариант"),
          select("Какую причину вы исправляете?", "cause", [
            ["", "Выберите причину"],
            ...t.choices.map((k) => [k, m.causes[k]]),
          ]),
        );
        if (t.kind === "lathe")
          host.append(
            select("Инструмент для проверки", "tool", [
              ["1", "T0101 · проходной"],
              ["3", "T0303 · торцевой"],
              ["4", "T0404 · канавочный 2 мм"],
            ]),
            input("G54 · машинный Z торца, мм", "zero"),
          );
        else {
          const label = el("label", "Шпиндель включён на копии", "field"),
            check = el("input");
          check.type = "checkbox";
          check.checked = s.draft.spindle;
          check.setAttribute("aria-label", "Шпиндель включён на копии");
          check.onchange = () => {
            s.draft.spindle = check.checked;
            save();
          };
          label.append(check);
          host.append(
            label,
            el(
              "p",
              "Строка маршрута: X Y Z G0/G1. До 6 строк; дробные числа с точкой.",
              "start-note",
            ),
          );
        }
        const key = t.kind === "lathe" ? "program" : "route",
          name =
            t.kind === "lathe"
              ? "Исправленная программа"
              : "Исправленный маршрут",
          label = el("label", name, "field"),
          editor = el("textarea");
        editor.rows = t.kind === "lathe" ? 12 : 6;
        editor.maxLength = t.kind === "lathe" ? 4000 : 900;
        editor.spellcheck = false;
        editor.value = s.draft[key];
        editor.setAttribute("aria-label", name);
        editor.oninput = () => {
          s.draft[key] = editor.value;
          save();
        };
        label.append(editor);
        host.append(
          label,
          button(
            "3. Проверить причину и исправление",
            () => ({ type: "repair", draft: s.draft }),
            true,
          ),
        );
        const hint = button(
          s.help.includes(t.id) ? "Разбор открыт" : "Нужен разбор",
          { type: "hint" },
        );
        hint.disabled = s.help.includes(t.id);
        host.append(hint);
        if (s.help.includes(t.id)) host.append(el("p", t.hint, "start-hint"));
      }
      if (s.repairResult) {
        const actions = s.events.slice(
            s.events.map((a) => a.type).lastIndexOf("next") + 1,
          ),
          last = actions.filter((a) => a.type === "repair").at(-1);
        host.append(
          panel(
            t,
            s.repairResult,
            "Последняя проверка исправления",
            t.kind === "lathe" ? last.draft.program : last.draft.route,
            "repair",
          ),
        );
      }
      const feedback = el("p", notice || s.feedback, "start-feedback");
      feedback.setAttribute("role", "status");
      feedback.tabIndex = -1;
      host.append(feedback);
      if (accepted) {
        host.append(
          el(
            "p",
            "Причина и исправление подтверждены. Разбор " +
              (s.help.includes(t.id) ? "открывался" : "не открывался") +
              "; ошибок " +
              s.errors[s.current] +
              ".",
            "start-value",
          ),
        );
        if (!readOnly && !routeMode && s.current < m.tasks.length - 1)
          host.append(
            button("Следующая диагностическая задача", { type: "next" }, true),
          );
      }
      const scope = el("details", undefined, "course-reading");
      scope.append(
        el("summary", "Границы проверки"),
        el(
          "p",
          "Проверки выполняются на изолированной копии. Красная линия показывает отвергнутый кадр, не точную точку физического контакта. Причина сверяется с условием и наладкой; безопасного конца движения недостаточно. Этот блок не подтверждает изготовление и допуск к физическому станку.",
        ),
      );
      host.append(scope);
      const back = el("button", "К маршруту курса", "course-back");
      back.onclick = onDone;
      host.append(back);
      if (focus === "title") title.focus();
      else if (focus === "original" || focus === "repair") {
        focusTargets[focus]?.focus();
      } else if (focus) feedback.focus();
    }
    render();
    return host;
  }
  root.CNCDiagnosticCourseUI = Object.freeze({ create });
})(window);
