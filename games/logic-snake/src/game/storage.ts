import { initialBoard, type Cell, type Level } from './engine';

export const STORAGE_KEY = 'puzzle-craze.logic-snake.v1';
export interface Progress {
  selected: string;
  boards: Record<string, Cell[]>;
  completed: string[];
}

export function decodeProgress(raw: string | null, levels: Level[]): Progress {
  const fallback: Progress = { selected: levels[0].id, boards: {}, completed: [] };
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return fallback;
    for (const level of levels) {
      const board = value.boards?.[level.id];
      if (
        Array.isArray(board) &&
        board.length === level.solution.length &&
        board.every((cell) => ['unknown', 'empty', 'snake', 'head'].includes(cell))
      ) {
        const initial = initialBoard(level);
        fallback.boards[level.id] = board.map((cell, i) =>
          level.clues.includes(i) ? initial[i] : cell === 'head' ? 'unknown' : cell,
        );
      }
    }
    if (levels.some((level) => level.id === value.selected)) fallback.selected = value.selected;
    if (Array.isArray(value.completed))
      fallback.completed = levels
        .filter((level) => value.completed.includes(level.id))
        .map((level) => level.id);
    return fallback;
  } catch {
    return fallback;
  }
}

export function loadProgress(levels: Level[]): Progress {
  try {
    return decodeProgress(localStorage.getItem(STORAGE_KEY), levels);
  } catch {
    return decodeProgress(null, levels);
  }
}
