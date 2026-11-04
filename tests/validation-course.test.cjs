'use strict';
const assert = require('node:assert/strict');
const validation = require('../server/validation.cjs');
const { withHistories } = require('./validation-course-fixtures.cjs');

(async () => {
  const archive = withHistories();
  const worker = validation.create();
  try {
    const start = performance.now();
    const result = await worker.run({ archive, pilot: null });
    assert.equal(result.summary.progress.done, 57);
    assert.equal(result.value.archive.sections.coursePath.history.length, 4);
    assert.deepEqual(result.value.archive.sections.coursePath.current, archive.sections.coursePath.current);
    console.log('Full 57-step course with four histories accepted within the unchanged 2-second worker limit (' + Math.round(performance.now() - start) + ' ms).');
  } finally {
    worker.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
