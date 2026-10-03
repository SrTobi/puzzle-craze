import type { Board } from './engine';
import { seededBoard } from './seededBoard';
import catalog from './catalog.json';
import type { Difficulty } from './difficulty';

export type Level = {
  id: string;
  number: number;
  seed: number | null;
  difficulty?: Difficulty;
  name: string;
  colors: number;
  board: Board;
  tutorial?: string;
};
export const TUTORIAL_COUNT = 3;
export const TOTAL_LEVELS = 1000;
export const CATALOG_VERSION = catalog.version;
export const isLevelNumber = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= TOTAL_LEVELS;
export function catalogEntry(number: number) {
  if (!isLevelNumber(number)) throw new Error(`Choose a level from 1 to ${TOTAL_LEVELS}.`);
  return number <= TUTORIAL_COUNT ? undefined : catalog.entries[number - TUTORIAL_COUNT - 1];
}
export function colorCount(number: number): number {
  return catalogEntry(number)?.colors ?? 3;
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

// Display order and generation seed are independent. Catalog entries reproduce
// the exact analyzed board, including its proven empty-bottle count.
export function initialLevel(number: number): Level {
  const colors = colorCount(number);
  const tutorial = tutorials[number - 1];
  if (tutorial)
    return {
      id: String(number),
      number,
      seed: null,
      colors,
      ...tutorial,
      board: [...tutorial.board.map((tube) => [...tube]), []],
    };
  const entry = catalogEntry(number)!;
  const board = seededBoard(entry.seed, colors, entry.emptyTubes);
  return {
    id: String(number),
    number,
    seed: entry.seed,
    difficulty: entry,
    colors,
    name: `Experiment ${number}`,
    board,
  };
}
