"use strict";
const assert = require("node:assert/strict");
const { analyze, fromLegacy } = require("../internal-profile-model.js");
const real = require("../real-machine-model.js");
const radial = require("../radial-ops-model.js");

const segment = (length, diameter, endDiameter = diameter) => ({ length, diameter, endDiameter });
const cylinderVolume = (diameter, length) => Math.PI * (diameter / 2) ** 2 * length;
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const stock = { frontZ: -2, outer: [segment(60, 32)], inner: [] };

const solid = analyze(stock);
assert.equal(solid.kind, "solid");
assert.equal(solid.backZ, -62);
assert.equal(solid.boreDepth, 0);
assert.equal(solid.boreEndZ, null);
assert.equal(solid.minWall, null);
near(solid.materialVolume, cylinderVolume(32, 60));

const blind = analyze({ ...stock, inner: [segment(10, 16), segment(12, 10)] });
assert.equal(blind.kind, "blind");
assert.equal(blind.boreDepth, 22);
assert.equal(blind.boreEndZ, -24);
assert.equal(blind.minWall, 8);
assert.equal(blind.outerVolume, solid.outerVolume);
near(blind.voidVolume, cylinderVolume(16, 10) + cylinderVolume(10, 12));
near(blind.materialVolume, 14420 * Math.PI);

const through = analyze({ ...stock, inner: [segment(60, 16)] });
assert.equal(through.kind, "through");
assert.equal(through.boreEndZ, through.backZ);
near(through.materialVolume, cylinderVolume(32, 60) - cylinderVolume(16, 60));

const pointed = analyze({ ...stock, inner: [segment(15, 16), segment(4, 16, 0)] });
assert.equal(pointed.kind, "blind");
assert.equal(pointed.boreDepth, 19);
near(pointed.voidVolume, cylinderVolume(16, 15) + cylinderVolume(16, 4) / 3);

// Separate, unaligned breakpoints. At depth 8, the inner shoulder is wider
// while the outside is still tapering. The narrowest wall lies at depth 10.
const compound = {
  frontZ: 0,
  outer: [segment(10, 28, 20), segment(10, 24)],
  inner: [segment(8, 10), segment(7, 18, 14)],
};
const unchanged = structuredClone(compound);
const combined = analyze(compound);
assert.equal(combined.kind, "blind");
near(combined.minWall, (20 - (18 - 4 * 2 / 7)) / 2);
const outsideFrustum = Math.PI * 10 / 3 * (14 ** 2 + 14 * 10 + 10 ** 2);
const insideFrustum = Math.PI * 7 / 3 * (9 ** 2 + 9 * 7 + 7 ** 2);
near(combined.outerVolume, outsideFrustum + cylinderVolume(24, 10));
near(combined.voidVolume, insideFrustum + cylinderVolume(10, 8));
assert.deepEqual(compound, unchanged);

for (const [profile, reason] of [
  [{ ...stock, inner: [segment(61, 10)] }, /за длину/],
  [{ ...stock, inner: [segment(20, 32)] }, /нулевую стенку/],
  [{ ...stock, inner: [segment(20, 34)] }, /наружный профиль/],
  [{ ...stock, inner: [segment(60, 16, 0)] }, /открытый выход/],
  [{ ...stock, inner: [segment(5, 16, 0), segment(6, 10)] }, /длина|длину/],
  [{ ...stock, inner: [segment(0, 16)] }, /длина|длину/],
  [{ ...stock, outer: [segment(10, 28), segment(4, 11), segment(16, 28)], inner: [segment(24, 12)] }, /наружный профиль/],
  [{ ...stock, outer: [segment(10, 40), segment(10, 20)], inner: [segment(10, 38), segment(10, 8)] }, /разрывают/],
  [{ ...stock, outer: [segment(0.1, 40), segment(0.2, 40), segment(1, 20)], inner: [segment(0.3, 38), segment(1, 8)] }, /разрывают/],
]) {
  assert.throws(() => analyze(profile), reason);
}
assert.equal(analyze({ frontZ: 0, outer: [segment(0.1, 32), segment(0.2, 32)], inner: [segment(0.3, 16)] }).kind, "through");
assert.throws(() => analyze({ ...stock, frontZ: Infinity }));
assert.throws(() => analyze({ ...stock, outer: Array(257).fill(segment(1, 32)) }));

const oldTube = real.restoreWork(real.newWork("Труба", {
  diameter: 32, length: 60, grip: 15, shape: "tube", bore: 16,
})).state.profile;
const adapted = fromLegacy(oldTube);
assert.deepEqual(adapted.inner, [segment(60, 16)]);
near(analyze(adapted).materialVolume, radial.volume(oldTube));
const faced = {
  frontZ: -5, bore: 6,
  segments: [{ ...segment(12, 30, 20), bore: 6 }, { ...segment(8, 20, 16), bore: 6 }],
};
assert.deepEqual(fromLegacy(faced).outer, [segment(8, 16, 20), segment(12, 20, 30)]);
assert.equal(analyze(fromLegacy(faced)).backZ, -25);
near(analyze(fromLegacy(faced)).materialVolume, radial.volume(faced));
assert.deepEqual(fromLegacy({ segments: [{ length: 60, diameter: 32 }] }).inner, []);
assert.throws(() => fromLegacy({ ...oldTube, segments: [{ ...oldTube.segments[0], bore: 8 }] }), /постоянный диаметр/);

const { input, expected } = require("../model-spec-model.js").manifest().internalProfile.example;
const documented = analyze(input);
const { materialVolumeOverPi, ...dimensions } = expected;
for (const [key, value] of Object.entries(dimensions)) assert.equal(documented[key], value);
near(documented.materialVolume, materialVolumeOverPi * Math.PI);
console.log("Internal profile: independent volumes, shoulders and tapers, blind/through boundaries and legacy conversion passed.");
