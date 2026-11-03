"use strict";
const diagnostics = require("../diagnostic-course-model.js");
const milling = require("../milling-course-model.js");
const operations = require("../operation-course-model.js");

// Presentation fields only. Journal IDs, reasons and stored evidence stay intact.
function describe(summary) {
  if (!summary) return summary;
  const result = { ...summary };
  for (const [key, tasks] of [
    ["diagnosticCourse", diagnostics.tasks],
    ["millingCourse", milling.lessons],
    ["operationCourse", operations.tasks],
  ]) {
    const block = summary[key];
    if (!block) continue;
    result[key] = {
      ...block,
      done: block.done.map((row) => ({
        ...row,
        title:
          tasks.find((task) => task.id === row.id)?.title ||
          "Задание не описано в этой версии",
      })),
    };
  }
  if (result.diagnosticCourse)
    result.diagnosticCourse.done = result.diagnosticCourse.done.map((row) => ({
      ...row,
      causeTitle: Object.hasOwn(diagnostics.causes, row.cause)
        ? diagnostics.causes[row.cause]
        : "Причина не описана в этой версии",
    }));
  const faultTitle = (code) =>
    Object.hasOwn(milling.faults, code)
      ? milling.faults[code][0]
      : "Ошибка не описана в этой версии";
  if (result.millingCourse) {
    result.millingCourse.done = result.millingCourse.done.map((row) => ({
      ...row,
      diagnosticTitles: row.diagnostics.map(faultTitle),
    }));
    result.millingCourse.incidents = result.millingCourse.incidents.map(
      (event) => ({ ...event, title: faultTitle(event.code) }),
    );
  }
  return result;
}
module.exports = { describe };
