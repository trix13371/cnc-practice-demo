(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model.js'));
  } else {
    root.CNCBasicSession = factory(root.CNCModel);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CNCModel) {
  'use strict';

  var VERSION = 1;
  var RESOLUTIONS = [0.1, 0.01];
  var VERDICTS = ['ok', 'large', 'small', 'uncertain'];
  var EPS = 1e-8;

  function isPlainObject(v) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    var proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  }

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isIntInRange(v, lo, hi) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi;
  }

  function findTask(taskId) {
    if (!CNCModel || !Array.isArray(CNCModel.tasks)) return null;
    for (var i = 0; i < CNCModel.tasks.length; i++) {
      if (CNCModel.tasks[i] && CNCModel.tasks[i].id === taskId) return CNCModel.tasks[i];
    }
    return null;
  }

  function copySettings(rawSettings) {
    if (!isPlainObject(rawSettings)) return null;
    var keys = ['x', 'offset', 'feed', 'rpm', 'tool'];
    var out = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!(k in rawSettings)) return null;
      out[k] = rawSettings[k];
    }
    return out;
  }

  function roundTo(value, resolution) {
    return Math.round(value / resolution) * resolution;
  }

  function expectedReading(surface, settings, task, evaluation, resolution) {
    var base = surface === 'stock' ? task.stock : evaluation.finalDiameter;
    if (!isFiniteNumber(base)) return null;
    return roundTo(base, resolution);
  }

  function restoreMeasurement(rawMeasurement, finished, settings, task, evaluation) {
    if (!finished) return null;
    if (!isPlainObject(rawMeasurement)) return null;
    var surface = rawMeasurement.surface;
    if (surface !== 'worked' && surface !== 'stock') return null;
    var resolution = rawMeasurement.resolution;
    if (RESOLUTIONS.indexOf(resolution) === -1) return null;
    var reading = rawMeasurement.reading;
    if (!isFiniteNumber(reading)) return null;
    var expected = expectedReading(surface, settings, task, evaluation, resolution);
    if (expected === null) return null;
    if (Math.abs(reading - expected) > EPS) return null;
    return { surface: surface, reading: reading, resolution: resolution };
  }

  function restore(raw, task) {
    if (!isPlainObject(raw)) return null;
    if (!isPlainObject(task) || typeof task.id !== 'string') return null;
    if (raw.version !== VERSION) return null;
    if (raw.task !== task.id) return null;

    var settings = copySettings(raw.settings);
    if (!settings) return null;

    var evaluation;
    try {
      evaluation = CNCModel.evaluate(settings, task);
    } catch (e) {
      return null;
    }
    if (!isPlainObject(evaluation) || evaluation.valid !== true) return null;

    var finished = raw.finished === true;
    if (finished && evaluation.canAnimate !== true) return null;

    var measurement = restoreMeasurement(raw.measurement, finished, settings, task, evaluation);

    var verdict = '';
    if (measurement && typeof raw.verdict === 'string' && VERDICTS.indexOf(raw.verdict) !== -1) {
      verdict = raw.verdict;
    }

    var inspection = null;
    if (measurement && verdict) {
      try {
        inspection = CNCModel.inspect(settings, task, {
          surface: measurement.surface,
          reading: measurement.reading,
          resolution: measurement.resolution,
          verdict: verdict
        });
      } catch (e) {
        inspection = null;
      }
    }

    var hintLevel = isIntInRange(raw.hintLevel, 0, 3) ? raw.hintLevel : 0;
    var assisted = raw.assisted === true || hintLevel > 0;

    return {
      version: VERSION,
      task: task.id,
      settings: settings,
      finished: finished,
      measurement: measurement,
      verdict: verdict,
      inspection: inspection,
      assisted: assisted,
      hintLevel: hintLevel
    };
  }

  function snapshot(sessionLike) {
    if (!isPlainObject(sessionLike)) return null;
    if (typeof sessionLike.task !== 'string') return null;
    var task = findTask(sessionLike.task);
    if (!task) return null;
    var restored = restore(sessionLike, task);
    if (!restored) return null;
    return {
      version: VERSION,
      task: restored.task,
      settings: restored.settings,
      finished: restored.finished,
      measurement: restored.measurement,
      verdict: restored.verdict,
      assisted: restored.assisted,
      hintLevel: restored.hintLevel
    };
  }

  return {
    restore: restore,
    snapshot: snapshot
  };
});
