import { describe, expect, it } from 'vitest';
import { analyze, initialBoard, type Cell, type Level } from '../game/engine';
import { numberedLevels } from '../game/levels';
import { solveWithDeductions } from './solver';

const small: Level = {
  id: 'small',
  name: 'Small',
  width: 4,
  height: 3,
  top: 2,
  solution: '.X++X..+++++'
    .split('')
    .map((c): Cell => (c === '.' ? 'empty' : c === 'X' ? 'head' : 'snake')),
  clues: [1, 4],
  moves: [],
};

const ambiguous: Level = {
  id: 'ambiguous',
  name: 'Ambiguous',
  width: 5,
  height: 3,
  top: 3,
  solution: Array.from({ length: 15 }, (_, i): Cell => (i === 0 || i === 4 ? 'head' : 'unknown')),
  clues: [0, 4],
  moves: [],
};

function enumerate(level: Level, board = initialBoard(level)): Cell[][] {
  const free = board.flatMap((cell, i) => (cell === 'unknown' ? [i] : []));
  const results: Cell[][] = [];
  for (let mask = 0; mask < 2 ** free.length; mask++) {
    const candidate = [...board];
    free.forEach((index, bit) => {
      candidate[index] = mask & (1 << bit) ? 'snake' : 'empty';
    });
    if (analyze(level, candidate).solved) results.push(candidate);
  }
  return results;
}

describe('deduction solver', () => {
  it('agrees with the game rules on every complete assignment of a small board', () => {
    const start = initialBoard(small);
    const free = start.flatMap((cell, i) => (cell === 'unknown' ? [i] : []));
    for (let mask = 0; mask < 2 ** free.length; mask++) {
      const board = [...start];
      free.forEach((index, bit) => {
        board[index] = mask & (1 << bit) ? 'snake' : 'empty';
      });
      const report = solveWithDeductions(small, { board, maxDepth: 0 });
      expect(report.status === 'solved').toBe(analyze(small, board).solved);
      expect(report.moves).toEqual([]);
    }
  });
  it('only commits moves shared by every possible solution, including on ambiguous boards', () => {
    for (const level of [small, { ...small, regionClues: { 5: 2 } }, ambiguous]) {
      const all = enumerate(level);
      expect(all.length).toBeGreaterThan(0);
      for (const solution of all) {
        for (const divisor of [2, 3, 5, 100]) {
          const board = initialBoard(level).map((cell, i) =>
            cell === 'unknown' && i % divisor === 0 ? solution[i] : cell,
          );
          const completions = enumerate(level, board);
          for (const maxDepth of [0, 1, 2]) {
            const report = solveWithDeductions(level, { board, maxDepth });
            expect(report.status).not.toBe('contradiction');
            for (const move of report.moves) {
              expect(completions.every((candidate) => candidate[move.index] === move.cell)).toBe(
                true,
              );
            }
            if (report.status === 'solved') expect(completions).toHaveLength(1);
          }
        }
      }
    }
  });
  it('never chooses a branch just because it finds a solution', () => {
    const all = enumerate(ambiguous);
    expect(all.length).toBeGreaterThan(1);
    expect(solveWithDeductions(ambiguous, { maxDepth: 2 }).status).toBe('stalled');
  });
  it('cannot read the hidden solution to choose deductions', () => {
    const level = numberedLevels[0];
    const blind = {
      ...level,
      solution: level.solution.map((cell, i): Cell => (level.clues.includes(i) ? cell : 'unknown')),
    };
    expect(solveWithDeductions(blind)).toEqual(solveWithDeductions(level));
  });
  it('retains a sound, unmodified board when the work budget runs out', () => {
    const level = numberedLevels[0];
    const board = initialBoard(level);
    const before = [...board];
    const report = solveWithDeductions(level, { board, maxChecks: 1 });
    expect(report.status).toBe('budget');
    expect(report.stats.checks).toBe(1);
    expect(report.moves).toEqual([]);
    expect(report.board).toEqual(before);
    expect(board).toEqual(before);
  });
  it('enforces positional numbers even when the global sizes fit', () => {
    const wrong = { ...small, regionClues: { 0: 2, 5: 1 } };
    expect(solveWithDeductions(wrong, { board: small.solution }).status).toBe('contradiction');
  });
  it('rejects unsupported depths and edits to fixed clues', () => {
    expect(() => solveWithDeductions(small, { maxDepth: 3 })).toThrow('depth');
    expect(() =>
      solveWithDeductions(small, { board: small.solution.map(() => 'unknown') }),
    ).toThrow('fixed clues');
  });
});
