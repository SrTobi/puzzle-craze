import { describe, expect, it } from 'vitest';
import catalog from './catalog.json';
import { initialLevel, isLevelNumber, TOTAL_LEVELS, colorCount } from './levels';
import { analyzeCandidate } from './catalogBuilder';
import { compareDifficulty, qualifiesForChallenge } from './difficulty';
import { seededBoard } from './seededBoard';
import { configurationKey } from './analysis';
import { COLOR_STAGES, stageColorCounts } from './colorStages';

describe('ranked catalog', () => {
  it('has exactly 1,000 levels with tutorials and an easy opening', () => {
    expect(catalog.entries).toHaveLength(TOTAL_LEVELS - 3);
    for (const number of [1, 2, 3]) expect(initialLevel(number).tutorial).toBeTruthy();
    for (let number = 4; number <= 9; number++) {
      const level = initialLevel(number);
      expect(level.difficulty!.shortest).toBeLessThan(10);
      expect(level.difficulty!.winningLosingRatio).toBeNull();
    }
    for (const invalid of [0, -1, 1.5, 1001, Infinity, NaN, '10']) {
      expect(isLevelNumber(invalid)).toBe(false);
    }
    expect(isLevelNumber(1000)).toBe(true);
    expect(() => initialLevel(1001)).toThrow();
  });

  it('keeps colors gradual and orders higher ratios first within each stage', () => {
    for (const stage of COLOR_STAGES) {
      const first = Math.max(10, stage.first);
      const challenges = catalog.entries.slice(first - 4, stage.last - 3);
      expect(challenges).toHaveLength(stage.last - first + 1);
      for (let i = 0; i < challenges.length; i++) {
        expect(stage.colors).toContain(challenges[i].colors);
        expect(qualifiesForChallenge(challenges[i])).toBe(true);
        if (i > 0)
          expect(compareDifficulty(challenges[i - 1], challenges[i])).toBeLessThanOrEqual(0);
      }
      for (const colors of stage.colors)
        expect(challenges.some((entry) => entry.colors === colors)).toBe(true);
      if (stage.colors.length === 2) {
        for (const colors of stage.colors)
          expect(challenges.filter((entry) => entry.colors === colors)).toHaveLength(15);
      }
      expect(challenges.at(-1)!.winningLosingRatio!).toBeLessThan(
        challenges[0].winningLosingRatio!,
      );
    }
    for (let level = 1; level <= TOTAL_LEVELS; level++)
      expect(stageColorCounts(level)).toContain(colorCount(level));
  });

  it('reproduces every board from its saved seed and conserves every color', () => {
    const keys = new Set<string>();
    for (let number = 4; number <= TOTAL_LEVELS; number++) {
      const entry = catalog.entries[number - 4];
      const level = initialLevel(number);
      expect(level.seed).toBe(entry.seed);
      expect(colorCount(number)).toBe(entry.colors);
      expect(level.board).toEqual(seededBoard(entry.seed, entry.colors, entry.emptyTubes));
      for (let color = 0; color < entry.colors; color++)
        expect(level.board.flat().filter((value) => value === color)).toHaveLength(4);
      expect(level.board.filter((tube) => !tube.length)).toHaveLength(entry.emptyTubes);
      const key = configurationKey(level.board);
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  it('independently rebuilds every selected graph and verifies its recorded difficulty', () => {
    for (const entry of catalog.entries) {
      const analyzed = analyzeCandidate(entry.seed, entry.colors);
      expect(analyzed).not.toBeNull();
      const { key: _key, ...stats } = analyzed!;
      expect(stats).toEqual(entry);
    }
  }, 120000);

  it('discards an incomplete candidate rather than treating it as unsolvable', () => {
    expect(analyzeCandidate(71, 6, 1)).toBeNull();
  });
});
