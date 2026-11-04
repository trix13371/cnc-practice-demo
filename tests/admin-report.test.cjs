"use strict";
const assert = require("node:assert/strict");
const progress = require("../progress-model.js"),
  diagnostics = require("../diagnostic-course-model.js"),
  milling = require("../milling-course-model.js");
const { describe } = require("../server/admin-report.cjs");
const archive = progress.empty();
archive.sections.coursePath.current.diagnosticCourse = diagnostics.snapshot(
  require("./diagnostic-course-fixtures.cjs").complete(),
);
archive.sections.coursePath.current.millingCourse = milling.snapshot(
  require("./milling-course-fixtures.cjs").complete(),
);
const summary = progress.summary(archive),
  before = JSON.stringify({ archive, summary }),
  report = describe(summary);
assert.equal(
  JSON.stringify({ archive, summary }),
  before,
  "Formatting an admin report must not mutate evidence or stored summaries",
);
assert.equal(report.diagnosticCourse.done[0].title, diagnostics.tasks[0].title);
assert.equal(
  report.diagnosticCourse.done[0].causeTitle,
  diagnostics.causes.rapid,
);
assert.equal(report.millingCourse.done[1].title, milling.lessons[1].title);
assert.equal(
  report.millingCourse.done[1].diagnosticTitles[0],
  milling.faults.FIXTURE[0],
);
assert(
  report.millingCourse.incidents.some(
    (e) => e.title === milling.faults.HOLDER_FIXTURE[0],
  ),
);
assert.deepEqual(report.progress, summary.progress);
const curriculum = require("../curriculum-model.js");
for (const row of report.rows) {
  assert.equal(row.learningGoal, curriculum.get(row.id).objective);
  assert.equal(row.evidenceScope, curriculum.get(row.id).evidenceScope);
  const { learningGoal, evidenceScope, ...original } = row;
  assert.deepEqual(
    original,
    summary.rows.find((r) => r.id === row.id),
  );
}
assert.equal(
  describe({ rows: [{ id: "constructor", done: true }] }).rows[0].learningGoal,
  "Цель не описана в этой версии курса",
);
assert.deepEqual(describe({ progress: summary.progress }), {
  progress: summary.progress,
});
assert.equal(describe(null), null);
assert.equal(
  describe({
    ...summary,
    diagnosticCourse: {
      ...summary.diagnosticCourse,
      done: [{ id: "obsolete", cause: "constructor" }],
    },
  }).diagnosticCourse.done[0].causeTitle,
  "Причина не описана в этой версии",
);
console.log(
  "Admin report: canonical task/fault titles, legacy fallbacks and immutable original evidence passed.",
);
