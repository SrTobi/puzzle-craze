import { describe, expect, it } from 'vitest';
import { arrowDistance, pickArrow } from './hitTesting';
import { ARROW_WIDTH, CELL_SIZE } from './arrowGeometry';
import type { Arrow, Point } from './types';

const upper: Arrow = {
  id: 'upper',
  color: 'teal',
  points: [
    [0, 0],
    [3, 0],
  ],
};
const lower: Arrow = {
  id: 'lower',
  color: 'coral',
  points: [
    [3, 1],
    [0, 1],
  ],
};
const obstacle: Arrow = {
  id: 'obstacle',
  color: 'violet',
  points: [
    [4, 0],
    [4, 2],
  ],
};

function neighboringArrows(gap: number, bothBlocked = false): Arrow[] {
  return [
    upper,
    {
      ...lower,
      points: bothBlocked
        ? [
            [0, gap],
            [3, gap],
          ]
        : [
            [3, gap],
            [0, gap],
          ],
    },
    {
      ...obstacle,
      points: [
        [4, 0],
        [4, gap + 1],
      ],
    },
  ];
}

const rotations: ((point: Point) => Point)[] = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
];

describe('forgiving arrow selection', () => {
  it('accepts a near miss outside the old invisible stroke', () => {
    expect(pickArrow([CELL_SIZE, 24], [upper])?.id).toBe('upper');
  });

  it('selects the closer of two removable arrows, regardless of paint order', () => {
    for (const arrows of [
      [upper, lower],
      [lower, upper],
    ]) {
      expect(pickArrow([CELL_SIZE, 18], arrows)?.id).toBe('upper');
      expect(pickArrow([CELL_SIZE, 26], arrows)?.id).toBe('lower');
    }
  });

  it('prefers a slightly farther removable arrow over the blocked closest one', () => {
    expect(pickArrow([CELL_SIZE, 18], [upper, lower, obstacle])?.id).toBe('lower');
  });

  it('uses distance again as soon as the closer arrow is unblocked', () => {
    expect(pickArrow([CELL_SIZE, 18], [upper, lower])?.id).toBe('upper');
  });

  it('keeps blocked feedback for an obvious near miss with no removable arrow in reach', () => {
    expect(pickArrow([CELL_SIZE, -60], [upper, lower, obstacle])?.id).toBe('upper');
  });

  it('breaks an exact neighboring tie consistently, regardless of paint order', () => {
    expect(pickArrow([CELL_SIZE, 22], [upper, lower])?.id).toBe('lower');
    expect(pickArrow([CELL_SIZE, 22], [lower, upper])?.id).toBe('lower');
  });

  it.each([1, 2])('takes the nearer of two removable arrows %s grid spaces apart', (gap) => {
    const arrows = neighboringArrows(gap).slice(0, 2);
    for (const order of [arrows, [...arrows].reverse()]) {
      expect(pickArrow([CELL_SIZE, (gap / 2 - 0.001) * CELL_SIZE], order)?.id).toBe('upper');
      expect(pickArrow([CELL_SIZE, (gap / 2 + 0.001) * CELL_SIZE], order)?.id).toBe('lower');
    }
  });

  it.each([1, 2])('takes the nearer of two blocked arrows %s grid spaces apart', (gap) => {
    const arrows = neighboringArrows(gap, true);
    for (const order of [arrows, [...arrows].reverse()]) {
      expect(pickArrow([CELL_SIZE, (gap / 2 - 0.001) * CELL_SIZE], order)?.id).toBe('upper');
      expect(pickArrow([CELL_SIZE, (gap / 2 + 0.001) * CELL_SIZE], order)?.id).toBe('lower');
    }
  });

  it.each([
    { gap: 1, boundary: 0.2 },
    { gap: 2, boundary: 0.75 },
  ])(
    'switches at $boundary grid spaces from the blocked arrow in a $gap-cell gap',
    ({ gap, boundary }) => {
      for (const rotate of rotations) {
        const arrows = neighboringArrows(gap).map((arrow) => ({
          ...arrow,
          points: arrow.points.map(rotate),
        }));
        for (const order of [arrows, [...arrows].reverse()]) {
          const at = (distance: number) =>
            pickArrow(rotate([CELL_SIZE, distance * CELL_SIZE]), order)?.id;
          expect(at(boundary - 0.001)).toBe('upper');
          expect(at(boundary)).toBe('lower');
          expect(at(boundary + 0.001)).toBe('lower');
          expect(at(gap / 2)).toBe('lower');
          expect(at(gap - 0.1)).toBe('lower');
          expect(at(0)).toBe('upper');
        }
      }
    },
  );

  it('does not prefer a removable neighbor on the far side of the blocked arrow', () => {
    expect(pickArrow([CELL_SIZE, -0.3 * CELL_SIZE], neighboringArrows(1))?.id).toBe('upper');
  });

  it.each([1, 1.25, 1.5])(
    'accepts an obvious arrow %s grid spaces from its visible edge',
    (cells) => {
      const point = [CELL_SIZE, -(ARROW_WIDTH / 2 + cells * CELL_SIZE)] as const;
      expect(pickArrow(point, [upper])?.id).toBe('upper');
    },
  );

  it('does not select beyond 1.5 grid spaces', () => {
    expect(pickArrow([CELL_SIZE, -(ARROW_WIDTH / 2 + 1.6 * CELL_SIZE)], [upper])).toBeUndefined();
  });

  it('rejects ambiguous distant clicks and accepts a clearly closer distant arrow', () => {
    const farLower: Arrow = {
      ...lower,
      points: [
        [3, 3],
        [0, 3],
      ],
    };
    expect(pickArrow([CELL_SIZE, 1.5 * CELL_SIZE], [upper, farLower])).toBeUndefined();
    expect(pickArrow([CELL_SIZE, 1.25 * CELL_SIZE], [upper, farLower])?.id).toBe('upper');
  });

  it('considers a nearly tied competitor even just outside the maximum reach', () => {
    const farLower: Arrow = {
      ...lower,
      points: [
        [3, 3],
        [0, 3],
      ],
    };
    // 55 px from upper and 69 px from lower: too ambiguous at this distance.
    expect(pickArrow([CELL_SIZE, 59], [upper, farLower])).toBeUndefined();
  });

  it('does not let a distant removable arrow steal an ambiguous click', () => {
    const farLower: Arrow = {
      ...lower,
      points: [
        [3, 3],
        [0, 3],
      ],
    };
    expect(pickArrow([CELL_SIZE, 1.5 * CELL_SIZE], [upper, farLower, obstacle])).toBeUndefined();
  });

  it('rejects a distant tie even when both arrows are blocked', () => {
    const farLower: Arrow = {
      ...lower,
      points: [
        [0, 3],
        [3, 3],
      ],
    };
    const tallObstacle: Arrow = {
      ...obstacle,
      points: [
        [4, 0],
        [4, 4],
      ],
    };
    expect(
      pickArrow([CELL_SIZE, 1.5 * CELL_SIZE], [upper, farLower, tallObstacle]),
    ).toBeUndefined();
  });

  it('includes the arrowhead wings in distance checks', () => {
    expect(arrowDistance([3 * CELL_SIZE - 12, 8], upper)).toBe(0);
  });

  it('leaves empty space and cleared arrows unselected', () => {
    expect(pickArrow([500, 500], [upper, lower])).toBeUndefined();
    expect(pickArrow([CELL_SIZE, 0], [])).toBeUndefined();
  });

  it('keeps a direct hit on a blocked arrow deliberate', () => {
    expect(pickArrow([CELL_SIZE, 0], [upper, lower, obstacle])?.id).toBe('upper');
  });
});
