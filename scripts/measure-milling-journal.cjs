"use strict";
// Synthetic learner exploration; never reads accounts or a database.
const m = require("../milling-course-model.js"),
  f = require("../tests/milling-course-fixtures.cjs");
const full = f.complete(3),
  insertions = [];
let state = m.create(3);
for (const [i, action] of full.events.entries()) {
  state = m.transition(state, action);
  if (action.type === "setup" && action.key === "door" && action.value === true)
    insertions.push({
      after: i,
      lesson: state.current,
      action: {
        type: "preview",
        x: state.position.x,
        y: state.position.y,
        z: state.position.z,
        mode: "G0",
      },
    });
}
const rows = [];
for (const attemptsPerLesson of [0, 10, 20, 30, 40]) {
  const events = [];
  for (const [i, action] of full.events.entries()) {
    events.push(action);
    const entry = insertions.find((v) => v.after === i);
    if (entry)
      for (let j = 0; j < attemptsPerLesson; j++) events.push(entry.action);
  }
  const raw = { ...m.snapshot(full), events },
    start = performance.now(),
    restored = m.restore(raw);
  rows.push({
    attemptsPerLesson,
    events: events.length,
    accepted: !!restored,
    completed: restored?.done.length || 0,
    restoreMs: Math.round(performance.now() - start),
  });
}
console.log(
  JSON.stringify(
    {
      baselineEvents: full.events.length,
      lessons: m.lessonCount(full),
      limit: 480,
      rows,
    },
    null,
    2,
  ),
);
