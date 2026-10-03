# Water Sort

A fixed collection of **1,000 puzzles**, generated and ranked before release. Each generated entry stores its seed, color count, proven empty-bottle count, and difficulty statistics. Boards are reproduced with the fixed PRNG; the displayed level number is independent of the seed.

## Progression and difficulty

- **1–3:** guided tutorials, unchanged.
- **4–9:** easy warm-ups with five to nine moves in their shortest solution and no losing states.
- **10–1,000:** every challenge has reachable losing states, needs at least ten pours, has at least three winnable configurations with a losing choice, and has at least 3% losing configurations overall. Its average winning-to-losing ratio is at most 4:1.

| Levels    | Colors |
| --------- | ------ |
| 1–20      | 3      |
| 21–50     | 3 or 4 |
| 51–60     | 4      |
| 61–90     | 4 or 5 |
| 91–100    | 5      |
| 101–130   | 5 or 6 |
| 131–140   | 6      |
| 141–170   | 6 or 7 |
| 171–1,000 | 7      |

After the first 20 levels, each new color is introduced with 30 mixed levels followed by ten using only that color. Mixed ranges contain 15 puzzles of each permitted color count, ranked together by difficulty. The existing maximum of seven colors is retained; after its introduction, the remaining levels use seven colors.

For every **unsolved, winnable configuration with at least one losing choice**, divide the number of legal pours that retain a route to victory by the number that lead to an unwinnable state. Average these ratios equally across those configurations. **Higher ratios are easier.** This is the mean of individual ratios, not the ratio of summed move counts. Winning choices include neutral or farther-away moves that still leave a solution, not only moves on a shortest route. Physical bottle choices retain their multiplicity.

Configurations with zero losing choices are excluded from the ratio to avoid dividing by zero. Puzzles with no losing choices anywhere store `null` for the ratio and display “Only winning choices”; these are permitted only in the opening. Losing and solved configurations are also excluded from the ratio. Average winning and losing move counts in the sidebar still cover all unsolved, winnable configurations.

Within each fixed or mixed range, sort by **descending** ratio, then ascending shortest solution length and average losing-move count, with seed as a deterministic tie-breaker. Each range begins a fresh easy-to-hard stage. Within a mixed range, neighboring levels can move between its two allowed color counts. This metric is a ranking aid, not a measured probability that a player will lose.

The sidebar shows the ratio and average winning/losing moves alongside exact shortest distances, current improving/losing/neutral/worsening choices, normalized state counts, unwinnable states, transitions, self-loops, dead ends, and distance averages. Every state can still be inspected in the configuration explorer.

## Rebuilding the catalog

```sh
pnpm generate:water-sort
```

The offline builder scans consecutive positive seeds independently for each color count. It gathers twice the total number of qualifying challenges needed for that color across all ranges (at least 100 candidates). It rejects duplicate normalized starting boards. For each range, it takes evenly spaced entries from the unused candidates for each allowed color count, then sorts their combined selection by difficulty. A starting configuration is never reused between ranges. Three tutorials, six warm-ups, and 991 challenges make exactly 1,000 levels.

The output is `src/game/catalog.json`, replaced atomically only after every pool has enough candidates. `--pilot` samples 100 seeds per color without replacing the catalog. The generator uses a 20,000-seed maximum per color and fails explicitly if it cannot fill the collection.

For each candidate:

1. Shuffle four units per color using the stable seed and Fisher–Yates algorithm; distribute them into full bottles and add one empty bottle.
2. Enumerate **all** legally reachable configurations, including loops. Normalize bottle order, preserving layer order, color identities, and empty-bottle count.
3. Record each directed transition and its multiplicity of physical source/destination choices.
4. Run reverse breadth-first search from the normalized goal. All states not reached by this reverse search are unwinnable, including losing cycles.
5. If the completed graph has no goal, retain the arrangement, add one empty bottle, and repeat.
6. Discard candidates exceeding 20,000 discovered states. An incomplete graph is never treated as unwinnable, never scored, and never triggers adding a bottle.
7. Measure difficulty only on the complete solvable graph and apply the challenge filters.

At play time, the saved seed, colors, and empty-bottle count reproduce the selected puzzle. The exact graph is rebuilt in a dedicated worker for hints, live statistics, and exploration. A catalog puzzle that fails its solvability check reports an error instead of silently changing its layout. Tutorial layouts may still add an empty bottle as needed.

## Play and persistence

- Select a tube, then an empty destination or one with a matching top color. Each tube holds four layers; matching top layers pour together up to the available space.
- Pours can overlap. Two sources can pour into a shared destination from opposite sides. The animated liquid drains and fills together, while logical capacity is reserved immediately. Moving and receiving tubes must settle before being picked up.
- Tap the selected tube again or press Escape to cancel. Undo with `U`, or get an exact shortest-path hint with `H`. Restart restores the same puzzle.
- Tab between tubes and use Enter or Space to select and pour. Reduced motion skips animations. Liquids contain no symbols; screen-reader labels name their colors.
- The picker accepts levels 1–1,000 and stops at the final page. The last level shows a completion message rather than a link to a nonexistent next level.
- Ranked progress uses the separate `puzzle-craze.water-sort.ranked-v3` storage key. Previous collections' saves are retained untouched because level numbers now refer to different puzzles. Selected level, completions, boards, and the last 100 undo steps are saved locally and validated on load.

## Validation

Run `pnpm test`, `pnpm build`, and `pnpm format:check` from the repository root. Tests independently check shortest paths, normalized loops, losing cycles, move multiplicities, simultaneous pours, and animation conservation. Catalog tests rebuild every selected graph to verify its stored statistics, filters, ratio ordering within stages, color boundaries, deterministic reconstruction, unique normalized layout, and color conservation.

The page is `/games/water-sort/`; links and workers follow Vite's base path.
