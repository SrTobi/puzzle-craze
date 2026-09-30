import { describe, expect, it } from 'vitest';
import { reservePour, type ActivePour } from './pours';
import { type Board } from './engine';
import { type Run } from './storage';

const runFor = (board: Board): Run => ({ board, moves: 0, history: [] });

describe('overlapping pours', () => {
  it.each(['left', 'right'] as const)(
    'fills a shared target from opposite sides when %s is occupied',
    (preferred) => {
      const original = runFor([[1, 0, 0], [1, 0, 0], []]);
      const firstMove = { from: 0, to: 2 };
      const first = reservePour(original, [], firstMove, preferred)!;
      const active: ActivePour[] = [{ move: firstMove, side: first.side }];
      const second = reservePour(first.run, active, { from: 1, to: 2 }, preferred)!;
      expect(first.side).toBe(preferred);
      expect(second.side).toBe(preferred === 'left' ? 'right' : 'left');
      expect(second.run.board).toEqual([[1], [1], [0, 0, 0, 0]]);
      expect(second.run.board.flat().sort()).toEqual(original.board.flat().sort());
      expect(second.run.moves).toBe(2);
      // Each accepted pour can be undone in the order it was started.
      expect(second.run.history).toEqual([original.board, first.run.board]);
      expect(first.liquid).toEqual([1, 0, 0]);
      expect(original.board).toEqual([[1, 0, 0], [1, 0, 0], []]);
    },
  );

  it('reserves destination capacity before either animation finishes', () => {
    const firstMove = { from: 0, to: 2 };
    const first = reservePour(runFor([[0, 0], [0, 0], [0]]), [], firstMove, 'left')!;
    const second = reservePour(
      first.run,
      [{ move: firstMove, side: first.side }],
      { from: 1, to: 2 },
      'right',
    )!;
    expect(second.run.board).toEqual([[], [0], [0, 0, 0, 0]]);
    expect(second.run.board.flat()).toHaveLength(5);
  });

  it('rejects a different color while the first pour enters an empty tube', () => {
    const move = { from: 0, to: 2 };
    const first = reservePour(runFor([[0], [1], []]), [], move, 'left')!;
    expect(
      reservePour(first.run, [{ move, side: first.side }], { from: 1, to: 2 }, 'right'),
    ).toBeNull();
  });

  it('does not reuse moving sources or lift receivers, but allows independent pours', () => {
    const move = { from: 0, to: 3 };
    const first = reservePour(runFor([[1, 0], [0], [1], [], []]), [], move, 'left')!;
    const active: ActivePour[] = [{ move, side: first.side }];
    for (const blocked of [
      { from: 0, to: 4 },
      { from: 3, to: 4 },
      { from: 2, to: 0 },
    ]) {
      expect(reservePour(first.run, active, blocked, 'left')).toBeNull();
    }
    expect(reservePour(first.run, active, { from: 2, to: 4 }, 'left')?.run.board).toEqual([
      [1],
      [0],
      [],
      [0],
      [1],
    ]);
  });

  it('waits when both sides are occupied and reuses only the side that finishes', () => {
    const original = runFor([[0], [0], [0], []]);
    const leftMove = { from: 0, to: 3 };
    const rightMove = { from: 1, to: 3 };
    const first = reservePour(original, [], leftMove, 'left')!;
    const left: ActivePour = { move: leftMove, side: first.side };
    const second = reservePour(first.run, [left], rightMove, 'right')!;
    const right: ActivePour = { move: rightMove, side: second.side };
    const thirdMove = { from: 2, to: 3 };
    expect(reservePour(second.run, [left, right], thirdMove, 'left')).toBeNull();
    expect(reservePour(second.run, [right], thirdMove, 'right')?.side).toBe('left');
    expect(reservePour(second.run, [left], thirdMove, 'left')?.side).toBe('right');
  });
});
