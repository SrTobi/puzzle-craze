import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { generateLevel } from '../src/generation/generator.ts';
import { serializeLevel } from '../src/game/level-format.ts';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: 'mixed-v4' },
    count: { type: 'string', default: '6' },
    'numbered-clue-chance': { type: 'string', default: '0.5' },
    'max-assumption-depth': { type: 'string', default: '1' },
    width: { type: 'string' },
    height: { type: 'string' },
    top: { type: 'string' },
    out: {
      type: 'string',
      default: fileURLToPath(new URL('../src/levels/numbered/', import.meta.url)),
    },
  },
});
const count = Number(values.count);
const numberedClueChance = Number(values['numbered-clue-chance']);
if (!Number.isFinite(numberedClueChance) || numberedClueChance < 0 || numberedClueChance > 1)
  throw new Error('Numbered clue chance must be between 0 and 1.');
const maxAssumptionDepth = Number(values['max-assumption-depth']);
if (![0, 1, 2].includes(maxAssumptionDepth))
  throw new Error('Assumption depth must be 0, 1, or 2.');
if (!Number.isSafeInteger(count) || count < 1 || count > 100)
  throw new Error('Count must be between 1 and 100.');
if (!/^[a-z0-9-]+$/i.test(values.seed!))
  throw new Error('Use letters, numbers and hyphens in the seed.');
const customSize = [values.width, values.height, values.top].some((value) => value !== undefined);
if (customSize && [values.width, values.height, values.top].some((value) => value === undefined)) {
  throw new Error('Provide width, height and top together.');
}
const sizes = [
  [6, 6, 5],
  [6, 6, 5],
  [7, 7, 6],
  [7, 7, 6],
  [8, 8, 7],
  [8, 8, 7],
];
const names = [
  'A quiet clue',
  'Paper trails',
  'Unspoken spaces',
  'A subtle turn',
  'Reading between',
  'A little room',
  'Cross purposes',
  'An open question',
  'Farther afield',
  'The missing number',
  'Space to think',
  'One last twist',
];
const output = resolve(values.out!);
const batch = [];
const layouts = new Set<string>();
for (let i = 0; i < count; i++) {
  const [width, height, top] = customSize
    ? [Number(values.width), Number(values.height), Number(values.top)]
    : sizes[Math.min(Math.floor((i * sizes.length) / count), sizes.length - 1)];
  const seed = `${values.seed}-${String(i + 1).padStart(2, '0')}`;
  const level = generateLevel({ seed, width, height, top, maxAssumptionDepth, numberedClueChance });
  const layout = `${width}x${height}:${level.solution.join(',')}`;
  if (layouts.has(layout))
    throw new Error('Duplicate layout in batch; try a different seed. No files written.');
  layouts.add(layout);
  level.name = names[i] ?? `Numbered regions ${i + 1}`;
  const path = join(output, `${level.id}.json`);
  const exists = await access(path).then(
    () => true,
    () => false,
  );
  if (exists)
    throw new Error(`Refusing to replace ${path}; choose another seed or output directory.`);
  batch.push({
    path,
    source: {
      ...serializeLevel(level),
    },
  });
}
await mkdir(output, { recursive: true });
for (const { path, source } of batch) {
  await writeFile(path, `${JSON.stringify(source, null, 2)}\n`, { flag: 'wx' });
  const numbered = source.region_clues?.length ?? 0;
  const plain = source.initial_open.filter(
    ([x, y]) =>
      source.level[y][x] === '.' && !source.region_clues?.some(([cx, cy]) => cx === x && cy === y),
  ).length;
  console.log(
    `Generated ${source.name}: ${source.width}×${source.height}, ${plain} plain + ${numbered} numbered clues; ${source.generation!.forcedMoves} forced moves, ${source.generation!.lookaheadMoves} lookahead moves, depth ${source.generation!.requiredAssumptionDepth}; unique solution verified.`,
  );
}
