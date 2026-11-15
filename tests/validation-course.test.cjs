'use strict';
const assert = require('node:assert/strict');
const validation = require('../server/validation.cjs');
const progress = require('../progress-model.js');
const { withHistories } = require('./validation-course-fixtures.cjs');

(async () => {
  const archive = withHistories();
  const worker = validation.create();
  try {
    const start = performance.now();
    const result = await worker.run({ archive, pilot: null });
    assert.equal(result.summary.progress.done, 76);
    assert.equal(result.value.archive.sections.coursePath.history.length, 4);
    assert.deepEqual(result.value.archive.sections.coursePath.current, archive.sections.coursePath.current);
    assert.equal(result.summary.millingPlate.result.independent, true);
    assert.equal(result.summary.holeCourse.done.length, 6);
    assert(result.summary.holeCourse.done.every(row=>row.independent));
    const elapsed = Math.round(performance.now() - start);
    assert.deepEqual(result.summary, progress.summary(result.value.archive));
    for (const [key, value] of [["criteriaVersion", 99], ["seed", "different-plate"]]) {
      const forged = structuredClone(archive);
      forged.sections.coursePath.current.millingPlate.assignment[key] = value;
      await assert.rejects(worker.run({ archive: forged, pilot: null }), /журнал самостоятельной плиты/);
    }
    const forged = structuredClone(archive);
    forged.sections.coursePath.history[0].millingPlate.done = true;
    await assert.rejects(worker.run({ archive: forged, pilot: null }), /журнал самостоятельной плиты/);
    for (const variant of ["criteria","fake","instrument"]) {
      const forgedHole = structuredClone(archive);
      const journal=forgedHole.sections.coursePath.current.holeCourse.works.sleeve;
      if(variant==="criteria") journal.assignment.criteriaVersion=2;
      if(variant==="fake") journal.complete=true;
      if(variant==="instrument") journal.events[2].instrument="__proto__";
      await assert.rejects(worker.run({archive:forgedHole,pilot:null}),/журнал обработки отверстий/);
    }
    const forgedMounting=structuredClone(archive);
    forgedMounting.sections.coursePath.current.mountingPlate.measured.pop();
    await assert.rejects(worker.run({archive:forgedMounting,pilot:null}),/журнал монтажной плиты/);
    console.log('Full 76-step course with four histories accepted within the 2-second worker limit (' + elapsed + ' ms). Forged journals rejected.');
  } finally {
    worker.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
