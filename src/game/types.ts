export type Point = readonly [x: number, y: number];
export type ArrowColor = 'violet' | 'coral' | 'teal' | 'gold' | 'blue' | 'pink';

export interface Arrow {
  id: string;
  color: ArrowColor;
  /** Grid coordinates, in tail-to-head order. Intermediate straight cells may be omitted. */
  points: readonly Point[];
}

export interface Level {
  version: 1;
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  grid: { columns: number; rows: number };
  arrows: readonly Arrow[];
}
