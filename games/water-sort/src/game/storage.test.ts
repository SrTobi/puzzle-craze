import { describe, expect, it } from 'vitest';
import { decodeProgress, freshRun, validBoard } from './storage';
import { initialLevel } from './levels';
const levels = [initialLevel(1), initialLevel(2), initialLevel(3)];
import { pour, solve } from './engine';

describe('saved progress', () => {
  it('restores a pour, undo history, selected level and completion', () => {
    const level = levels[0];
    const run = freshRun(level);
    const progress = {
      selected: level.id,
      completed: ['2'],
      runs: {
        [level.id]: {
          board: pour(run.board, solve(run.board)![0]),
          history: [run.board],
          moves: 1,
        },
      },
    };
    expect(decodeProgress(JSON.stringify(progress))).toEqual(progress);
  });
  it('recovers safely from absent or corrupted storage', () => {
    for (const value of [null, '{broken', 'null', '42', '{}']) {
      expect(decodeProgress(value)).toEqual({ selected: levels[0].id, completed: [], runs: {} });
    }
  });
  it('discards impossible liquid counts and invalid colors', () => {
    const level = levels[0];
    expect(validBoard([[0], [], [], []], level)).toBe(false);
    expect(validBoard([[99, 99, 99, 99], [1, 1, 1, 1], [], []], level)).toBe(false);
    expect(validBoard([[0, 0, 0, 0, 0], [1, 1, 1], [], []], level)).toBe(false);
    const data = {
      selected: 'missing',
      completed: ['missing', level.id, level.id],
      runs: { [level.id]: { board: [[0]], moves: 0, history: [] } },
    };
    expect(decodeProgress(JSON.stringify(data))).toEqual({
      selected: level.id,
      completed: [level.id],
      runs: {},
    });
  });
  it('keeps a valid board when history is corrupt', () => {
    const level = levels[0];
    const data = { runs: { [level.id]: { ...freshRun(level), moves: 1, history: ['bad'] } } };
    expect(decodeProgress(JSON.stringify(data)).runs[level.id].history).toEqual([]);
  });
});
