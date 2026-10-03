import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadLevel } from '../src/game/level-format.ts';
import { generateLevel } from '../src/generation/generator.ts';
import { solveWithDeductions } from '../src/generation/solver.ts';

const directory = fileURLToPath(new URL('../src/levels/numbered/', import.meta.url));
const levels = readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) =>
    loadLevel(JSON.parse(readFileSync(join(directory, name), 'utf8')), name.slice(0, -5), name),
  );
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)].toFixed(1);
// Warm up constraint checks before measuring; generation includes the independent uniqueness check.
solveWithDeductions(levels[0]);
console.log(`Node ${process.version}; median of 3 runs per puzzle, local wall-clock milliseconds.`);
console.log(
  '| Puzzle | Board | Numbers | Depth | Forced / lookahead | Generate ms | Solve ms | Solver checks |',
);
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const level of levels) {
  const info = level.generation!;
  const generation: number[] = [],
    solving: number[] = [];
  for (let run = 0; run < 3; run++) {
    let start = performance.now();
    const generated = generateLevel({
      seed: info.seed,
      width: level.width,
      height: level.height,
      top: level.top,
      maxAssumptionDepth: info.maxAssumptionDepth,
      generationVersion: info.version,
      numberedClueChance: info.numberedClueChance,
    });
    generation.push(performance.now() - start);
    if (JSON.stringify(generated.solution) !== JSON.stringify(level.solution))
      throw new Error('Benchmark seed did not reproduce the stored puzzle.');
    start = performance.now();
    const report = solveWithDeductions(level, { maxDepth: info.requiredAssumptionDepth });
    solving.push(performance.now() - start);
    if (report.status !== 'solved') throw new Error('Benchmark puzzle was not solved.');
  }
  console.log(
    `| ${level.name} | ${level.width}×${level.height} | ${Object.keys(level.regionClues ?? {}).length} | ${info.requiredAssumptionDepth} | ${info.forcedMoves} / ${info.lookaheadMoves} | ${median(generation)} | ${median(solving)} | ${info.solverChecks} |`,
  );
}
