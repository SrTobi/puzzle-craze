import { describe, expect, it } from 'vitest';
import { buildColorStages, stageColorCounts } from './colorStages';

describe('alternating color progression', () => {
  it.each([
    [1, [3]],
    [20, [3]],
    [21, [3, 4]],
    [50, [3, 4]],
    [51, [4]],
    [60, [4]],
    [61, [4, 5]],
    [90, [4, 5]],
    [91, [5]],
    [100, [5]],
    [101, [5, 6]],
    [130, [5, 6]],
    [131, [6]],
    [140, [6]],
    [141, [6, 7]],
    [170, [6, 7]],
    [171, [7]],
    [1000, [7]],
  ])('level %i permits the expected colors', (level, colors) => {
    expect(stageColorCounts(level)).toEqual(colors);
  });
  it('covers every level once with no gaps or overlaps', () => {
    const stages = buildColorStages();
    expect(stages[0].first).toBe(1);
    expect(stages.at(-1)!.last).toBe(1000);
    for (let index = 1; index < stages.length; index++)
      expect(stages[index].first).toBe(stages[index - 1].last + 1);
    for (const stage of stages) {
      expect(stage.colors.length).toBeGreaterThanOrEqual(1);
      expect(stage.colors.length).toBeLessThanOrEqual(2);
      if (stage.colors.length === 2) expect(stage.last - stage.first + 1).toBe(30);
    }
  });
  it('clips the final range and supports a different maximum', () => {
    expect(buildColorStages(35).at(-1)).toEqual({ first: 21, last: 35, colors: [3, 4] });
    expect(buildColorStages(5)).toEqual([{ first: 1, last: 5, colors: [3] }]);
    expect(buildColorStages(1000, 28).at(-1)).toEqual({ first: 981, last: 1000, colors: [27, 28] });
  });
  it('rejects invalid level numbers', () => {
    for (const value of [0, 1.5, 1001, NaN]) expect(() => stageColorCounts(value)).toThrow();
  });
});
