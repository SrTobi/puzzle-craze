import { describe, expect, it } from 'vitest';
import { analyze, historyReducer, initialBoard, markCell } from './engine';
import { levels, levelNumber, puzzleLevels, numberedLevels } from './levels';
import { tutorialLevels, tutorialStep } from './tutorials';
import { decodeProgress } from './storage';

describe('tutorial progression', () => {
  it('starts with one missing snake cell and no empty regions', () => {
    const level = tutorialLevels[0];
    const start = initialBoard(level);
    expect(start).toEqual(['head', 'unknown', 'head']);
    expect(level.top).toBe(0);
    expect(analyze(level, start).solved).toBe(false);
    expect(analyze(level, markCell(level, start, 1, 'snake')).solved).toBe(true);
    expect(analyze(level, markCell(level, start, 1, 'empty')).solved).toBe(false);
  });
  for (const level of tutorialLevels) {
    it(`guides ${level.name} to a valid solution without conflicts`, () => {
      let board = initialBoard(level);
      for (const [position, step] of level.tutorial!.steps.entries()) {
        expect(tutorialStep(level, board)).toMatchObject({ ...step, position });
        expect(level.clues).not.toContain(step.index);
        expect(analyze(level, board).solved).toBe(false);
        board = markCell(level, board, step.index, step.tool);
        expect(analyze(level, board).errors.size).toBe(0);
      }
      expect(tutorialStep(level, board)).toBeNull();
      expect(analyze(level, board).solved).toBe(true);
      expect(analyze(level, board).used).toEqual(Array(level.top).fill(1));
    });
  }
  it('teaches an empty mark before connecting the second snake', () => {
    const level = tutorialLevels[1];
    const board = initialBoard(level);
    const step = tutorialStep(level, board)!;
    expect(step.tool).toBe('empty');
    const marked = markCell(level, board, step.index, 'empty');
    expect(analyze(level, marked).regions[0].closed).toBe(false);
    expect(tutorialStep(level, marked)?.tool).toBe('snake');
  });
  it('restores the right prompt after a wrong mark, undo, reload, or restart', () => {
    const level = tutorialLevels[1];
    const start = initialBoard(level);
    const step = tutorialStep(level, start)!;
    expect(tutorialStep(level, markCell(level, start, step.index, 'snake'))?.index).toBe(
      step.index,
    );
    const state = historyReducer(
      { past: [], present: start, future: [] },
      { type: 'edit', board: markCell(level, start, step.index, 'empty') },
    );
    expect(tutorialStep(level, historyReducer(state, { type: 'undo' }).present)?.position).toBe(0);
    const restored = decodeProgress(
      JSON.stringify({ selected: level.id, boards: { [level.id]: state.present } }),
      levels,
    );
    expect(tutorialStep(level, restored.boards[level.id])?.position).toBe(1);
    expect(tutorialStep(level, initialBoard(level))?.position).toBe(0);
  });
  it('introduces beginners to tutorials and keeps existing saves with continuous level numbering', () => {
    expect(levels).toHaveLength(16 + numberedLevels.length);
    expect(decodeProgress(null, levels).selected).toBe(tutorialLevels[0].id);
    const old = puzzleLevels[0];
    const board = initialBoard(old);
    const restored = decodeProgress(
      JSON.stringify({ selected: old.id, boards: { [old.id]: board }, completed: [old.id] }),
      levels,
    );
    expect(restored).toEqual({
      selected: old.id,
      boards: { [old.id]: board },
      completed: [old.id],
    });
    expect(levelNumber(old)).toBe('04');
    expect(tutorialLevels.map(levelNumber)).toEqual(['01', '02', '03']);
    expect(tutorialStep(old, board)).toBeNull();
  });
});
