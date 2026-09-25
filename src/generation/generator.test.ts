import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import { cells, blocker } from '../game/engine';
import { shapeMask, pixelsToMask } from './masks';
import { PuzzleIndex } from '../game/puzzleIndex';

describe('full-coverage generation', () => {
  it.each([
    [2, 1],
    [1, 9],
    [3, 3],
    [12, 10],
    [31, 19],
    [64, 64],
  ])('covers all %i × %i points and has a valid solution', (columns, rows) => {
    const result = generatePuzzle({ columns, rows, seed: 'full', repair: false });
    expect(result.generation.repairs).toEqual([]);
    const occupied = result.level.arrows.flatMap(cells).map((p) => p.join(','));
    expect(occupied.length).toBe(columns * rows);
    expect(new Set(occupied).size).toBe(columns * rows);
    expect(result.generation.solution.length).toBe(result.level.arrows.length);
  });
  it('is deterministic for the same seed and differs for another seed', () => {
    const input = { columns: 16, rows: 16, seed: 'repeat' };
    expect(generatePuzzle(input)).toEqual(generatePuzzle(input));
    expect(generatePuzzle(input).level.arrows).not.toEqual(
      generatePuzzle({ ...input, seed: 'different' }).level.arrows,
    );
  });
  it.each(['heart', 'cat', 'butterfly'] as const)(
    'covers a %s silhouette exactly after reported repairs',
    (shape) => {
      const mask = shapeMask(shape, 48, 48);
      const result = generatePuzzle({ columns: 48, rows: 48, seed: shape, mask });
      const repaired = mask.slice();
      for (const {
        point: [x, y],
        enabled,
      } of result.generation.repairs)
        repaired[y * 48 + x] = Number(enabled);
      const actual = new Uint8Array(mask.length);
      for (const arrow of result.level.arrows)
        for (const [x, y] of cells(arrow)) actual[y * 48 + x]++;
      expect(actual).toEqual(repaired);
    },
  );
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
  it('fails cleanly when repairs are disallowed or the input is invalid', () => {
    expect(() =>
      generatePuzzle({ columns: 3, rows: 1, mask: [1, 0, 0], seed: '', repair: false }),
    ).toThrow('Could not cover');
    expect(() => generatePuzzle({ columns: 1, rows: 1, seed: '' })).toThrow('two adjacent');
    expect(() =>
      generatePuzzle({ columns: 3, rows: 2, seed: '', mask: [0, 0, 0, 0, 0, 0] }),
    ).toThrow('empty');
    expect(() => generatePuzzle({ columns: 3, rows: 2, seed: '', mask: [2] })).toThrow('mask');
    expect(() => generatePuzzle({ columns: 1025, rows: 2, seed: '' })).toThrow('dimensions');
  });
  it('generates and indexes a board beyond the old 200-point limit', () => {
    const result = generatePuzzle({ columns: 256, rows: 256, seed: 'large', length: 16 });
    expect(result.generation.stats.cells).toBe(65536);
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
