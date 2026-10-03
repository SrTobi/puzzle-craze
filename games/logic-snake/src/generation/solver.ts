import type { SolveMove } from './types';
import { initialBoard, neighbors, type Cell, type Level } from '../game/engine.ts';

const UNKNOWN = 0,
  EMPTY = 1,
  SNAKE = 2,
  HEAD = 3;
const labels: Cell[] = ['unknown', 'empty', 'snake', 'head'];
type Shape = Pick<Level, 'width' | 'height' | 'top' | 'regionClues'>;
export interface SolveReport {
  status: 'solved' | 'stalled' | 'contradiction' | 'budget';
  board: Cell[];
  moves: SolveMove[];
  stats: {
    checks: number;
    forcedMoves: number;
    lookaheadMoves: number;
    maxDepthUsed: number;
    unknownRemaining: number;
  };
}
class SearchBudget extends Error {}

/** Rust-style allowed-cell checks, recomputed on small typed-array boards instead of union-find. */
class Constraints {
  readonly adjacent: number[][];
  readonly requiredSnake: number;
  readonly numbers: Int16Array;
  readonly seen: Uint8Array;
  readonly queue: Int16Array;
  readonly used: Uint8Array;
  checks = 0;
  readonly shape: Shape;
  readonly maxChecks: number;
  constructor(shape: Shape, maxChecks: number) {
    this.shape = shape;
    this.maxChecks = maxChecks;
    const size = shape.width * shape.height;
    this.adjacent = Array.from({ length: size }, (_, i) => neighbors(shape, i));
    this.requiredSnake = size - (shape.top * (shape.top + 1)) / 2;
    this.numbers = new Int16Array(size);
    for (const [index, target] of Object.entries(shape.regionClues ?? {}))
      this.numbers[Number(index)] = target;
    this.seen = new Uint8Array(size);
    this.queue = new Int16Array(size);
    this.used = new Uint8Array(shape.top + 1);
  }
  contradiction(board: Uint8Array): string | null {
    if (this.checks >= this.maxChecks) throw new SearchBudget();
    this.checks++;
    let snakes = 0,
      unknown = 0,
      heads = 0;
    for (let i = 0; i < board.length; i++) {
      const cell = board[i];
      if (this.numbers[i] && cell !== EMPTY) return 'A numbered cell must stay empty.';
      if (cell === UNKNOWN) unknown++;
      if (cell < SNAKE) continue;
      snakes++;
      if (cell === HEAD) heads++;
      let around = 0,
        possible = 0;
      for (const next of this.adjacent[i]) {
        if (board[next] >= SNAKE) around++;
        if (board[next] === UNKNOWN) possible++;
      }
      const target = cell === HEAD ? 1 : 2;
      if (around > target) return 'The snake would branch or touch itself.';
      if (around + possible < target) return 'A snake cell could not connect to the path.';
    }
    if (heads !== 2) return 'The snake needs two endpoints.';
    if (snakes > this.requiredSnake) return 'Too few cells would remain for the empty regions.';
    if (snakes + unknown < this.requiredSnake) return 'Too many cells would be empty.';
    this.seen.fill(0);
    this.used.fill(0);
    for (let start = 0; start < board.length; start++) {
      if (board[start] === UNKNOWN || this.seen[start]) continue;
      const empty = board[start] === EMPTY;
      this.queue[0] = start;
      this.seen[start] = 1;
      let length = 1,
        closed = true,
        target = 0,
        groupHeads = 0,
        degreeSum = 0;
      for (let cursor = 0; cursor < length; cursor++) {
        const index = this.queue[cursor];
        if (board[index] === HEAD) groupHeads++;
        if (empty && this.numbers[index]) {
          if (target && target !== this.numbers[index])
            return 'Different numbered regions would merge.';
          target = this.numbers[index];
        }
        for (const next of this.adjacent[index]) {
          if (board[next] === UNKNOWN) closed = false;
          const same = empty ? board[next] === EMPTY : board[next] >= SNAKE;
          if (!same) continue;
          degreeSum++;
          if (this.seen[next]) continue;
          this.seen[next] = 1;
          this.queue[length++] = next;
        }
      }
      if (empty) {
        if (length > (target || this.shape.top))
          return 'An empty region would exceed its required size.';
        if (closed) {
          if (target && length !== target)
            return `The numbered region must contain ${target} cells.`;
          if (this.used[length]) return 'Two finished empty regions would have the same size.';
          this.used[length] = 1;
        }
      } else {
        if (degreeSum / 2 >= length) return 'The snake would form a loop.';
        if (groupHeads === 2 && (length !== snakes || length !== this.requiredSnake))
          return 'The endpoints would connect before the required snake is complete.';
      }
    }
    if (unknown === 0 && this.used.slice(1).some((count) => count !== 1))
      return 'A required empty region is missing.';
    return null;
  }
}

function assign(
  board: Uint8Array,
  index: number,
  value: number,
  depth: number,
  reason: string,
  moves?: SolveMove[],
) {
  board[index] = value;
  moves?.push({ index, cell: value === SNAKE ? 'snake' : 'empty', depth, reason });
}

/** Equivalent to fill_obvious: commit only when the other cell value violates a constraint. */
function fillObvious(context: Constraints, board: Uint8Array, moves?: SolveMove[]): boolean {
  if (context.contradiction(board)) return false;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== UNKNOWN) continue;
      let snakeError: string | null, emptyError: string | null;
      try {
        board[i] = SNAKE;
        snakeError = context.contradiction(board);
        board[i] = EMPTY;
        emptyError = context.contradiction(board);
      } finally {
        board[i] = UNKNOWN;
      }
      if (snakeError && emptyError) return false;
      if (snakeError || emptyError) {
        const value = snakeError ? EMPTY : SNAKE;
        assign(board, i, value, 0, snakeError ?? emptyError!, moves);
        changed = true;
      }
    }
  }
  return true;
}

/** Search for a contradiction, never treat finding one completion as proof of a forced move. */
function contradicts(
  context: Constraints,
  board: Uint8Array,
  depthLeft: number,
  last: number,
): boolean {
  if (!fillObvious(context, board)) return true;
  if (depthLeft === 0 || !board.includes(UNKNOWN)) return false;
  // Like the Rust solver, nested assumptions stay next to the last assumed cell.
  const next = context.adjacent[last].find((i) => board[i] === UNKNOWN);
  if (next === undefined) return false;
  for (const value of [SNAKE, EMPTY]) {
    const branch = board.slice();
    branch[next] = value;
    if (!contradicts(context, branch, depthLeft - 1, next)) return false;
  }
  return true;
}

export function solveWithDeductions(
  level: Level,
  options: {
    maxDepth?: number;
    maxChecks?: number;
    board?: Cell[];
  } = {},
): SolveReport {
  const { maxDepth = 1, maxChecks = 250_000 } = options;
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 2)
    throw new Error('Assumption depth must be 0, 1, or 2.');
  if (!Number.isSafeInteger(maxChecks) || maxChecks < 1)
    throw new Error('Solver budget must be positive.');
  const given = initialBoard(level);
  const input = options.board ?? given;
  if (
    input.length !== given.length ||
    input.some(
      (cell, i) =>
        !labels.includes(cell) ||
        (given[i] !== 'unknown' && cell !== given[i]) ||
        (cell === 'head' && given[i] !== 'head'),
    )
  ) {
    throw new Error('Solver board must preserve the fixed clues and endpoints.');
  }
  const board = Uint8Array.from(input, (cell) => labels.indexOf(cell));
  const context = new Constraints(level, maxChecks);
  const moves: SolveMove[] = [];
  let status: SolveReport['status'] = 'stalled';
  try {
    while (true) {
      if (!fillObvious(context, board, moves)) {
        status = 'contradiction';
        break;
      }
      if (!board.includes(UNKNOWN)) {
        status = 'solved';
        break;
      }
      let advanced = false;
      for (let depth = 1; depth <= maxDepth && !advanced; depth++) {
        for (let i = 0; i < board.length && !advanced; i++) {
          if (board[i] !== UNKNOWN) continue;
          const snake = board.slice();
          snake[i] = SNAKE;
          const empty = board.slice();
          empty[i] = EMPTY;
          const noSnake = contradicts(context, snake, depth - 1, i);
          const noEmpty = contradicts(context, empty, depth - 1, i);
          if (noSnake && noEmpty) {
            status = 'contradiction';
            break;
          }
          if (noSnake || noEmpty) {
            assign(
              board,
              i,
              noSnake ? EMPTY : SNAKE,
              depth,
              `Assuming ${noSnake ? 'snake' : 'empty'} leads to a contradiction within depth ${depth}.`,
              moves,
            );
            advanced = true;
          }
        }
        if (status === 'contradiction') break;
      }
      if (!advanced || status === 'contradiction') break;
    }
  } catch (error) {
    if (!(error instanceof SearchBudget)) throw error;
    status = 'budget';
  }
  return {
    status,
    board: Array.from(board, (cell) => labels[cell]),
    moves,
    stats: {
      checks: context.checks,
      forcedMoves: moves.filter((move) => move.depth === 0).length,
      lookaheadMoves: moves.filter((move) => move.depth > 0).length,
      maxDepthUsed: Math.max(0, ...moves.map((move) => move.depth)),
      unknownRemaining: board.filter((cell) => cell === UNKNOWN).length,
    },
  };
}

/** Rust's layout phase: random endpoints, forced assignments, then randomized backtracking. */
export function constructSolution(
  shape: Shape,
  rng: () => number,
  maxChecks: number,
): { board: Cell[]; checks: number } {
  const context = new Constraints(shape, maxChecks);
  const size = shape.width * shape.height;
  function search(board: Uint8Array): Uint8Array | null {
    if (!fillObvious(context, board)) return null;
    const index = board.findIndex((cell) => cell === UNKNOWN);
    if (index === -1) return board;
    const values = rng() < 0.5 ? [SNAKE, EMPTY] : [EMPTY, SNAKE];
    for (const value of values) {
      const branch = board.slice();
      branch[index] = value;
      const result = search(branch);
      if (result) return result;
    }
    return null;
  }
  try {
    for (let attempt = 0; attempt < 64; attempt++) {
      const a = Math.floor(rng() * size),
        b = Math.floor(rng() * size);
      const distance =
        Math.abs((a % shape.width) - (b % shape.width)) +
        Math.abs(Math.floor(a / shape.width) - Math.floor(b / shape.width));
      if (distance < 2 || (distance - (context.requiredSnake - 1)) % 2 !== 0) continue;
      const board = new Uint8Array(size);
      board[a] = HEAD;
      board[b] = HEAD;
      const result = search(board);
      if (result)
        return { board: Array.from(result, (cell) => labels[cell]), checks: context.checks };
    }
  } catch (error) {
    if (!(error instanceof SearchBudget)) throw error;
  }
  throw new Error(
    `No layout found within the bounded search (${context.checks} constraint checks). Try another seed.`,
  );
}
