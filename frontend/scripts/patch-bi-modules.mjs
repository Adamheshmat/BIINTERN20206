import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const oversizedStyleThreshold = 100_000;
const styleMarker = 'styles: ["';
const affectedComponents = ['BiMultiSelectComponent', 'biControlListin2ColComponent'];

export function patchBiModulesSource(source) {
  const ranges = [];

  for (const componentName of affectedComponents) {
    const classStart = source.indexOf(`class ${componentName}`);
    if (classStart === -1) continue;

    const nextClass = source.indexOf('\nclass ', classStart + 1);
    const classEnd = nextClass === -1 ? source.length : nextClass;
    let searchFrom = classStart;

    while (searchFrom < classEnd) {
      const markerStart = source.indexOf(styleMarker, searchFrom);
      if (markerStart === -1 || markerStart >= classEnd) break;

      const contentStart = markerStart + styleMarker.length;
      let contentEnd = contentStart;

      while (contentEnd < classEnd) {
        if (source[contentEnd] === '\\') {
          contentEnd += 2;
          continue;
        }
        if (source[contentEnd] === '"') break;
        contentEnd += 1;
      }

      if (contentEnd - contentStart > oversizedStyleThreshold) {
        ranges.push([contentStart, contentEnd]);
      }
      searchFrom = contentEnd + 1;
    }
  }

  let patched = source;
  for (const [start, end] of ranges.reverse()) {
    patched = `${patched.slice(0, start)}${patched.slice(end)}`;
  }

  if (ranges.length > 0) {
    patched = patched.replace(/\n?\/\/# sourceMappingURL=bi-modules\.mjs\.map\s*$/, '\n');
  }

  return { source: patched, replacements: ranges.length };
}

if (
  process.argv[1] &&
  import.meta.url.startsWith('file:') &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  const modulePath = fileURLToPath(
    new URL('../node_modules/bi-modules/fesm2022/bi-modules.mjs', import.meta.url),
  );
  const original = await readFile(modulePath, 'utf8');
  const result = patchBiModulesSource(original);

  if (result.replacements > 0) {
    await writeFile(modulePath, result.source);
    console.log(`Prepared the BI frontend package (${result.replacements} oversized style copies removed).`);
  }
}
