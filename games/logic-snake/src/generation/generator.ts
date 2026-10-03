import { constructSolution, solveWithDeductions } from './solver.ts';
import { analyze, initialBoard, neighbors, type Cell, type Level } from '../game/engine.ts';

export interface SearchResult {
  solutions: Cell[][];
  exhaustive: boolean;
  nodes: number;
}

function random(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function validateShape(width: number, height: number, top: number, maxNodes: number) {
  if (
    ![width, height, top, maxNodes].every(Number.isSafeInteger) ||
    width < 2 ||
    height < 2 ||
    width > 8 ||
    height > 8 ||
    top < 1 ||
    maxNodes < 1 ||
    width * height - (top * (top + 1)) / 2 < 3
  ) {
    throw new Error(
      'Use a 2–8 cell width and height, a positive search budget, and region sizes leaving at least three snake cells.',
    );
  }
}

/** Enumerate induced endpoint-to-endpoint paths; never report budget exhaustion as uniqueness. */
export function findSolutions(level: Level, maxNodes = 2_000_000, limit = 2): SearchResult {
  validateShape(level.width, level.height, level.top, maxNodes);
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error('Solution limit must be positive.');
  const fixed = initialBoard(level);
  const heads = fixed.flatMap((cell, i) => (cell === 'head' ? [i] : []));
  if (heads.length !== 2) throw new Error('Both endpoints must be fixed.');
  const [start, end] = heads;
  const length = level.width * level.height - (level.top * (level.top + 1)) / 2;
  const adjacent = fixed.map((_, i) => neighbors(level, i));
  const path = [start];
  const occupied = new Set(path);
  const solutions: Cell[][] = [];
  const possible = new Uint8Array(fixed.length);
  const seen = new Uint8Array(fixed.length);
  const queue = new Int16Array(fixed.length);
  const used = new Uint8Array(level.top + 1);
  function canFinish(tail: number, remaining: number): boolean {
    possible.fill(0);
    for (let i = 0; i < fixed.length; i++) {
      if (occupied.has(i) || fixed[i] === 'empty') continue;
      const touching = adjacent[i].filter((next) => occupied.has(next));
      // A future cell touching an earlier segment would create an illegal side contact.
      if (!touching.length || (touching.length === 1 && touching[0] === tail)) possible[i] = 1;
      else if (fixed[i] === 'snake' || fixed[i] === 'head') return false;
    }
    seen.fill(0);
    queue[0] = tail;
    seen[tail] = 1;
    let length = 1;
    for (let cursor = 0; cursor < length; cursor++) {
      for (const next of adjacent[queue[cursor]]) {
        if (possible[next] && !seen[next]) {
          seen[next] = 1;
          queue[length++] = next;
        }
      }
    }
    if (!seen[end] || length - 1 < remaining) return false;
    seen.fill(0);
    used.fill(0);
    for (let start = 0; start < fixed.length; start++) {
      if (occupied.has(start) || possible[start] || seen[start]) continue;
      queue[0] = start;
      seen[start] = 1;
      length = 1;
      let closed = true,
        target = 0;
      for (let cursor = 0; cursor < length; cursor++) {
        const i = queue[cursor];
        const number = level.regionClues?.[i];
        if (number) {
          if (target && target !== number) return false;
          target = number;
        }
        for (const next of adjacent[i]) {
          if (possible[next]) closed = false;
          else if (!occupied.has(next) && !seen[next]) {
            seen[next] = 1;
            queue[length++] = next;
          }
        }
      }
      if (length > (target || level.top)) return false;
      if (closed) {
        if ((target && length !== target) || used[length]) return false;
        used[length] = 1;
      }
    }
    return true;
  }
  let nodes = 0;
  let exhaustive = true;
  function visit(cell: number) {
    if (solutions.length >= limit || nodes >= maxNodes) {
      exhaustive = false;
      return;
    }
    nodes++;
    const left = length - path.length;
    const distance =
      Math.abs((cell % level.width) - (end % level.width)) +
      Math.abs(Math.floor(cell / level.width) - Math.floor(end / level.width));
    if (distance > left || (left - distance) % 2) return;
    if (cell === end) {
      if (left !== 0) return;
      const board: Cell[] = fixed.map((_, i) =>
        occupied.has(i) ? (i === start || i === end ? 'head' : 'snake') : 'empty',
      );
      if (
        fixed.every((value, i) => value === 'unknown' || board[i] === value) &&
        analyze(level, board).solved
      ) {
        solutions.push(board);
      }
      return;
    }
    if (left <= 0) return;
    if (!canFinish(cell, left)) return;
    for (const next of adjacent[cell]) {
      if (
        fixed[next] === 'empty' ||
        occupied.has(next) ||
        adjacent[next].filter((i) => occupied.has(i)).length !== 1
      )
        continue;
      path.push(next);
      occupied.add(next);
      visit(next);
      occupied.delete(next);
      path.pop();
      if (!exhaustive) return;
    }
  }
  visit(start);
  return { solutions, exhaustive, nodes };
}

export interface GenerateOptions {
  seed: string;
  width: number;
  height: number;
  top: number;
  maxNodes?: number;
  maxAssumptionDepth?: number;
  maxSolverChecks?: number;
  numberedClueChance?: number;
  /** Retained for reproducing the existing version-3 collection. */
  generationVersion?: 3 | 4;
}

/** Port of Rust's two phases: solve a random board, then reveal clues that unlock deductions. */
export function generateLevel({
  seed,
  width,
  height,
  top,
  maxNodes = 2_000_000,
  maxAssumptionDepth = 1,
  maxSolverChecks = 250_000,
  numberedClueChance = 0.5,
  generationVersion = 4,
}: GenerateOptions): Level {
  validateShape(width, height, top, maxNodes);
  if (!Number.isInteger(maxAssumptionDepth) || maxAssumptionDepth < 0 || maxAssumptionDepth > 2) {
    throw new Error('Assumption depth must be 0, 1, or 2.');
  }
  if (!Number.isFinite(numberedClueChance) || numberedClueChance < 0 || numberedClueChance > 1) {
    throw new Error('Numbered clue chance must be between 0 and 1.');
  }
  const legacy = generationVersion === 3;
  const rng = random(seed);
  const layout = constructSolution({ width, height, top }, rng, maxNodes);
  const level: Level = {
    id: `numbered-${seed}`,
    name: 'Numbered regions',
    width,
    height,
    top,
    solution: layout.board,
    clues: layout.board.flatMap((cell, i) => (cell === 'head' ? [i] : [])),
    moves: [],
    regionClues: {},
  };
  if (!analyze(level, level.solution).solved)
    throw new Error('Layout solver produced an invalid board.');
  const regionSizes = new Map(
    analyze(level, level.solution).regions.flatMap((region) =>
      region.cells.map((i) => [i, region.cells.length] as const),
    ),
  );
  const options = { maxDepth: maxAssumptionDepth, maxChecks: maxSolverChecks };
  let report = solveWithDeductions(level, options);
  let clueTrials = 0;
  // Try random clue positions, prefer those unlocking the most solver progress.
  // Each trial starts from the givens: all reported moves must be independently deducible.
  const clueCount = () =>
    new Set([
      ...Object.keys(level.regionClues!).map(Number),
      ...level.clues.filter((i) => level.solution[i] === 'empty'),
    ]).size;
  while (
    report.status !== 'solved' ||
    (legacy ? Object.keys(level.regionClues!).length : clueCount()) === 0
  ) {
    const candidates = shuffle(
      [...regionSizes.keys()].filter(
        (i) =>
          level.regionClues![i] === undefined &&
          (legacy || numberedClueChance > 0 || !level.clues.includes(i)),
      ),
      rng,
    );
    if (!candidates.length)
      throw new Error('Could not solve the puzzle within the deduction budget.');
    let best:
      { index: number; numbered: boolean; report: typeof report; progress: number } | undefined;
    for (const index of candidates.slice(0, 8)) {
      const numbered = legacy || level.clues.includes(index) || rng() < numberedClueChance;
      const trial = numbered
        ? { ...level, regionClues: { ...level.regionClues, [index]: regionSizes.get(index)! } }
        : { ...level, clues: [...level.clues, index] };
      const result = solveWithDeductions(trial, options);
      clueTrials++;
      if (result.status === 'contradiction')
        throw new Error('A valid clue caused a solver contradiction.');
      const progress =
        report.stats.unknownRemaining -
        result.stats.unknownRemaining -
        (report.board[index] === 'unknown' ? 1 : 0);
      if (!best || result.status === 'solved' || progress > best.progress)
        best = { index, numbered, report: result, progress };
      if (result.status === 'solved') break;
    }
    if (best!.numbered) level.regionClues![best!.index] = regionSizes.get(best!.index)!;
    else level.clues.push(best!.index);
    report = best!.report;
  }

  // A clue is redundant only if the deduction solver still finishes at the same depth.
  for (const index of shuffle(Object.keys(level.regionClues!).map(Number), rng)) {
    if (legacy && Object.keys(level.regionClues!).length <= 1) break;
    const target = level.regionClues![index];
    const before = level.clues;
    delete level.regionClues![index];
    // Prefer a plain empty clue when its number is unnecessary for deduction.
    if (!legacy && !level.clues.includes(index)) level.clues = [...level.clues, index];
    const trial = solveWithDeductions(level, options);
    clueTrials++;
    if (trial.status === 'solved') report = trial;
    else {
      level.regionClues![index] = target;
      level.clues = before;
    }
  }
  if (!legacy) {
    for (const index of shuffle(
      level.clues.filter(
        (i) => level.solution[i] === 'empty' && level.regionClues![i] === undefined,
      ),
      rng,
    )) {
      if (clueCount() <= 1) break;
      const before = level.clues;
      level.clues = before.filter((i) => i !== index);
      const trial = solveWithDeductions(level, options);
      clueTrials++;
      if (trial.status === 'solved') report = trial;
      else level.clues = before;
    }
  }
  // Record the shallowest successful proof, not just the depth allowed during generation.
  let requiredAssumptionDepth = maxAssumptionDepth;
  for (let depth = 0; depth <= maxAssumptionDepth; depth++) {
    const trial = solveWithDeductions(level, { ...options, maxDepth: depth });
    if (trial.status === 'solved') {
      report = trial;
      requiredAssumptionDepth = depth;
      break;
    }
  }
  if (report.status !== 'solved' || report.board.some((cell, i) => cell !== level.solution[i])) {
    throw new Error('Deduction solver did not reproduce the generated solution.');
  }
  // Keep the independent path enumerator as a correctness check, never as the clue selector.
  const unique = findSolutions(level, maxNodes);
  if (
    !unique.exhaustive ||
    unique.solutions.length !== 1 ||
    unique.solutions[0].some((cell, i) => cell !== level.solution[i])
  ) {
    throw new Error(
      `Independent search could not verify uniqueness (${unique.solutions.length} solutions, exhaustive: ${unique.exhaustive}, ${unique.nodes} nodes).`,
    );
  }
  level.moves = report.moves.map((move) => move.index);
  level.generation = {
    version: generationVersion,
    ...(!legacy ? { numberedClueChance } : {}),
    seed,
    unique: true,
    maxAssumptionDepth,
    requiredAssumptionDepth,
    forcedMoves: report.stats.forcedMoves,
    lookaheadMoves: report.stats.lookaheadMoves,
    solverChecks: report.stats.checks,
    layoutChecks: layout.checks,
    clueTrials,
    trace: report.moves,
  };
  return level;
}
