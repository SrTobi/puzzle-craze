import { describe, expect, it } from 'vitest';
import { POUR_DURATION, pourTimeline, visibleAmount } from './pourTimeline';

describe('pour animation timeline', () => {
  it('transfers liquid only while tilted and returns with the final contents', () => {
    expect(pourTimeline(0, 0)).toMatchObject({ transferred: 0, travel: 0, lift: 1 });
    expect(pourTimeline(0, 300).transferred).toBe(0);
    expect(pourTimeline(0, 624)).toMatchObject({ transferred: 0.5, travel: 1 });
    expect(pourTimeline(0, 1000).transferred).toBe(1);
    expect(pourTimeline(0, POUR_DURATION)).toMatchObject({
      transferred: 1,
      travel: 0,
      lift: 0,
      stream: 0,
    });
  });

  it('conserves visible liquid during staggered pours into a shared bottle', () => {
    const pours = [
      { amount: 2, startedAt: 0 },
      { amount: 1, startedAt: 180 },
    ];
    for (let now = 0; now <= 1500; now += 20) {
      const sources = pours.reduce(
        (sum, pour) => sum + pour.amount * (1 - pourTimeline(pour.startedAt, now).transferred),
        0,
      );
      expect(visibleAmount(4, pours, now) + sources).toBeCloseTo(4);
    }
    expect(visibleAmount(4, pours, 0)).toBe(1);
    expect(visibleAmount(4, pours, 1500)).toBe(4);
  });

  it('does not jump when a completed animation is removed', () => {
    const first = { amount: 2, startedAt: 0 };
    const second = { amount: 2, startedAt: 600 };
    expect(visibleAmount(4, [first, second], 1200)).toBeCloseTo(visibleAmount(4, [second], 1200));
    expect(visibleAmount(4, [second], 1800)).toBe(visibleAmount(4, [], 1800));
  });
});
