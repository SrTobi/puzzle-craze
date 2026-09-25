import { CellGrid, checkDimensions } from '../game/grid';
import { cells, parseLevel } from '../game/engine';
import { PuzzleIndex } from '../game/puzzleIndex';
import type { Arrow, ArrowColor, Level, Point } from '../game/types';

export const GENERATOR_VERSION = 1;
export interface GeneratorInput {
  columns: number;
  rows: number;
  mask?: ArrayLike<number>;
  seed: string;
  name?: string;
  length?: number;
  repair?: boolean;
  maxRepairs?: number;
}
export interface GeneratedPuzzle {
  level: Level;
  generation: {
    version: number;
    seed: string;
    length: number;
    repairBudget: number;
    originalMask: string[];
    finalMask: string[];
    repairs: { point: Point; enabled: boolean }[];
    solution: string[];
    stats: {
      cells: number;
      arrows: number;
      initiallyFree: number;
      attempts: number;
      fallback: boolean;
    };
  };
}
export type GenerationProgress = { phase: string; fraction: number };

function randomFor(seed: string) {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random-access set, with O(1) membership updates and sampling. */
class Frontier {
  values: number[] = [];
  positions: Int32Array;
  constructor(size: number) {
    this.positions = new Int32Array(size).fill(-1);
  }
  set(value: number, present: boolean) {
    const i = this.positions[value];
    if (present && i < 0) {
      this.positions[value] = this.values.length;
      this.values.push(value);
    } else if (!present && i >= 0) {
      const last = this.values.pop()!;
      if (i < this.values.length) {
        this.values[i] = last;
        this.positions[last] = i;
      }
      this.positions[value] = -1;
    }
  }
}

function carve(
  mask: Uint8Array,
  columns: number,
  rows: number,
  random: () => number,
  length: number,
) {
  const grid = new CellGrid(columns, rows, mask);
  const frontier = new Frontier(mask.length * 4);
  const update = (p: number) => {
    if (p < 0) return;
    for (let d = 0; d < 4; d++) {
      const back = grid.adjacent(p, d ^ 1);
      frontier.set(
        p * 4 + d,
        Boolean(grid.occupied[p] && grid.links[d][p] < 0 && back >= 0 && grid.occupied[back]),
      );
    }
  };
  for (const lane of grid.ends) for (const p of lane) update(p);
  const remove = (p: number) => {
    const nearby = grid.neighbors(p);
    const affected = grid.links.map((link) => link[p]);
    grid.remove(p);
    update(p);
    nearby.forEach(update);
    affected.forEach(update);
  };
  // Removing a cell may leave one forced continuation, but never two isolated leftovers.
  const orphans = (p: number, alsoRemoved = -1) =>
    grid
      .neighbors(p)
      .filter(
        (n) =>
          n !== alsoRemoved &&
          grid.neighbors(n).every((other) => other === p || other === alsoRemoved),
      );
  const paths: number[][] = [];
  while (frontier.values.length) {
    const code = frontier.values[Math.floor(random() * frontier.values.length)];
    const head = Math.floor(code / 4),
      d = code % 4;
    const back = grid.adjacent(head, d ^ 1);
    const stranded = orphans(head);
    if (stranded.some((p) => p !== back) || orphans(back, head).length > 1) {
      frontier.set(code, false);
      continue;
    }
    const path = [head, back];
    remove(head);
    remove(back);
    const target = Math.max(2, Math.round(length * (0.5 + random())));
    let forced = grid.neighbors(back).filter((p) => grid.neighbors(p).length === 0);
    while (true) {
      const tail = path.at(-1)!;
      if (!forced.length && path.length >= target) break;
      const options = forced.length
        ? forced
        : grid.neighbors(tail).filter((p) => orphans(p).length <= 1);
      if (!options.length) break;
      const delta = tail - path.at(-2)!;
      const straight = options.find((p) => p - tail === delta);
      const next =
        straight !== undefined && random() < 0.65
          ? straight
          : options[Math.floor(random() * options.length)];
      forced = orphans(next);
      remove(next);
      path.push(next);
    }
    paths.push(path);
  }
  return { paths, remaining: grid.occupied, count: grid.count };
}

/** Full rectangles always have a simple solvable fallback, including odd and narrow boards. */
function strips(columns: number, rows: number, random: () => number, length: number): number[][] {
  const vertical = columns === 1 || (rows > 1 && random() < 0.5);
  const span = vertical ? rows : columns,
    lanes = vertical ? columns : rows;
  const paths: number[][] = [];
  for (let lane = 0; lane < lanes;) {
    // Narrow serpentine bands make bent arrows, while all heads in a band face
    // its already-cleared end. Other bands cannot intersect those exit rays.
    let width = lanes === 1 ? 1 : Math.min(lanes - lane, random() < 0.25 ? 3 : 2);
    if (lanes - lane - width === 1) width++;
    const reverse = random() < 0.5;
    const acrossReverse = random() < 0.5;
    for (let at = 0; at < span;) {
      let size = Math.min(span - at, Math.max(2, Math.round((length / width) * (0.5 + random()))));
      if (span - at - size === 1) size++;
      const path: number[] = [];
      for (let across = 0; across < width; across++)
        for (let i = 0; i < size; i++) {
          const step = across % 2 ? size - 1 - i : i;
          const p = reverse ? span - 1 - at - step : at + step;
          const q = lane + (acrossReverse ? width - 1 - across : across);
          path.push(vertical ? p * columns + q : q * columns + p);
        }
      paths.push(path);
      at += size;
    }
    lane += width;
  }
  return paths;
}

function compress(path: number[], columns: number): Point[] {
  const points: Point[] = [];
  for (let i = path.length - 1; i >= 0; i--) {
    if (i > 0 && i < path.length - 1 && path[i + 1] - path[i] === path[i] - path[i - 1]) continue;
    points.push([path[i] % columns, Math.floor(path[i] / columns)]);
  }
  return points;
}

export function generatePuzzle(
  input: GeneratorInput,
  progress: (p: GenerationProgress) => void = () => {},
): GeneratedPuzzle {
  const { columns, rows, seed } = input;
  checkDimensions(columns, rows);
  if (typeof seed !== 'string' || seed.length > 256)
    throw new Error('Use a seed of at most 256 characters.');
  const length = input.length ?? 10;
  if (!Number.isFinite(length) || length < 2 || length > 100)
    throw new Error('Arrow length must be between 2 and 100.');
  if (
    input.mask &&
    (input.mask.length !== columns * rows || Array.from(input.mask).some((n) => n !== 0 && n !== 1))
  )
    throw new Error('A mask must contain one 0 or 1 for each grid point.');
  const original = input.mask
    ? Uint8Array.from(input.mask)
    : new Uint8Array(columns * rows).fill(1);
  const mask = original.slice();
  const count = original.reduce((a, b) => a + b, 0);
  if (count === 0)
    throw new Error('The shape is empty. Adjust the image threshold or invert its colors.');
  if (mask.length === 1) throw new Error('An arrow needs at least two adjacent grid points.');
  const full = count === mask.length;
  const budget =
    input.repair === false || full
      ? 0
      : (input.maxRepairs ?? Math.max(2, Math.floor(count * 0.02)));
  if (!Number.isInteger(budget) || budget < 0 || budget > mask.length)
    throw new Error('Invalid repair budget.');
  const random = randomFor(`${GENERATOR_VERSION}:${seed}`);
  let paths: number[][] | undefined;
  let best: ReturnType<typeof carve> | undefined;
  let attempts = 0,
    fallback = false,
    edits = 0;
  // Exact-mask attempts come first. Repairs are bounded, deterministic, and recorded.
  for (let round = 0; round < 12; round++) {
    for (let attempt = 0; attempt < (round === 0 ? 6 : 2); attempt++) {
      progress({
        phase: round ? 'Refining the shape' : 'Weaving arrows',
        fraction: Math.min(0.8, attempts / 30),
      });
      const candidate = carve(mask, columns, rows, random, length);
      attempts++;
      if (!candidate.count) {
        paths = candidate.paths;
        break;
      }
      if (!best || candidate.count < best.count) best = candidate;
    }
    if (paths) break;
    if (full) {
      paths = strips(columns, rows, random, length);
      fallback = true;
      break;
    }
    if (edits >= budget || !best) break;
    const remaining = new CellGrid(columns, rows, best.remaining);
    let changed = false;
    // Pair isolated points by adding one neighboring point where possible.
    for (let p = 0; p < mask.length && edits < budget; p++) {
      if (!remaining.occupied[p] || remaining.neighbors(p).length) continue;
      const next = [0, 1, 2, 3]
        .map((d) => remaining.adjacent(p, d))
        .find((n) => n >= 0 && !mask[n]);
      if (next !== undefined) {
        mask[next] = 1;
        edits++;
        changed = true;
      }
    }
    if (!changed) {
      // Trim one thin dead end, then retry the entire mask before making further edits.
      const leaf = Array.from(remaining.occupied).findIndex(
        (v, p) => v && remaining.neighbors(p).length <= 1,
      );
      if (leaf < 0) break;
      mask[leaf] = 0;
      edits++;
      changed = true;
    }
    best = undefined;
  }
  if (!paths?.length)
    throw new Error(
      `Could not cover this shape within ${budget} point repairs. Try a larger image grid, a different seed, or a simpler outline.`,
    );
  progress({ phase: 'Checking every arrow', fraction: 0.85 });
  const colors: ArrowColor[] = ['violet', 'coral', 'teal', 'gold', 'blue', 'pink'];
  const arrows: Arrow[] = paths.map((path, i) => ({
    id: `a${i}`,
    color: colors[Math.floor(random() * colors.length)],
    points: compress(path, columns),
  }));
  const repairs: GeneratedPuzzle['generation']['repairs'] = [];
  for (let p = 0; p < mask.length; p++)
    if (mask[p] !== original[p])
      repairs.push({ point: [p % columns, Math.floor(p / columns)], enabled: Boolean(mask[p]) });
  const level: Level = {
    version: 1,
    id: `generated-${seed}`,
    name: input.name || 'A fresh tangle',
    description: `${columns} × ${rows} · ${arrows.length.toLocaleString()} arrows · seed ${seed}`,
    difficulty: 'medium',
    grid: { columns, rows },
    arrows,
  };
  // Independent validation of geometry, exact coverage, and the recorded removal order.
  const coverage = new Uint8Array(mask.length);
  for (const arrow of arrows) for (const [x, y] of cells(arrow)) coverage[y * columns + x]++;
  if (coverage.some((v, p) => v !== mask[p]))
    throw new Error('Generation failed its coverage check.');
  parseLevel(level);
  const verification = new PuzzleIndex(arrows, level.grid);
  const initiallyFree = arrows.filter((arrow) => !verification.hit(arrow)).length;
  for (const arrow of arrows) {
    if (verification.hit(arrow)) throw new Error('Generation failed its solution check.');
    verification.remove(arrow.id);
  }
  const serialize = (data: Uint8Array) =>
    Array.from({ length: rows }, (_, y) =>
      Array.from(data.subarray(y * columns, (y + 1) * columns)).join(''),
    );
  progress({ phase: 'Ready to untangle', fraction: 1 });
  return {
    level,
    generation: {
      version: GENERATOR_VERSION,
      seed,
      length,
      repairBudget: budget,
      originalMask: serialize(original),
      finalMask: serialize(mask),
      repairs,
      solution: arrows.map((arrow) => arrow.id),
      stats: {
        cells: mask.reduce((a, b) => a + b, 0),
        arrows: arrows.length,
        initiallyFree,
        attempts,
        fallback,
      },
    },
  };
}
