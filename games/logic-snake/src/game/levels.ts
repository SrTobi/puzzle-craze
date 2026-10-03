import type { Level } from './engine';
import { tutorialLevels } from './tutorials';

import { loadLevel, type SourceLevel } from './level-format';

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

export const puzzleLevels: Level[] = Object.entries(sources)
  .sort(([a], [b]) =>
    a.endsWith('/level.json') ? -1 : b.endsWith('/level.json') ? 1 : a.localeCompare(b),
  )
  .map(([path, source], index) =>
    loadLevel(source, path.split('/').at(-1)!.replace('.json', ''), names[index]),
  );

const numberedSources = import.meta.glob<SourceLevel>('../levels/numbered/*.json', {
  eager: true,
  import: 'default',
});
export const numberedLevels = Object.entries(numberedSources)
  .sort(
    ([a, sourceA], [b, sourceB]) =>
      (sourceA.generation?.version ?? 0) - (sourceB.generation?.version ?? 0) || a.localeCompare(b),
  )
  .map(([path, source], index) =>
    loadLevel(
      source,
      path.split('/').at(-1)!.replace('.json', ''),
      `Numbered regions ${index + 1}`,
    ),
  );

export const levels = [...tutorialLevels, ...puzzleLevels, ...numberedLevels];

export function levelNumber(level: Level) {
  return String(levels.indexOf(level) + 1).padStart(2, '0');
}
