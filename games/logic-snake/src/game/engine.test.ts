import { describe, expect, it } from 'vitest';
import {
  analyze,
  historyReducer,
  initialBoard,
  markCell,
  neighbors,
  nextHint,
  type Cell,
  type Level,
} from './engine';
import { levels } from './levels';
import { decodeProgress } from './storage';

const fixture = (rows: string[], top = 3): Level => ({
  id: 'test',
  name: 'Test',
  width: rows[0].length,
  height: rows.length,
  top,
  solution: rows
    .join('')
    .split('')
    .map((c) => ({ '?': 'unknown', '.': 'empty', '+': 'snake', X: 'head' })[c] as Cell),
  clues: [],
  moves: [],
});

describe('imported Flutter puzzles', () => {
  it('includes all 13 levels with both endpoints locked and every cell covered by clues or solve moves', () => {
    expect(levels).toHaveLength(13);
    for (const level of levels) {
      expect(level.solution).toHaveLength(level.width * level.height);
      const heads = level.solution.flatMap((cell, i) => (cell === 'head' ? [i] : []));
      expect(heads).toHaveLength(2);
      expect(heads.every((i) => level.clues.includes(i))).toBe(true);
      expect(new Set([...level.clues, ...level.moves]).size).toBe(level.solution.length);
    }
  });
  for (const level of levels) {
    it(`wins without crossing out remaining empty cells for ${level.id}`, () => {
      for (const partialCrosses of [false, true]) {
        const board = level.solution.map((cell, i): Cell =>
          cell === 'empty' && !level.clues.includes(i) && (!partialCrosses || i % 2 === 0)
            ? 'unknown'
            : cell,
        );
        const before = [...board];
        const result = analyze(level, board);
        expect(result.solved).toBe(true);
        expect(result.unknown).toBeGreaterThan(0);
        expect(result.used).toEqual(Array(level.top).fill(1));
        expect(result.regions.every((region) => region.closed && region.valid)).toBe(true);
        expect(board).toEqual(before);
      }
    });
    it(`accepts the solution and every correct partial board for ${level.id}`, () => {
      const board = initialBoard(level);
      expect(analyze(level, board).solved).toBe(false);
      for (const index of level.moves) {
        board[index] = level.solution[index];
        expect(analyze(level, board).errors.size).toBe(0);
      }
      const result = analyze(level, board);
      expect(result.solved).toBe(true);
      expect(result.used).toEqual(Array(level.top).fill(1));
      expect(nextHint(level, board)).toBeNull();
    });
  }
});

describe('snake and region rules', () => {
  it('does not infer a win for an unfinished snake or an extra snake cell', () => {
    const level = levels[0];
    const board = level.solution.map((cell): Cell => (cell === 'empty' ? 'unknown' : cell));
    const missing = [...board];
    missing[board.indexOf('snake')] = 'unknown';
    expect(analyze(level, missing).solved).toBe(false);
    const extra = [...board];
    extra[board.indexOf('unknown')] = 'snake';
    expect(analyze(level, extra).solved).toBe(false);
  });
  it('requires correct region sizes even when the endpoints are connected', () => {
    const level = fixture(['X+X', '???'], 2);
    expect(analyze(level, level.solution).solved).toBe(false);
  });
  it('undoes an inferred win without keeping automatically displayed empty marks', () => {
    const level = levels[0];
    const complete = level.solution.map((cell): Cell => (cell === 'empty' ? 'unknown' : cell));
    const incomplete = [...complete];
    incomplete[complete.indexOf('snake')] = 'unknown';
    const won = historyReducer(
      { past: [], present: incomplete, future: [] },
      { type: 'edit', board: complete },
    );
    expect(analyze(level, won.present).solved).toBe(true);
    const undone = historyReducer(won, { type: 'undo' });
    expect(undone.present).toEqual(incomplete);
    expect(analyze(level, undone.present).solved).toBe(false);
    expect(analyze(level, historyReducer(undone, { type: 'redo' }).present).solved).toBe(true);
  });
  it('never wraps neighbors across a row boundary', () => {
    expect(neighbors({ width: 3, height: 2 }, 2)).toEqual([5, 1]);
    expect(neighbors({ width: 3, height: 2 }, 3)).toEqual([0, 4]);
  });
  it('leaves regions open next to unknown cells and treats board edges as boundaries', () => {
    const level = fixture(['.?+', '+++']);
    expect(analyze(level, level.solution).regions[0].closed).toBe(false);
    const board = [...level.solution];
    board[1] = 'snake';
    expect(analyze(level, board).regions[0].closed).toBe(true);
    expect(analyze(level, board).used[0]).toBe(1);
  });
  it('recomputes duplicate regions when one is reopened', () => {
    const level = fixture(['.+.', '+++']);
    expect(analyze(level, level.solution).regions.every((r) => !r.valid)).toBe(true);
    const board = [...level.solution];
    board[5] = 'unknown';
    const result = analyze(level, board);
    expect(result.used[0]).toBe(1);
    expect(result.regions.every((r) => r.valid)).toBe(true);
  });
  it('keeps diagonally touching empty cells in separate regions', () => {
    const level = fixture(['.+', '+.']);
    expect(analyze(level, level.solution).regions.map((r) => r.cells.length)).toEqual([1, 1]);
  });
  it('flags an oversized region even before it is enclosed', () => {
    const level = fixture(['...?', '????'], 2);
    const result = analyze(level, level.solution);
    expect(result.regions[0]).toMatchObject({ closed: false, valid: false });
    expect(result.errors.has(0)).toBe(true);
  });
  it('flags branches, over-connected endpoints, and isolated body cells', () => {
    for (const rows of [
      ['?+?', '+++', '???'],
      ['+X+', '???'],
      ['.+.', '...'],
    ]) {
      const level = fixture(rows);
      expect(analyze(level, level.solution).errors.size).toBeGreaterThan(0);
    }
  });
  it('rejects a disconnected cycle alongside an otherwise valid snake', () => {
    const level = fixture(['X+X.++', '....++'], 1);
    const result = analyze(level, level.solution);
    expect(result.solved).toBe(false);
    expect(result.messages.some((message) => message.includes('loop'))).toBe(true);
  });
  it('accepts valid paths by rules, independently of the stored solution', () => {
    const actual = levels[0];
    expect(
      analyze({ ...actual, solution: actual.solution.map(() => 'unknown') }, actual.solution)
        .solved,
    ).toBe(true);
  });
});

describe('editing and recovery', () => {
  const level = levels[0];
  it('protects clues, toggles a mark, replaces another mark, and erases', () => {
    const start = initialBoard(level);
    const i = level.moves[0];
    expect(markCell(level, start, level.clues[0], 'snake')).toBe(start);
    const snake = markCell(level, start, i, 'snake');
    expect(snake[i]).toBe('snake');
    expect(markCell(level, snake, i, 'snake')[i]).toBe('unknown');
    expect(markCell(level, snake, i, 'empty')[i]).toBe('empty');
    expect(markCell(level, snake, i, 'erase')[i]).toBe('unknown');
    expect(start[i]).toBe('unknown');
  });
  it('prioritizes correcting an incorrect mark before revealing new cells', () => {
    const board = initialBoard(level);
    const index = level.moves.at(-1)!;
    board[index] = level.solution[index] === 'empty' ? 'snake' : 'empty';
    expect(nextHint(level, board)).toEqual({ index, cell: level.solution[index] });
  });
  it('undoes, redoes, and discards the redo branch after a new edit', () => {
    const start = initialBoard(level);
    const first = markCell(level, start, level.moves[0], 'snake');
    const state = historyReducer(
      { past: [], present: start, future: [] },
      { type: 'edit', board: first },
    );
    const undone = historyReducer(state, { type: 'undo' });
    expect(undone.present).toEqual(start);
    expect(historyReducer(undone, { type: 'redo' }).present).toEqual(first);
    expect(
      historyReducer(undone, {
        type: 'edit',
        board: markCell(level, start, level.moves[1], 'empty'),
      }).future,
    ).toEqual([]);
  });
  it('loads progress safely and repairs tampered clues', () => {
    for (const raw of [null, 'garbage', '{}', '[]', '{"boards":null}']) {
      expect(decodeProgress(raw, levels)).toMatchObject({
        selected: levels[0].id,
        boards: {},
        completed: [],
      });
    }
    const board = initialBoard(level);
    board[level.clues[0]] = 'unknown';
    board[level.moves[0]] = 'head';
    const result = decodeProgress(
      JSON.stringify({
        selected: level.id,
        boards: { [level.id]: board },
        completed: [level.id, 'bogus'],
      }),
      levels,
    );
    expect(result.boards[level.id]).toEqual(initialBoard(level));
    expect(result.completed).toEqual([level.id]);
    expect(
      decodeProgress(JSON.stringify({ boards: { [level.id]: ['bogus'] } }), levels).boards,
    ).toEqual({});
  });
});
