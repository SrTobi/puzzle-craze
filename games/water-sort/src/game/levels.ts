import { CAPACITY, type Board } from './engine';

export type Level = {
  id: string;
  number: number;
  name: string;
  colors: number;
  board: Board;
  tutorial?: string;
};
export const TUTORIAL_COUNT = 3;
export const isLevelNumber = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
export function colorCount(number: number): number {
  if (!isLevelNumber(number)) throw new Error('Enter a positive whole level number.');
  return number <= 10
    ? 3
    : number <= 40
      ? 4
      : number <= 70
        ? 5
        : 6 + Math.floor((number - 71) / 50);
}

const tutorials: { name: string; tutorial: string; board: Board }[] = [
  {
    name: 'One color at a time',
    tutorial:
      'Tap tube 1, then the empty tube. Both lavender layers pour together. Bring matching top colors together until every filled tube holds one color.',
    board: [
      [0, 0, 1, 1],
      [1, 1, 0, 0],
      [2, 2, 2, 2],
    ],
  },
  {
    name: 'Make a little room',
    tutorial:
      'An empty tube lets you reach a buried color. Only matching top colors can pour together, and each tube holds four layers. Use Undo to try another route.',
    board: [
      [0, 1, 0, 0],
      [1, 2, 2, 0],
      [1, 2, 2, 1],
    ],
  },
  {
    name: 'Find the way forward',
    tutorial:
      'Watch “Moves to win” as you pour. An improving move brings you one step closer. A losing configuration needs an undo or restart. Hint always chooses a shortest route.',
    board: [
      [2, 2, 2, 0],
      [0, 2, 1, 0],
      [1, 1, 1, 0],
    ],
  },
];

// Hash the full decimal level number, then use a fixed integer PRNG and Fisher–Yates.
// Generation has no dependency on dates, Math.random(), or earlier levels.
export function initialLevel(number: number): Level {
  const colors = colorCount(number);
  const tutorial = tutorials[number - 1];
  if (tutorial)
    return {
      id: String(number),
      number,
      colors,
      ...tutorial,
      board: [...tutorial.board.map((tube) => [...tube]), []],
    };
  let state = 2166136261;
  for (const digit of String(number))
    state = Math.imul(state ^ digit.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const liquid = Array.from({ length: colors * CAPACITY }, (_, i) => Math.floor(i / CAPACITY));
  for (let i = liquid.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [liquid[i], liquid[j]] = [liquid[j], liquid[i]];
  }
  const board = Array.from({ length: colors }, (_, i) =>
    liquid.slice(i * CAPACITY, (i + 1) * CAPACITY),
  );
  return {
    id: String(number),
    number,
    colors,
    name: `Experiment ${number}`,
    board: [...board, []],
  };
}
