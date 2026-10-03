export const CAPACITY = 4;
// Each tube is stored bottom to top.
export type Board = number[][];
export type Move = { from: number; to: number };

export function isSorted(tube: number[]): boolean {
  return tube.length === CAPACITY && tube.every((color) => color === tube[0]);
}

export function isSolved(board: Board): boolean {
  return (
    board.some((tube) => tube.length > 0) && board.every((tube) => !tube.length || isSorted(tube))
  );
}

export function pourAmount(board: Board, { from, to }: Move): number {
  const source = board[from];
  const target = board[to];
  if (!source || !target || from === to || !source.length || target.length >= CAPACITY) return 0;
  const color = source.at(-1)!;
  if (target.length && target.at(-1) !== color) return 0;
  let count = 0;
  for (let i = source.length - 1; i >= 0 && source[i] === color; i--) count++;
  return Math.min(count, CAPACITY - target.length);
}

export function pour(board: Board, move: Move): Board | null {
  const amount = pourAmount(board, move);
  if (!amount) return null;
  return board.map((tube, index) =>
    index === move.from
      ? tube.slice(0, -amount)
      : index === move.to
        ? [...tube, ...board[move.from].slice(-amount)]
        : [...tube],
  );
}

export function legalMoves(board: Board): Move[] {
  return board.flatMap((_, from) =>
    board.flatMap((_, to) => (pourAmount(board, { from, to }) ? [{ from, to }] : [])),
  );
}

// Tube positions are interchangeable. Canonical keys avoid exploring equivalent states.
function key(board: Board): string {
  return board
    .map((tube) => tube.join(','))
    .sort()
    .join('|');
}

export function solve(board: Board, budget = 40000): Move[] | null {
  const visited = new Set<string>();
  const path: Move[] = [];
  function search(current: Board): boolean {
    if (isSolved(current)) return true;
    const state = key(current);
    if (visited.has(state) || visited.size >= budget || path.length >= 150) return false;
    visited.add(state);
    const moves = legalMoves(current).filter(({ from, to }) => {
      const source = current[from];
      // Moving an already uniform tube to an empty tube only renames that tube.
      return !isSorted(source) && (current[to].length > 0 || !source.every((c) => c === source[0]));
    });
    moves.sort((a, b) => {
      const score = (m: Move) => (current[m.to].length ? 10 : 0) + pourAmount(current, m);
      return score(b) - score(a);
    });
    for (const move of moves) {
      path.push(move);
      if (search(pour(current, move)!)) return true;
      path.pop();
    }
    return false;
  }
  return search(board) ? [...path] : null;
}
