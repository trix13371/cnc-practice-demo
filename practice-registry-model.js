(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./course-model.js")
      : root.CNCCourse,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCPracticeRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (course) {
  "use strict";
  // Activity is intentionally distinct from draft ownership during archive merge.
  // Keep these four books in their historical evidence order.
  const definitions = [
    [
      "metrologyCourse",
      "tasks",
      "metrology-",
      (v) => !!v?.events?.some((e) => e.type !== "begin"),
    ],
    [
      "operationCourse",
      "tasks",
      "operation-",
      (v) => !!course.operationCourse.hasWork(v),
    ],
    ["millingCourse", "lessons", "milling-", (v) => !!v?.events?.length],
    [
      "diagnosticCourse",
      "tasks",
      "diagnostic-",
      (v) => !!v?.events?.length || !!v?.draft?.program || !!v?.draft?.route,
    ],
  ];
  const books = Object.freeze(
    definitions.map(([key, field, prefix, hasWork]) =>
      Object.freeze({
        key,
        prefix,
        hasWork,
        get engine() {
          return course[key];
        },
        get definitions() {
          return course[key][field];
        },
      }),
    ),
  );
  return Object.freeze({
    books,
    get: (key) => books.find((b) => b.key === key) || null,
  });
});
