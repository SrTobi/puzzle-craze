import { analyzeGraph, configurationKey } from './analysis';
import { measureDifficulty, type Difficulty } from './difficulty';
import { seededBoard } from './seededBoard';

export type Candidate = Difficulty & {
  seed: number;
  colors: number;
  emptyTubes: number;
  configurations: number;
  key: string;
};

export function analyzeCandidate(
  seed: number,
  colors: number,
  stateLimit = 20000,
): Candidate | null {
  for (let emptyTubes = 1; emptyTubes <= colors; emptyTubes++) {
    const board = seededBoard(seed, colors, emptyTubes);
    const analysis = analyzeGraph(board);
    let next = analysis.next();
    while (!next.done) {
      // Reject oversized candidates; never mistake an incomplete graph for a
      // losing puzzle or add an empty bottle because a search hit its budget.
      if (next.value.discovered > stateLimit) {
        return null;
      }
      next = analysis.next();
    }
    const graph = next.value;
    if (graph.summary.startDistance === null) continue;
    return {
      seed,
      colors,
      emptyTubes,
      configurations: graph.keys.length,
      key: configurationKey(board),
      ...measureDifficulty(graph),
    };
  }
  return null;
}
