import { CAPACITY, type Board } from './engine';
import { CATALOG_VERSION, colorCount, isLevelNumber, type Level } from './levels';

// Ranked levels have new identities; leave earlier collections and their saves untouched.
export const STORAGE_KEY = `puzzle-craze.water-sort.ranked-v${CATALOG_VERSION}`;
export type Run = { board: Board; history: Board[]; moves: number };
export type Progress = { selected: string; completed: string[]; runs: Record<string, Run> };
export const freshRun = (level: Level): Run => ({
  board: level.board.map((t) => [...t]),
  history: [],
  moves: 0,
});

export function validBoard(value: unknown, level: Pick<Level, 'board' | 'colors'>): value is Board {
  if (
    !Array.isArray(value) ||
    value.length !== level.board.length ||
    value.length < level.colors ||
    !Number.isSafeInteger(level.colors) ||
    level.colors < 1
  )
    return false;
  const counts = Array<number>(level.colors).fill(0);
  for (const tube of value) {
    if (!Array.isArray(tube) || tube.length > CAPACITY) return false;
    for (const color of tube) {
      if (!Number.isInteger(color) || color < 0 || color >= level.colors) return false;
      counts[color]++;
    }
  }
  return counts.every((count) => count === CAPACITY);
}
const validId = (id: unknown): id is string =>
  typeof id === 'string' && isLevelNumber(Number(id)) && String(Number(id)) === id;
export function decodeProgress(raw: string | null): Progress {
  const result: Progress = { selected: '1', completed: [], runs: {} };
  try {
    const data = JSON.parse(raw ?? 'null');
    if (!data || typeof data !== 'object') return result;
    if (validId(data.selected)) result.selected = data.selected;
    if (Array.isArray(data.completed))
      result.completed = [...new Set<string>(data.completed.filter(validId))];
    if (data.runs && typeof data.runs === 'object')
      for (const [id, value] of Object.entries(data.runs)) {
        if (!validId(id) || !value || typeof value !== 'object') continue;
        const run = value as Run;
        const colors = colorCount(Number(id));
        if (
          !Array.isArray(run.board) ||
          run.board.length < colors + 1 ||
          run.board.length > colors * 2
        )
          continue;
        const spec = { colors, board: run.board };
        if (validBoard(run.board, spec) && Number.isSafeInteger(run.moves) && run.moves >= 0) {
          const history =
            Array.isArray(run.history) &&
            run.history.length <= run.moves &&
            run.history.every((board) => validBoard(board, spec))
              ? run.history.slice(-100)
              : [];
          result.runs[id] = { board: run.board, history, moves: run.moves };
        }
      }
  } catch {
    /* A corrupt save must not prevent playing. */
  }
  return result;
}
export function loadProgress(): Progress {
  try {
    return decodeProgress(localStorage.getItem(STORAGE_KEY));
  } catch {
    return decodeProgress(null);
  }
}
