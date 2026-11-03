(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CNCTrainingMath = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EPS = 1e-9;

  function parseNumber(text) {
    if (typeof text === 'number') {
      return isFinite(text) ? text : null;
    }
    if (typeof text !== 'string') {
      return null;
    }
    var s = text.trim();
    if (s === '') {
      return null;
    }
    if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) {
      return null;
    }
    var normalized = s.replace(',', '.');
    var value = Number(normalized);
    return isFinite(value) ? value : null;
  }

  function isPositiveNumber(value) {
    return typeof value === 'number' && isFinite(value) && value > 0;
  }

  function metrics(diameter, length, feed, rpm) {
    if (!isPositiveNumber(diameter) || !isPositiveNumber(length) ||
        !isPositiveNumber(feed) || !isPositiveNumber(rpm)) {
      throw new RangeError('metrics requires finite positive numbers');
    }
    return {
      surfaceSpeed: Math.PI * diameter * rpm / 1000,
      feedPerMinute: feed * rpm,
      seconds: 60 * length / (feed * rpm)
    };
  }

  function classify(reading, resolution, target, tolerance) {
    if (typeof reading !== 'number' || !isFinite(reading) || reading < 0 ||
        !isPositiveNumber(resolution) || !isPositiveNumber(target) ||
        !isPositiveNumber(tolerance)) {
      throw new RangeError('classify requires valid numeric inputs');
    }

    var low = reading - resolution / 2;
    var high = reading + resolution / 2;
    var targetLow = target - tolerance;
    var targetHigh = target + tolerance;

    if (low >= targetLow - EPS && high <= targetHigh + EPS) {
      return 'ok';
    }
    if (low > targetHigh + EPS) {
      return 'large';
    }
    if (high < targetLow - EPS) {
      return 'small';
    }
    return 'uncertain';
  }

  return {
    parseNumber: parseNumber,
    metrics: metrics,
    classify: classify
  };
});
