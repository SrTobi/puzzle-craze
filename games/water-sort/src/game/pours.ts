import { pour, type Move } from './engine';
import type { Run } from './storage';

export type PourSide = 'left' | 'right';
export type ActivePour = { move: Move; side: PourSide };

export function availablePourSide(
  active: ActivePour[],
  move: Move,
  preferred: PourSide = 'left',
): PourSide | null {
  // A moving or receiving tube must settle before it can be lifted again.
  if (
    active.some(
      ({ move: other }) =>
        other.from === move.from || other.to === move.from || other.from === move.to,
    )
  )
    return null;
  const occupied = active.filter(({ move: other }) => other.to === move.to).map(({ side }) => side);
  if (!occupied.includes(preferred)) return preferred;
  const opposite = preferred === 'left' ? 'right' : 'left';
  return occupied.includes(opposite) ? null : opposite;
}

export function reservePour(run: Run, active: ActivePour[], move: Move, preferred: PourSide) {
  const side = availablePourSide(active, move, preferred);
  if (!side) return null;
  const board = pour(run.board, move);
  if (!board) return null;
  // Reserve the liquid and capacity immediately. Animation completion only removes
  // the visual, so overlapping pours cannot overfill a tube or apply a move twice.
  return {
    side,
    liquid: [...run.board[move.from]],
    run: {
      board,
      moves: run.moves + 1,
      history: [...run.history, run.board].slice(-100),
    },
  };
}
