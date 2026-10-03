import { describe, expect, it } from 'vitest';
import { enterValue, freshRun } from './engine';
import { generatePuzzle } from './generator';
import { decodeProgress, validPuzzle } from './storage';
import levelData from './levels.json';
import type { Puzzle } from './types';

const levels = levelData as Puzzle[];
const base = () => decodeProgress(null, levels);
describe('saved Sudoku progress', () => {
  it('restores a campaign run including pencil marks, undo history, and completion', () => {
    const puzzle = levels[0];
    const cell = puzzle.givens.indexOf(0);
    const run = enterValue(puzzle, freshRun(puzzle), cell, 4, true);
    const progress = { ...base(), runs: { [puzzle.id]: run }, completed: [puzzle.id] };
    expect(decodeProgress(JSON.stringify(progress), levels)).toEqual(progress);
  });
  it('restores a generated puzzle with its rules and in-progress board', () => {
    const custom = generatePuzzle({ ...levels.at(-1)!.options, seed: 'saved' });
    const progress = { ...base(), custom, selected: 'custom', runs: { custom: freshRun(custom) } };
    expect(decodeProgress(JSON.stringify(progress), levels)).toEqual(progress);
  });
  it('recovers from broken JSON, missing custom puzzles, unknown levels, and duplicate completions', () => {
    expect(decodeProgress('{bad json', levels)).toEqual(base());
    expect(decodeProgress('null', levels)).toEqual(base());
    expect(decodeProgress('{"selected":"custom"}', levels)).toEqual(base());
    expect(decodeProgress('{"selected":"missing"}', levels)).toEqual(base());
    expect(
      decodeProgress(
        JSON.stringify({ completed: ['level-1', 'missing', 'level-1', {}, null] }),
        levels,
      ).completed,
    ).toEqual(['level-1']);
  });
  it('rejects overwritten clues, invalid note masks, and malformed custom rules', () => {
    const puzzle = levels[0];
    const run = freshRun(puzzle);
    run.board[puzzle.givens.findIndex(Boolean)] = 0;
    expect(decodeProgress(JSON.stringify({ runs: { [puzzle.id]: run } }), levels).runs).toEqual({});
    const notes = freshRun(puzzle);
    notes.notes[puzzle.givens.indexOf(0)] = 1 << 9;
    expect(decodeProgress(JSON.stringify({ runs: { [puzzle.id]: notes } }), levels).runs).toEqual(
      {},
    );
    expect(validPuzzle({ ...puzzle, colors: Array(81).fill(0) })).toBe(false);
    expect(validPuzzle({ ...puzzle, regions: Array(81).fill(0) })).toBe(false);
    expect(validPuzzle({ ...puzzle, solution: [] })).toBe(false);
  });
  it('bounds saved history and drops corrupt snapshots', () => {
    const run = freshRun(levels[0]);
    const snapshot = { board: run.board, notes: run.notes };
    run.history = Array(150).fill(snapshot);
    run.future = [null as never, snapshot];
    const decoded = decodeProgress(JSON.stringify({ runs: { 'level-1': run } }), levels);
    expect(decoded.runs['level-1'].history).toHaveLength(100);
    expect(decoded.runs['level-1'].future).toHaveLength(1);
  });
});
