import { createServer } from 'vite';
import { writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';

const server = await createServer({
  server: { middlewareMode: true, ws: false, hmr: false },
  appType: 'custom',
});
try {
  const { analyzeCandidate } = await server.ssrLoadModule(
    '/games/water-sort/src/game/catalogBuilder.ts',
  );
  const { qualifiesForChallenge, compareDifficulty } = await server.ssrLoadModule(
    '/games/water-sort/src/game/difficulty.ts',
  );
  const { COLOR_STAGES } = await server.ssrLoadModule('/games/water-sort/src/game/colorStages.ts');
  const pilot = process.argv.includes('--pilot');
  const spread = (pool, count) =>
    Array.from(
      { length: count },
      (_, i) => pool[count === 1 ? 0 : Math.round((i * (pool.length - 1)) / (count - 1))],
    );
  const quotas = COLOR_STAGES.map((stage) => {
    const count = stage.last - Math.max(10, stage.first) + 1;
    return stage.colors.map((colors, index) => ({
      colors,
      count:
        Math.floor(count / stage.colors.length) + (index < count % stage.colors.length ? 1 : 0),
    }));
  });
  const needs = new Map();
  for (const stage of quotas)
    for (const quota of stage)
      needs.set(quota.colors, (needs.get(quota.colors) ?? 0) + quota.count);
  const pools = new Map();
  let candidateCount = 0,
    rejected = 0;
  const compare = (a, b) => compareDifficulty(a, b) || a.colors - b.colors || a.seed - b.seed;
  for (const [colors, needed] of needs) {
    const target = Math.max(needed * 2, 100);
    const keys = new Set();
    const challenges = [],
      intro = [];
    let examined = 0;
    for (let seed = 1; seed <= (pilot ? 100 : 20000); seed++) {
      examined++;
      const candidate = analyzeCandidate(seed, colors);
      if (!candidate || keys.has(candidate.key)) {
        rejected++;
        continue;
      }
      keys.add(candidate.key);
      candidateCount++;
      if (qualifiesForChallenge(candidate)) challenges.push(candidate);
      if (
        colors === 3 &&
        candidate.shortest >= 5 &&
        candidate.shortest <= 9 &&
        candidate.trapStates === 0
      )
        intro.push(candidate);
      if (seed % 100 === 0)
        console.log(JSON.stringify({ colors, seed, qualified: challenges.length, target }));
      if (!pilot && challenges.length >= target && (colors !== 3 || intro.length >= 6)) break;
    }
    challenges.sort(compare);
    intro.sort((a, b) => a.shortest - b.shortest || a.seed - b.seed);
    if (!pilot && (challenges.length < needed || (colors === 3 && intro.length < 6)))
      throw new Error(`Not enough ${colors}-color puzzles; catalog unchanged.`);
    pools.set(colors, { colors, examined, qualified: challenges.length, challenges, intro });
    console.log(JSON.stringify({ colors, examined, qualified: challenges.length }));
  }
  if (pilot) {
    await writeFile('/tmp/water-sort-mixed-pilot.json', JSON.stringify([...pools.values()]));
  } else {
    const used = new Set();
    const selected = spread(pools.get(3).intro, 6);
    for (const entry of selected) used.add(entry.key);
    for (const stage of quotas) {
      const mixed = [];
      for (const { colors, count } of stage) {
        const available = pools.get(colors).challenges.filter((entry) => !used.has(entry.key));
        if (available.length < count)
          throw new Error('Insufficient distinct candidates; catalog unchanged.');
        for (const entry of spread(available, count)) {
          used.add(entry.key);
          mixed.push(entry);
        }
      }
      selected.push(...mixed.sort(compare));
    }
    const entries = selected.map(({ key, ...entry }) => entry);
    if (entries.length !== 997)
      throw new Error('Expected 997 generated levels; catalog unchanged.');
    const catalog = {
      version: 3,
      generatorVersion: 1,
      difficultyVersion: 2,
      candidateCount,
      rejected,
      stages: COLOR_STAGES,
      pools: [...pools.values()].map(({ challenges, intro, ...summary }) => summary),
      entries,
    };
    const destination = 'games/water-sort/src/game/catalog.json';
    const formatted = await format(JSON.stringify(catalog), {
      ...(await resolveConfig(destination)),
      filepath: destination,
    });
    await writeFile(`${destination}.tmp`, formatted);
    await rename(`${destination}.tmp`, destination);
    console.log(JSON.stringify({ levels: entries.length + 3, candidateCount, rejected }));
  }
} finally {
  await server.close();
}
