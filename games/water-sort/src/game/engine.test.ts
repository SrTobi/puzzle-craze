import { describe, expect, it } from 'vitest';
import { isSolved, legalMoves, pour, pourAmount, solve } from './engine';
import { initialLevel } from './levels';
const levels = [initialLevel(1), initialLevel(2), initialLevel(3)].map((level) => ({
  ...level,
  board: [...level.board, []],
}));
import { validBoard } from './storage';

describe('pouring', () => {
  it('moves the complete matching top group and leaves its input unchanged', () => {
    const board = [[0, 1, 1], [1], []];
    expect(pour(board, { from: 0, to: 1 })).toEqual([[0], [1, 1, 1], []]);
    expect(board).toEqual([[0, 1, 1], [1], []]);
  });
  it('only pours as much as the destination can hold', () => {
    expect(
      pour(
        [
          [0, 1, 1],
          [1, 1, 1],
        ],
        { from: 0, to: 1 },
      ),
    ).toEqual([
      [0, 1],
      [1, 1, 1, 1],
    ]);
  });
  it('allows pouring into an empty tube without moving a buried color', () => {
    expect(pour([[0, 1, 1], []], { from: 0, to: 1 })).toEqual([[0], [1, 1]]);
  });
  it('rejects empty sources, full targets, mismatching tops, invalid indices and self-pours', () => {
    const board = [[0, 1], [0, 0, 0, 0], [], [0]];
    for (const move of [
      { from: 2, to: 0 },
      { from: 0, to: 1 },
      { from: 0, to: 3 },
      { from: 0, to: 0 },
      { from: -1, to: 0 },
      { from: 0, to: 7 },
    ]) {
      expect(pourAmount(board, move)).toBe(0);
      expect(pour(board, move)).toBeNull();
    }
  });
  it('requires each nonempty tube to be full and uniform', () => {
    expect(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
    expect(isSolved([[0, 0], [0, 0], []])).toBe(false);
    expect(isSolved([[0, 1, 0, 1], []])).toBe(false);
    expect(isSolved([[], []])).toBe(false);
  });
  it('recognizes a dead end and respects the search budget', () => {
    expect(
      legalMoves([
        [0, 1, 0, 1],
        [1, 0, 1, 0],
      ]),
    ).toEqual([]);
    expect(
      solve([
        [0, 1, 0, 1],
        [1, 0, 1, 0],
      ]),
    ).toBeNull();
    expect(solve(levels[0].board, 0)).toBeNull();
  });
});

describe('the collection', () => {
  it.each(levels)('$name has a legal solution that preserves every drop', (level) => {
    let board = level.board;
    expect(validBoard(board, level)).toBe(true);
    expect(isSolved(board)).toBe(false);
    const solution = solve(board);
    expect(solution?.length).toBeGreaterThan(0);
    for (const move of solution!) {
      const next = pour(board, move);
      expect(next).not.toBeNull();
      board = next!;
      expect(validBoard(board, level)).toBe(true);
    }
    expect(isSolved(board)).toBe(true);
    expect(solve(board)).toEqual([]);
  });
});
