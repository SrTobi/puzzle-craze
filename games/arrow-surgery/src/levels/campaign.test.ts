import { describe, expect, it } from 'vitest';
import { availableArrows, parseLevel, solve } from '../game/engine';
import { MAX_SIDE } from '../game/grid';
import { generatePuzzle } from '../generation/generator';
import {
  campaignInput,
  isCampaignLevel,
  MAX_CAMPAIGN_LEVEL,
  tutorialLevel,
  tutorialStep,
} from './campaign';

describe('numbered Arrow Surgery levels', () => {
  it('teaches a clear exit, a blocker, and a bend in three guided moves', () => {
    const level = parseLevel(tutorialLevel);
    const removed: string[] = [];
    for (const id of ['exit', 'blocked', 'bend']) {
      expect(tutorialStep(removed)?.arrow).toBe(id);
      expect(
        availableArrows(level.arrows.filter((arrow) => !removed.includes(arrow.id))).map(
          (arrow) => arrow.id,
        ),
      ).toEqual([id]);
      removed.push(id);
    }
    expect(tutorialStep(removed)).toBeNull();
    expect(solve(level.arrows)).toEqual(removed);
  });

  it('varies each dimension around 10 + level / 2 within the supported grid size', () => {
    let rectangles = 0;
    const seeds = new Set<string>();
    for (let number = 2; number <= MAX_CAMPAIGN_LEVEL; number++) {
      const input = campaignInput(number);
      const mean = 10 + number / 2;
      expect(input).toEqual(campaignInput(number));
      for (const size of [input.columns, input.rows]) {
        expect(Math.abs(size - mean)).toBeLessThanOrEqual(2.5);
        expect(size).toBeLessThanOrEqual(MAX_SIDE);
        expect(Number.isInteger(size)).toBe(true);
      }
      if (input.columns !== input.rows) rectangles++;
      seeds.add(input.seed);
    }
    expect(rectangles).toBeGreaterThan(MAX_CAMPAIGN_LEVEL / 2);
    expect(seeds.size).toBe(MAX_CAMPAIGN_LEVEL - 1);
  });

  it.each([
    [2, 'easy'],
    [4, 'easy'],
    [5, 'hard'],
    [14, 'hard'],
    [15, 'super-hard'],
  ] as const)('reproduces a solvable level %i with the %s preset', (number, difficulty) => {
    const input = campaignInput(number);
    expect(input.difficulty).toBe(difficulty);
    const first = generatePuzzle(input);
    expect(first).toEqual(generatePuzzle(input));
    expect(parseLevel(first.level)).toEqual(first.level);
    expect(solve(first.level.arrows)).toHaveLength(first.level.arrows.length);
    expect(first.level.name).toBe(`Level ${number}`);
  });

  it.each([0, -1, 1.5, NaN, Infinity, MAX_CAMPAIGN_LEVEL + 1, '2', null])(
    'rejects invalid level %s',
    (number) => {
      expect(isCampaignLevel(number)).toBe(false);
    },
  );
  it('keeps the authored tutorial separate from seeded generation', () => {
    expect(isCampaignLevel(1)).toBe(true);
    expect(() => campaignInput(1)).toThrow();
    expect(() => campaignInput(MAX_CAMPAIGN_LEVEL + 1)).toThrow();
  });
});
