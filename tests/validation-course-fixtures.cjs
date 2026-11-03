'use strict';
const fixtures = require('./unified-course-fixtures.cjs');
const diagnostics = require('../diagnostic-course-model.js');

function withHistories(count = 4) {
  const archive = fixtures.full();
  for (let removed = 1; removed <= count; removed++) {
    const prior = structuredClone(archive.sections.coursePath.current);
    let state = diagnostics.create();
    for (const action of prior.diagnosticCourse.events.slice(0, -removed)) {
      state = diagnostics.transition(state, action);
    }
    prior.diagnosticCourse = diagnostics.snapshot(state);
    archive.sections.coursePath.history.push(prior);
  }
  return archive;
}
module.exports = { withHistories };
