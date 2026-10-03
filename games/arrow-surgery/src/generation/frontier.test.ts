import { describe, expect, it } from 'vitest';
import { exitDistance, Frontier } from './frontier';

const code = (x: number, y: number, direction: number, columns = 9) =>
  (y * columns + x) * 4 + direction;

function pick(frontier: Frontier, explore: boolean, sample: number) {
  let calls = 0;
  return frontier.pick(() => (calls++ === 0 ? (explore ? 0.1 : 0.5) : sample));
}

describe('entry-point priority', () => {
  it('measures distance to the pointed-at edge in all four directions', () => {
    expect([0, 1, 2, 3].map((d) => exitDistance(code(2, 1, d), 9, 6))).toEqual([2, 6, 1, 4]);
    expect(exitDistance(code(8, 5, 1), 9, 6)).toBe(0);
    expect(exitDistance(code(8, 5, 3), 9, 6)).toBe(0);
  });

  it('picks the farthest candidate when not exploring, breaking ties randomly', () => {
    const frontier = new Frontier(9, 6);
    const near = code(1, 0, 0);
    const farLeft = code(7, 2, 0);
    const farRight = code(1, 4, 1);
    [near, farLeft, farRight].forEach((entry) => frontier.set(entry, true));
    expect(pick(frontier, false, 0)).toBe(farLeft);
    expect(pick(frontier, false, 0.99)).toBe(farRight);
    frontier.set(farLeft, false);
    expect(pick(frontier, false, 0)).toBe(farRight);
    frontier.set(farRight, false);
    expect(pick(frontier, false, 0)).toBe(near);
    frontier.set(farLeft, true);
    expect(pick(frontier, false, 0)).toBe(farLeft);
  });

  it('can explore every candidate with equal probability regardless of distance', () => {
    const frontier = new Frontier(9, 6);
    const entries = [code(1, 0, 0), code(2, 0, 0), code(2, 1, 0), code(7, 2, 0)];
    entries.forEach((entry) => frontier.set(entry, true));
    entries.forEach((entry, i) => {
      expect(pick(frontier, true, (i + 0.5) / entries.length)).toBe(entry);
    });
    // Removing a random candidate must not leave a stale sampling slot.
    frontier.set(entries[1], false);
    for (let i = 0; i < frontier.size; i++)
      expect(pick(frontier, true, (i + 0.5) / frontier.size)).not.toBe(entries[1]);
  });

  it('keeps membership correct through repeated removals and reinsertions', () => {
    const frontier = new Frontier(9, 6);
    const expected = new Set<number>();
    // Exercise every direction, tie bucket, and swap-removal position.
    for (let i = 0; i < 2000; i++) {
      const entry = (i * 53) % (9 * 6 * 4);
      const present = i % 3 !== 0;
      frontier.set(entry, present);
      frontier.set(entry, present);
      if (present) expected.add(entry);
      else expected.delete(entry);
      const picked = pick(frontier, false, 0.37);
      expect(frontier.size).toBe(expected.size);
      if (!expected.size) expect(picked).toBeUndefined();
      else {
        expect(expected.has(picked!)).toBe(true);
        expect(expected.has(pick(frontier, true, (i % 10) / 10)!)).toBe(true);
        expect(exitDistance(picked!, 9, 6)).toBe(
          Math.max(...[...expected].map((entry) => exitDistance(entry, 9, 6))),
        );
      }
    }
    expected.forEach((entry) => frontier.set(entry, false));
    expect(pick(frontier, false, 0)).toBeUndefined();
  });
});
