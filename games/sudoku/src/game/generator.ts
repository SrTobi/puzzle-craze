import { boxRegions, connected, neighbors, solve, solvesWithSingles } from './engine.ts';
import { BOXES, SIZES, type Options, type Puzzle } from './types.ts';

export function validOptions(value: unknown): value is Options {
  if (!value || typeof value !== 'object') return false;
  const o = value as Options;
  return (
    SIZES.includes(o.size) &&
    ['boxes', 'jigsaw'].includes(o.regions) &&
    typeof o.colors === 'boolean' &&
    typeof o.diagonal === 'boolean' &&
    ['gentle', 'balanced', 'sparse'].includes(o.density) &&
    typeof o.seed === 'string' &&
    o.seed.length > 0 &&
    o.seed.length <= 80
  );
}

function randomSource(seed: string): () => number {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function bendRegions(puzzle: Puzzle, random: () => number): boolean {
  const { size } = puzzle.options;
  const original = [...puzzle.regions];
  const regions = puzzle.regions;
  const cells = regions.map((_, i) => i);
  for (let pass = 0; pass < size * 4; pass++) {
    let changed = false;
    for (const a of shuffle(cells, random)) {
      const regionA = regions[a];
      const adjacent = new Set(neighbors(a, size).map((i) => regions[i]));
      for (const b of shuffle(cells, random)) {
        const regionB = regions[b];
        if (
          regionA === regionB ||
          puzzle.solution[a] !== puzzle.solution[b] ||
          !adjacent.has(regionB) ||
          !neighbors(b, size).some((i) => regions[i] === regionA)
        )
          continue;
        [regions[a], regions[b]] = [regionB, regionA];
        if (
          [regionA, regionB].every((r) =>
            connected(
              cells.filter((i) => regions[i] === r),
              size,
            ),
          )
        ) {
          changed = true;
          break;
        }
        [regions[a], regions[b]] = [regionA, regionB];
      }
      if (changed) break;
    }
    if (pass >= size && regions.filter((r, i) => r !== original[i]).length >= Math.ceil(size / 2))
      return true;
  }
  return regions.some((r, i) => r !== original[i]);
}

export function generatePuzzle(
  options: Options,
  onProgress: (message: string) => void = () => {},
): Puzzle {
  if (!validOptions(options))
    throw new Error('Choose a supported size, rule set, and a seed of 1–80 characters.');
  const { size } = options;
  const random = randomSource(
    JSON.stringify([options.size, options.regions, options.colors, options.diagonal, options.seed]),
  );
  const cells = Array.from({ length: size * size }, (_, i) => i);
  const digits = Array.from({ length: size }, (_, i) => i + 1);
  const puzzle: Puzzle = {
    id: `custom:${JSON.stringify(options)}`,
    name: 'Your little experiment',
    options: { ...options },
    regions: boxRegions(size),
    colors: cells.map(() => -1),
    givens: cells.map(() => 0),
    solution: [],
  };
  onProgress('Finding a grid that fits your rules…');
  let ready = false;
  for (let attempt = 0; attempt < 24; attempt++) {
    puzzle.regions = boxRegions(size);
    if (options.diagonal) {
      const result = solve(puzzle, puzzle.givens, 1, 150_000, random);
      if (!result.solution) continue;
      puzzle.solution = result.solution;
    } else {
      const [height, width] = BOXES[size];
      const rows = shuffle(
        Array.from({ length: size / height }, (_, i) => i),
        random,
      ).flatMap((b) =>
        shuffle(
          Array.from({ length: height }, (_, i) => b * height + i),
          random,
        ),
      );
      const cols = shuffle(
        Array.from({ length: size / width }, (_, i) => i),
        random,
      ).flatMap((b) =>
        shuffle(
          Array.from({ length: width }, (_, i) => b * width + i),
          random,
        ),
      );
      const symbols = shuffle(digits, random);
      puzzle.solution = rows.flatMap((r) =>
        cols.map((c) => symbols[(width * (r % height) + Math.floor(r / height) + c) % size]),
      );
    }
    if (options.regions === 'jigsaw' && !bendRegions(puzzle, random)) continue;
    ready = true;
    break;
  }
  if (!ready) throw new Error('This seed took too long to shape. Try another seed.');
  if (options.colors) {
    // Every color gets one occurrence of each digit, spread across the board.
    for (const value of digits) {
      const choices = shuffle(
        cells.filter((i) => puzzle.solution[i] === value),
        random,
      );
      for (let color = 0; color < Math.min(3, size / 2); color++)
        puzzle.colors[choices[color]] = color;
    }
  }
  puzzle.givens = [...puzzle.solution];
  const target = Math.ceil(
    cells.length * { gentle: 0.57, balanced: 0.43, sparse: 0.32 }[options.density],
  );
  let clues = cells.length;
  onProgress('Removing clues and checking for one unique solution…');
  for (const cell of shuffle(cells, random)) {
    if (clues <= target) break;
    const value = puzzle.givens[cell];
    puzzle.givens[cell] = 0;
    const result = solve(puzzle, puzzle.givens, 2, 20_000);
    if (
      result.count !== 1 ||
      result.exhausted ||
      (options.density === 'gentle' && !solvesWithSingles(puzzle, puzzle.givens))
    )
      puzzle.givens[cell] = value;
    else clues--;
  }
  return puzzle;
}
