import type { Graph } from './analysis';

export type Difficulty = {
  winningLosingRatio: number | null;
  averageWinningMoves: number;
  failureRisk: number;
  averageLosingMoves: number;
  trapStates: number;
  losingStateRatio: number;
  shortest: number;
};

// The ratio averages states where both winning and losing choices exist.
// Zero-losing-choice states have no finite ratio and are counted separately.
// Other averages retain equal weight across all unsolved, winnable states.
export function measureDifficulty(graph: Graph): Difficulty {
  let risk = 0,
    ratioSum = 0,
    winningSum = 0,
    losingSum = 0,
    states = 0,
    trapStates = 0;
  for (let id = 0; id < graph.keys.length; id++) {
    if (graph.distances[id] <= 0) continue;
    let legal = 0,
      losing = 0;
    for (const edge of graph.edges[id]) {
      legal += edge.moves;
      if (graph.distances[edge.to] < 0) losing += edge.moves;
    }
    risk += legal ? losing / legal : 0;
    winningSum += legal - losing;
    losingSum += losing;
    if (losing) {
      trapStates++;
      ratioSum += (legal - losing) / losing;
    }
    states++;
  }
  return {
    winningLosingRatio: trapStates ? ratioSum / trapStates : null,
    averageWinningMoves: states ? winningSum / states : 0,
    failureRisk: states ? risk / states : 0,
    averageLosingMoves: states ? losingSum / states : 0,
    trapStates,
    losingStateRatio: graph.summary.unwinnable / graph.keys.length,
    shortest: graph.summary.startDistance ?? -1,
  };
}

export function compareDifficulty(a: Difficulty, b: Difficulty) {
  // null means no losing choices: the easiest case, without serializing Infinity.
  if (a.winningLosingRatio === null && b.winningLosingRatio !== null) return -1;
  if (a.winningLosingRatio !== null && b.winningLosingRatio === null) return 1;
  return (
    (b.winningLosingRatio ?? 0) - (a.winningLosingRatio ?? 0) ||
    a.shortest - b.shortest ||
    a.averageLosingMoves - b.averageLosingMoves
  );
}

export function qualifiesForChallenge(value: Difficulty) {
  return (
    value.shortest >= 10 &&
    value.winningLosingRatio !== null &&
    value.winningLosingRatio <= 4 &&
    value.trapStates >= 3 &&
    value.losingStateRatio >= 0.03
  );
}
