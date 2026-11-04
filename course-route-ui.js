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
  function render({ article, step, path, save, available, histories }) {
    const model = window.CNCCourse;
    const key = step.target,
      modelKey = { firstSession: "startSession" }[key] || key,
      engine = model[modelKey],
      raw = path[key],
      current = engine.restore(raw),
      proofs = [path, ...histories];
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
    const leave = () => window.CNCWorkshop.home(),
      uiName = {
        firstSession: "CNCStartSessionUI",
        drawingSession: "CNCDrawingSessionUI",
        firstProcess: "CNCFirstProcessUI",
        programSetup: "CNCProgramSetupUI",
        shaftProject: "CNCShaftProjectUI",
        operationCourse: "CNCOperationCourseUI",
        millingCourse: "CNCMillingCourseUI",
        diagnosticCourse: "CNCDiagnosticCourseUI",
      }[key];
    if (proof && !step.subtask) {
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
      if (s.taskId !== step.subtask)
        article.append(
          node(
            "p",
            "Сначала завершите начатую попытку " +
              s.taskId +
              ". Она сохранена и не заменяется другим чертежом.",
            "start-hint",
          ),
        );
    } else if (step.subtask) {
      let s = current || engine.create();
      const definitions =
          key === "operationCourse"
            ? engine.tasks
            : key === "diagnosticCourse"
              ? engine.tasks
              : engine.lessons,
        target = definitions.findIndex((t) => t.id === step.subtask);
      while (
        s.current < target &&
        s.done.some((d) => d.id === definitions[s.current].id)
      ) {
        s = engine.transition(s, {
          type:
            key === "operationCourse" && s.version === 1 && s.current === 4
              ? "upgrade"
              : key === "millingCourse" && s.profile === 1 && s.current === 3
                ? "upgrade"
                : "next",
          ...(key === "operationCourse" && (s.version === 2 || s.current === 4)
            ? { assignment: definitions[s.current + 1].assignment }
            : {}),
        });
      }
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
    const widget = window[uiName].create({
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
