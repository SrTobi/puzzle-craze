import { CAPACITY, type Board } from './engine';

// Stable generator: the catalog stores its seed and color count, not its board.
export function seededBoard(seed: number, colors: number, emptyTubes = 1): Board {
  let state = 2166136261;
  for (const digit of String(seed)) state = Math.imul(state ^ digit.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const liquid = Array.from({ length: colors * CAPACITY }, (_, i) => Math.floor(i / CAPACITY));
  for (let i = liquid.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [liquid[i], liquid[j]] = [liquid[j], liquid[i]];
  }
  const board = Array.from({ length: colors }, (_, i) =>
    liquid.slice(i * CAPACITY, (i + 1) * CAPACITY),
  );
  return [...board, ...Array.from({ length: emptyTubes }, () => [])];
}
