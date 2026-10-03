import { describe, expect, it } from 'vitest';
import { measureDifficulty, compareDifficulty, qualifiesForChallenge } from './difficulty';
import { analyzeGraph, inspectPosition, configurationBoard, type Graph } from './analysis';
import { seededBoard } from './seededBoard';

function analyze(board: number[][]) {
  const search = analyzeGraph(board);
  let result = search.next();
  while (!result.done) result = search.next();
  return result.value;
}

describe('difficulty based on winning / losing choices', () => {
  it('averages each trap-state ratio and includes all moves that keep the game winnable', () => {
    const graph = analyze(seededBoard(20, 4));
    let states = 0,
      totalRatio = 0,
      totalWinning = 0,
      totalLosing = 0,
      traps = 0;
    for (const key of graph.keys) {
      const position = inspectPosition(graph, configurationBoard(key));
      if (position.distance === null || position.distance === 0) continue;
      const winning = position.legalMoves - position.losingMoves;
      totalWinning += winning;
      totalLosing += position.losingMoves;
      if (position.losingMoves) {
        totalRatio += winning / position.losingMoves;
        traps++;
      }
      states++;
    }
    expect(traps).toBeGreaterThan(0);
    expect(measureDifficulty(graph)).toMatchObject({
      winningLosingRatio: totalRatio / traps,
      averageWinningMoves: totalWinning / states,
      averageLosingMoves: totalLosing / states,
      trapStates: traps,
    });
  });

  it('uses the mean of ratios, not the ratio of totals', () => {
    const base = analyze([[0, 0, 1, 1], [1, 1, 0, 0], []]);
    const graph: Graph = {
      ...base,
      keys: ['a', 'b', 'goal', 'lost'],
      distances: Int32Array.from([2, 1, 0, -1]),
      edges: [
        [
          { to: 1, moves: 4 },
          { to: 3, moves: 1 },
        ],
        [
          { to: 2, moves: 1 },
          { to: 3, moves: 2 },
        ],
        [],
        [{ to: 3, moves: 5 }],
      ],
      summary: { ...base.summary, unwinnable: 1, startDistance: 2 },
    };
    expect(measureDifficulty(graph).winningLosingRatio).toBe(2.25);
    expect(measureDifficulty(graph).winningLosingRatio).not.toBe(5 / 3);
  });

  it('handles zero losing choices without Infinity or NaN in saved data', () => {
    const easy = measureDifficulty(analyze([[0, 0, 1, 1], [1, 1, 0, 0], []]));
    expect(easy.winningLosingRatio).toBeNull();
    expect(easy.trapStates).toBe(0);
    expect(qualifiesForChallenge(easy)).toBe(false);
    expect(compareDifficulty(easy, { ...easy, winningLosingRatio: 2 })).toBeLessThan(0);
  });

  it('orders higher ratios first, with solution length breaking ties', () => {
    const base = measureDifficulty(analyze(seededBoard(20, 4)));
    expect(
      compareDifficulty({ ...base, winningLosingRatio: 3 }, { ...base, winningLosingRatio: 1 }),
    ).toBeLessThan(0);
    expect(compareDifficulty({ ...base, shortest: 10 }, { ...base, shortest: 12 })).toBeLessThan(0);
  });

  it('rejects short, trap-free, and overwhelmingly safe challenge puzzles', () => {
    const valid = {
      shortest: 12,
      winningLosingRatio: 2,
      averageWinningMoves: 2,
      failureRisk: 0.2,
      averageLosingMoves: 1,
      trapStates: 4,
      losingStateRatio: 0.2,
    };
    expect(qualifiesForChallenge(valid)).toBe(true);
    for (const patch of [
      { shortest: 9 },
      { winningLosingRatio: null },
      { winningLosingRatio: 5 },
      { trapStates: 0 },
      { losingStateRatio: 0 },
    ])
      expect(qualifiesForChallenge({ ...valid, ...patch })).toBe(false);
    // The old average-losing-choice cutoff no longer decides eligibility.
    expect(qualifiesForChallenge({ ...valid, failureRisk: 0.01 })).toBe(true);
  });
});
