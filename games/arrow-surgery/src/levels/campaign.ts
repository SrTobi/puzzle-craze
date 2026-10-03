import { MAX_SIDE } from '../game/grid';
import type { Level } from '../game/types';
import type { GeneratorInput } from '../generation/generator';

// The size formula reaches the generator's existing limit at this level.
export const MAX_CAMPAIGN_LEVEL = (MAX_SIDE - 10) * 2;
export const isCampaignLevel = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CAMPAIGN_LEVEL;

export const tutorialLevel: Level = {
  version: 1,
  id: 'arrow-tutorial',
  name: 'First moves',
  description: 'Follow the glowing arrow.',
  difficulty: 'easy',
  grid: { columns: 7, rows: 5 },
  arrows: [
    {
      id: 'exit',
      color: 'violet',
      points: [
        [5, 2],
        [5, 0],
      ],
    },
    {
      id: 'blocked',
      color: 'coral',
      points: [
        [1, 1],
        [3, 1],
      ],
    },
    {
      id: 'bend',
      color: 'teal',
      points: [
        [1, 3],
        [3, 3],
        [3, 2],
      ],
    },
  ],
};

export function tutorialStep(removed: readonly string[]) {
  if (!removed.includes('exit'))
    return { arrow: 'exit', message: 'Tap the glowing arrow. Its head points to a clear exit.' };
  if (!removed.includes('blocked'))
    return {
      arrow: 'blocked',
      message: 'Now the coral arrow is free. Clear blockers to open a path.',
    };
  if (!removed.includes('bend'))
    return { arrow: 'bend', message: 'Tap the bent arrow. It follows the direction of its head.' };
  return null;
}

/** Stable, independently varied dimensions: each is centered on 10 + level / 2. */
export function campaignInput(number: number): GeneratorInput {
  if (!isCampaignLevel(number) || number === 1)
    throw new Error('Choose a generated level from 2 onward.');
  let state = number >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mean = 10 + number / 2;
  const dimension = () => Math.max(2, Math.min(MAX_SIDE, Math.round(mean + (random() - 0.5) * 4)));
  return {
    columns: dimension(),
    rows: dimension(),
    seed: `arrow-surgery-level-${number}`,
    name: `Level ${number}`,
    difficulty: number < 5 ? 'easy' : number < 15 ? 'hard' : 'super-hard',
    repair: false,
  };
}
