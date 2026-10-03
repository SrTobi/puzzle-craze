import {
  Grid2X2,
  Grid3X3,
  Maximize2,
  MoveDiagonal,
  Palette,
  Puzzle as PuzzleIcon,
} from 'lucide-react';
import type { Options } from '../game/types';

export function features(options: Options) {
  return [
    {
      key: 'size',
      Icon: options.size === 9 ? Grid3X3 : Maximize2,
      label: `${options.size}×${options.size}`,
      description: `Use numbers 1–${options.size}`,
    },
    options.regions === 'jigsaw'
      ? {
          key: 'jigsaw',
          Icon: PuzzleIcon,
          label: 'Jigsaw',
          description: 'Each outlined region uses every number once',
        }
      : {
          key: 'boxes',
          Icon: Grid2X2,
          label: 'Boxes',
          description: 'Each outlined box uses every number once',
        },
    ...(options.colors
      ? [
          {
            key: 'colors',
            Icon: Palette,
            label: 'Colors',
            description: 'Each lettered color group uses every number once',
          },
        ]
      : []),
    ...(options.diagonal
      ? [
          {
            key: 'diagonal',
            Icon: MoveDiagonal,
            label: 'Diagonals',
            description: 'Both dotted diagonals use every number once',
          },
        ]
      : []),
  ];
}
export function Features({ options }: { options: Options }) {
  return (
    <span className="sudoku-features">
      {features(options).map(({ key, Icon, label, description }) => (
        <span key={key} className={`sudoku-feature feature-${key}`} title={description}>
          <Icon size={13} aria-hidden="true" />
          {label}
        </span>
      ))}
    </span>
  );
}
