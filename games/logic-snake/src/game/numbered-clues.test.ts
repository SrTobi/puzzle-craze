import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Board } from '../components/Board';
import { analyze, initialBoard, markCell, nextHint, type Cell, type Level } from './engine';
import { loadLevel, serializeLevel } from './level-format';
import { decodeProgress } from './storage';
import { numberedLevels, levels } from './levels';

const level: Level = {
  id: 'number-test',
  name: 'Number test',
  width: 4,
  height: 3,
  top: 2,
  solution: '.X++X..+++++'
    .split('')
    .map((c): Cell => (c === '.' ? 'empty' : c === 'X' ? 'head' : 'snake')),
  clues: [1, 4],
  regionClues: { 0: 1, 5: 2 },
  moves: [2, 3, 7, 11, 10, 9, 8, 6],
};

describe('numbered empty-region clues', () => {
  it('fixes numbered cells even if they are absent from the ordinary clues list', () => {
    const board = initialBoard(level);
    expect(board[0]).toBe('empty');
    expect(board[5]).toBe('empty');
    for (const tool of ['snake', 'empty', 'erase'] as const) {
      expect(markCell(level, board, 5, tool)).toBe(board);
    }
    expect(nextHint(level, board)?.index).not.toBe(5);
    board[5] = 'snake';
    const restored = decodeProgress(JSON.stringify({ boards: { [level.id]: board } }), [level]);
    expect(restored.boards[level.id]).toEqual(initialBoard(level));
  });
  it('accepts an open region below its target and optional crosses at completion', () => {
    expect(analyze(level, initialBoard(level)).errors.size).toBe(0);
    expect(analyze(level, level.solution).solved).toBe(true);
    const board = [...level.solution];
    board[6] = 'unknown';
    expect(analyze(level, board).solved).toBe(true);
  });
  it('rejects the wrong location even when global region sizes are correct', () => {
    const misplaced = { ...level, regionClues: { 0: 2, 5: 1 } };
    const result = analyze(misplaced, level.solution);
    expect(result.solved).toBe(false);
    expect(result.regionMismatch).toBe(true);
    expect(result.used).toEqual([0, 0]);
    expect(result.messages[0]).toContain('must contain exactly 2');
    expect(result.errors.has(0)).toBe(true);
    expect(result.errors.has(5)).toBe(true);
  });
  it('keeps numbered cells empty during validation as well as editing', () => {
    const corrupted = [...level.solution];
    corrupted[5] = 'unknown';
    // Auto-crossing must not silently conceal a broken fixed clue.
    expect(analyze(level, corrupted).solved).toBe(false);
  });
  it('flags an oversized open region and a closed region below its target', () => {
    const board = initialBoard(level);
    board[6] = 'empty';
    board[9] = 'empty';
    const large = analyze(level, board);
    expect(large.errors.has(5)).toBe(true);
    expect(large.regions.find((r) => r.cells.includes(5))?.closed).toBe(false);
    const closed = initialBoard(level);
    closed[6] = 'snake';
    closed[9] = 'snake';
    expect(
      analyze(level, closed).messages.some((message) => message.includes('must contain exactly 2')),
    ).toBe(true);
  });
  it('rejects joining different numbers, but allows two equal numbers in one region', () => {
    const board = initialBoard(level);
    board[6] = 'empty';
    const conflicting = { ...level, regionClues: { 5: 2, 6: 1 } };
    expect(analyze(conflicting, board).messages).toContain(
      'Clues with different numbers must be in separate empty regions.',
    );
    expect(analyze({ ...level, regionClues: { 5: 2, 6: 2 } }, board).errors.size).toBe(0);
  });
  it('keeps the required number visible and accessible before and after a conflict', () => {
    const board = initialBoard(level);
    for (const errors of [new Set<number>(), new Set([5])]) {
      const html = renderToStaticMarkup(
        createElement(Board, {
          level,
          board,
          errors,
          regions: analyze(level, board).regions,
          hint: null,
          onMark: () => {},
        }),
      );
      expect(html).toContain('empty, must belong to a region of 2 cells, fixed clue');
      expect(html).toContain('class="region-clue-number">2</span>');
    }
  });
  it('round-trips numbered clues and rejects malformed or nonempty clue positions', () => {
    const source = serializeLevel(level);
    const restored = loadLevel(source, level.id, 'Fallback');
    expect(restored.regionClues).toEqual(level.regionClues);
    expect(initialBoard(restored)).toEqual(initialBoard(level));
    for (const clue of [
      [4, 0, 1],
      [0, -1, 1],
      [0, 0, 0],
      [0, 0, 3],
      [1, 0, 1],
    ]) {
      expect(() =>
        loadLevel({ ...source, region_clues: [clue as [number, number, number]] }, 'bad', 'Bad'),
      ).toThrow();
    }
  });
  it('appends generated levels without renumbering the existing collection', () => {
    expect(numberedLevels).toHaveLength(18);
    expect(levels.slice(16)).toEqual(numberedLevels);
    for (const puzzle of numberedLevels) {
      const board = initialBoard(puzzle);
      expect(analyze(puzzle, board).solved).toBe(false);
      expect(analyze(puzzle, board).errors.size).toBe(0);
      for (const index of puzzle.moves) {
        board[index] = puzzle.solution[index];
        expect(analyze(puzzle, board).errors.size).toBe(0);
      }
      expect(board).toEqual(puzzle.solution);
      expect(analyze(puzzle, board).solved).toBe(true);
    }
  });
});
