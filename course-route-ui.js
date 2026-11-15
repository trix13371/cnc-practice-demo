(function (window) {
  "use strict";
  const node = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  const button = (text, action) => {
    const element = node("button", text, "button secondary");
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  };
  function courseOutline() {
    window.CNCWorkshop.home();
    window.CNCHomeUI.openOutline();
  }
  function practice({ article, step, engine, ui, index }) {
    const model = index >= 0 ? { ...engine, ...engine.exercise(index) } : engine;
    const intro = step.target === "firstSession" && index >= 0;
    const key = "cnc-course-exercise-v1:" + step.id;
    let attempt = {};
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      const restored = model.restore(stored?.saved);
      if (restored && (index < 0 || (intro ? restored.step : restored.current) === index)) attempt = stored;
    } catch {
      // Storage can be unavailable in standalone or private browsing.
    }
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(attempt));
        return true;
      } catch {
        return false;
      }
    };
    const start = () => step.target === "shaftProject" ? model.create(step.subtask) : model.create();
    article.replaceChildren(
      node("p", "Свободная практика. Эта попытка хранится в этом браузере отдельно от зачёта курса.", "start-note"),
      ui.create({
        model,
        singleExercise: intro,
        headingTag: "h1",
        saved: attempt.saved || model.snapshot(start()),
        savedDraft: attempt.draft,
        routeMode: true,
        onChange(saved) {
          attempt = { saved };
          return save();
        },
        onDraft(value) {
          attempt.saved ??= model.snapshot(start());
          attempt.draft = step.target === "firstSession"
            ? { step: model.restore(attempt.saved).step, value }
            : value;
          return save();
        },
        onDone: courseOutline,
      }),
    );
  }
  function render({ article, step, path, save, available, histories, direct = false }) {
    const model = window.CNCCourse;
    const key = step.target,
      modelKey = { firstSession: "startSession" }[key] || key,
      engine = model[modelKey],
      raw = path[key],
      current = key === "holeCourse" ? null : engine.restore(raw),
      proofs = [path, ...histories];
    if (key === "holeCourse") {
      const id = step.subtask, saved = raw?.works?.[id];
      const historical = !saved && histories.map(h=>h.holeCourse?.works?.[id]).find(entry=>engine.restore(entry,id)?.complete);
      article.append(window.CNCHoleCourseUI.create({
        id, saved: saved || historical, readOnly: !!historical,
        onChange(value) {
          const works = {...path.holeCourse?.works};
          if (value) works[id] = value;
          else delete works[id];
          if (Object.keys(works).length) path.holeCourse = {version:1,works};
          else delete path.holeCourse;
          save();
        },
        onDone: direct ? courseOutline : () => window.CNCWorkshop.home(),
      }));
      return;
    }
    if (key === "mountingPlate") {
      article.append(button("Перенос и история работы",()=>window.CNCProgressUI.openMilling()));
      const archived = !raw && histories.find(item=>item.mountingPlate);
      article.append(window.CNCMountingPlateUI.create({
        saved: archived ? archived.mountingPlate : raw,
        readOnly: !!archived,
        onChange(value) {
          path.mountingPlate = value;
          save();
          return available();
        },
        onDone: direct ? courseOutline : () => window.CNCWorkshop.home(),
      }));
      return;
    }
    if (key === "millingPlate") {
      article.append(button("Перенос и история работы",()=>window.CNCProgressUI.openMilling()));
      const historical = histories.find((item) => engine.restore(item.millingPlate)?.done.length);
      const review = !raw?.events.length && !path.millingPlateDraft &&
        (historical || histories.find(item=>item.millingPlate));
      article.append(window.CNCMillingCourseUI.create({
        model: engine,
        headingTag: "h1",
        saved: review ? review.millingPlate : raw,
        savedDraft: review ? review.millingPlateDraft : path.millingPlateDraft,
        readOnly: !!review,
        routeMode: true,
        onChange(value) {
          path.millingPlate = value;
          save();
          return available();
        },
        onDraft(value) {
          if (!engine.validDraft(value)) return false;
          path.millingPlate ??= engine.snapshot(engine.create());
          path.millingPlateDraft = value;
          save();
          return available();
        },
        onDone: direct ? courseOutline : () => window.CNCWorkshop.home(),
      }));
      return;
    }
    if (key === "firstSession" && step.subtask) {
      const index = engine.steps.findIndex((exercise) => exercise.id === step.subtask);
      if (index >= 0)
        return practice({ article, step, engine, ui: window.CNCStartSessionUI, index });
    }
    const doneIn = (value) => {
      const state = engine.restore(value);
      if (!state) return false;
      if (!step.subtask) return !!state.complete;
      if (key === "shaftProject")
        return (
          (state.complete && state.taskId === step.subtask) ||
          state.completedProjects.some(
            (p) => engine.restore(p)?.taskId === step.subtask,
          )
        );
      return state.done.some((d) => d.id === step.subtask);
    };
    const proof = proofs.find((h) => doneIn(h[key]));
    const leave = direct ? courseOutline : () => window.CNCWorkshop.home(),
      uiName = {
        firstSession: "CNCStartSessionUI",
        drawingSession: "CNCDrawingSessionUI",
        metrologyCourse: "CNCMetrologyCourseUI",
        firstProcess: "CNCFirstProcessUI",
        programSetup: "CNCProgramSetupUI",
        shaftProject: "CNCShaftProjectUI",
        operationCourse: "CNCOperationCourseUI",
        millingCourse: "CNCMillingCourseUI",
        diagnosticCourse: "CNCDiagnosticCourseUI",
      }[key],
      ui = window[uiName];
    if (proof && !step.subtask) {
      if (direct) return practice({ article, step, engine, ui, index: -1 });
      article.replaceChildren(
        node("h1", step.title),
        node(
          "p",
          "Практический блок уже завершён. Результат подтверждён сохранённым журналом.",
        ),
        button("К маршруту курса", leave),
      );
      return;
    }
    let saved = raw,
      readOnly = false;
    if (proof && step.subtask) {
      readOnly = true;
      if (key === "shaftProject") {
        const s = engine.restore(proof[key]);
        saved =
          s.complete && s.taskId === step.subtask
            ? engine.snapshot(s)
            : s.completedProjects.find(
                (p) => engine.restore(p)?.taskId === step.subtask,
              );
      } else saved = engine.review(proof[key], step.subtask);
    } else if (key === "shaftProject") {
      let s = current || engine.create();
      if (s.taskId !== step.subtask && (s.complete || !s.events.length)) {
        s = engine.transition(s, { type: "selectVariant", id: step.subtask });
        path[key] = engine.snapshot(s);
        delete path.shaftProjectDraft;
        save();
      }
      saved = engine.snapshot(s);
      if (s.taskId !== step.subtask) {
        if (direct) return practice({ article, step, engine, ui, index: -1 });
        article.append(
          node(
            "p",
            "Сначала завершите начатую попытку " +
              s.taskId +
              ". Она сохранена и не заменяется другим чертежом.",
            "start-hint",
          ),
        );
      }
    } else if (step.subtask) {
      let s = current || engine.create();
      const definitions = engine.tasks || engine.lessons,
        target = definitions.findIndex((t) => t.id === step.subtask);
      while (s.current < target) {
        const action = engine.advanceAction(s);
        if (!action) break;
        s = engine.transition(s, action);
      }
      if (direct && target >= 0 && s.current !== target)
        return practice({ article, step, engine, ui, index: target });
      saved = engine.snapshot(s);
      if (JSON.stringify(saved) !== JSON.stringify(raw)) {
        path[key] = saved;
        save();
      }
      if (s.current !== target)
        article.append(
          node(
            "p",
            "Открыта текущая попытка практикума. Завершите её очередное задание; результаты из других историй сохранены.",
            "start-hint",
          ),
        );
    }
    const onChange = (value) => {
      if (readOnly) return false;
      path[key] = value;
      const draftKey =
        key === "firstSession" ? "firstSessionDraft" : key + "Draft";
      delete path[draftKey];
      save();
      return available();
    };
    const onDraft = (input) => {
      const state = engine.restore(path[key]);
      const d =
        key === "firstSession" ? { step: state?.step, value: input } : input;
      const valid =
        key === "firstSession"
          ? model.validFirstSessionDraft(d, state)
          : engine.validDraft?.(d, state);
      if (valid) {
        path[key + "Draft"] = d;
        save();
      }
      return available();
    };
    const widget = ui.create({
      headingTag: "h1",
      saved,
      savedDraft: readOnly ? undefined : path[key + "Draft"],
      readOnly,
      routeMode: true,
      onChange,
      onDraft,
      onDone: leave,
    });
    article.append(widget);
  }
  window.CNCCourseRouteUI = Object.freeze({ render });
})(window);
