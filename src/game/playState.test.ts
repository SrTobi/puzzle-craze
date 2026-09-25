import { describe, expect, it } from 'vitest';
import { blockingHit, advance, pathLength } from './engine';
import { ARROW_WIDTH, CELL_SIZE } from './arrowGeometry';
import { attemptDistance, attemptEnd, createAttempt, impactGlow } from './motion';
import { continuePlay, finishMotions, initialPlayState, tapArrow, undoPlay } from './playState';
import type { Arrow, Point } from './types';

const rear: Arrow = {
  id: 'rear',
  color: 'teal',
  points: [
    [0, 0],
    [1, 0],
  ],
};
const middle: Arrow = {
  id: 'middle',
  color: 'blue',
  points: [
    [3, 0],
    [4, 0],
  ],
};
const front: Arrow = {
  id: 'front',
  color: 'coral',
  points: [
    [6, 0],
    [7, 0],
  ],
};
const arrows = [rear, middle, front];

describe('three lives', () => {
  const chain: Arrow[] = Array.from({ length: 7 }, (_, i) => ({
    id: `link-${i}`,
    color: 'teal',
    points: [
      [i * 3, 0],
      [i * 3 + 1, 0],
    ],
  }));
  const lose = () => {
    let state = initialPlayState();
    for (let i = 0; i < 3; i++) state = tapArrow(chain, state, `link-${i}`, i);
    return state;
  };

  it('charges each new blocked selection once and locks on the third, even during motion', () => {
    const state = lose();
    expect(state.lives).toBe(0);
    expect(state.collisions).toBe(3);
    expect(state.attempts).toHaveLength(3);
    expect(tapArrow(chain, state, 'link-6', 4)).toBe(state);
    expect(tapArrow(chain, state, 'link-3', 4)).toBe(state);
    expect(undoPlay(state)).toBe(state);
    expect(finishMotions(state, 10000).lives).toBe(0);
  });

  it('free arrows and repeated queued selections cost no lives', () => {
    const state = tapArrow(arrows, initialPlayState(), 'rear', 0);
    expect(state.lives).toBe(2);
    expect(tapArrow(arrows, state, 'rear', 10).lives).toBe(2);
    expect(tapArrow(arrows, state, 'front', 20).lives).toBe(2);
  });

  it('undo before a loss restores the life and removes that queued selection', () => {
    let state = tapArrow(arrows, initialPlayState(), 'rear', 0);
    state = tapArrow(arrows, state, 'middle', 10);
    const undone = undoPlay(state);
    expect(undone.lives).toBe(2);
    expect(undone.collisions).toBe(1);
    expect(undone.queued).toEqual(['rear']);
  });

  it('continues with three fresh lives, preserving progress, queue, and total mistakes', () => {
    const previous = finishMotions(lose(), 10000);
    const resumed = continuePlay(previous);
    expect(resumed.lives).toBe(3);
    expect(resumed.queued).toEqual(previous.queued);
    expect(resumed.removed).toEqual(previous.removed);
    expect(resumed.collisions).toBe(3);
    expect(resumed.history).toEqual([]);
    expect(continuePlay(resumed)).toBe(resumed);
    expect(undoPlay(resumed)).toBe(resumed);
    let secondLoss = resumed;
    for (let i = 3; i < 6; i++) secondLoss = tapArrow(chain, secondLoss, `link-${i}`, i);
    expect(secondLoss.lives).toBe(0);
    expect(secondLoss.collisions).toBe(6);
    const final = tapArrow(chain, continuePlay(secondLoss), 'link-6', 10000);
    expect(final.removed).toHaveLength(7);
    expect(final.queued).toEqual([]);
    expect(final.lives).toBe(3);
  });

  it('keeps arrows already freed before the loss when continuing', () => {
    let state = tapArrow(chain, initialPlayState(), 'link-6', 0);
    for (let i = 0; i < 3; i++) state = tapArrow(chain, state, `link-${i}`, i + 1);
    expect(continuePlay(state).removed).toEqual(['link-6']);
    expect(initialPlayState().lives).toBe(3);
  });
});

describe('queued arrows', () => {
  it('queues a blocked arrow and aims at its nearest blocker', () => {
    const state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    expect(state.removed).toEqual([]);
    expect(state.queued).toEqual(['rear']);
    expect(state.attempts[0].by).toBe('middle');
    expect(state.attempts[0].distance * CELL_SIZE).toBeCloseTo(
      2 * CELL_SIZE - ARROW_WIDTH / 2 - 1.5,
    );
  });

  it('keeps the arrow queued after the complete outward-and-return animation', () => {
    const state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    const resting = finishMotions(state, attemptEnd(state.attempts[0]));
    expect(resting.attempts).toEqual([]);
    expect(resting.queued).toEqual(['rear']);
    expect(resting.removed).toEqual([]);
  });

  it('does not restart or duplicate an already queued arrow', () => {
    const state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    expect(tapArrow(arrows, state, 'rear', 200)).toBe(state);
    expect(state.collisions).toBe(1);
  });

  it('releases a dependency chain even when queue order is the reverse of launch order', () => {
    let state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    state = tapArrow(arrows, state, 'middle', 200);
    state = finishMotions(state, 2000);
    state = tapArrow(arrows, state, 'front', 2100);
    expect(state.removed).toEqual(['front', 'middle', 'rear']);
    expect(state.queued).toEqual([]);
    expect(state.attempts).toEqual([]);
    expect(state.flights.map((flight) => [flight.id, flight.queued])).toEqual([
      ['front', false],
      ['middle', true],
      ['rear', true],
    ]);
    expect(finishMotions(state, 4000).flights).toEqual([]);
  });

  it('does not release a queued arrow while any other blocker remains', () => {
    let state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    state = tapArrow(arrows, state, 'front', 200);
    expect(state.queued).toEqual(['rear']);
    expect(state.removed).toEqual(['front']);
    state = tapArrow(arrows, state, 'middle', 300);
    expect(state.removed).toEqual(['front', 'middle', 'rear']);
  });

  it('leaves untapped arrows on the board when their path opens', () => {
    const state = tapArrow(arrows, initialPlayState(), 'front', 100);
    expect(state.removed).toEqual(['front']);
    expect(state.queued).toEqual([]);
  });

  it.each(['outward', 'returning'])(
    'continues smoothly when unblocked during the %s motion',
    (phase) => {
      const pair = [rear, middle];
      const state = tapArrow(pair, initialPlayState(), 'rear', 100);
      const attempt = state.attempts[0];
      const now =
        phase === 'outward'
          ? 100 + attempt.outward / 2
          : 100 + attempt.outward + attempt.hold + attempt.returning / 2;
      const next = tapArrow(pair, state, 'middle', now);
      expect(next.removed).toEqual(['middle', 'rear']);
      expect(next.flights[1].fromDistance).toBeCloseTo(attemptDistance(attempt, now));
      expect(next.flights[1].fromDistance).toBeGreaterThan(0);
      expect(next.attempts).toEqual([]);
    },
  );

  it('undo restores an entire automatic chain together with its previous queue', () => {
    let state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    state = tapArrow(arrows, state, 'middle', 200);
    state = tapArrow(arrows, state, 'front', 2000);
    expect(undoPlay(state)).toBe(state); // Don't undo halfway through an outgoing flight.
    state = undoPlay(finishMotions(state, 4000));
    expect(state.removed).toEqual([]);
    expect(state.queued).toEqual(['rear', 'middle']);
    expect(state.flights).toEqual([]);
    expect(state.attempts).toEqual([]);
    expect(finishMotions(state, 5000)).toBe(state);
    expect(tapArrow(arrows, state, 'front', 5100).removed).toEqual(['front', 'middle', 'rear']);
  });

  it('undo cancels the last queued selection, including its active motion', () => {
    const state = tapArrow(arrows, initialPlayState(), 'rear', 100);
    expect(undoPlay(state)).toEqual(initialPlayState());
  });

  it('a restart discards pending attempts, departures, and the undo history', () => {
    const old = tapArrow(arrows, initialPlayState(), 'rear', 100);
    const restarted = finishMotions(initialPlayState(), attemptEnd(old.attempts[0]));
    expect(restarted).toEqual(initialPlayState());
    expect(tapArrow(arrows, restarted, 'front', 2000).removed).toEqual(['front']);
  });

  it('reduced motion retains the persistent queue and automatic release without travel', () => {
    const pair = [rear, middle];
    let state = tapArrow(pair, initialPlayState(), 'rear', 100, true);
    expect(attemptDistance(state.attempts[0], 150)).toBe(0);
    state = tapArrow(pair, state, 'middle', 150, true);
    expect(state.removed).toEqual(['middle', 'rear']);
    expect(
      state.flights.every((flight) => flight.duration === 200 && flight.fromDistance === 0),
    ).toBe(true);
  });
});

describe('contact and retreat geometry', () => {
  it.each<{ points: Point[]; obstacle: Point[] }>([
    {
      points: [
        [0, 2],
        [1, 2],
      ],
      obstacle: [
        [3, 0],
        [3, 4],
      ],
    },
    {
      points: [
        [4, 2],
        [3, 2],
      ],
      obstacle: [
        [1, 0],
        [1, 4],
      ],
    },
    {
      points: [
        [2, 0],
        [2, 1],
      ],
      obstacle: [
        [0, 3],
        [4, 3],
      ],
    },
    {
      points: [
        [2, 4],
        [2, 3],
      ],
      obstacle: [
        [0, 1],
        [4, 1],
      ],
    },
  ])('measures the first collision along each head direction %#', ({ points, obstacle }) => {
    const arrow = { ...rear, points };
    const block = { ...front, points: obstacle };
    expect(blockingHit(arrow, [arrow, block])).toEqual({ arrow: block, distance: 2 });
  });

  it('reaches contact without overshooting and returns to exactly the original path', () => {
    const attempt = createAttempt('a', 'b', 4, 100, false);
    const points: Point[] = [
      [0, 0],
      [0, 80],
      [80, 80],
    ];
    expect(attemptDistance(attempt, 100)).toBe(0);
    expect(attemptDistance(attempt, 100 + attempt.outward)).toBe(attempt.distance);
    for (let now = 100; now <= attemptEnd(attempt) + 100; now += 20) {
      const distance = attemptDistance(attempt, now);
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThanOrEqual(attempt.distance);
      expect(pathLength(advance(points, distance * CELL_SIZE))).toBeCloseTo(pathLength(points));
    }
    expect(attemptDistance(attempt, attemptEnd(attempt))).toBe(0);
    expect(impactGlow(attempt, 100)).toBe(0);
    expect(impactGlow(attempt, 100 + attempt.outward)).toBe(1);
    expect(impactGlow(attempt, attemptEnd(attempt))).toBe(0);
  });
});
