import { describe, expect, it } from 'vitest';
import {
  analyzeGraph,
  configurationKey,
  generateLevel,
  inspectPosition,
  graphPage,
  type Graph,
} from './analysis';
import { colorCount, initialLevel } from './levels';
import { isSolved, legalMoves, pour, type Board } from './engine';

function finish<T>(generator: Generator<unknown, T>): T {
  let next = generator.next();
  while (!next.done) next = generator.next();
  return next.value;
}
function analyze(board: Board): Graph {
  return finish(analyzeGraph(board));
}

// Independent forward BFS on physically labeled bottles, used only as a small
// oracle. It neither normalizes states nor uses the production reverse graph.
function shortest(board: Board): number | null {
  const queue = [{ board, distance: 0 }];
  const visited = new Set([JSON.stringify(board)]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (isSolved(current.board)) return current.distance;
    for (const move of legalMoves(current.board)) {
      const next = pour(current.board, move)!;
      const key = JSON.stringify(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ board: next, distance: current.distance + 1 });
    }
  }
  return null;
}

describe('normalization and exact analysis', () => {
  it('ignores bottle order but keeps layer order and empty-bottle count', () => {
    expect(configurationKey([[1, 0], [], [0, 1]])).toBe(configurationKey([[0, 1], [1, 0], []]));
    expect(configurationKey([[1, 0], []])).not.toBe(configurationKey([[0, 1], []]));
    expect(configurationKey([[1, 0], []])).not.toBe(configurationKey([[1, 0], [], []]));
  });
  it('matches independent shortest paths for every reachable state, including loops', () => {
    const graph = analyze([[0, 0, 1, 1], [1, 1, 0, 0], []]);
    expect(graph.summary.winningConfigurations).toBe(1);
    expect(graph.summary.selfLoops).toBeGreaterThan(0);
    let improving = 0;
    for (const key of graph.keys) {
      const board = key.split('|').map((t) => (t === '' ? [] : t.split(',').map(Number)));
      const position = inspectPosition(graph, board);
      expect(position.distance).toBe(shortest(board));
      if (position.distance !== null) improving += position.improvingMoves;
      if (position.distance !== null && position.distance > 0) {
        expect(position.hint).not.toBeNull();
        expect(inspectPosition(graph, pour(board, position.hint!)!).distance).toBe(
          position.distance - 1,
        );
      }
    }
    expect(graph.summary.averageImprovingMoves).toBe(improving / graph.summary.winnable);
    expect(graph.summary.winnable + graph.summary.unwinnable).toBe(graph.keys.length);
  });
  it('marks a closed losing cycle unwinnable even when legal moves remain', () => {
    const graph = analyze([...initialLevel(2).board, [3, 3, 3, 3]]);
    expect(graph.summary.selfLoops).toBeGreaterThan(0);
    expect(graph.summary.winningConfigurations).toBe(0);
    const losingWithMoves = graph.keys.find((key) => {
      const id = graph.index.get(key)!;
      return graph.distances[id] === -1 && graph.edges[id].length > 0;
    });
    expect(losingWithMoves).toBeDefined();
    for (let id = 0; id < graph.keys.length; id++)
      if (graph.distances[id] < 0) {
        expect(graph.edges[id].every((edge) => graph.distances[edge.to] < 0)).toBe(true);
      }
  });
  it('counts physical choices separately from normalized outcomes', () => {
    const graph = analyze([[0, 0, 1, 1], [1, 1, 0, 0], [], []]);
    expect(graph.summary.legalMoves).toBeGreaterThan(graph.summary.transitions);
    expect(graph.summary.averageImprovingMoves).toBeGreaterThan(
      graph.summary.averageImprovingOutcomes,
    );
    const board = [[0, 0, 1, 1], [1, 1, 0, 0], [], []];
    const permuted = [board[3], board[1], board[2], board[0]];
    const before = inspectPosition(graph, board),
      after = inspectPosition(graph, permuted);
    expect(before.distance).toBe(after.distance);
    expect(after.hint && inspectPosition(graph, pour(permuted, after.hint)!).distance).toBe(
      after.distance! - 1,
    );
  });
  it('paginates and labels the graph without changing it', () => {
    const graph = analyze([[0, 0, 1, 1], [1, 1, 0, 0], []]);
    const first = graphPage(graph, 0, 'all', 2),
      second = graphPage(graph, 2, 'all', 2);
    expect(first.rows).toHaveLength(2);
    expect(second.rows[0].id).not.toBe(first.rows[0].id);
    expect(graphPage(graph, 0, 'winnable').total).toBe(graph.summary.winnable);
    expect(graphPage(graph, 0, 'unwinnable').total).toBe(graph.summary.unwinnable);
  });
});

describe('endless levels', () => {
  it.each([
    [1, 3],
    [10, 3],
    [11, 4],
    [40, 4],
    [41, 5],
    [70, 5],
    [71, 6],
    [120, 6],
    [121, 7],
    [170, 7],
    [171, 8],
    [220, 8],
    [221, 9],
    [1001, 24],
  ])('level %i uses %i colors', (number, colors) => {
    expect(colorCount(number)).toBe(colors);
  });
  it('uses the full level number as a repeatable seed and starts with one empty', () => {
    expect(initialLevel(41)).toEqual(initialLevel(41));
    expect(initialLevel(41).board).not.toEqual(initialLevel(42).board);
    const level = initialLevel(171);
    expect(level.board).toHaveLength(9);
    expect(level.board.filter((t) => !t.length)).toHaveLength(1);
    for (let color = 0; color < level.colors; color++)
      expect(level.board.flat().filter((c) => c === color)).toHaveLength(4);
    expect(initialLevel(4).tutorial).toBeUndefined();
    expect(initialLevel(3).tutorial).toBeTruthy();
  });
  it.each([1, 2, 3, 4, 10, 11, 40, 41, 71, 121, 171, 221])(
    'fully analyzes and makes level %i solvable',
    (number) => {
      const generated = finish(generateLevel(number));
      expect(generated.graph.summary.startDistance).not.toBeNull();
      expect(generated.graph.summary.winningConfigurations).toBe(1);
      const original = initialLevel(number);
      expect(generated.level.board.slice(0, original.colors)).toEqual(
        original.board.slice(0, original.colors),
      );
      for (const attempt of generated.attempts.slice(0, -1)) expect(attempt.winnable).toBe(false);
    },
  );
});
