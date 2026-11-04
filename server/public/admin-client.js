(function () {
  "use strict";
  const root = document.querySelector("#admin-users"),
    detail = document.querySelector("#admin-detail"),
    status = document.querySelector("#admin-status"),
    node = (tag, text) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      return e;
    };
  async function api(url) {
    const res = await fetch(url, { credentials: "same-origin" }),
      data = await res.json();
    if (!res.ok) {
      if (res.status === 401) location.assign("/login");
      throw Error(data.error);
    }
    return data;
  }
  function button(text, run) {
    const b = node("button", text);
    b.type = "button";
    b.onclick = () =>
      Promise.resolve(run()).catch((e) => (status.textContent = e.message));
    return b;
  }
  function table(headers, rows) {
    if (!rows.length) return node("p", "Подтверждённых результатов пока нет.");
    const wrap = node("div"),
      t = node("table"),
      head = node("thead"),
      tr = node("tr"),
      body = node("tbody");
    wrap.className = "admin-table-wrap";
    for (const h of headers) {
      const th = node("th", h);
      th.scope = "col";
      tr.append(th);
    }
    head.append(tr);
    for (const row of rows) {
      const r = node("tr");
      for (const value of row) {
        const td = node("td");
        td.append(value instanceof Node ? value : node("span", String(value)));
        r.append(td);
      }
      body.append(r);
    }
    t.append(head, body);
    wrap.append(t);
    return wrap;
  }
  function download(name, data) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      ),
      a = node("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function compactEvidence(data) {
    const s = data.summary,
      overview = node("section"),
      activity = node("ul"),
      signals = node("ul");
    const noteChecks = (part, title) => {
      if (!part) return;
      const errors = Array.isArray(part.errors)
        ? part.errors.reduce((sum, n) => sum + n, 0)
        : part.errors || 0;
      const helped = part.assisted || part.help?.length;
      if (errors || helped)
        signals.append(
          node(
            "li",
            title +
              " · проверок с ошибками: " +
              errors +
              (helped ? " · разбор открывался" : ""),
          ),
        );
    };
    overview.className = "admin-overview";
    overview.append(
      node("h3", "Сводка обучения"),
      node(
        "p",
        "Завершено этапов: " + s.progress.done + " / " + s.progress.total,
      ),
    );
    for (const [key, title] of [
      ["introduction", "Первое знакомство"],
      ["drawing", "Деталь и измерение"],
      ["firstProcess", "Первый процесс"],
      ["programSetup", "Программа и наладка"],
      ["shaftProject", "Проект по чертежу"],
    ]) {
      const part = s[key];
      noteChecks(part, title);
      if (part?.status === "in-progress")
        activity.append(
          node(
            "li",
            title + " · действие " + (part.step + 1) + " из " + part.total,
          ),
        );
    }
    const current = data.archive?.sections?.coursePath?.current;
    for (const [key, title] of [
      ["operationCourse", "Токарные операции"],
      ["millingCourse", "Фрезерный станок"],
      ["diagnosticCourse", "Диагностика"],
    ]) {
      const part = s[key];
      noteChecks(part, title);
      if (current?.[key]?.events.length && part?.done.length < part.total)
        activity.append(
          node(
            "li",
            title + " · задание " + (part.current + 1) + " из " + part.total,
          ),
        );
    }
    if (activity.children.length)
      overview.append(node("p", "В работе:"), activity);
    if (signals.children.length)
      overview.append(
        node("p", "Ошибки и помощь в текущих попытках:"),
        signals,
        node(
          "p",
          "Проверка ошибки может быть намеренной частью задания. Подробности — в разделах ниже.",
        ),
      );
    if (s.progress.next)
      overview.append(node("p", "По маршруту: " + s.progress.next.title));
    const previous = [...detail.children],
      sections = [],
      exports = [];
    const fold = (title) => {
      const box = node("details");
      box.className = "admin-evidence";
      box.append(node("summary", title));
      sections.push(box);
      return box;
    };
    let section = fold("Подробный маршрут · этапов: " + s.rows.length);
    for (const child of previous.slice(2)) {
      if (child.tagName.toLowerCase() === "h3")
        section = fold(child.textContent);
      else if (
        child.tagName.toLowerCase() === "button" &&
        child.textContent === "Скачать учебный JSON"
      )
        exports.push(child);
      else section.append(child);
    }
    detail.replaceChildren(
      ...previous.slice(0, 2),
      overview,
      ...sections,
      ...exports,
    );
  }
  async function show(user) {
    const data = await api("/api/admin/users/" + user.id + "/progress");
    detail.hidden = false;
    detail.replaceChildren(
      node("h2", user.username),
      node(
        "p",
        data.updatedAt
          ? "Последнее сохранение: " +
              new Date(data.updatedAt).toLocaleString("ru-RU")
          : "Участник ещё не передавал результаты.",
      ),
    );
    if (!data.summary) return;
    const s = data.summary;
    detail.append(
      table(
        ["Шаг", "Подтверждение", "Цель и границы проверки"],
        s.rows.map((r) => {
          const goal = node("div");
          goal.append(
            node("p", r.learningGoal || "Цель не описана в этой версии курса"),
            node(
              "small",
              r.evidenceScope || "Область проверки требует уточнения.",
            ),
          );
          return [r.title, r.done ? r.detail : "Предстоит", goal];
        }),
      ),
      node("h3", "Самостоятельная практика и помощь"),
      table(
        ["Условие", "Результат", "Помощь и ошибки"],
        [...s.training, ...s.gcode].map((r) => [
          r.title,
          r.independent
            ? "Самостоятельно"
            : r.passed
              ? "С разбором / сохранён зачёт"
              : "Предстоит",
          `${r.hints || r.helped ? "Есть помощь" : "Помощь не отмечена"}; ошибок до ${r.errors}`,
        ]),
      ),
    );
    if (s.diagnosticCourse) {
      const d = s.diagnosticCourse;
      detail.append(
        node("h3", "Диагностика: причины и исправления"),
        node("p", "Принято " + d.done.length + " из " + d.total),
        table(
          ["Задание", "Причина", "Разбор", "Ошибки"],
          d.done.map((r) => [
            r.title || "Задание диагностики",
            r.causeTitle || "Причина не описана в этой версии",
            r.help ? "Открывался" : "Не открывался",
            r.errors,
          ]),
        ),
      );
    }
    if (s.millingCourse) {
      const mill = s.millingCourse;
      detail.append(
        node("h3", "Фрезерный станок XYZ"),
        node(
          "p",
          "Принято " +
            mill.done.length +
            " из " +
            mill.total +
            "; ошибок: " +
            mill.errors.reduce((a, b) => a + b, 0),
        ),
        table(
          ["Задание", "Диагностика на копии", "Ошибки", "Разбор"],
          mill.done.map((d) => [
            d.title || "Фрезерное задание",
            d.diagnosticTitles?.join(", ") || "—",
            d.errors,
            d.help ? "Открывался" : "Не открывался",
          ]),
        ),
      );
      if (mill.incidents.length)
        detail.append(
          node(
            "p",
            "События диагностики и блокировки: " +
              mill.incidents
                .map(
                  (e) =>
                    e.title + (e.preview ? " (на копии)" : " (выполнение)"),
                )
                .join(", "),
          ),
        );
      if (mill.fault)
        detail.append(node("p", "Текущая ошибка: " + mill.fault.title));
    }
    if (s.operationCourse) {
      detail.append(
        node("h3", "Практикум токарных операций"),
        node(
          "p",
          "Принято " +
            s.operationCourse.done.length +
            " из " +
            s.operationCourse.total,
        ),
        table(
          ["Операция", "Попытка", "Разбор", "Ошибки", "Зачёт и версия"],
          s.operationCourse.done.map((d) => [
            d.title || "Токарная операция",
            d.attempt,
            d.help ? "Открывался" : "Не открывался",
            d.errors,
            (d.legacy
              ? "Прежний зачёт · самостоятельность не оценивалась"
              : d.independent
                ? "Без открытия разбора"
                : "С разбором") +
              (d.assignment
                ? " · условие " +
                  d.assignment.contentVersion +
                  ", критерии " +
                  d.assignment.criteriaVersion +
                  ", профиль " +
                  d.assignment.profileVersion +
                  " · проверок " +
                  d.criteria.filter((c) => c.passed).length +
                  "/" +
                  d.criteria.length
                : ""),
          ]),
        ),
      );
    }
    const project = data.summary.shaftProject;
    if (project) {
      detail.append(
        node("h3", "Проект: ступенчатый валик"),
        node(
          "p",
          project.completed
            ? "Изделие и протокол подтверждены"
            : project.status === "in-progress"
              ? "Этап " + (project.step + 1) + " из " + project.total
              : "Не начато",
        ),
        node(
          "p",
          "Карта контроля: " +
            project.recorded +
            "/6; попытка " +
            project.attempt +
            "; ошибок " +
            project.errors +
            "; помощь: " +
            (project.assisted ? "да" : "нет"),
        ),
      );
      detail.append(
        node(
          "p",
          "Текущий чертёж: " +
            project.taskId +
            "; принято вариантов: " +
            (project.accepted?.length || 0),
        ),
      );
      for (const accepted of project.accepted || []) {
        const entry = node("details");
        entry.className = "admin-project-protocol";
        entry.append(
          node("summary", "Принято: " + accepted.taskId),
          node("pre", accepted.report),
        );
        detail.append(entry);
      }
      if (project.report && !project.accepted?.length) {
        const fold = node("details");
        fold.className = "admin-project-protocol";
        fold.append(
          node("summary", "Протокол учебного изделия"),
          node("pre", project.report),
        );
        detail.append(fold);
      }
    }
    const evidence = project?.evidence;
    if (evidence) {
      detail.append(
        node("h3", "Наблюдаемые действия по проектам"),
        node("p", evidence.scope),
        node(
          "p",
          "Принято " +
            evidence.accepted +
            " из " +
            evidence.total +
            "; без дополнительных подсказок: " +
            evidence.unassisted +
            ". Перенос размеров: " +
            (evidence.numericTransfer
              ? "есть результаты на разных чертежах"
              : "пока не подтверждён") +
            ". Другой припуск: " +
            (evidence.allowanceTransfer
              ? "есть результаты"
              : "пока не подтверждён") +
            ".",
        ),
      );
      for (const p of evidence.projects) {
        const fold = node("details");
        fold.append(
          node(
            "summary",
            p.title +
              " · " +
              p.taskId +
              (p.completed ? " · принято" : " · в работе"),
          ),
          node(
            "p",
            "Попытка " +
              p.attempt +
              "; перепады диаметров чертежа на радиус: " +
              p.allowance.firstRadial +
              " и " +
              p.allowance.secondRadial +
              " мм на радиус.",
          ),
          table(
            ["Наблюдаемое действие", "Результат", "Ошибки", "Границы вывода"],
            p.rows.map((r) => [
              r.title,
              r.done
                ? r.helpOpened
                  ? "Выполнено с открытой подсказкой"
                  : "Выполнено; подсказка не открывалась"
                : "Этап не завершён",
              r.errors,
              r.limitation,
            ]),
          ),
        );
        detail.append(fold);
      }
      detail.append(node("h4", "Следующие проверки"));
      const list = node("ul");
      for (const text of evidence.next) list.append(node("li", text));
      detail.append(
        list,
        button("Скачать отчёт по проектам", () =>
          download(user.username + "-project-evidence.json", evidence),
        ),
      );
    }
    const ps = data.summary.programSetup;
    if (ps)
      detail.append(
        node("h3", "Программа и наладка"),
        node(
          "p",
          ps.completed
            ? "Завершено"
            : ps.status === "in-progress"
              ? "Шаг " + (ps.step + 1) + " из " + ps.total
              : "Не начато",
        ),
        node(
          "p",
          "Ошибок: " +
            ps.errors +
            "; помощь: " +
            (ps.assisted ? "открывалась" : "нет"),
        ),
      );
    const fp = data.summary.firstProcess;
    if (fp)
      detail.append(
        node("h3", "Координаты и первый процесс"),
        node(
          "p",
          fp.completed
            ? "Завершено"
            : fp.status === "in-progress"
              ? "Шаг " + (fp.step + 1) + " из " + fp.total
              : "Не начато",
        ),
        node(
          "p",
          "Ошибок: " +
            fp.errors +
            "; помощь: " +
            (fp.assisted ? "открывалась" : "нет"),
        ),
      );
    const d = data.summary.drawing;
    if (d)
      detail.append(
        node("h3", "Деталь и измерение"),
        node(
          "p",
          d.completed
            ? "Завершено"
            : d.status === "in-progress"
              ? "Действие " + (d.step + 1) + " из " + d.total
              : "Не начато",
        ),
        node(
          "p",
          "Ошибок: " +
            d.errors +
            "; подсказки: " +
            (d.assisted ? "открывались" : "нет"),
        ),
      );
    const intro = data.summary.introduction;
    if (intro) {
      detail.append(
        node("h3", "Первое знакомство со станком"),
        node(
          "p",
          intro.status === "complete"
            ? "Вводное занятие завершено"
            : intro.status === "in-progress"
              ? "Текущее действие: " + (intro.step + 1) + " из " + intro.total
              : "Новое вводное занятие пока не начато",
        ),
        node(
          "p",
          "Подсказки: " +
            (intro.assisted ? "открывались" : "не открывались") +
            "; неверных проверочных действий: " +
            intro.errors,
        ),
        node(
          "p",
          "Этот результат учитывается отдельно от прежних зачётов курса и не является допуском к работе.",
        ),
      );
    }
    detail.append(
      button("Скачать учебный JSON", () =>
        download(user.username + "-progress.json", data.archive),
      ),
    );
    if (data.pilot) {
      detail.append(
        node("h3", "Наблюдения за курсом"),
        button("Скачать журнал наблюдений", () =>
          download(user.username + "-observations.json", data.pilot),
        ),
      );
      const notes = data.pilot.participants.flatMap((p) =>
        ["main", "followup"].flatMap((phase) =>
          p[phase].events.map((e) => [p.id, e.kind, e.note]),
        ),
      );
      detail.append(table(["Прогон", "Событие", "Заметка"], notes));
      for (const [key, item] of Object.entries(data.pilot.review))
        if (item.note) detail.append(node("p", key + ": " + item.note));
    } else
      detail.append(
        node(
          "p",
          "Журнал проверки участник пока не заполнял. Это не мешает сохранению учебного прогресса.",
        ),
      );
    compactEvidence(data);
    detail.querySelector("h2").tabIndex = -1;
    detail.querySelector("h2").focus();
  }
  async function refresh() {
    status.textContent = "Получаем результаты…";
    const me = await api("/api/me");
    if (me.user.role !== "admin") throw Error("Доступ только администратору.");
    const users = await api("/api/admin/users");
    root.replaceChildren(
      table(
        ["Аккаунт", "Роль", "Курс", "Последнее сохранение", ""],
        users.map((u) => [
          u.username,
          u.role === "admin" ? "Администратор" : "Участник",
          `${u.done}/${u.total}`,
          u.updatedAt
            ? new Date(u.updatedAt).toLocaleString("ru-RU")
            : "Ещё нет",
          button("Посмотреть " + u.username, () => show(u)),
        ]),
      ),
    );
    status.textContent =
      "Данные обновлены. Участников: " +
      users.filter((u) => u.role === "user").length +
      ".";
  }
  document.querySelector("#admin-refresh").onclick = () =>
    refresh().catch((e) => (status.textContent = e.message));
  refresh().catch((e) => (status.textContent = e.message));
})();
