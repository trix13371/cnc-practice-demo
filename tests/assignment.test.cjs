"use strict";
const assert = require("node:assert/strict");
const assignment = require("../assignment-model.js");
const identity = {
  id: "operation-shoulder-control",
  contentVersion: 1,
  criteriaVersion: 1,
  profileId: "lathe-xz",
  profileVersion: 1,
  seed: "fixed-01",
};
const checks = [
  { id: "execution", title: "Обработка выполнена", passed: true },
  { id: "control:A", title: "Свежий контроль A", passed: true },
];
assert(assignment.matches(identity, identity));
for (const key of Object.keys(identity)) {
  const broken = {
    ...identity,
    [key]: typeof identity[key] === "number" ? 99 : "unknown",
  };
  assert.equal(assignment.matches(broken, identity), false, key);
  assert.equal(
    assignment.evaluate(broken, identity, checks, false).passed,
    false,
  );
}
assert.equal(
  assignment.matches({ ...identity, passed: true }, identity),
  false,
);
assert.equal(assignment.matches(null, identity), false);
assert.equal(
  assignment.matches(JSON.parse('{"__proto__":{}}'), identity),
  false,
);
assert.equal(assignment.evaluate(identity, identity, [], false).passed, false);
assert.equal(
  assignment.evaluate(identity, identity, [{ ...checks[0], passed: 1 }], false)
    .passed,
  false,
);
assert.equal(
  assignment.evaluate(identity, identity, checks, false).independent,
  true,
);
const assisted = assignment.evaluate(identity, identity, checks, true);
assert(assisted.passed);
assert.equal(assisted.independent, false);
assert.equal(
  assignment.evaluate(
    identity,
    identity,
    [{ ...checks[0], passed: false }],
    false,
  ).passed,
  false,
);
console.log(
  "Assignment: exact content/criteria/profile/seed binding, fail-closed versions and assistance separation passed.",
);
