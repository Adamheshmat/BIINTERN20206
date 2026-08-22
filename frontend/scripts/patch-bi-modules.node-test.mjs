import assert from 'node:assert/strict';
import test from 'node:test';

import { patchBiModulesSource } from './patch-bi-modules.mjs';

test('removes only oversized inline BI styles and their stale source map', () => {
  const largeStyle = 'x'.repeat(100_001);
  const source = [
    'class BiMultiSelectComponent {',
    '  small = { styles: ["keep-me"] };',
    `  large = { styles: ["${largeStyle}"] };`,
    '}',
    '//# sourceMappingURL=bi-modules.mjs.map',
  ].join('\n');

  const result = patchBiModulesSource(source);

  assert.match(result.source, /styles: \["keep-me"\]/);
  assert.match(result.source, /large = \{ styles: \[""\] \};/);
  assert.doesNotMatch(result.source, /sourceMappingURL/);
  assert.equal(result.replacements, 1);
});

test('keeps oversized styles on unrelated BI components', () => {
  const largeStyle = 'x'.repeat(100_001);
  const source = `class BIGridComponent { value = { styles: ["${largeStyle}"] }; }`;

  const result = patchBiModulesSource(source);

  assert.equal(result.source, source);
  assert.equal(result.replacements, 0);
});
