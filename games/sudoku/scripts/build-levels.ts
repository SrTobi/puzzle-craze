import { writeFileSync } from 'node:fs';
import { catalog } from '../src/game/catalog.ts';
import { generatePuzzle } from '../src/game/generator.ts';

const levels = catalog.map(({ id, name, options }) => ({ ...generatePuzzle(options), id, name }));
writeFileSync(
  new URL('../src/game/levels.json', import.meta.url),
  `${JSON.stringify(levels, null, 2)}\n`,
);
console.log(`Generated ${levels.length} uniquely solvable Sudoku levels.`);
