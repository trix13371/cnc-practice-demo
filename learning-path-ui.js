(function () {
  "use strict";
  const model = window.CNCLearningPath,
    key = "cnc-learning-path-v1",
    directKey = "cnc-course-direct-v1";
  let state = model.restore(null),
    banner,
    direct = false,
    introExercise = null,
    available = true;
  try {
    state = model.restore(JSON.parse(localStorage.getItem(key) || "null"));
  } catch {
    available = false;
  }
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      if (state.active && direct) localStorage.setItem(directKey, introExercise?.id || state.selected);
      else localStorage.removeItem(directKey);
      available = true;
    } catch {
      available = false;
    }
  }
  function evidence() {
    const current = {
      courseSteps: window.CNCProgress.courseEvidence(
        window.CNCCourseUI.pathSnapshot(),
      ),
      lessons: window.CNCCourseUI.answered(),
      basic: window.CNCDemo.basicEvidence("diameter"),
      records: window.CNCDemo.completionRecords(),
      training: window.CNCTrainingUI.pathEvidence(),
      gcode: window.CNCGCodeUI.pathEvidence(),
    };
    return window.CNCProgress.combineEvidence(
      current,
      window.CNCProgressUI?.historicalEvidence() || {},
    );
  }
  const progress = () => model.status(evidence());
  function navigate(id, requested) {
    let step = model.get(id);
    if (!step) return;
    const p = progress(),
      index = model.steps.findIndex((s) => s.id === id);
    if (!requested && !p.items[index].done && p.items.slice(0, index).some((s) => !s.done))
      step = p.next;
    direct = requested;
    introExercise = null;
    state = { version: 1, active: true, selected: step.id };
    save();
    if (step.kind === "coursePractice") window.CNCCourseUI.openRouteStep(step, direct);
    else if (step.kind === "lesson")
      window.CNCWorkshop.openLesson(step.target, true);
    else if (step.kind === "training")
      window.CNCWorkshop.openTraining(
        step.id === "self-cycle"
          ? window.CNCTrainingUI.nextIndependent() || step.target
          : step.target,
        true,
      );
    else if (step.kind === "gcode")
      window.CNCWorkshop.openGCode(
        step.id === "self-code"
          ? window.CNCGCodeUI.nextFinal() || step.target
          : step.target,
        true,
      );
    else window.CNCWorkshop.openPractice(step.target, step.stage, true, direct);
    render();
  }
  const open = (id) => navigate(id, false);
  const openDirect = (id) => navigate(id, true);
  const follow = (id) => navigate(id, direct);
  function openIntroExercise(id) {
    const exercise = window.CNCStartSession.steps.find((step) => step.id === id);
    if (!exercise) return;
    const parent = model.get("practice-firstSession");
    introExercise = { ...parent, id, title: exercise.title, subtask: id };
    direct = true;
    state = { version: 1, active: true, selected: parent.id };
    save();
    window.CNCCourseUI.openRouteStep(introExercise, true);
    render();
  }
  function start() {
    const step = model.resume(state, evidence());
    if (step) open(step.id);
    else finish();
  }
  function finish() {
    state.active = false;
    save();
    window.CNCWorkshop.results();
  }
  function deactivate() {
    state.active = false;
    save();
    render();
  }
  function lesson(id) {
    const step = model.get(state.selected);
    return state.active && step?.kind === "lesson" && step.target === id
      ? step
      : null;
  }
  function continuation(id) {
    const step = lesson(id);
    if (!step) return null;
    const next = model.following(step.id);
    return {
      label: next
        ? "Далее: " + next.title[0].toLowerCase() + next.title.slice(1)
        : "К итогам модуля",
      run: () => (next ? follow(next.id) : finish()),
    };
  }
  function guided() {
    const d = window.CNCDemo.readState();
    return (
      state.active &&
      ["first-cut", "first-control"].includes(state.selected) &&
      d.mode === "learn" &&
      d.task === "diameter"
    );
  }
  function action(stage, data) {
    if (!guided()) return null;
    if (stage === 2 && data.finished && !data.result.success)
      return {
        text: "Исправить настройку X",
        run: () => window.CNCWorkshop.goStage(1),
      };
    if (
      state.selected === "first-cut" &&
      stage === 2 &&
      data.finished &&
      data.result.success
    ) {
      return { text: "Далее: зачем нужен замер", run: () => follow("control") };
    }
    if (state.selected === "first-control" && stage === 3 && data.controlPassed) {
      if (window.CNCDemo.controlPracticeActive())
        return { text: "Все задания курса", run: showOutline };
      return { text: "Далее: подготовка станка", run: () => follow("setup") };
    }
    return null;
  }
  function render() {
    if (!banner) return;
    const screen = document.body.dataset.screen,
      step = model.get(state.selected);
    const relevant =
      state.active &&
      ((screen === "course" &&
        (step?.kind === "coursePractice" ||
          lesson(window.CNCCourseUI.currentId()))) ||
        (screen === "work" && guided()) ||
        (screen === "training" && training()) ||
        (screen === "gcode" && gcode(window.CNCGCodeUI.currentId())));
    document.body.dataset.intro = String(!!relevant && screen === "work");
    document
      .getElementById("workshop-steps")
      .querySelector('[data-stage="3"]').disabled =
      !!relevant && guided() && state.selected === "first-cut";
    banner.hidden = !relevant;
    if (!relevant) return;
    if (screen === "work") {
      const stage = Number(
        document.querySelector('#workshop-steps [aria-current="step"]')?.dataset
          .stage || 0,
      );
      document.getElementById("stage-description").textContent = [
        "Найдите на чертеже диаметр, который нужно получить.",
        "Задайте конечный X. Остальные параметры уже подготовлены.",
        "Проследите четыре этапа движения резца. Затем разберём измерение.",
        "Измерьте обработанный участок и сравните показание с допуском.",
      ][stage];
    }
    const p = progress(),
      nextButton = banner.querySelector("[data-course-next]");
    if (nextButton) {
      const done = p.items.find((i) => i.id === step.id)?.done,
        next = model.following(step.id);
      nextButton.hidden = step.kind !== "coursePractice" || !done || !!introExercise;
      nextButton.textContent = next ? "Далее: " + next.title : "К итогам курса";
      nextButton.onclick = () => (next ? follow(next.id) : finish());
    }
    banner.querySelector("strong").textContent =
      "Учебный путь · шаг " +
      (model.steps.findIndex((s) => s.id === step.id) + 1) +
      " из " +
      model.steps.length;
    const prepared = screen === "work" && window.CNCDemo.controlPracticeActive();
    banner.querySelector("p").textContent = available
      ? (introExercise?.title || step.title) +
        (prepared ? " · пробный контроль на готовой детали" : " · выполнено " + p.done + " из " + p.total)
      : "Маршрут не сохранится после закрытия: хранилище недоступно.";
  }
  function showOutline() {
    window.CNCWorkshop.home();
    window.CNCHomeUI.openOutline();
  }
  function mount(main) {
    banner = node("aside", undefined, "learning-path-banner");
    banner.hidden = true;
    const copy = node("div");
    copy.append(node("strong"), node("p"));
    const back = node("button", "Все задания курса", "course-back");
    back.type = "button";
    back.addEventListener("click", showOutline);
    const nextButton = node("button", "Продолжить курс", "button primary");
    nextButton.type = "button";
    nextButton.dataset.courseNext = "";
    nextButton.hidden = true;
    banner.append(copy, nextButton, back);
    main.querySelector(".learning-bar").after(banner);
    const refresh = () => {
      render();
      if (document.body.dataset.screen === "home") window.CNCHomeUI.render();
    };
    window.addEventListener("cnc-course-change", refresh);
    window.addEventListener("cnc-machine-change", () =>
      requestAnimationFrame(refresh),
    );
    window.addEventListener("cnc-training-change", refresh);
    window.addEventListener("cnc-gcode-change", refresh);
    render();
  }
  function training() {
    return state.active && ["full-cycle", "self-cycle"].includes(state.selected)
      ? { independent: state.selected === "self-cycle" }
      : null;
  }
  function continueTraining() {
    if (state.selected === "full-cycle") follow("self-cycle");
    else if (progress().items.find((s) => s.id === "self-cycle").done)
      follow("code-coordinates");
    else {
      const next = window.CNCTrainingUI.nextIndependent();
      if (next) window.CNCWorkshop.openTraining(next, true);
    }
  }
  function gcode(id) {
    const step = model.get(state.selected);
    return state.active &&
      step?.kind === "gcode" &&
      (step.target === id ||
        (step.id === "self-code" &&
          window.CNCGCodeLearning.finalIds().includes(id)))
      ? step
      : null;
  }
  function codeContinuation(id) {
    const step = gcode(id);
    if (!step) return null;
    if (step.id === "self-code") {
      if (progress().items.find((s) => s.id === "self-code").done)
        return {
          label: "Далее: " + model.following(step.id).title,
          run: () => follow(model.following(step.id).id),
        };
      const next = window.CNCGCodeUI.nextFinal();
      return next && next !== id
        ? {
            label: "Другое условие без помощи",
            run: () => window.CNCWorkshop.openGCode(next, true),
          }
        : {
            label: "К маршруту: итог пока не подтверждён",
            run: () => window.CNCWorkshop.home(),
          };
    }
    const next = model.following(step.id);
    return {
      label: "Далее: " + next.title[0].toLowerCase() + next.title.slice(1),
      run: () => follow(next.id),
    };
  }
  window.CNCLearningUI = {
    mount,
    render,
    progress,
    start,
    open,
    openDirect,
    openIntroExercise,
    finish,
    deactivate,
    lesson,
    continuation,
    guided,
    action,
    training,
    continueTraining,
    gcode,
    codeContinuation,
    capStage: (stage) =>
      guided() && state.selected === "first-cut" ? Math.min(2, stage) : stage,
    restoreSelection(screen) {
      const step = model.get(state.selected);
      if (!state.active || !step) return;
      const targetScreen = { coursePractice: "course", lesson: "course", practice: "work", training: "training", gcode: "gcode" }[step.kind];
      if (screen !== targetScreen) return;
      let remembered;
      try { remembered = localStorage.getItem(directKey); } catch {}
      if (step.id === "practice-firstSession" && remembered && remembered !== step.id)
        openIntroExercise(remembered);
      else if (remembered === step.id) openDirect(step.id);
      else if (step.kind === "coursePractice") open(step.id);
    },
    progressSnapshot: () => state,
    goFurther() {
      open("machine");
    },
  };
})();
