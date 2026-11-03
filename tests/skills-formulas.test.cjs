'use strict';
// OpenRouter / DeepSeek draft; reviewed and corrected the depth question ID.
const assert = require("node:assert/strict");
const m = require("../skills-model.js");

const mults = [1, 1.5, 2];
for (let v = 0; v <= 11; v++) {
  const q = m.question("passes", v);
  const expected = Math.ceil((32 + 2 * (v % 4) - 24 - 0.4) / (2 * mults[Math.floor(v / 4)]));
  assert.equal(q.value, expected, `value for v=${v}`);
  assert.equal(m.evaluate(q, expected).correct, true, `correct for v=${v}`);
  assert.equal(m.evaluate(q, expected + 1).correct, false, `incorrect for v=${v}`);
}

const depth = m.question("depth", 1);
assert.equal(depth.value, 1.4);
assert.equal(m.evaluate(depth, "1,4").valid, true);
assert.equal(m.evaluate(depth, "1,4").correct, true);
for (const bad of [null, "", "1.4mm"]) {
  assert.equal(m.evaluate(depth, bad).valid, false, `invalid for ${JSON.stringify(bad)}`);
}

console.log("Independent pass-count and decimal input checks passed.");
