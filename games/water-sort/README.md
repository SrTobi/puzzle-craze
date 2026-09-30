# Water Sort

An endless sequence of laboratory puzzles. Levels 1–3 are guided tutorials. From level 4 onward, the level number is the seed; a level's layout never depends on earlier play or on the current time.

## Progression

| Levels                     | Colors               |
| -------------------------- | -------------------- |
| 1–10 (including tutorials) | 3                    |
| 11–40                      | 4                    |
| 41–70                      | 5                    |
| 71–120                     | 6                    |
| 121–170                    | 7                    |
| Each subsequent 50 levels  | One additional color |

The picker accepts any positive safe integer level number, and Next experiment advances without a fixed catalog limit. Additional colors are generated beyond the original palette. The liquids contain no symbols; tube labels name the colors for screen readers.

## Generation and exact analysis

1. Seed the fixed PRNG with the full decimal level number. Shuffle four units per color with Fisher–Yates and divide them into full bottles. Tutorials use fixed teaching arrangements.
2. Add one empty bottle. Enumerate **all** legally reachable configurations, including loops, using immutable pouring rules.
3. Canonicalize each configuration by sorting its bottle encodings. Bottle positions are interchangeable; layer order, color identities, and the number of empty bottles are preserved.
4. Retain each distinct directed transition, with a multiplicity for the number of physical source/destination choices that produce it. Do not prune solved bottles, uniform-to-empty pours, or self-loops.
5. Run reverse breadth-first search from the unique normalized winning configuration. This gives the shortest distance for every winnable configuration. All remaining configurations are marked unwinnable, including cycles that cannot reach the goal.
6. If the starting graph contains no goal, keep the same shuffled liquid arrangement, add one empty bottle, and repeat the complete analysis.
7. For every winnable configuration, count legal pours whose destination has a smaller shortest distance. Average these counts equally over all winnable configurations, including the goal with zero improving moves. The sidebar also gives the average number of distinct improving outcomes, to distinguish equivalent physical moves from graph edges.

The sidebar shows starting and current shortest distances, improving/losing/neutral/worsening move counts, configuration totals, unwinnable counts, transition counts, self-loops, dead ends, distance averages, and analysis time. The configuration explorer pages through every state with a distance or an unwinnable label, its improving-move count, and expandable bottle contents. Hints use exact shortest paths from the current position.

## Resource limits

Enumeration and analysis run in a dedicated Web Worker. Large graphs can grow exponentially; an unlimited level sequence cannot guarantee bounded computation or memory per level. Progress is visible and the user can pause or select another level to cancel the worker. At 100,000 discovered states, exploration pauses with a **Continue analysis** control that increases its state budget. The complete graph stays in the worker; only statistics and requested pages are sent to the UI. No partial graph is presented as an exact analysis, no incomplete search is labeled unwinnable, and no empty bottle is added because a resource budget was reached. Completed graphs have no approximation or depth cutoff.

## Play and persistence

- Select a tube, then an empty destination or one with a matching top color. Each tube holds four layers; matching top layers pour together up to the available space.
- Pours can overlap. Two sources may pour into the same destination from opposite sides. Liquid and capacity are reserved immediately; moving or receiving tubes must settle before they can be lifted. Each pour gets its own undo entry.
- Select the same tube or press Escape to cancel. Undo with `U`, or get a hint with `H`. Restart resets the same seeded layout.
- Use Tab and Enter/Space for keyboard play. Reduced-motion settings skip the animations.
- Local storage saves selected level, boards, completion, and the last 100 undo steps per level. Version 2 uses a separate storage key and leaves the old fixed collection's save untouched. Saved boards are validated against the generated level and graph. A storage failure keeps play available and displays a notice.

`src/game/analysis.ts` owns graph enumeration, reverse distances, statistics, and generation. `analysis.worker.ts` keeps that work off the UI thread. `engine.ts` owns pouring rules, and `pours.ts` reserves overlapping moves. Tests cross-check shortest paths against an independent forward BFS, check normalized loops and losing states, verify the color thresholds and deterministic generation, and cover empty-bottle retries, persistence, and simultaneous pours.

Run `pnpm test`, `pnpm build`, and `pnpm format:check` at the repository root. The page is `/games/water-sort/`; navigation and the worker follow Vite's base path.
