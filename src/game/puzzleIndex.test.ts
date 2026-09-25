import { expect, it } from 'vitest';
import { PuzzleIndex } from './puzzleIndex';
import { blocker, blockingHit, parseLevel } from './engine';
import { pickArrow } from './hitTesting';
import firstLight from '../levels/first-light.json';
import { CELL_SIZE } from './arrowGeometry';

it('matches collision and forgiving-selection rules before and after removals', () => {
  const level = parseLevel(firstLight);
  const index = new PuzzleIndex(level.arrows, level.grid);
  let active = [...level.arrows];
  for (const removed of ['', 'meadow', 'sky', 'mint']) {
    if (removed) {
      index.remove(removed);
      active = active.filter((a) => a.id !== removed);
    }
    for (const arrow of active) expect(index.hit(arrow)).toEqual(blockingHit(arrow, active));
    for (let y = -1; y <= 11; y += 0.73)
      for (let x = -1; x <= 13; x += 0.71) {
        const point = [x * CELL_SIZE, y * CELL_SIZE] as const;
        expect(pickArrow(point, index.near(point), (a) => !index.hit(a))?.id).toBe(
          pickArrow(point, active, (a) => !blocker(a, active))?.id,
        );
      }
  }
});
