import { expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import { shapeMask } from './masks';

it('fully covers a million-point board within a bounded generation pass', () => {
  const start = performance.now();
  const result = generatePuzzle({ columns: 1024, rows: 1024, seed: 'million', length: 16 });
  expect(result.generation.stats.cells).toBe(1048576);
  expect(result.generation.repairs).toHaveLength(0);
  console.info(
    '1024×1024 generation:',
    Math.round(performance.now() - start),
    'ms',
    result.generation.stats,
  );
}, 60000);

it('generates varied rectangles and masks across seeds', () => {
  let bent = 0;
  for (let seed = 0; seed < 20; seed++) {
    const result = generatePuzzle({ columns: 32, rows: 32, seed: String(seed) });
    expect(result.generation.stats.cells).toBe(1024);
    if (result.level.arrows.some((arrow) => arrow.points.length > 2)) bent++;
  }
  expect(bent).toBeGreaterThan(15);
  const start = performance.now();
  const result = generatePuzzle({
    columns: 256,
    rows: 256,
    mask: shapeMask('cat', 256, 256),
    seed: 'big-cat',
  });
  expect(result.generation.repairs.length).toBeLessThan(30);
  console.info(
    '256×256 cat generation:',
    Math.round(performance.now() - start),
    'ms',
    result.generation.stats,
  );
}, 20000);
