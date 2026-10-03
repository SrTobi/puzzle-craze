import { describe, expect, it } from 'vitest';
import { boxRegions, connected, isSolved, solve, solvesWithSingles, units } from './engine';
import { generatePuzzle } from './generator';
import { catalog } from './catalog';
import levelData from './levels.json';
import { SIZES, type Options, type Puzzle } from './types';

describe('the guided collection', () => {
  it('starts with classic 9×9 and introduces variants separately before combining them', () => {
    expect(catalog[0].options).toMatchObject({
      size: 9,
      regions: 'boxes',
      colors: false,
      diagonal: false,
      density: 'gentle',
    });
    for (const feature of ['regions', 'colors', 'diagonal'] as const) {
      const intro = catalog.find((p) =>
        feature === 'regions' ? p.options.regions === 'jigsaw' : p.options[feature],
      )!;
      expect(
        [intro.options.regions === 'jigsaw', intro.options.colors, intro.options.diagonal].filter(
          Boolean,
        ),
      ).toHaveLength(1);
      expect(intro.options.density).toBe('gentle');
    }
  });
  for (const puzzle of levelData as Puzzle[])
    it(`${puzzle.name} is consistent, unique, and reproducible`, () => {
      expect(isSolved(puzzle, puzzle.solution)).toBe(true);
      const solved = solve(puzzle);
      expect(solved.exhausted).toBe(false);
      expect(solved.count).toBe(1);
      expect(solved.solution).toEqual(puzzle.solution);
      expect(generatePuzzle(puzzle.options)).toMatchObject({
        givens: puzzle.givens,
        regions: puzzle.regions,
        colors: puzzle.colors,
        solution: puzzle.solution,
      });
      if (puzzle.options.density === 'gentle')
        expect(solvesWithSingles(puzzle, puzzle.givens)).toBe(true);
    });
});

describe('custom generation', () => {
  for (const size of SIZES)
    for (const regions of ['boxes', 'jigsaw'] as const)
      for (const colors of [false, true])
        for (const diagonal of [false, true]) {
          it(`generates a valid unique ${size}×${size}, ${regions}, colors=${colors}, diagonals=${diagonal}`, () => {
            const puzzle = generatePuzzle({
              size,
              regions,
              colors,
              diagonal,
              density: 'sparse',
              seed: 'combination-check',
            });
            const original = JSON.stringify(puzzle);
            expect(isSolved(puzzle, puzzle.solution)).toBe(true);
            expect(puzzle.givens.filter(Boolean).length).toBeLessThan(size * size * 0.65);
            const solution = solve(puzzle, puzzle.givens, 2, 200_000);
            expect(solution.exhausted).toBe(false);
            expect(solution.count).toBe(1);
            expect(solution.solution).toEqual(puzzle.solution);
            for (const u of units(puzzle)) {
              expect(u.cells).toHaveLength(size);
              expect(new Set(u.cells.map((i) => puzzle.solution[i])).size).toBe(size);
              if (u.kind === 'region') expect(connected(u.cells, size)).toBe(true);
            }
            if (regions === 'jigsaw') expect(puzzle.regions).not.toEqual(boxRegions(size));
            else expect(puzzle.regions).toEqual(boxRegions(size));
            expect(new Set(puzzle.colors.filter((n) => n >= 0)).size).toBe(
              colors ? Math.min(3, size / 2) : 0,
            );
            expect(JSON.stringify(puzzle)).toBe(original);
          });
        }
  it('uses the seed deterministically and varies different seeds', () => {
    const options: Options = {
      size: 9,
      regions: 'jigsaw',
      colors: true,
      diagonal: true,
      density: 'balanced',
      seed: 'garden',
    };
    expect(generatePuzzle(options)).toEqual(generatePuzzle({ ...options }));
    expect(generatePuzzle(options).givens).not.toEqual(
      generatePuzzle({ ...options, seed: 'meadow' }).givens,
    );
  });
  it('rejects invalid options rather than silently ignoring a requested rule', () => {
    const options = catalog[0].options;
    for (const invalid of [
      { size: 5 },
      { seed: '' },
      { seed: 'x'.repeat(81) },
      { colors: 'true' },
      { regions: 'invalid' },
      { density: 'unknown' },
    ])
      expect(() => generatePuzzle({ ...options, ...invalid } as Options)).toThrow();
  });
});
