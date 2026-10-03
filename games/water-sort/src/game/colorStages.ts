export type ColorStage = { first: number; last: number; colors: number[] };

export function buildColorStages(totalLevels = 1000, maximumColors = 7): ColorStage[] {
  if (
    !Number.isSafeInteger(totalLevels) ||
    totalLevels < 1 ||
    !Number.isSafeInteger(maximumColors) ||
    maximumColors < 3
  )
    throw new Error('Invalid color progression limits.');
  const stages: ColorStage[] = [{ first: 1, last: Math.min(20, totalLevels), colors: [3] }];
  let first = 21;
  let lower = 3;
  while (first <= totalLevels && lower < maximumColors) {
    stages.push({ first, last: Math.min(first + 29, totalLevels), colors: [lower, lower + 1] });
    first += 30;
    lower++;
    if (first <= totalLevels) {
      const last = lower === maximumColors ? totalLevels : Math.min(first + 9, totalLevels);
      stages.push({ first, last, colors: [lower] });
      first = last + 1;
    }
  }
  if (first <= totalLevels) stages[stages.length - 1].last = totalLevels;
  return stages;
}

export const COLOR_STAGES = buildColorStages();

export function stageColorCounts(level: number): readonly number[] {
  const stage = COLOR_STAGES.find(({ first, last }) => level >= first && level <= last);
  if (!Number.isInteger(level) || !stage) throw new Error('Choose a level from 1 to 1000.');
  return stage.colors;
}
