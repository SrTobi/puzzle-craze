import { describe, expect, it } from 'vitest';
import { generatePuzzle, type GeneratorDifficulty } from './generator';
import { cells, blocker } from '../game/engine';
import { shapeMask, pixelsToMask } from './masks';
import { PuzzleIndex } from '../game/puzzleIndex';
import { CellGrid } from '../game/grid';
import { exitDistance } from './frontier';

const difficulties: GeneratorDifficulty[] = ['easy', 'hard', 'super-hard'];

describe('carved puzzle generation', () => {
  it.each([
    [2, 1],
    [1, 9],
    [3, 3],
    [12, 10],
    [31, 19],
    [64, 64],
  ])('carves a solvable %i × %i board with accurately recorded holes', (columns, rows) => {
    const result = generatePuzzle({ columns, rows, seed: 'full', repair: false });
    expect(result.generation.repairs).toEqual([]);
    const occupied = result.level.arrows.flatMap(cells).map((p) => p.join(','));
    expect(occupied.length).toBeGreaterThan(0);
    expect(new Set(occupied).size).toBe(occupied.length);
    expect(occupied.length + result.generation.uncovered.length).toBe(columns * rows);
    expect(result.generation.stats.cells).toBe(occupied.length);
    expect(result.generation.stats.uncovered).toBe(result.generation.uncovered.length);
    const finalMask = result.generation.finalMask.join('');
    for (let p = 0; p < columns * rows; p++)
      expect(finalMask[p]).toBe(
        occupied.includes(`${p % columns},${Math.floor(p / columns)}`) ? '1' : '0',
      );
    for (const point of result.generation.uncovered)
      expect(occupied).not.toContain(point.join(','));
    expect(result.generation.solution.length).toBe(result.level.arrows.length);
  });
  it('is deterministic for the same seed and differs for another seed', () => {
    const input = { columns: 16, rows: 16, seed: 'repeat' };
    expect(generatePuzzle(input)).toEqual(generatePuzzle(input));
    expect(generatePuzzle(input).level.arrows).not.toEqual(
      generatePuzzle({ ...input, seed: 'different' }).level.arrows,
    );
  });
  it.each(difficulties)('records and reproduces a solvable %s preset', (difficulty) => {
    const input = { columns: 24, rows: 20, seed: 'difficulty', difficulty };
    const result = generatePuzzle(input);
    expect(result).toEqual(generatePuzzle(input));
    expect(result.level.difficulty).toBe(difficulty);
    expect(result.generation.difficulty).toBe(difficulty);
    expect(result.generation.version).toBe(6);
    expect(result.generation.stats.cells + result.generation.stats.uncovered).toBe(480);
    const index = new PuzzleIndex(result.level.arrows, result.level.grid);
    for (const arrow of result.level.arrows) {
      expect(index.hit(arrow)).toBeUndefined();
      index.remove(arrow.id);
    }
    expect(index.grid.count).toBe(0);
  });
  it('increases the number of arrows across difficulty presets', () => {
    const totals = difficulties.map((difficulty) =>
      ['one', 'two', 'three'].reduce(
        (sum, seed) =>
          sum +
          generatePuzzle({
            columns: 32,
            rows: 24,
            seed,
            difficulty,
          }).generation.stats.arrows,
        0,
      ),
    );
    expect(totals[0]).toBeLessThan(totals[1]);
    expect(totals[1]).toBeLessThan(totals[2]);
  });
  it.each([
    [200, 1],
    [1, 200],
  ])('mixes deep and random entries on %i × %i while preserving a solution', (columns, rows) => {
    const result = generatePuzzle({ columns, rows, seed: 'deep-entry', difficulty: 'super-hard' });
    expect(result.generation.stats.uncovered).toBe(0);
    const grid = new CellGrid(columns, rows, new Uint8Array(columns * rows).fill(1));
    let deepest = 0,
      explored = 0;
    for (const arrow of result.level.arrows) {
      const points = cells(arrow);
      const [x, y] = points.at(-1)!;
      const [bx, by] = points.at(-2)!;
      const direction = x < bx ? 0 : x > bx ? 1 : y < by ? 2 : 3;
      const chosen = (y * columns + x) * 4 + direction;
      const candidates: number[] = [];
      grid.occupied.forEach((occupied, point) => {
        if (!occupied) return;
        for (let d = 0; d < 4; d++) {
          const back = grid.adjacent(point, d ^ 1);
          if (grid.links[d][point] < 0 && back >= 0 && grid.occupied[back])
            candidates.push(point * 4 + d);
        }
      });
      expect(candidates).toContain(chosen);
      const maxDistance = Math.max(
        ...candidates.map((entry) => exitDistance(entry, columns, rows)),
      );
      if (exitDistance(chosen, columns, rows) === maxDistance) deepest++;
      else explored++;
      points.forEach(([px, py]) => grid.remove(py * columns + px));
    }
    expect(explored).toBeGreaterThan(0);
    expect(deepest).toBeGreaterThan(0);
    expect(grid.count).toBe(0);
  });
  it.each(
    (['heart', 'cat', 'butterfly'] as const).flatMap((shape) =>
      difficulties.map((difficulty) => ({ shape, difficulty })),
    ),
  )('records all covered and empty points for $shape on $difficulty', ({ shape, difficulty }) => {
    const mask = shapeMask(shape, 48, 48);
    const result = generatePuzzle({ columns: 48, rows: 48, seed: shape, mask, difficulty });
    const repaired = mask.slice();
    for (const {
      point: [x, y],
      enabled,
    } of result.generation.repairs)
      repaired[y * 48 + x] = Number(enabled);
    for (const [x, y] of result.generation.uncovered) {
      expect(repaired[y * 48 + x]).toBe(1);
      repaired[y * 48 + x] = 0;
    }
    const actual = new Uint8Array(mask.length);
    for (const arrow of result.level.arrows)
      for (const [x, y] of cells(arrow)) actual[y * 48 + x]++;
    expect(actual).toEqual(repaired);
  });
  it('preserves holes and solves interactions across disconnected parts', () => {
    const mask = shapeMask('rectangle', 12, 10);
    for (let y = 2; y < 8; y++) for (let x = 4; x < 8; x++) mask[y * 12 + x] = 0;
    for (let y = 0; y < 10; y++) mask[y * 12 + 9] = 0;
    const result = generatePuzzle({ columns: 12, rows: 10, mask, seed: 'holes', repair: false });
    const remaining = [...result.level.arrows];
    for (const id of result.generation.solution) {
      const arrow = remaining.find((a) => a.id === id)!;
      expect(blocker(arrow, remaining)).toBeUndefined();
      remaining.splice(remaining.indexOf(arrow), 1);
    }
    expect(result.generation.repairs).toHaveLength(0);
  });
  it('keeps a playable partial mask when isolated leftovers cannot be repaired', () => {
    const result = generatePuzzle({
      columns: 4,
      rows: 1,
      mask: [1, 1, 0, 1],
      seed: 'leftover',
      repair: false,
    });
    expect(result.generation.originalMask).toEqual(['1101']);
    expect(result.generation.finalMask).toEqual(['1100']);
    expect(result.generation.uncovered).toEqual([[3, 0]]);
    expect(result.generation.repairs).toEqual([]);
    expect(result.generation.stats).toMatchObject({
      cells: 2,
      uncovered: 1,
      arrows: 1,
      attempts: 6,
    });
    expect(blocker(result.level.arrows[0], result.level.arrows)).toBeUndefined();
  });
  it('pairs an isolated point with one reported added point', () => {
    const result = generatePuzzle({
      columns: 3,
      rows: 3,
      mask: [0, 0, 0, 0, 1, 0, 0, 0, 0],
      seed: 'speck',
    });
    expect(result.generation.repairs).toHaveLength(1);
    expect(result.generation.repairs[0].enabled).toBe(true);
    expect(result.generation.stats.cells).toBe(2);
  });
  it('fails cleanly when no arrow can be placed or the input is invalid', () => {
    expect(() =>
      generatePuzzle({ columns: 3, rows: 1, mask: [1, 0, 0], seed: '', repair: false }),
    ).toThrow('Could not place any arrows');
    expect(() => generatePuzzle({ columns: 1, rows: 1, seed: '' })).toThrow('two adjacent');
    expect(() =>
      generatePuzzle({ columns: 3, rows: 2, seed: '', mask: [0, 0, 0, 0, 0, 0] }),
    ).toThrow('empty');
    expect(() => generatePuzzle({ columns: 3, rows: 2, seed: '', mask: [2] })).toThrow('mask');
    expect(() => generatePuzzle({ columns: 1025, rows: 2, seed: '' })).toThrow('dimensions');
    expect(() =>
      generatePuzzle({
        columns: 4,
        rows: 4,
        seed: '',
        // @ts-expect-error Validate untrusted worker input too.
        difficulty: 'medium',
      }),
    ).toThrow('difficulty');
  });
  it('generates and indexes a board beyond the old 200-point limit', () => {
    const result = generatePuzzle({ columns: 256, rows: 256, seed: 'large', difficulty: 'easy' });
    // Coverage can vary with carving choices; this checks scale and solvability, not density.
    expect(result.generation.stats.cells).toBeGreaterThan(200);
    expect(result.generation.stats.cells + result.generation.stats.uncovered).toBe(65536);
    expect(result.generation.stats.attempts).toBeLessThanOrEqual(6);
    const index = new PuzzleIndex(result.level.arrows, result.level.grid);
    for (const id of result.generation.solution) {
      const arrow = result.level.arrows[index.byId.get(id)!];
      expect(index.hit(arrow)).toBeUndefined();
      index.remove(id);
    }
    expect(index.grid.count).toBe(0);
  }, 20000);
});

it('thresholds image pixels, supports inversion, and preserves transparency', () => {
  const rgba = [0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 100, 100, 100, 255];
  expect([...pixelsToMask(rgba, 128, false)]).toEqual([1, 0, 0, 1]);
  expect([...pixelsToMask(rgba, 128, true)]).toEqual([0, 1, 0, 0]);
});
