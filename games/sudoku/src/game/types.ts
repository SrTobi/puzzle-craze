export const SIZES = [4, 6, 9, 12] as const;
export type Size = (typeof SIZES)[number];
export type ClueDensity = 'gentle' | 'balanced' | 'sparse';
export type Options = {
  size: Size;
  regions: 'boxes' | 'jigsaw';
  colors: boolean;
  diagonal: boolean;
  density: ClueDensity;
  seed: string;
};
export type Puzzle = {
  id: string;
  name: string;
  options: Options;
  regions: number[];
  // -1 means uncolored. Each color contains exactly size cells.
  colors: number[];
  givens: number[];
  solution: number[];
};
export type Unit = {
  kind: 'row' | 'column' | 'region' | 'color' | 'diagonal';
  name: string;
  cells: number[];
};
export type Snapshot = { board: number[]; notes: number[] };
export type Run = Snapshot & { history: Snapshot[]; future: Snapshot[] };
export type Hint = { cell: number; value: number; message: string; reveal: boolean };

export const BOXES: Record<Size, [number, number]> = {
  4: [2, 2],
  6: [2, 3],
  9: [3, 3],
  12: [3, 4],
};
export const COLOR_NAMES = ['Rose', 'Sage', 'Lavender'];
