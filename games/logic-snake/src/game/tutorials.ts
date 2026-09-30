import type { Cell, Level, Tool } from './engine';

export interface TutorialStep {
  index: number;
  tool: Exclude<Tool, 'erase'>;
  text: string;
}
export interface Tutorial {
  description: string;
  lesson: string;
  steps: TutorialStep[];
}

function tutorial(
  id: string,
  name: string,
  rows: string[],
  top: number,
  clues: number[],
  guide: Tutorial,
): Level {
  const solution = rows
    .join('')
    .split('')
    .map((c): Cell => (c === 'X' ? 'head' : c === '+' ? 'snake' : 'empty'));
  return {
    id,
    name,
    width: rows[0].length,
    height: rows.length,
    top,
    solution,
    clues,
    moves: guide.steps.map((step) => step.index),
    tutorial: guide,
  };
}

export const tutorialLevels: Level[] = [
  tutorial('tutorial-connect', 'Meet in the middle', ['X+X'], 0, [0, 2], {
    description: 'Two endpoints. One little connection.',
    lesson: 'Fill the gap between the two round endpoints. No empty spaces to worry about yet.',
    steps: [
      {
        index: 1,
        tool: 'snake',
        text: 'Tap the highlighted cell to add a snake body and connect the two endpoints.',
      },
    ],
  }),
  tutorial('tutorial-empty', 'A little detour', ['X.X', '+++'], 1, [0, 2], {
    description: 'Make a turn. Leave one little space.',
    lesson:
      'The 1 means leave one empty cell. Cross out the gap, then connect the endpoints around it.',
    steps: [
      {
        index: 1,
        tool: 'empty',
        text: 'Mark this cell empty with a cross. The snake will take the longer way around.',
      },
      { index: 3, tool: 'snake', text: 'Start the snake just below the left endpoint.' },
      {
        index: 4,
        tool: 'snake',
        text: 'Continue across the bottom. The empty cell is now surrounded: its number is 1.',
      },
      { index: 5, tool: 'snake', text: 'Turn up to meet the other endpoint. Tap this last gap.' },
    ],
  }),
  tutorial('tutorial-regions', 'Room for two', ['.X++', 'X..+', '++++'], 2, [0, 1, 4], {
    description: 'One space of size 1. Another of size 2.',
    lesson:
      'The locked corner already makes a region of 1. Leave two connected empty cells for a region of 2, then wind around them.',
    steps: [
      { index: 5, tool: 'empty', text: 'Start the region of 2 by marking this middle cell empty.' },
      {
        index: 6,
        tool: 'empty',
        text: 'Cross out its neighbor. Empty cells touching along an edge belong to the same region.',
      },
      { index: 2, tool: 'snake', text: 'Extend the upper endpoint to the right.' },
      {
        index: 3,
        tool: 'snake',
        text: 'Continue to the corner. The snake only moves along edges.',
      },
      { index: 7, tool: 'snake', text: 'Turn down, around the empty pair.' },
      { index: 11, tool: 'snake', text: 'Keep going down to the bottom corner.' },
      { index: 10, tool: 'snake', text: 'Turn left below the empty pair.' },
      {
        index: 9,
        tool: 'snake',
        text: 'One more step left. The pair is now a finished region of 2.',
      },
      {
        index: 8,
        tool: 'snake',
        text: 'Close the final gap to the other endpoint. Ready for the collection!',
      },
    ],
  }),
];

// Derive the next prompt from actual marks, so undo, restart, and reload all work.
export function tutorialStep(level: Level, board: Cell[]) {
  const steps = level.tutorial?.steps;
  if (!steps) return null;
  const position = steps.findIndex((step) => board[step.index] !== step.tool);
  return position < 0 ? null : { ...steps[position], position, total: steps.length };
}
