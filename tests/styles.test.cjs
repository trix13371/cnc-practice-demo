'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const styles = require('../scripts/build-styles.cjs');
styles.check();
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const links = [...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(links, ['app.css', 'typography.css'], 'Application uses the canonical bundle and shared typography');
for (const file of styles.sources.filter(file => file !== 'tokens.css')) {
  const text = fs.readFileSync(require('node:path').join(__dirname, '../styles', file), 'utf8');
  assert.doesNotMatch(text, /:root\s*\{/, file + ': shared tokens must have one owner');
}
assert.match(fs.readFileSync(require.resolve('../typography.css'), 'utf8'), /@font-face/);
console.log('Styles: canonical sources, generated assets, single token owner and standalone auth typography passed.');
