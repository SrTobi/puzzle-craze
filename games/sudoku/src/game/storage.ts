import { boxRegions, connected, isSolved, units } from './engine';
import { validOptions } from './generator';
import type { Puzzle, Run, Snapshot } from './types';

export const STORAGE_KEY = 'puzzle-craze.sudoku.v1';
export type Progress = {
  inputMode: 'cell-first' | 'number-first';
  selected: string;
  completed: string[];
  runs: Record<string, Run>;
  custom: Puzzle | null;
};

export function validPuzzle(value: unknown): value is Puzzle {
  if (!value || typeof value !== 'object') return false;
  const p = value as Puzzle;
  if (
    !validOptions(p.options) ||
    typeof p.id !== 'string' ||
    p.id.length > 500 ||
    typeof p.name !== 'string' ||
    p.name.length > 100
  )
    return false;
  const size = p.options.size;
  const array = (v: unknown, min: number, max: number): v is number[] =>
    Array.isArray(v) &&
    v.length === size * size &&
    v.every((n) => Number.isInteger(n) && n >= min && n <= max);
  if (
    !array(p.givens, 0, size) ||
    !array(p.solution, 1, size) ||
    !array(p.regions, 0, size - 1) ||
    !array(p.colors, -1, 2)
  )
    return false;
  const groups = units(p);
  if (groups.some((u) => u.cells.length !== size)) return false;
  if (groups.filter((u) => u.kind === 'region').some((u) => !connected(u.cells, size)))
    return false;
  if (p.options.regions === 'boxes' && p.regions.some((r, i) => r !== boxRegions(size)[i]))
    return false;
  const colors = new Set(p.colors.filter((n) => n >= 0)).size;
  if (colors !== (p.options.colors ? Math.min(3, size / 2) : 0)) return false;
  return isSolved(p, p.solution);
}
export function validSnapshot(value: unknown, puzzle: Puzzle): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Snapshot;
  const length = puzzle.givens.length;
  return (
    Array.isArray(s.board) &&
    s.board.length === length &&
    s.board.every(
      (v, i) =>
        Number.isInteger(v) &&
        v >= 0 &&
        v <= puzzle.options.size &&
        (!puzzle.givens[i] || puzzle.givens[i] === v),
    ) &&
    Array.isArray(s.notes) &&
    s.notes.length === length &&
    s.notes.every(
      (v, i) =>
        Number.isInteger(v) && v >= 0 && v < 1 << puzzle.options.size && (!s.board[i] || v === 0),
    )
  );
}
export function decodeProgress(raw: string | null, levels: Puzzle[]): Progress {
  const result: Progress = {
    inputMode: 'cell-first',
    selected: levels[0].id,
    completed: [],
    runs: {},
    custom: null,
  };
  try {
    const data = JSON.parse(raw ?? 'null');
    if (!data || typeof data !== 'object') return result;
    if (data.inputMode === 'number-first') result.inputMode = 'number-first';
    if (validPuzzle(data.custom)) result.custom = data.custom;
    const puzzles = new Map(levels.map((p) => [p.id, p]));
    if (result.custom) puzzles.set('custom', result.custom);
    if (typeof data.selected === 'string' && puzzles.has(data.selected))
      result.selected = data.selected;
    if (Array.isArray(data.completed))
      result.completed = [
        ...new Set<string>(
          data.completed.filter((id: unknown) => typeof id === 'string' && puzzles.has(id)),
        ),
      ];
    if (data.runs && typeof data.runs === 'object')
      for (const [id, value] of Object.entries(data.runs)) {
        const puzzle = puzzles.get(id);
        if (!puzzle || !validSnapshot(value, puzzle)) continue;
        const run = value as Run;
        const history = (values: unknown): Snapshot[] =>
          Array.isArray(values) ? values.slice(-100).filter((s) => validSnapshot(s, puzzle)) : [];
        result.runs[id] = {
          board: run.board,
          notes: run.notes,
          history: history(run.history),
          future: history(run.future),
        };
      }
  } catch {
    /* An unavailable or damaged save must not prevent playing. */
  }
  return result;
}
export function loadProgress(levels: Puzzle[]): Progress {
  try {
    return decodeProgress(localStorage.getItem(STORAGE_KEY), levels);
  } catch {
    return decodeProgress(null, levels);
  }
}
