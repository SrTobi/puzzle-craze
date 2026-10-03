import { describe, expect, it } from 'vitest';
import {
  boxRegions,
  candidates,
  conflicts,
  enterValue,
  freshRun,
  isSolved,
  logicalHint,
  peers,
  redo,
  solve,
  undo,
  units,
} from './engine';
import { generatePuzzle } from './generator';
import type { Puzzle } from './types';

const basic: Puzzle = {
  id: 'test',
  name: 'Test',
  options: {
    size: 4,
    regions: 'boxes',
    colors: false,
    diagonal: false,
    density: 'gentle',
    seed: 'test',
  },
  regions: boxRegions(4),
  colors: Array(16).fill(-1),
  givens: Array(16).fill(0),
  solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
};

describe('Sudoku constraints', () => {
  it('accepts a complete valid grid and rejects empties, out-of-range values, and changed givens', () => {
    expect(isSolved(basic, basic.solution)).toBe(true);
    expect(isSolved(basic, basic.givens)).toBe(false);
    expect(isSolved(basic, basic.solution.slice(1))).toBe(false);
    expect(
      isSolved(
        basic,
        basic.solution.map((v) => v + 1),
      ),
    ).toBe(false);
    expect(
      isSolved({ ...basic, givens: basic.givens.map((v, i) => (i === 0 ? 2 : v)) }, basic.solution),
    ).toBe(false);
  });
  it.each([
    [0, 1],
    [0, 4],
    [1, 4],
  ])('marks both duplicates in a row, column, or region (%i, %i)', (a, b) => {
    const board = [...basic.givens];
    board[a] = 1;
    board[b] = 1;
    expect([...conflicts(basic, board)].sort()).toEqual([a, b]);
  });
  it('enforces color groups and both diagonals even when the classic rules permit an entry', () => {
    const colorPuzzle = {
      ...basic,
      options: { ...basic.options, colors: true },
      colors: basic.colors.map((v, i) => ([0, 6, 9, 15].includes(i) ? 0 : v)),
    };
    const colorBoard = [...basic.givens];
    colorBoard[0] = 2;
    colorBoard[6] = 2;
    expect(conflicts(basic, colorBoard).size).toBe(0);
    expect(conflicts(colorPuzzle, colorBoard)).toEqual(new Set([0, 6]));
    for (const [a, b] of [
      [0, 10],
      [3, 9],
    ]) {
      const board = [...basic.givens];
      board[a] = 1;
      board[b] = 1;
      expect(conflicts(basic, board).size).toBe(0);
      expect(conflicts({ ...basic, options: { ...basic.options, diagonal: true } }, board)).toEqual(
        new Set([a, b]),
      );
    }
  });
  it('uses the actual jigsaw shapes in validation and candidate calculation', () => {
    const p = generatePuzzle({ ...basic.options, size: 6, regions: 'jigsaw' });
    const classic = boxRegions(6);
    const pair = units(p)
      .filter((u) => u.kind === 'region')
      .flatMap((u) => u.cells.flatMap((a) => u.cells.map((b) => [a, b])))
      .find(
        ([a, b]) =>
          classic[a] !== classic[b] && Math.floor(a / 6) !== Math.floor(b / 6) && a % 6 !== b % 6,
      )!;
    expect(pair).toBeDefined();
    const board = p.givens.map(() => 0);
    board[pair[0]] = 1;
    expect(candidates(board, pair[1], peers(p), 6)).not.toContain(1);
    board[pair[1]] = 1;
    expect(conflicts(p, board)).toEqual(new Set(pair));
  });
  it('distinguishes zero, one, and multiple solutions and flags search exhaustion', () => {
    expect(solve(basic).count).toBe(2);
    expect(solve(basic, basic.solution).count).toBe(1);
    expect(
      solve(
        basic,
        basic.solution.map((v, i) => (i === 0 ? 2 : v)),
      ).count,
    ).toBe(0);
    expect(solve(basic, basic.givens, 2, 1).exhausted).toBe(true);
    // Enumerating the entire 4×4 space also catches incorrect pruning or mask rollback.
    expect(solve(basic, basic.givens, 300).count).toBe(288);
  });
});

describe('entries, notes, hints, and history', () => {
  it('keeps clues fixed, rejects invalid inputs, and preserves the previous state', () => {
    const p = { ...basic, givens: [...basic.givens] };
    p.givens[0] = 1;
    const run = freshRun(p);
    expect(enterValue(p, run, 0, 3, false)).toBe(run);
    expect(enterValue(p, run, 1, 5, false)).toBe(run);
    expect(enterValue(p, run, -1, 1, false)).toBe(run);
    expect(enterValue(p, run, 1.5, 1, false)).toBe(run);
    const next = enterValue(p, run, 1, 2, false);
    expect(next.board[1]).toBe(2);
    expect(run.board[1]).toBe(0);
    expect(enterValue(p, next, 1, 2, false)).toBe(next);
  });
  it('toggles pencil marks, removes only peer notes, and restores them on undo/redo', () => {
    let run = freshRun(basic);
    run = enterValue(basic, run, 0, 2, true);
    run = enterValue(basic, run, 1, 2, true);
    run = enterValue(basic, run, 10, 2, true);
    const before = structuredClone(run);
    run = enterValue(basic, run, 0, 2, false);
    expect(run.notes[0]).toBe(0);
    expect(run.notes[1]).toBe(0);
    expect(run.notes[10]).toBe(2);
    const back = undo(run);
    expect(back.board).toEqual(before.board);
    expect(back.notes).toEqual(before.notes);
    expect(redo(back).board).toEqual(run.board);
    expect(redo(back).notes).toEqual(run.notes);
    expect(enterValue(basic, back, 0, 1, false).future).toEqual([]);
    expect(enterValue(basic, before, 10, 2, true).notes[10]).toBe(0);
  });
  it('clears entries and notes without changing given numbers', () => {
    const run = enterValue(basic, freshRun(basic), 0, 3, false);
    expect(enterValue(basic, run, 0, 0, true).board[0]).toBe(0);
    const note = enterValue(basic, freshRun(basic), 0, 3, true);
    expect(enterValue(basic, note, 0, 0, false).notes[0]).toBe(0);
  });
  it('explains a deduction without changing the board', () => {
    const board = [...basic.solution];
    board[6] = 0;
    const before = [...board];
    expect(logicalHint(basic, board)).toMatchObject({ cell: 6, value: 1, reveal: false });
    expect(board).toEqual(before);
    expect(logicalHint(basic, basic.givens)).toBeNull();
    expect(logicalHint(basic, basic.solution)).toBeNull();
  });
  it('handles 10–12 as numbers, including notes', () => {
    const p = generatePuzzle({ ...basic.options, size: 12 });
    const cell = p.givens.indexOf(0);
    const note = enterValue(p, freshRun(p), cell, 12, true);
    expect(note.notes[cell]).toBe(1 << 11);
    expect(enterValue(p, note, cell, 12, false).board[cell]).toBe(12);
  });
});
