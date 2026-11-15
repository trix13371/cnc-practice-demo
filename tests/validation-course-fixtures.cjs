'use strict';
const fixtures = require('./unified-course-fixtures.cjs');
const diagnostics = require('../diagnostic-course-model.js');
const { plate } = require('../milling-course-model.js');
const plateFixture = require('./milling-plate-fixtures.cjs');
const holeFixture = require('./hole-course-fixtures.cjs');

function withHistories(count = 4) {
  const archive = fixtures.full();
  archive.sections.coursePath.current.holeCourse = holeFixture.book();
  archive.sections.coursePath.current.mountingPlate = require("../mounting-plate-model.js").snapshot(require("./mounting-plate-fixture.cjs").complete());
  const plateLog = plate.snapshot(plateFixture.complete({ restarts: 8 }));
  archive.sections.coursePath.current.millingPlate = plateLog;
  archive.sections.coursePath.current.millingPlateDraft = "Полосы слева и справа, разный Z";
  for (let removed = 1; removed <= count; removed++) {
    const prior = structuredClone(archive.sections.coursePath.current);
    let state = diagnostics.create();
    for (const action of prior.diagnosticCourse.events.slice(0, -removed)) {
      state = diagnostics.transition(state, action);
    }
    prior.diagnosticCourse = diagnostics.snapshot(state);
    prior.holeCourse.works.sleeve.events = prior.holeCourse.works.sleeve.events.slice(0, -removed);
    prior.millingPlate.events = plateLog.events.slice(0, -removed);
    archive.sections.coursePath.history.push(prior);
  }
  return archive;
}
module.exports = { withHistories };
