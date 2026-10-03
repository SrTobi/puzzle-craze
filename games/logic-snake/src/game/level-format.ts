import type { Cell, Level } from './engine';

/** Original Flutter format, extended with optional positional region-size clues. */
export interface SourceLevel {
  name?: string;
  generation?: Level['generation'];
  width: number;
  height: number;
  fields: Record<string, string>;
  level: string[];
  initial_open: [number, number][];
  moves: [number, number][];
  region_clues?: [number, number, number][];
  empty_policy: { Ascending: { top: number } };
}

export function loadLevel(source: SourceLevel, id: string, fallbackName: string): Level {
  const regionClues: Record<number, number> = {};
  for (const [x, y, size] of source.region_clues ?? []) {
    if (
      ![x, y, size].every(Number.isInteger) ||
      x < 0 ||
      x >= source.width ||
      y < 0 ||
      y >= source.height ||
      size < 1 ||
      size > source.empty_policy.Ascending.top ||
      source.level[y]?.[x] !== source.fields.empty ||
      regionClues[y * source.width + x] !== undefined
    ) {
      throw new Error(`Invalid numbered region clue in ${id}.`);
    }
    regionClues[y * source.width + x] = size;
  }
  return {
    id,
    ...(source.generation ? { generation: source.generation } : {}),
    name: source.name ?? fallbackName,
    width: source.width,
    height: source.height,
    top: source.empty_policy.Ascending.top,
    solution: source.level
      .join('')
      .split('')
      .map((char): Cell =>
        char === source.fields['snake-head']
          ? 'head'
          : char === source.fields['snake-body']
            ? 'snake'
            : 'empty',
      ),
    clues: source.initial_open.map(([x, y]) => y * source.width + x),
    moves: source.moves.map(([x, y]) => y * source.width + x),
    ...(source.region_clues?.length ? { regionClues } : {}),
  };
}

export function serializeLevel(level: Level): SourceLevel {
  const point = (i: number): [number, number] => [i % level.width, Math.floor(i / level.width)];
  if (level.solution.includes('unknown')) throw new Error('Cannot export an unfinished solution.');
  return {
    name: level.name,
    ...(level.generation ? { generation: level.generation } : {}),
    width: level.width,
    height: level.height,
    fields: { 'snake-head': 'X', 'snake-body': '+', empty: '.' },
    level: Array.from({ length: level.height }, (_, y) =>
      level.solution
        .slice(y * level.width, (y + 1) * level.width)
        .map((cell) => (cell === 'head' ? 'X' : cell === 'snake' ? '+' : '.'))
        .join(''),
    ),
    initial_open: [
      ...new Set([...level.clues, ...Object.keys(level.regionClues ?? {}).map(Number)]),
    ].map(point),
    moves: level.moves.map(point),
    region_clues: Object.entries(level.regionClues ?? {}).map(([index, size]) => [
      ...point(Number(index)),
      size,
    ]),
    empty_policy: { Ascending: { top: level.top } },
  };
}
