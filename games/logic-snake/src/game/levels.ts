import type { Cell, Level } from './engine';

interface SourceLevel {
  width: number;
  height: number;
  fields: Record<string, string>;
  level: string[];
  initial_open: [number, number][];
  moves: [number, number][];
  empty_policy: { Ascending: { top: number } };
}
const sources = import.meta.glob<SourceLevel>('../levels/*.json', {
  eager: true,
  import: 'default',
});
const names = [
  'A little winding',
  'Quiet corners',
  'The long way home',
  'Room to grow',
  'Between the lines',
  'A gentle detour',
  'Twists & turns',
  'Finding a rhythm',
  'A wider world',
  'Around the bend',
  'The scenic route',
  'Loose ends',
  'Full circle',
];

export const levels: Level[] = Object.entries(sources)
  .sort(([a], [b]) =>
    a.endsWith('/level.json') ? -1 : b.endsWith('/level.json') ? 1 : a.localeCompare(b),
  )
  .map(([path, source], index) => ({
    id: path.split('/').at(-1)!.replace('.json', ''),
    name: names[index],
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
  }));
