(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCCourseView = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const lessons = Object.freeze({
    firstSession: "machine",
    drawingSession: "control",
    metrologyCourse: "control",
    firstProcess: "axes",
    programSetup: "setup",
    shaftProject: "verification",
    operationCourse: "verification",
    millingCourse: "verification",
    millingPlate: "verification",
    mountingPlate: "verification",
    holeCourse: "verification",
    diagnosticCourse: "verification",
  });
  function create(kind = "lesson", step = null) {
    if (
      kind !== "lesson" &&
      kind !== "route" &&
      !Object.hasOwn(lessons, kind)
    ) {
      throw Error("Unknown course view");
    }
    if (kind === "route") {
      if (
        step?.kind !== "coursePractice" ||
        !Object.hasOwn(lessons, step.target)
      ) {
        throw Error("Invalid course practice route");
      }
      return { kind, step: { ...step } };
    }
    return { kind, step: null };
  }
  function restore(path) {
    const kind = path?.activePractice;
    return ["operationCourse", "millingCourse", "diagnosticCourse"].includes(
      kind,
    ) && path.selected === lessons[kind]
      ? create(kind)
      : create();
  }
  return Object.freeze({
    create,
    restore,
    lessonFor: (kind) => (Object.hasOwn(lessons, kind) ? lessons[kind] : null),
  });
});
