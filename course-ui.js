(function () {
  "use strict";
  const model = window.CNCCourse,
    discovery = window.CNCCourseDiscovery,
    views = window.CNCCourseView;
  const key = "cnc-foundations-v1",
    pathKey = "cnc-course-path-v1";
  let state = model.restore(null),
    path = model.restorePath(null),
    current = 0,
    storageAvailable = true,
    root,
    onPractice;
  try {
    state = model.restore(JSON.parse(localStorage.getItem(key) || "null"));
    path = model.restorePath(
      JSON.parse(localStorage.getItem(pathKey) || "null"),
    );
  } catch {
    storageAvailable = false;
  }
  let view = views.restore(path);
  if (path.activePractice === "metrologyCourse" && path.selected === "control") {
    const saved = model.metrologyCourse.restore(path.metrologyCourse) || model.metrologyCourse.create();
    const step = window.CNCLearningPath.get("metrology-" + model.metrologyCourse.tasks[saved.current].id);
    view = views.create("route", step);
  }
  const hasAnswer = (id) => Object.hasOwn(state.answers, id);
  const firstMissing = () =>
    Math.max(
      0,
      model.lessons.findIndex((l) => !hasAnswer(l.id)),
    );
  current =
    view.kind !== "lesson" || !hasAnswer(path.selected)
      ? model.lessons.findIndex((l) => l.id === path.selected)
      : firstMissing();
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const button = (text, action, cls = "button secondary") => {
    const b = node("button", text, cls);
    b.type = "button";
    b.addEventListener("click", action);
    return b;
  };
  function questionFigure(spec) {
    if (
      spec?.kind !== "turning-axes" ||
      !Number.isFinite(spec.diameter) ||
      spec.diameter <= 0
    )
      return null;
    const figure = node("figure", undefined, "course-question-figure");
    const diameter = spec.diameter.toLocaleString("ru-RU");
    figure.innerHTML = `<svg viewBox="0 0 640 290" role="img" aria-label="Цилиндр диаметром ${diameter} миллиметров. Ось X направлена поперёк детали, Z — вдоль неё. Ноль Z расположен на правом торце.">
      <rect x="22" y="99" width="68" height="112" rx="5" fill="#475b69" stroke="#95a8b5"/>
      <path d="M70 111h24v20H70m0 48h24v20H70" fill="#a5b9c6"/>
      <path d="M94 111H410V199H94" fill="#8299a8" stroke="#c6d6e0" stroke-width="2"/>
      <ellipse cx="410" cy="155" rx="16" ry="44" fill="#b1c5d1" stroke="#d7e3eb" stroke-width="2"/>
      <path d="M95 155H410" stroke="#8b9eaf" stroke-dasharray="7 7"/>
      <path d="M134 111V199m-7-81 7-7 7 7m-14 74 7 7 7-7" fill="none" stroke="#255beb" stroke-width="2"/>
      <text x="166" y="147" fill="#101b23" font-size="23" font-weight="600">Ø${diameter} мм</text>
      <path d="M410 155V37m-7 9 7-9 7 9M410 155H591m-9-7 9 7-9 7" fill="none" stroke="#255beb" stroke-width="3"/>
      <text x="433" y="47" fill="#255beb" font-size="22">+X</text>
      <text x="557" y="139" fill="#255beb" font-size="22">+Z</text>
      <path d="M380 155H321m9-7-9 7 9 7" fill="none" stroke="#8b9eaf" stroke-width="2"/>
      <text x="306" y="139" fill="#101b23" font-size="20">−Z</text>
      <circle cx="410" cy="155" r="5" fill="#255beb"/>
      <path d="M416 163 465 220" fill="none" stroke="#b6c7d2"/>
      <text x="421" y="246" fill="#e3ecf2" font-size="20">Ноль Z на торце</text>
      <text x="22" y="246" fill="#c0d0dc" font-size="20">Патрон</text>
      <text x="187" y="246" fill="#c0d0dc" font-size="20">Деталь</text>
    </svg>`;
    figure.append(
      node(
        "figcaption",
        "Правила этого упражнения: X — по диаметру, Z — вдоль детали. Дополнительного смещения инструмента нет.",
      ),
    );
    return figure;
  }
  function save() {
    path.selected = model.lessons[current].id;
    try {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(pathKey, JSON.stringify(path));
    } catch {
      storageAvailable = false;
    }
    window.dispatchEvent(new Event("cnc-course-change"));
  }
  function select(index) {
    view = views.create();
    path.activePractice = "course";
    current = index;
    save();
    render(true);
  }
  function phaseTo(phase) {
    path.phases[model.lessons[current].id] = phase;
    save();
    render(true);
  }
  function readingLinks(article, id) {
    const reading = node("details", undefined, "course-reading");
    reading.append(node("summary", "Если хочется узнать больше"));
    for (const item of window.CNCLibrary.lessonArticles(id))
      reading.append(
        button(item.title, () => window.CNCWorkshop.openReference(item.id)),
      );
    article.append(reading);
  }
  function presentArticle(article, focus) {
    const title = article.querySelector("h1");
    if (title) {
      title.tabIndex = -1;
      if (focus) title.focus();
    }
  }
  function render(focus = false) {
    if (!root) return;
    const routeStep = view.kind === "route" ? view.step : null;
    root.replaceChildren();
    const l = model.lessons[current],
      unit = discovery.units[l.id],
      count = Object.keys(state.answers).length;
    const guided = window.CNCLearningUI?.lesson(l.id);
    root.dataset.guided = String(!!guided);
    let phase = path.phases[l.id] || 0;
    if (phase === 2 && !model.canCheck(l.id, path, state.answers))
      phase = unit ? 1 : 0;
    const heading = node("div", undefined, "course-heading");
    const progressLabel = node(
      "p",
      `Основы: ${count} из ${model.lessons.length} уроков пройдено`,
      "course-progress-label",
    );
    const progress = node("progress");
    progress.max = model.lessons.length;
    progress.value = count;
    progress.setAttribute("aria-label", "Пройдено уроков основ");
    heading.append(progressLabel, progress);
    if (window.CNCStartSessionUI)
      heading.append(
        button(
          "Первое знакомство со станком",
          () => {
            view = views.create("firstSession");
            current = 0;
            path.selected = "machine";
            save();
            render(true);
          },
          "course-back",
        ),
      );
    if (!routeStep) root.append(heading);
    const layout = node("div", undefined, "course-layout"),
      nav = node("nav", undefined, "course-menu");
    nav.setAttribute("aria-label", "Уроки основ");
    model.lessons.forEach((lesson, i) => {
      const b = button(
        `${hasAnswer(lesson.id) ? "✓" : String(i + 1).padStart(2, "0")}  ${lesson.title}`,
        () => select(i),
        "",
      );
      b.setAttribute("aria-current", i === current ? "step" : "false");
      nav.append(b);
    });
    const index = node("details", undefined, "course-index");
    index.append(
      node("summary", `Все ${model.lessons.length} урока · выбрать тему`),
      nav,
    );
    if (!routeStep) layout.append(index);
    const article = node("article", undefined, "panel course-lesson");
    article.dataset.phase = String(phase);
    article.append(
      node(
        "p",
        guided
          ? "УЧЕБНЫЙ ПУТЬ · РАЗБИРАЕМСЯ ПЕРЕД ДЕЙСТВИЕМ"
          : `Урок ${current + 1} из ${model.lessons.length}${current < 4 ? " · Первое знакомство · без расчётов" : ""}`,
        "eyebrow",
      ),
      node("h1", l.title),
    );
    const phases = unit
      ? [
          [0, "Разобраться"],
          [1, "Попробовать"],
          [2, "Проверить"],
        ]
      : [
          [0, "Разобраться"],
          [2, "Проверить"],
        ];
    const steps = node("nav", undefined, "course-phases");
    steps.setAttribute("aria-label", "Шаги урока");
    for (const [value, label] of phases) {
      const b = button(label, () => phaseTo(value), "");
      b.setAttribute("aria-current", value === phase ? "step" : "false");
      b.disabled = value === 2 && !model.canCheck(l.id, path, state.answers);
      steps.append(b);
    }
    article.append(steps);
    const note = node(
      "p",
      storageAvailable
        ? window.CNCAccount
          ? "Прогресс передаётся в аккаунт. Статус сохранения — вверху страницы. Проверка урока закрепляет понятие; практика с преподавателем нужна отдельно."
          : "Прогресс хранится в этом браузере. Проверка урока помогает закрепить понятие; практика с преподавателем нужна отдельно."
        : "Сохранение недоступно. Прогресс останется до закрытия страницы.",
      "course-note",
    );
    if (routeStep) {
      article.replaceChildren();
      window.CNCCourseRouteUI.render({
        article,
        step: routeStep,
        path,
        save,
        available: () => storageAvailable,
        histories: window.CNCProgressUI?.courseStates?.() || [],
        direct: routeStep.direct,
      });
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);
      return;
    }
    if (view.kind === "diagnosticCourse") {
      article.replaceChildren(
        window.CNCDiagnosticCourseUI.create({
          headingTag: "h1",
          saved: path.diagnosticCourse,
          onChange: (s) => {
            path.diagnosticCourse = s;
            save();
            return storageAvailable;
          },
          onDone: () => window.CNCWorkshop.home(),
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);
      return;
    }
    if (view.kind === "millingCourse") {
      article.replaceChildren(
        window.CNCMillingCourseUI.create({
          headingTag: "h1",
          saved: path.millingCourse,
          onChange: (s) => {
            path.millingCourse = s;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            path.activePractice = "course";
            save();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);
      return;
    }
    if (view.kind === "operationCourse") {
      article.replaceChildren(
        window.CNCOperationCourseUI.create({
          headingTag: "h1",
          saved: path.operationCourse,
          onChange: (s) => {
            path.operationCourse = s;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);
      return;
    }
    const introduction = model.startSession?.restore(path.firstSession);
    if (
      l.id === "machine" &&
      window.CNCStartSessionUI &&
      (view.kind === "firstSession" ||
        (!hasAnswer("machine") && !introduction?.complete))
    ) {
      article.dataset.phase = "introduction";
      article.replaceChildren(
        window.CNCStartSessionUI.create({
          headingTag: "h1",
          onNext: () => window.CNCCourseUI.openDrawing(),
          saved: path.firstSession,
          savedDraft: path.firstSessionDraft,
          onDraft: (value) => {
            const intro = model.startSession.restore(path.firstSession);
            const d = { step: intro?.step, value };
            if (model.validFirstSessionDraft(d, intro)) {
              path.firstSessionDraft = d;
              save();
            }
            return storageAvailable;
          },
          onChange: (snapshot) => {
            path.firstSession = snapshot;
            const intro = model.startSession.restore(snapshot);
            if (!model.validFirstSessionDraft(path.firstSessionDraft, intro))
              delete path.firstSessionDraft;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            if (!hasAnswer("machine")) {
              if (!path.explored.includes("machine"))
                path.explored.push("machine");
              path.phases.machine = 2;
            }
            save();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);

      return;
    }
    const drawing = model.drawingSession?.restore(path.drawingSession);
    if (
      l.id === "control" &&
      window.CNCDrawingSessionUI &&
      (view.kind === "drawingSession" ||
        (!hasAnswer("control") && !drawing?.complete) ||
        (drawing?.events.length && !drawing.complete))
    ) {
      article.dataset.phase = "introduction";
      article.replaceChildren(
        window.CNCDrawingSessionUI.create({
          headingTag: "h1",
          onNext: () => window.CNCCourseUI.openFirstProcess(),
          saved: path.drawingSession,
          savedDraft: path.drawingSessionDraft,
          onDraft: (d) => {
            if (
              model.drawingSession.validDraft(
                d,
                model.drawingSession.restore(path.drawingSession),
              )
            ) {
              path.drawingSessionDraft = d;
              save();
            }
            return storageAvailable;
          },
          onChange: (s) => {
            path.drawingSession = s;
            if (
              !model.drawingSession.validDraft(
                path.drawingSessionDraft,
                model.drawingSession.restore(s),
              )
            )
              delete path.drawingSessionDraft;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            if (!hasAnswer("control")) {
              if (!path.explored.includes("control"))
                path.explored.push("control");
              path.phases.control = 2;
            }
            save();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);

      return;
    }
    const process = model.firstProcess?.restore(path.firstProcess);
    if (
      l.id === "axes" &&
      window.CNCFirstProcessUI &&
      (view.kind === "firstProcess" ||
        (!hasAnswer("axes") && !process?.complete) ||
        (process?.events.length && !process.complete))
    ) {
      article.dataset.phase = "introduction";
      article.replaceChildren(
        window.CNCFirstProcessUI.create({
          headingTag: "h1",
          onNext: () => window.CNCCourseUI.openProgramSetup(),
          saved: path.firstProcess,
          savedDraft: path.firstProcessDraft,
          onDraft: (d) => {
            if (
              model.firstProcess.validDraft(
                d,
                model.firstProcess.restore(path.firstProcess),
              )
            ) {
              path.firstProcessDraft = d;
              save();
            }
            return storageAvailable;
          },
          onChange: (s) => {
            path.firstProcess = s;
            if (
              !model.firstProcess.validDraft(
                path.firstProcessDraft,
                model.firstProcess.restore(s),
              )
            )
              delete path.firstProcessDraft;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            if (!hasAnswer("axes")) {
              if (!path.explored.includes("axes")) path.explored.push("axes");
              path.phases.axes = 2;
            }
            save();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);

      return;
    }
    const ps = model.programSetup?.restore(path.programSetup);
    if (
      l.id === "setup" &&
      window.CNCProgramSetupUI &&
      (view.kind === "programSetup" ||
        (!hasAnswer("setup") && !ps?.complete) ||
        (ps?.events.length && !ps.complete))
    ) {
      article.dataset.phase = "introduction";
      article.replaceChildren(
        window.CNCProgramSetupUI.create({
          headingTag: "h1",
          onNext: () => window.CNCCourseUI.openShaftProject(),
          saved: path.programSetup,
          savedDraft: path.programSetupDraft,
          onDraft: (d) => {
            if (
              model.programSetup.validDraft(
                d,
                model.programSetup.restore(path.programSetup),
              )
            ) {
              path.programSetupDraft = d;
              save();
            }
            return storageAvailable;
          },
          onChange: (s) => {
            path.programSetup = s;
            if (
              !model.programSetup.validDraft(
                path.programSetupDraft,
                model.programSetup.restore(s),
              )
            )
              delete path.programSetupDraft;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            path.phases.setup = 2;
            save();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);

      return;
    }
    const shaft = model.shaftProject?.restore(path.shaftProject);
    if (
      l.id === "verification" &&
      window.CNCShaftProjectUI &&
      (view.kind === "shaftProject" ||
        (!hasAnswer("verification") && !shaft?.complete) ||
        (shaft?.events.length && !shaft.complete))
    ) {
      article.dataset.phase = "introduction";
      article.replaceChildren(
        window.CNCShaftProjectUI.create({
          headingTag: "h1",
          saved: path.shaftProject,
          savedDraft: path.shaftProjectDraft,
          onDraft: (d) => {
            if (
              model.shaftProject.validDraft(
                d,
                model.shaftProject.restore(path.shaftProject),
              )
            ) {
              path.shaftProjectDraft = d;
              save();
            }
            return storageAvailable;
          },
          onChange: (s) => {
            path.shaftProject = s;
            if (
              !model.shaftProject.validDraft(
                path.shaftProjectDraft,
                model.shaftProject.restore(s),
              )
            )
              delete path.shaftProjectDraft;
            save();
            return storageAvailable;
          },
          onDone: () => {
            view = views.create();
            path.phases.verification = 2;
            save();
            render(true);
          },
        }),
      );
      layout.append(article);
      root.append(layout, note);
      presentArticle(article, focus);

      return;
    }
    if (phase === 0) {
      const guide = discovery.guidance[l.id];
      const goal = node("section", undefined, "lesson-goal");
      goal.append(
        node("span", "После этого урока вы сможете"),
        node("strong", guide?.goal || l.skill),
      );
      article.append(goal);
      const visual = discovery.preview(l.id);
      if (visual) article.append(visual);
      article.append(node("h4", "Что здесь происходит", "course-stage-title"));
      for (const p of unit ? unit.intro : [l.intro])
        article.append(node("p", p));
      const worked = node("details", undefined, "course-example lesson-worked");
      worked.append(node("summary", "Разобрать другой пример по шагам"));
      if (unit) {
        worked.append(
          node("strong", `Разбираем вместе: ${unit.worked.title}`),
          node("p", unit.worked.scene),
        );
        const reasoning = node("ol");
        for (const step of unit.worked.steps)
          reasoning.append(node("li", step));
        worked.append(reasoning, node("p", unit.worked.result));
      } else {
        worked.append(
          node("strong", "Разобранная ситуация"),
          node("p", l.example),
        );
      }
      article.append(worked);
      readingLinks(article, l.id);
      window.CNCNormativeUI?.appendLesson(article, l.id);
      if (!guided && ["modal", "axes", "incremental"].includes(l.id))
        article.append(
          button("Попробовать задания по G-коду", () =>
            window.CNCWorkshop.openGCode(
              l.id === "modal" ? "modal" : "coordinates",
            ),
          ),
        );
      article.append(
        button(
          unit
            ? "Теперь попробуем на схеме"
            : "Перейти к самостоятельной проверке",
          () => phaseTo(unit ? 1 : 2),
          "button primary",
        ),
      );
    } else if (phase === 1) {
      const handsOn = model.practice.ids.includes(l.id);
      if (!handsOn)
        article.append(
          node("h4", "Посмотрите, что изменится", "course-stage-title"),
          node(
            "p",
            "Здесь можно исследовать схему без оценки. Нажатия не засчитывают урок — самостоятельная проверка будет следующим шагом.",
            "course-stage-copy",
          ),
        );
      const next = button(
        "Перейти к самостоятельной проверке",
        () => phaseTo(2),
        "button primary",
      );
      next.disabled = !model.canCheck(l.id, path, state.answers);
      const ready = node(
        "p",
        next.disabled
          ? handsOn
            ? "Для самостоятельной проверки выполните все три действия."
            : "Исследуйте условия выше — затем откроется проверка."
          : path.explored.includes(l.id)
            ? "Вы уже исследовали эту схему. Можно повторить или перейти к проверке."
            : "Урок уже пройден раньше. Можно исследовать новую схему или повторить проверку.",
        "course-ready",
      );
      ready.setAttribute("role", "status");
      article.append(
        discovery.create(
          l.id,
          () => {
            if (!path.explored.includes(l.id)) path.explored.push(l.id);
            save();
            next.disabled = false;
            ready.textContent =
              "Схема исследована. Теперь попробуйте другую ситуацию самостоятельно.";
            steps.lastElementChild.disabled = false;
            if (!storageAvailable)
              note.textContent =
                "Сохранение недоступно. Прогресс останется до закрытия страницы.";
          },
          {
            saved: path.practice?.[l.id],
            onChange: (snapshot) => {
              path.practice = { ...path.practice, [l.id]: snapshot };
              save();
              if (!storageAvailable)
                note.textContent =
                  "Сохранение недоступно. Прогресс останется до закрытия страницы.";
            },
          },
        ),
        ready,
        next,
      );
      article.append(
        button("Вернуться к объяснению", () => phaseTo(0), "course-back"),
      );
    } else {
      article.append(
        node("h4", "Теперь самостоятельно", "course-stage-title"),
        node(
          "p",
          "Прочитайте новую ситуацию. Если пока трудно, вернитесь к объяснению — штрафа за это нет.",
          "course-stage-copy",
        ),
      );
      const form = node("form"),
        fieldset = node("fieldset");
      fieldset.append(node("legend", l.question));
      const figure = questionFigure(l.diagram);
      if (figure) fieldset.append(figure);
      if (l.choices) {
        l.choices.forEach((choice, i) => {
          const label = node("label", undefined, "course-choice"),
            input = node("input");
          input.type = "radio";
          input.name = "answer";
          input.value = String(i);
          input.required = true;
          label.append(input, node("span", choice));
          fieldset.append(label);
        });
      } else {
        const label = node("label", `Ваш ответ, ${l.unit}`, "field"),
          input = node("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.name = "answer";
        input.autocomplete = "off";
        input.required = true;
        label.append(input);
        fieldset.append(label);
      }
      const check = node("button", "Проверить ответ", "button primary");
      check.type = "submit";
      form.append(fieldset, check);
      const feedback = node(
        "div",
        hasAnswer(l.id)
          ? "Проверка уже пройдена. Можно повторить или продолжить."
          : "",
        "course-feedback",
      );
      feedback.setAttribute("role", "status");
      const route = window.CNCLearningUI?.continuation(l.id);
      const next = button(
        route?.label ||
          (current === model.lessons.length - 1
            ? "Открыть первый проход"
            : "Следующий урок"),
        () => {
          if (route) route.run();
          else if (current === model.lessons.length - 1) onPractice();
          else select(current + 1);
        },
        "button primary",
      );
      next.disabled = !hasAnswer(l.id);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const raw = new FormData(form).get("answer");
        const answer = l.choices
          ? raw === null
            ? null
            : Number(raw)
          : window.CNCTrainingMath.parseNumber(raw);
        const result = model.evaluate(l.id, answer);
        if (!result.valid) {
          feedback.textContent = "Выберите ответ или введите число.";
          feedback.tabIndex = -1;
          feedback.focus();
          return;
        }
        feedback.replaceChildren();
        feedback.className =
          "course-feedback " + (result.correct ? "correct" : "incorrect");
        if (result.correct) {
          feedback.append(
            node("strong", "Верно — теперь понятно, почему"),
            node("p", l.explanation),
          );
          const guide = discovery.guidance[l.id];
          if (guide)
            feedback.append(node("p", guide.use, "lesson-application"));
          check.textContent = "Проверить ещё раз";
        } else {
          const help = discovery.mistake(l.id, answer);
          feedback.append(
            node("strong", "Давайте разберём этот вариант"),
            node("p", help.reason),
            node("p", "Что сделать: " + help.action),
          );
          if (hasAnswer(l.id))
            feedback.append(
              node("p", "Это повторная проверка. Ваш прежний зачёт сохранён."),
            );
          const solution = node("details", undefined, "lesson-solution");
          solution.append(
            node("summary", "Показать полный разбор"),
            node("p", l.explanation),
          );
          feedback.append(solution);
          if (unit)
            feedback.append(
              button(
                "Вернуться к наглядной пробе",
                () => phaseTo(1),
                "button secondary",
              ),
            );
          check.textContent = "Попробовать ещё раз";
        }
        feedback.tabIndex = -1;
        feedback.focus();
        if (result.correct) {
          state.answers[l.id] = answer;
          save();
          next.disabled = false;
          check.className = "button secondary";
          progress.value = Object.keys(state.answers).length;
          progressLabel.textContent = `Основы: ${progress.value} из ${model.lessons.length} уроков пройдено`;
          nav.children[current].textContent = `✓  ${l.title}`;
          if (!storageAvailable)
            note.textContent =
              "Сохранение недоступно. Прогресс останется до закрытия страницы.";
        }
      });
      article.append(
        form,
        feedback,
        next,
        button("Вернуться к объяснению", () => phaseTo(0), "course-back"),
      );
    }
    layout.append(article);
    root.append(layout, note);
    presentArticle(article, focus);
  }
  function openPractice(kind) {
    window.CNCWorkshop.openLesson(views.lessonFor(kind));
    view = views.create(kind);
    path.activePractice = [
      "operationCourse",
      "millingCourse",
      "diagnosticCourse",
    ].includes(kind)
      ? kind
      : "course";
    save();
    render(true);
  }
  function pendingSession() {
    const mill = model.millingCourse.restore(path.millingCourse);
    if (
      path.selected === "verification" &&
      path.activePractice === "millingCourse" &&
      mill?.events.length &&
      mill.done.length < model.millingCourse.lessonCount(mill)
    )
      return {
        key: "millingCourse",
        title: "Фрезерный станок XYZ",
        step: mill.current,
        total: model.millingCourse.lessonCount(mill),
      };
    const op = model.operationCourse.restore(path.operationCourse);
    if (
      path.selected === "verification" &&
      (!path.activePractice || path.activePractice === "operationCourse") &&
      op?.events.length &&
      op.done.length < model.operationCourse.tasks.length
    )
      return {
        key: "operationCourse",
        title: "Токарные операции",
        step: op.current,
        total: model.operationCourse.tasks.length,
      };
    for (const [lesson, key, label, modelName] of [
      ["machine", "firstSession", "Первое знакомство", "startSession"],
      ["control", "drawingSession", "Деталь и измерение", "drawingSession"],
      ["axes", "firstProcess", "Координаты и первый процесс", "firstProcess"],
      ["setup", "programSetup", "Программа и наладка", "programSetup"],
      [
        "verification",
        "shaftProject",
        "Проект: ступенчатый валик",
        "shaftProject",
      ],
    ]) {
      if (path.selected !== lesson) continue;
      const restored = model[modelName]?.restore(path[key]);
      if (restored?.events.length && !restored.complete)
        return {
          key,
          title: label,
          step: restored.step,
          total: model[modelName].steps.length,
        };
    }
    return null;
  }
  window.CNCCourseUI = {
    openRouteStep(step, direct = false) {
      const id =
        {
          firstSession: "machine",
          drawingSession: "control",
          firstProcess: "axes",
          programSetup: "setup",
          metrologyCourse: "control",
        }[step.target] || "verification";
      window.CNCWorkshop.openLesson(id, true);
      view = views.create("route", { ...step, direct });
      path.activePractice =
        step.target === "diagnosticCourse"
          ? "diagnosticCourse"
          : ["operationCourse", "millingCourse", "metrologyCourse"].includes(step.target)
            ? step.target
            : "course";
      save();
      render(true);
    },
    openDiagnostics() {
      openPractice("diagnosticCourse");
    },
    openMilling() {
      openPractice("millingCourse");
    },
    openOperations() {
      openPractice("operationCourse");
    },
    pendingSession,
    resumeSession() {
      const p = pendingSession();
      if (!p) return false;
      const method = {
        millingCourse: "openMilling",
        operationCourse: "openOperations",
        firstSession: "openIntroduction",
        drawingSession: "openDrawing",
        firstProcess: "openFirstProcess",
        programSetup: "openProgramSetup",
        shaftProject: "openShaftProject",
      }[p.key];
      window.CNCCourseUI[method]();
      return true;
    },
    openShaftProject() {
      openPractice("shaftProject");
    },
    openProgramSetup() {
      openPractice("programSetup");
    },
    openFirstProcess() {
      openPractice("firstProcess");
    },
    openDrawing() {
      openPractice("drawingSession");
    },
    openIntroduction() {
      openPractice("firstSession");
    },
    progressSnapshot: () => state,
    pathSnapshot: () => path,
    mount(parent, practice) {
      root = node("section", undefined, "course-screen");
      root.id = "course-screen";
      root.hidden = true;
      parent.insertBefore(root, parent.querySelector("footer"));
      onPractice = practice;
      render();
      return root;
    },
    render,
    openLesson(id) {
      const index = model.lessons.findIndex((l) => l.id === id);
      if (index >= 0) select(index);
    },
    resume() {
      const saved = model.lessons.findIndex((l) => l.id === path.selected);
      current =
        saved >= 0 &&
        (view.kind !== "lesson" ||
          !hasAnswer(path.selected) ||
          (path.selected === "verification" &&
            model.shaftProject.restore(path.shaftProject)?.events.length &&
            !model.shaftProject.restore(path.shaftProject)?.complete) ||
          (path.selected === "setup" &&
            model.programSetup.restore(path.programSetup)?.events.length &&
            !model.programSetup.restore(path.programSetup)?.complete) ||
          (path.selected === "axes" &&
            model.firstProcess.restore(path.firstProcess)?.events.length &&
            !model.firstProcess.restore(path.firstProcess)?.complete) ||
          (path.selected === "control" &&
            model.drawingSession.restore(path.drawingSession)?.events.length &&
            !model.drawingSession.restore(path.drawingSession)?.complete))
          ? saved
          : firstMissing();
      save();
      render(true);
    },
    completed: () => Object.keys(state.answers).length,
    answered: () => Object.keys(state.answers),
    currentId: () => model.lessons[current].id,
  };
})();
