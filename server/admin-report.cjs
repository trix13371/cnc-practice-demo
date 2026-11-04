"use strict";
const diagnostics = require("../diagnostic-course-model.js");
const milling = require("../milling-course-model.js");
const operations = require("../operation-course-model.js");
const metrology = require("../metrology-course-model.js");
const curriculum = require("../curriculum-model.js");

// Presentation fields only. Journal IDs, reasons and stored evidence stay intact.
function describe(summary) {
  if (!summary) return summary;
  const result = { ...summary };
  if (summary.rows)
    result.rows = summary.rows.map((row) => {
      const goal = curriculum.get(row.id);
      return {
        ...row,
        learningGoal: goal?.objective || "Цель не описана в этой версии курса",
        evidenceScope:
          goal?.evidenceScope || "Область проверки требует уточнения.",
      };
    });
  for (const [key, tasks] of [
    ["metrologyCourse", metrology.tasks],
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
      originalIncident: (() => {
        const t = diagnostics.tasks.find((t) => t.id === row.id);
        const f = t && diagnostics.original(t).incident;
        return f
          ? {
              row: f.row,
              source: f.raw,
              code: f.code,
              part: f.part || null,
              obstacle: f.obstacle || null,
            }
          : null;
      })(),
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
