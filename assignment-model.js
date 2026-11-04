(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCAssignment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const keys = [
    "id",
    "contentVersion",
    "criteriaVersion",
    "profileId",
    "profileVersion",
    "seed",
  ];
  function valid(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)) &&
      ["id", "profileId", "seed"].every(
        (key) =>
          typeof value[key] === "string" &&
          /^[a-zA-Z0-9_-]{1,100}$/.test(value[key]),
      ) &&
      ["contentVersion", "criteriaVersion", "profileVersion"].every(
        (key) => Number.isSafeInteger(value[key]) && value[key] > 0,
      )
    );
  }
  function matches(value, expected) {
    return !!(
      valid(value) &&
      valid(expected) &&
      keys.every((key) => value[key] === expected[key])
    );
  }
  // Checks must be computed by the owning replay engine. No API accepts them as learner evidence.
  function evaluate(value, expected, checks, assisted) {
    const validChecks =
      Array.isArray(checks) &&
      checks.length > 0 &&
      checks.length <= 64 &&
      checks.every(
        (check) =>
          check &&
          typeof check.id === "string" &&
          typeof check.title === "string" &&
          typeof check.passed === "boolean",
      ) &&
      new Set(checks.map((check) => check.id)).size === checks.length;
    const valid =
      matches(value, expected) && validChecks && typeof assisted === "boolean";
    const passed = !!(valid && checks.every((check) => check.passed));
    return {
      valid: !!valid,
      passed,
      independent: passed && !assisted,
      checks: valid
        ? checks.map(({ id, title, passed }) => ({ id, title, passed }))
        : [],
    };
  }
  return Object.freeze({ matches, evaluate });
});
