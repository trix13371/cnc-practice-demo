'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { Element } = require('./helpers/dom.cjs');
let pending = null, starts = 0;
const window = {
  CNCLearningUI: { progress: () => require('../learning-path-model.js').status() },
  CNCCourseUI: { pendingSession: () => pending },
  CNCWorkshop: { results() {} },
};
vm.runInNewContext(fs.readFileSync(require.resolve('../home-ui.js'), 'utf8'), {
  window, document: { createElement: tag => new Element(tag) },
});
const root = window.CNCHomeUI.mount(new Element('main'), () => starts++);
const primary = () => root.all().find(e => e.dataset.homeStart !== undefined);
assert.match(primary().textContent, /Начать обучение/);
pending = { key: 'firstSession', title: 'Первое знакомство', step: 1, total: 9 };
window.CNCHomeUI.render();
assert.match(primary().textContent, /Продолжить обучение/);
assert.match(root.textContent, /2 из 9/);
primary().click();
assert.equal(starts, 1, 'Continue still follows the main route');
console.log('Home: fresh start and saved introductory action have distinct labels and resume the route.');
