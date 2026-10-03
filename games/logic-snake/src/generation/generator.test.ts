import { describe, expect, it } from 'vitest';
import { analyze, initialBoard, type Cell, type Level } from '../game/engine';
import { numberedLevels } from '../game/levels';
import { findSolutions, generateLevel } from './generator';
import { solveWithDeductions } from './solver';
import { loadLevel, serializeLevel } from '../game/level-format';

describe('numbered level generation', () => {
  it('reproduces a seed and independently verifies every bundled puzzle has one solution', () => {
    const options = { seed: 'repeatable', width: 5, height: 5, top: 4 };
    expect(generateLevel(options)).toEqual(generateLevel(options));
  });
  for (const level of numberedLevels) {
    it(`verifies and reproduces ${level.name}`, () => {
      const search = findSolutions(level);
      expect(search.exhaustive).toBe(true);
      expect(search.solutions).toEqual([level.solution]);
      const expected = generateLevel({
        seed: level.id.replace(/^numbered-/, ''),
        width: level.width,
        height: level.height,
        top: level.top,
        maxAssumptionDepth: level.generation!.maxAssumptionDepth,
        generationVersion: level.generation!.version,
        numberedClueChance: level.generation!.numberedClueChance,
      });
      expect(expected.solution).toEqual(level.solution);
      expect(expected.regionClues ?? {}).toEqual(level.regionClues ?? {});
      expect(expected.generation).toEqual(level.generation);
      const report = solveWithDeductions(level, {
        maxDepth: level.generation!.requiredAssumptionDepth,
      });
      expect(report.status).toBe('solved');
      expect(report.board).toEqual(level.solution);
      expect(report.moves).toEqual(level.generation!.trace);
      expect(report.moves.map((move) => move.index)).toEqual(level.moves);
      expect(report.stats.lookaheadMoves).toBe(level.generation!.lookaheadMoves);
    }, 30_000);
  }
  it('uses solver depth to select clues instead of removing clues for uniqueness alone', () => {
    const options = { seed: 'depth-test', width: 6, height: 6, top: 5 };
    const direct = generateLevel({ ...options, maxAssumptionDepth: 0 });
    const lookahead = generateLevel({ ...options, maxAssumptionDepth: 1 });
    expect(direct.solution).toEqual(lookahead.solution);
    expect(solveWithDeductions(direct, { maxDepth: 0 }).status).toBe('solved');
    expect(direct.generation!.lookaheadMoves).toBe(0);
    for (const level of numberedLevels) {
      expect(Object.keys(level.regionClues ?? {}).length).toBeLessThan(level.top);
      expect(level.generation!.requiredAssumptionDepth).toBeLessThanOrEqual(1);
      expect(solveWithDeductions(level, { maxDepth: 0 }).status).toBe('stalled');
      expect(solveWithDeductions(level, { maxDepth: 1 }).status).toBe('solved');
    }
  });
  it('can generate only plain empty clues and preserve them through export and solving', () => {
    const level = generateLevel({
      seed: 'plain-only',
      width: 6,
      height: 6,
      top: 5,
      numberedClueChance: 0,
    });
    expect(Object.keys(level.regionClues ?? {})).toHaveLength(0);
    const emptyClues = level.clues.filter((i) => level.solution[i] === 'empty');
    expect(emptyClues.length).toBeGreaterThan(0);
    expect(emptyClues.every((i) => initialBoard(level)[i] === 'empty')).toBe(true);
    expect(solveWithDeductions(level).status).toBe('solved');
    const imported = loadLevel(serializeLevel(level), level.id, level.name);
    expect(initialBoard(imported)).toEqual(initialBoard(level));
    expect(imported.generation).toEqual(level.generation);
    expect(findSolutions(imported).solutions).toEqual([level.solution]);
  });
  it('includes both clue types in the appended batch without changing the earlier levels', () => {
    expect(numberedLevels.slice(0, 6).map((level) => level.id)).toEqual(
      Array.from(
        { length: 6 },
        (_, i) => `numbered-deduction-v3-${String(i + 1).padStart(2, '0')}`,
      ),
    );
    const added = numberedLevels.slice(6);
    expect(added).toHaveLength(12);
    expect(added.some((level) => !Object.keys(level.regionClues ?? {}).length)).toBe(true);
    expect(
      added.some(
        (level) =>
          Object.keys(level.regionClues ?? {}).length &&
          level.clues.some(
            (i) => level.solution[i] === 'empty' && level.regionClues?.[i] === undefined,
          ),
      ),
    ).toBe(true);
    expect(
      new Set(numberedLevels.map((level) => `${level.width}:${level.solution.join(',')}`)).size,
    ).toBe(numberedLevels.length);
  });
  it('rejects invalid clue probabilities', () => {
    for (const numberedClueChance of [-0.1, 1.1, NaN]) {
      expect(() =>
        generateLevel({ seed: 'invalid-chance', width: 5, height: 5, top: 4, numberedClueChance }),
      ).toThrow('chance');
    }
  });
  it('does not confuse a bounded or interrupted search with proof of uniqueness', () => {
    const result = findSolutions(numberedLevels[0], 1);
    expect(result.exhaustive).toBe(false);
    expect(result.solutions).toEqual([]);
    expect(() =>
      generateLevel({ seed: 'too-short', width: 5, height: 5, top: 4, maxNodes: 1 }),
    ).toThrow('bounded search');
    expect(() => generateLevel({ seed: 'invalid', width: 2, height: 2, top: 8 })).toThrow();
  });
  it('keeps every solution when pruning an ambiguous path search', () => {
    const level: Level = {
      id: 'ambiguous',
      name: 'Ambiguous',
      width: 5,
      height: 3,
      top: 3,
      solution: Array.from({ length: 15 }, (_, i): Cell =>
        i === 0 || i === 4 ? 'head' : 'unknown',
      ),
      clues: [0, 4],
      moves: [],
    };
    const start = initialBoard(level);
    const free = start.flatMap((cell, i) => (cell === 'unknown' ? [i] : []));
    const brute: string[] = [];
    for (let mask = 0; mask < 2 ** free.length; mask++) {
      const board = [...start];
      free.forEach((index, bit) => {
        board[index] = mask & (1 << bit) ? 'snake' : 'empty';
      });
      if (analyze(level, board).solved) brute.push(board.join(','));
    }
    const search = findSolutions(level, 500_000, 1000);
    expect(search.exhaustive).toBe(true);
    expect(brute.length).toBeGreaterThan(1);
    expect(search.solutions.map((board) => board.join(',')).sort()).toEqual(brute.sort());
  });
  it('matches an independent enumeration of all assignments on a small board', () => {
    const level: Level = {
      id: 'exhaustive',
      name: 'Exhaustive',
      width: 4,
      height: 3,
      top: 2,
      solution: '.X++X..+++++'
        .split('')
        .map((c): Cell => (c === '.' ? 'empty' : c === 'X' ? 'head' : 'snake')),
      clues: [1, 4],
      moves: [],
      regionClues: { 5: 2 },
    };
    const start = initialBoard(level);
    const free = start.flatMap((cell, i) => (cell === 'unknown' ? [i] : []));
    const brute: string[] = [];
    for (let bits = 0; bits < 2 ** free.length; bits++) {
      const board = [...start];
      free.forEach((index, bit) => {
        board[index] = bits & (1 << bit) ? 'snake' : 'empty';
      });
      if (analyze(level, board).solved) brute.push(board.join(','));
    }
    const search = findSolutions(level, 500_000, 1000);
    expect(search.exhaustive).toBe(true);
    expect(search.solutions.map((board) => board.join(',')).sort()).toEqual(brute.sort());
    expect(brute.length).toBeGreaterThan(0);
  });
});
