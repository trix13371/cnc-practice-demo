"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const curriculum = require("../curriculum-model.js"),
  path = require("../learning-path-model.js");
const manifest = curriculum.manifest();
assert.equal(manifest.version, 1);
assert.match(manifest.prerequisitePolicy.step, /не подтверждение освоения/);
assert(
  curriculum.get("code-modal").prerequisites.includes("gcode"),
  "An introduced topic may be required again when a later step deepens it",
);
assert.deepEqual(
  manifest.steps.map((s) => s.id).sort(),
  path.steps.map((s) => s.id).sort(),
  "Every existing route step must have an explicit pedagogical mapping",
);
assert.equal(new Set(manifest.steps.map((s) => s.id)).size, 57);
const skills = new Map(manifest.competencies.map((s) => [s.id, s]));
assert.equal(
  skills.size,
  manifest.competencies.length,
  "Duplicate competency ID",
);
assert.equal(new Set(manifest.families.map((f) => f.id)).size, 10);
const active = new Set(),
  visited = new Set();
function visit(id) {
  assert(skills.has(id), "Unknown prerequisite " + id);
  assert(!active.has(id), "Prerequisite cycle " + id);
  if (visited.has(id)) return;
  active.add(id);
  for (const prior of skills.get(id).prerequisites) visit(prior);
  active.delete(id);
  visited.add(id);
}
for (const skill of skills.values()) visit(skill.id);
for (const step of manifest.steps) {
  assert(step.objective.length > 25);
  assert.equal(step.title, path.get(step.id).title);
  assert(step.evidenceScope.length > 25);
  assert(step.competencies.length);
  assert(manifest.families.some((f) => f.id === step.family));
  for (const id of [...step.competencies, ...step.prerequisites])
    assert(skills.has(id));
  assert(
    [
      "orientation",
      "concept",
      "guided-practice",
      "programming",
      "diagnosis",
      "project",
      "transfer",
    ].includes(step.format),
  );
}
for (const step of manifest.steps) {
  for (const variant of manifest.steps.filter(
    (s) => s.conditionId === step.conditionId,
  )) {
    assert.equal(
      variant.family,
      step.family,
      "Variants cannot cross operation families",
    );
    assert.deepEqual(variant.competencies, step.competencies);
  }
}
assert.deepEqual(
  curriculum.get("practice-firstSession").prerequisites,
  [],
  "The first activity must not assume CNC knowledge",
);
assert.equal(curriculum.get("constructor"), null);
assert.equal(curriculum.get("machine").format, "concept");
assert.equal(
  curriculum.get("project-RF5-SHAFT-01").conditionId,
  curriculum.get("project-RF5-SHAFT-02").conditionId,
);
assert.notEqual(
  curriculum.get("project-RF5-SHAFT-01").conditionId,
  curriculum.get("project-RF5-SHAFT-04").conditionId,
  "A changed planning decision is distinct from changing dimensions",
);
const coverage = curriculum.coverage();
assert.equal(coverage.routeSteps, 57);
assert.equal(coverage.conditions, 55);
assert.equal(coverage.parameterVariants, 2);
assert.equal(coverage.families.find((f) => f.id === "holes").status, "planned");
assert(
  coverage.families
    .filter((f) => f.routeSteps)
    .every((f) => f.status === "partial"),
  "Presence is not full pedagogical coverage",
);
assert.equal(
  coverage.mastery,
  undefined,
  "A content catalogue must never manufacture learner mastery",
);
manifest.steps[0].objective = "tampered";
assert.notEqual(curriculum.get(manifest.steps[0].id).objective, "tampered");
assert(Object.isFrozen(curriculum.get("machine")));
assert.throws(
  () => curriculum.get("machine").competencies.push("forged"),
  TypeError,
);
assert.deepEqual(
  JSON.parse(
    fs.readFileSync(require.resolve("../docs/curriculum-map.json"), "utf8"),
  ),
  curriculum.manifest(),
  "The reviewable JSON must match the executable registry",
);
console.log(
  "Curriculum: complete 57-step mapping, prerequisite DAG, honest content coverage, variant accounting and immutable metadata passed.",
);
