import { describe, expect, it } from 'vitest';
import { advance, availableArrows, blocker, cells, parseLevel, pathLength, solve } from './engine';
import type { Arrow, Level, Point } from './types';
import firstLight from '../levels/first-light.json';

const makeArrow = (id: string, points: Point[]): Arrow => ({ id, color: 'teal', points });

describe('arrow collision rules', () => {
  it.each<{ name: string; points: Point[]; obstruction: Point[] }>([
    {
      name: 'right',
      points: [
        [0, 2],
        [1, 2],
      ],
      obstruction: [
        [3, 1],
        [3, 3],
      ],
    },
    {
      name: 'left',
      points: [
        [4, 2],
        [3, 2],
      ],
      obstruction: [
        [1, 1],
        [1, 3],
      ],
    },
    {
      name: 'down',
      points: [
        [2, 0],
        [2, 1],
      ],
      obstruction: [
        [1, 3],
        [3, 3],
      ],
    },
    {
      name: 'up',
      points: [
        [2, 4],
        [2, 3],
      ],
      obstruction: [
        [1, 1],
        [3, 1],
      ],
    },
  ])('detects the body of a blocker when pointing $name', ({ points, obstruction }) => {
    const arrow = makeArrow('a', points);
    const other = makeArrow('b', obstruction);
    expect(blocker(arrow, [arrow, other])).toBe(other);
    expect(blocker(arrow, [arrow])).toBeUndefined();
  });

  it('ignores cells behind the head and in adjacent lanes', () => {
    const arrow = makeArrow('a', [
      [2, 2],
      [3, 2],
    ]);
    expect(
      blocker(arrow, [
        arrow,
        makeArrow('b', [
          [0, 1],
          [0, 3],
        ]),
        makeArrow('c', [
          [4, 3],
          [6, 3],
        ]),
      ]),
    ).toBeUndefined();
  });

  it('returns the nearest blocker, independent of array order', () => {
    const arrow = makeArrow('a', [
      [0, 0],
      [1, 0],
    ]);
    const near = makeArrow('near', [
      [3, 0],
      [3, 2],
    ]);
    const far = makeArrow('far', [
      [5, 0],
      [5, 2],
    ]);
    expect(blocker(arrow, [arrow, far, near])).toBe(near);
  });

  it('expands compressed corners into grid cells without repeating corners', () => {
    expect(
      cells(
        makeArrow('a', [
          [0, 0],
          [0, 2],
          [2, 2],
        ]),
      ),
    ).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });
});

describe('handcrafted level and format validation', () => {
  it('validates the first level and solves every arrow without a blocked move', () => {
    const level = parseLevel(firstLight);
    expect(level.arrows).toHaveLength(12);
    const solution = solve(level.arrows)!;
    expect(solution).toHaveLength(12);
    let remaining = [...level.arrows];
    for (const id of solution) {
      const arrow = remaining.find((item) => item.id === id)!;
      expect(blocker(arrow, remaining)).toBeUndefined();
      remaining = remaining.filter((item) => item.id !== id);
    }
    expect(remaining).toHaveLength(0);
  });

  it('has a discoverable first move that frees further moves', () => {
    const level = parseLevel(firstLight);
    expect(availableArrows(level.arrows).map((arrow) => arrow.id)).toEqual([
      'meadow',
      'sky',
      'mint',
    ]);
    expect(
      availableArrows(level.arrows.filter((arrow) => arrow.id !== 'meadow')).length,
    ).toBeGreaterThan(1);
  });

  it.each([
    {
      name: 'diagonal',
      edit: (level: Level) => {
        level.arrows = [
          makeArrow('a', [
            [0, 0],
            [1, 1],
          ]),
        ];
      },
    },
    {
      name: 'zero-length',
      edit: (level: Level) => {
        level.arrows = [
          makeArrow('a', [
            [0, 0],
            [0, 0],
          ]),
        ];
      },
    },
    {
      name: 'out-of-bounds',
      edit: (level: Level) => {
        level.arrows = [
          makeArrow('a', [
            [0, 0],
            [30, 0],
          ]),
        ];
      },
    },
    {
      name: 'overlapping',
      edit: (level: Level) => {
        level.arrows = [
          makeArrow('a', [
            [0, 0],
            [0, 3],
          ]),
          makeArrow('b', [
            [0, 2],
            [3, 2],
          ]),
        ];
      },
    },
    {
      name: 'duplicate ID',
      edit: (level: Level) => {
        level.arrows = [
          makeArrow('a', [
            [0, 0],
            [1, 0],
          ]),
          makeArrow('a', [
            [0, 1],
            [1, 1],
          ]),
        ];
      },
    },
    {
      name: 'deadlock',
      edit: (level: Level) => {
        level.arrows = [
          makeArrow('a', [
            [0, 0],
            [1, 0],
          ]),
          makeArrow('b', [
            [4, 0],
            [3, 0],
          ]),
        ];
      },
    },
  ])('rejects $name geometry', ({ edit }) => {
    const level = structuredClone(parseLevel(firstLight));
    edit(level);
    expect(() => parseLevel(level)).toThrow('Invalid level');
  });

  it.each([
    null,
    {},
    { ...firstLight, version: 2 },
    { ...firstLight, grid: { columns: 0, rows: 3 } },
    { ...firstLight, arrows: [] },
  ])('rejects malformed level metadata %#', (value) => {
    expect(() => parseLevel(value)).toThrow('Invalid level');
  });
});

describe('unwinding animation', () => {
  const path: Point[] = [
    [0, 0],
    [0, 40],
    [80, 40],
    [80, 80],
  ];
  it.each([0, 10, 40, 55, 120, 159, 160, 350])(
    'preserves the arrow length at distance %i',
    (distance) => {
      const shifted = advance(path, distance);
      expect(pathLength(shifted)).toBeCloseTo(pathLength(path));
      expect(shifted.at(-1)).toEqual([80, 80 + distance]);
    },
  );
  it('follows corners instead of translating the entire shape', () => {
    expect(advance(path, 60)).toEqual([
      [20, 40],
      [80, 40],
      [80, 80],
      [80, 140],
    ]);
  });
});
