import type { GenerationInfo } from '../generation/types';
import type { Tutorial } from './tutorials';

export type Cell = 'unknown' | 'empty' | 'snake' | 'head';
export type Tool = 'snake' | 'empty' | 'erase';
export interface Level {
  id: string;
  name: string;
  width: number;
  height: number;
  top: number;
  solution: Cell[];
  clues: number[];
  /** Fixed empty cells, indexed by position, with their required region size. */
  regionClues?: Record<number, number>;
  moves: number[];
  tutorial?: Tutorial;
  generation?: GenerationInfo;
}

export const isSnake = (cell: Cell) => cell === 'snake' || cell === 'head';
export const isFixedClue = (level: Level, index: number) =>
  level.clues.includes(index) || level.regionClues?.[index] !== undefined;
export const initialBoard = (level: Level): Cell[] =>
  level.solution.map((cell, i) =>
    level.regionClues?.[i] !== undefined ? 'empty' : isFixedClue(level, i) ? cell : 'unknown',
  );

export function neighbors(level: Pick<Level, 'width' | 'height'>, index: number): number[] {
  const { width, height } = level;
  const x = index % width;
  const y = Math.floor(index / width);
  return [
    y > 0 ? index - width : -1,
    x < width - 1 ? index + 1 : -1,
    y < height - 1 ? index + width : -1,
    x > 0 ? index - 1 : -1,
  ].filter((i) => i >= 0);
}

export function markCell(level: Level, board: Cell[], index: number, tool: Tool): Cell[] {
  if (index < 0 || index >= board.length || isFixedClue(level, index)) return board;
  const cell = tool === 'erase' || board[index] === tool ? 'unknown' : tool;
  if (board[index] === cell) return board;
  return board.map((previous, i) => (i === index ? cell : previous));
}

export interface Region {
  cells: number[];
  closed: boolean;
  valid: boolean;
}

function analyzeBoard(level: Level, board: Cell[]) {
  const regions: Region[] = [];
  const visited = new Set<number>();
  const errors = new Set<number>();
  const messages = new Set<string>();
  const used = Array.from({ length: level.top }, () => 0);
  for (const index of Object.keys(level.regionClues ?? {}).map(Number)) {
    if (board[index] !== 'empty') {
      errors.add(index);
      messages.add('Numbered clues must remain empty.');
    }
  }

  // A region is only finished when no unknown cell touches it. Board edges are walls.
  board.forEach((cell, start) => {
    if (cell !== 'empty' || visited.has(start)) return;
    const cells = [start];
    visited.add(start);
    let closed = true;
    for (let cursor = 0; cursor < cells.length; cursor++) {
      for (const next of neighbors(level, cells[cursor])) {
        if (board[next] === 'unknown') closed = false;
        if (board[next] === 'empty' && !visited.has(next)) {
          visited.add(next);
          cells.push(next);
        }
      }
    }
    if (closed && cells.length <= level.top) used[cells.length - 1]++;
    regions.push({ cells, closed, valid: true });
  });
  for (const region of regions) {
    const size = region.cells.length;
    region.valid = size <= level.top && (!region.closed || used[size - 1] <= 1);
    if (!region.valid) {
      region.cells.forEach((i) => errors.add(i));
      messages.add(
        size > level.top
          ? `An empty region is larger than ${level.top} cells.`
          : `Two finished regions have size ${size}. Each size is needed once.`,
      );
    }
    const targets = [
      ...new Set(
        region.cells.flatMap((i) =>
          level.regionClues?.[i] === undefined ? [] : [level.regionClues[i]],
        ),
      ),
    ];
    const wrongClue =
      targets.length > 1 ||
      targets.some((target) => size > target || (region.closed && size !== target));
    if (wrongClue) {
      region.valid = false;
      region.cells.forEach((i) => errors.add(i));
      messages.add(
        targets.length > 1
          ? 'Clues with different numbers must be in separate empty regions.'
          : `The region containing ${targets[0]} has ${size} cells. It must contain exactly ${targets[0]}.`,
      );
    }
  }

  // A region with a misplaced numbered clue must not appear complete in the checklist.
  used.forEach((count, index) => {
    if (
      count === 1 &&
      !regions.some((region) => region.closed && region.valid && region.cells.length === index + 1)
    ) {
      used[index] = 0;
    }
  });

  const snakeCells = board.flatMap((cell, i) => (isSnake(cell) ? [i] : []));
  for (const index of snakeCells) {
    const around = neighbors(level, index);
    const count = around.filter((i) => isSnake(board[i])).length;
    const possible = around.filter((i) => board[i] === 'unknown').length;
    const target = board[index] === 'head' ? 1 : 2;
    if (count > target || count + possible < target) {
      errors.add(index);
      messages.add(
        count > target
          ? 'The snake cannot branch or touch itself along an edge.'
          : 'A snake cell is cut off. Leave a path to both endpoints.',
      );
    }
  }
  const snakeVisited = new Set<number>();
  let components = 0;
  let connectedSnake: number[] = [];
  for (const start of snakeCells) {
    if (snakeVisited.has(start)) continue;
    components++;
    const group = [start];
    snakeVisited.add(start);
    for (let cursor = 0; cursor < group.length; cursor++) {
      for (const next of neighbors(level, group[cursor])) {
        if (isSnake(board[next]) && !snakeVisited.has(next)) {
          snakeVisited.add(next);
          group.push(next);
        }
      }
    }
    if (group.filter((i) => board[i] === 'head').length === 2) connectedSnake = group;
    if (group.every((i) => neighbors(level, i).filter((n) => isSnake(board[n])).length === 2)) {
      group.forEach((i) => errors.add(i));
      messages.add('The snake forms a loop. It needs to connect the two endpoints.');
    }
  }
  const unknown = board.filter((cell) => cell === 'unknown').length;
  const snakeConnected =
    components === 1 &&
    board.filter((cell) => cell === 'head').length === 2 &&
    snakeCells.every(
      (i) =>
        neighbors(level, i).filter((n) => isSnake(board[n])).length ===
        (board[i] === 'head' ? 1 : 2),
    );
  const solved =
    unknown === 0 && errors.size === 0 && snakeConnected && used.every((count) => count === 1);
  return {
    regions,
    used,
    errors,
    messages: [...messages],
    unknown,
    solved,
    snakeConnected,
    connectedSnake,
    regionMismatch: false,
  };
}

export function analyze(level: Level, board: Cell[]) {
  const current = analyzeBoard(level, board);
  if (Object.keys(level.regionClues ?? {}).some((index) => board[Number(index)] !== 'empty')) {
    return current;
  }
  if (!current.snakeConnected) {
    if (current.connectedSnake.length > 0) {
      current.connectedSnake.forEach((i) => current.errors.add(i));
      current.messages.push('The endpoints are connected, but the puzzle is not solved.');
    }
    return current;
  }

  // Crosses are optional: a finished snake determines every remaining empty cell.
  // Once connected, check the spaces even if the player has not crossed them out.
  const completed = analyzeBoard(
    level,
    board.map((cell) => (cell === 'unknown' ? 'empty' : cell)),
  );
  if (completed.solved) return { ...completed, unknown: current.unknown };

  current.connectedSnake.forEach((i) => completed.errors.add(i));
  const sizes = completed.regions.map((region) => region.cells.length).sort((a, b) => a - b);
  const required =
    level.top === 0
      ? 'no empty regions'
      : `one region of each size: ${Array.from({ length: level.top }, (_, i) => i + 1).join(', ')}`;
  return {
    ...completed,
    unknown: current.unknown,
    regionMismatch: true,
    messages: [
      completed.messages.length && Object.keys(level.regionClues ?? {}).length
        ? `The snake is connected, but ${completed.messages[0][0].toLowerCase()}${completed.messages[0].slice(1)} Adjust the snake’s path.`
        : `The snake is connected, but the empty regions have sizes ${sizes.join(', ') || 'none'}. You need ${required}. Adjust the snake’s path.`,
      'The endpoints are connected, but the puzzle is not solved.',
    ],
  };
}

// Hints use the source puzzle's recorded solve order, correcting mistakes first.
export function nextHint(level: Level, board: Cell[]) {
  const order = [...new Set([...level.moves, ...board.map((_, i) => i)])].filter(
    (i) => !isFixedClue(level, i),
  );
  const index =
    order.find((i) => board[i] !== 'unknown' && board[i] !== level.solution[i]) ??
    order.find((i) => board[i] === 'unknown');
  return index === undefined ? null : { index, cell: level.solution[index] };
}

export interface History {
  past: Cell[][];
  present: Cell[];
  future: Cell[][];
}
export type HistoryAction = { type: 'edit'; board: Cell[] } | { type: 'undo' | 'redo' };
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  if (action.type !== 'edit' || action.board.every((cell, i) => cell === state.present[i]))
    return state;
  return { past: [...state.past.slice(-149), state.present], present: action.board, future: [] };
}
