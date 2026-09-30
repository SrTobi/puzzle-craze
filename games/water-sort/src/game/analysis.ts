import { isSolved, legalMoves, pour, type Board, type Move } from './engine';
import { initialLevel, type Level } from './levels';

export function configurationKey(board: Board): string {
  return board
    .map((tube) => tube.join(','))
    .sort()
    .join('|');
}
export function configurationBoard(key: string): Board {
  return key.split('|').map((tube) => (tube === '' ? [] : tube.split(',').map(Number)));
}
export type Edge = { to: number; moves: number };
export type GraphProgress = {
  phase: 'exploring' | 'distances' | 'statistics';
  discovered: number;
  explored: number;
  transitions: number;
};
export type GraphSummary = {
  configurations: number;
  transitions: number;
  legalMoves: number;
  selfLoops: number;
  winnable: number;
  unwinnable: number;
  deadEnds: number;
  startDistance: number | null;
  averageImprovingMoves: number;
  averageImprovingOutcomes: number;
  averageDistance: number;
  maxDistance: number;
  winningConfigurations: number;
};
export type Graph = {
  keys: string[];
  index: Map<string, number>;
  edges: Edge[][];
  distances: Int32Array;
  improving: Uint32Array;
  summary: GraphSummary;
};

// Full directed graph, not a solution search. No move pruning: even moving a
// uniform tube into an empty one produces a retained normalized self-loop.
export function* analyzeGraph(start: Board): Generator<GraphProgress, Graph> {
  const keys = [configurationKey(start)];
  const index = new Map([[keys[0], 0]]);
  const edges: Edge[][] = [];
  const incoming: number[][] = [[]];
  let transitions = 0;
  let totalMoves = 0;
  let selfLoops = 0;
  let deadEnds = 0;
  const goals: number[] = [];
  for (let cursor = 0; cursor < keys.length; cursor++) {
    const board = configurationBoard(keys[cursor]);
    if (isSolved(board)) goals.push(cursor);
    const destinations = new Map<number, number>();
    for (const move of legalMoves(board)) {
      const key = configurationKey(pour(board, move)!);
      let to = index.get(key);
      if (to === undefined) {
        to = keys.length;
        index.set(key, to);
        keys.push(key);
        incoming.push([]);
      }
      destinations.set(to, (destinations.get(to) ?? 0) + 1);
      totalMoves++;
    }
    const outgoing = [...destinations].map(([to, moves]) => ({ to, moves }));
    edges.push(outgoing);
    if (!outgoing.length) deadEnds++;
    for (const { to } of outgoing) {
      incoming[to].push(cursor);
      if (to === cursor) selfLoops++;
    }
    transitions += outgoing.length;
    if ((cursor + 1) % 256 === 0)
      yield { phase: 'exploring', discovered: keys.length, explored: cursor + 1, transitions };
  }
  yield { phase: 'distances', discovered: keys.length, explored: keys.length, transitions };
  const distances = new Int32Array(keys.length).fill(-1);
  const queue = [...goals];
  for (const goal of goals) distances[goal] = 0;
  // Reverse BFS gives the exact shortest distance to the goal for every node.
  // Nodes not visited here are unwinnable, including closed cycles with exits
  // only to other unwinnable nodes.
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const to = queue[cursor];
    for (const from of incoming[to]) {
      if (distances[from] !== -1) continue;
      distances[from] = distances[to] + 1;
      queue.push(from);
    }
    if ((cursor + 1) % 4096 === 0)
      yield { phase: 'distances', discovered: keys.length, explored: cursor + 1, transitions };
  }
  const improving = new Uint32Array(keys.length);
  let improvingSum = 0;
  let improvingOutcomes = 0;
  let distanceSum = 0;
  let maxDistance = 0;
  for (let from = 0; from < keys.length; from++) {
    if (distances[from] >= 0) {
      distanceSum += distances[from];
      maxDistance = Math.max(maxDistance, distances[from]);
      for (const edge of edges[from]) {
        if (distances[edge.to] >= 0 && distances[edge.to] < distances[from]) {
          improving[from] += edge.moves;
          improvingOutcomes++;
        }
      }
      improvingSum += improving[from];
    }
    if ((from + 1) % 4096 === 0)
      yield { phase: 'statistics', discovered: keys.length, explored: from + 1, transitions };
  }
  return {
    keys,
    index,
    edges,
    distances,
    improving,
    summary: {
      configurations: keys.length,
      transitions,
      legalMoves: totalMoves,
      selfLoops,
      winnable: queue.length,
      unwinnable: keys.length - queue.length,
      deadEnds,
      startDistance: distances[0] < 0 ? null : distances[0],
      averageImprovingMoves: queue.length ? improvingSum / queue.length : 0,
      averageImprovingOutcomes: queue.length ? improvingOutcomes / queue.length : 0,
      averageDistance: queue.length ? distanceSum / queue.length : 0,
      maxDistance,
      winningConfigurations: goals.length,
    },
  };
}

export type Attempt = { emptyTubes: number; configurations: number; winnable: boolean };
export type GenerationProgress = GraphProgress & { emptyTubes: number; attempt: number };
export type GeneratedLevel = { level: Level; graph: Graph; attempts: Attempt[] };
export function* generateLevel(number: number): Generator<GenerationProgress, GeneratedLevel> {
  let level = initialLevel(number);
  const attempts: Attempt[] = [];
  while (true) {
    const analysis = analyzeGraph(level.board);
    let result = analysis.next();
    while (!result.done) {
      yield {
        ...result.value,
        emptyTubes: level.board.length - level.colors,
        attempt: attempts.length + 1,
      };
      result = analysis.next();
    }
    const graph = result.value;
    attempts.push({
      emptyTubes: level.board.length - level.colors,
      configurations: graph.keys.length,
      winnable: graph.summary.startDistance !== null,
    });
    if (graph.summary.startDistance !== null) return { level, graph, attempts };
    // Keep exactly the same random arrangement; only add one empty bottle.
    level = { ...level, board: [...level.board, []] };
  }
}

export type PositionStats = {
  key: string;
  id: number | null;
  distance: number | null;
  unwinnable: boolean;
  legalMoves: number;
  improvingMoves: number;
  losingMoves: number;
  neutralMoves: number;
  worseningMoves: number;
  hint: Move | null;
};
export function inspectPosition(graph: Graph, board: Board): PositionStats {
  const key = configurationKey(board);
  const id = graph.index.get(key);
  const distance = id === undefined || graph.distances[id] < 0 ? null : graph.distances[id];
  const moves = legalMoves(board);
  let improvingMoves = 0,
    losingMoves = 0,
    neutralMoves = 0,
    worseningMoves = 0;
  let hint: Move | null = null;
  for (const move of moves) {
    const next = graph.index.get(configurationKey(pour(board, move)!));
    const remaining = next === undefined ? -1 : graph.distances[next];
    if (remaining < 0) losingMoves++;
    else if (distance !== null && remaining < distance) {
      improvingMoves++;
      hint ??= move;
    } else if (remaining === distance) neutralMoves++;
    else worseningMoves++;
  }
  return {
    key,
    id: id ?? null,
    distance,
    unwinnable: id !== undefined && distance === null,
    legalMoves: moves.length,
    improvingMoves,
    losingMoves,
    neutralMoves,
    worseningMoves,
    hint,
  };
}

export type StateFilter = 'all' | 'winnable' | 'unwinnable';
export type StateRow = {
  id: number;
  board: Board;
  distance: number | null;
  improvingMoves: number;
  legalMoves: number;
};
export function graphPage(graph: Graph, offset: number, filter: StateFilter, pageSize = 10) {
  const rows: StateRow[] = [];
  let total = 0;
  for (let id = 0; id < graph.keys.length; id++) {
    const distance = graph.distances[id];
    if ((filter === 'winnable' && distance < 0) || (filter === 'unwinnable' && distance >= 0))
      continue;
    if (total >= offset && rows.length < pageSize)
      rows.push({
        id,
        board: configurationBoard(graph.keys[id]),
        distance: distance < 0 ? null : distance,
        improvingMoves: graph.improving[id],
        legalMoves: graph.edges[id].reduce((sum, edge) => sum + edge.moves, 0),
      });
    total++;
  }
  return { rows, total, offset, filter };
}
