'use strict';

var assert = require('assert');
var math = require('../training-math.js');

function approx(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 1e-9, msg + ': ' + actual + ' vs ' + expected);
}

// parseNumber
assert.strictEqual(math.parseNumber('12.5'), 12.5);
assert.strictEqual(math.parseNumber('12,5'), 12.5);
assert.strictEqual(math.parseNumber('-3,25'), -3.25);
assert.strictEqual(math.parseNumber('+7'), 7);
assert.strictEqual(math.parseNumber('0'), 0);
assert.strictEqual(math.parseNumber(42), 42);
assert.strictEqual(math.parseNumber(''), null);
assert.strictEqual(math.parseNumber('   '), null);
assert.strictEqual(math.parseNumber(null), null);
assert.strictEqual(math.parseNumber(undefined), null);
assert.strictEqual(math.parseNumber('0x10'), null);
assert.strictEqual(math.parseNumber('1e3'), null);
assert.strictEqual(math.parseNumber([1]), null);
assert.strictEqual(math.parseNumber({}), null);
assert.strictEqual(math.parseNumber(true), null);
assert.strictEqual(math.parseNumber(Infinity), null);
assert.strictEqual(math.parseNumber(NaN), null);
assert.strictEqual(math.parseNumber('1.2.3'), null);

// metrics
var m = math.metrics(50, 100, 0.2, 1000);
approx(m.surfaceSpeed, Math.PI * 50 * 1000 / 1000, 'surfaceSpeed');
approx(m.feedPerMinute, 200, 'feedPerMinute');
approx(m.seconds, 60 * 100 / 200, 'seconds');

assert.throws(function () { math.metrics(0, 100, 0.2, 1000); }, RangeError);
assert.throws(function () { math.metrics(50, -1, 0.2, 1000); }, RangeError);
assert.throws(function () { math.metrics(50, 100, 0, 1000); }, RangeError);
assert.throws(function () { math.metrics(50, 100, 0.2, Infinity); }, RangeError);
assert.throws(function () { math.metrics('50', 100, 0.2, 1000); }, RangeError);
assert.throws(function () { math.metrics(50, 100, 0.2, NaN); }, RangeError);

// classify
// Coarse reading exactly at tolerance boundary -> uncertain
assert.strictEqual(math.classify(10.0, 0.5, 10.0, 0.2), 'uncertain');
// Finer measurement fully inside tolerance -> ok
assert.strictEqual(math.classify(10.0, 0.1, 10.0, 0.2), 'ok');
// Entirely above target band -> large
assert.strictEqual(math.classify(11.0, 0.1, 10.0, 0.2), 'large');
// Entirely below target band -> small
assert.strictEqual(math.classify(9.0, 0.1, 10.0, 0.2), 'small');
// Interval straddling upper boundary -> uncertain
assert.strictEqual(math.classify(10.15, 0.2, 10.0, 0.2), 'uncertain');
// Interval straddling lower boundary -> uncertain
assert.strictEqual(math.classify(9.85, 0.2, 10.0, 0.2), 'uncertain');
// Exact fit at boundaries -> ok
assert.strictEqual(math.classify(10.0, 0.4, 10.0, 0.2), 'ok');

assert.throws(function () { math.classify(-1, 0.1, 10, 0.2); }, RangeError);
assert.throws(function () { math.classify(10, 0, 10, 0.2); }, RangeError);
assert.throws(function () { math.classify(10, 0.1, 0, 0.2); }, RangeError);
assert.throws(function () { math.classify(10, 0.1, 10, 0); }, RangeError);
assert.throws(function () { math.classify('10', 0.1, 10, 0.2); }, RangeError);
assert.throws(function () { math.classify(10, 0.1, 10, Infinity); }, RangeError);

console.log('All training-math tests passed');
