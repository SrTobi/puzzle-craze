# Logic Snake

A browser adaptation of the Flutter `logic_snake_puzzle` project, with a new interface in the visual style of Arrow Surgery: warm paper, sage paths, soft colors, Manrope/DM Sans, and quiet controls.

Play at `/games/logic-snake/`. Run the shared development, test, and build commands from the repository root.

## Tutorials

New players begin with three guided levels before the original collection:

1. **Meet in the middle** — one missing segment between two endpoints, with no empty cells.
2. **A little detour** — mark one cell empty, then connect the endpoints around it.
3. **Room for two** — use a fixed clue and create empty regions of sizes 1 and 2.

The guide points an arrow at the next cell, highlights the needed marking tool, and explains each move. Players can hide guidance and solve freely. Prompts follow the actual board, including after undo, restart, or reload. The tutorials are levels 1–3 in the normal list, followed by the original puzzles as levels 4–16. Six larger puzzles with sparse numbered clues follow as levels 17–22 (6×6 through 8×8), then twelve puzzles mixing plain and numbered empty clues at levels 23–34. Original puzzle IDs and saved boards remain unchanged. Existing players can open levels 1–3 in the puzzle picker or use the tutorial link in **How to play**.

## Rules

- Connect the two fixed endpoints with one continuous snake using edge-adjacent cells. Each endpoint has exactly one snake neighbor; each body cell has exactly two. No branches, self-touching along edges, or disconnected loops. Diagonal contact is allowed.
- Empty cells connected along edges form a region; the board edge also bounds a region. Crossing them out is optional: a completed snake wins as soon as all remaining cells form the required regions, and those cells are shown as empty automatically.
- Create exactly one empty region of each required size. The tutorials start with none, then size 1, then sizes 1–2. The original collection uses sizes 1–6 on a 7×7 board and 1–7 on an 8×8 board.
- Locked cells are starting clues. A **circled number** is a fixed empty cell: its region must have exactly that many cells, including the clue itself. It stays visible before the region is finished and when the region is invalid. Uncircled numbers show the actual size of a finished region. Coral marks a rule conflict.
- Regions containing different numbered clues cannot join. A region may contain several clues with the same number. All regions must still satisfy the global one-of-each-size rule.

The implementation retains all 13 original JSON puzzles, including their clues, recorded solution orders, and author attribution. It implements the ascending region-size policy used by those assets. The Flutter prototype's unfinished fixed-size policy is not used by any bundled puzzle.

## Controls

Choose **Snake**, **Empty**, or **Erase**, then click/tap cells. Selecting the same mark again clears it. Right-click or Shift-click marks empty. Keyboard shortcuts: `S` snake, `E` empty, `X` erase, `U` undo, `H` hint, `Ctrl/Cmd+Z` undo, and `Ctrl/Cmd+Shift+Z` redo. Tab to a cell, navigate with arrow keys, and mark with Space/Enter.

Hints offer one cell from the original solution, prioritizing incorrect marks, then following the recorded solve order. They are optional and must be applied explicitly. Completion checks the rules rather than equality with the stored solution.

Undo/redo covers marks, applied hints, and restart. Up to 150 edits are retained for the current puzzle session. Switching puzzles or reloading starts a new undo history. Boards, the selected puzzle, and completion badges are saved in local storage under `puzzle-craze.logic-snake.v1`. If storage is unavailable, play continues in memory with an on-screen notice.

## Source layout

- `src/game/engine.ts`: marking, adjacency, region analysis, snake validation, hints, and undo/redo.
- `src/game/levels.ts`: loads the original JSON format, assigns collection titles, and places tutorials first.
- `src/game/tutorials.ts`: three introductory puzzles and board-driven guidance.
- `src/game/tutorials.test.ts`: tutorial solutions, guided progression, undo/reload behavior, and compatibility with existing saves.
- `src/game/storage.ts`: validates saved boards and restores fixed clues.
- `src/game/engine.test.ts`: all imported solutions and correct partial states, invalid topology, region rules, editing, history, and saved-state recovery.
- `src/components/`: board rendering and accessible native dialogs.
- `src/App.tsx`: play screen, collection, instructions, progress, and persistence.
- `src/styles.css`: responsive game-specific design; shared fonts and base styles come from `shared/`.

## Generate more numbered puzzles

Generation runs locally in this web repository with Node 24. Version 3 ported the Rust generator's **solve, reveal a clue, keep solving** strategy to TypeScript and extended it with numbered empty cells. Version 4 adds randomized plain empty clues alongside numbered clues. The historical Rust files are unchanged.

1. Choose random endpoints and construct a complete board by applying forced assignments, then backtracking over snake/empty assignments when stuck. This replaces the earlier random path growth.
2. Starting with the endpoints, run the deduction solver. When stuck, try up to eight shuffled empty-cell positions. For each new position, randomly choose a plain empty clue or a numbered empty clue (50% chance each by default). An existing plain clue can be upgraded to a numbered clue in a later trial. Solve each proposed puzzle from its givens, then keep the clue that unlocks the most progress, or the first that solves it. A region does not need its own clue; a known empty cell can also gain a number. Both types remain fixed empty cells in play. A plain clue reveals no required region size; it keeps the normal cross until its region is finished.
3. Continue until the solver completes the board at the permitted assumption depth. Try removing clues again, but keep a removal **only if the same deduction solver still finishes**. Version 4 first tries downgrading each number to a plain empty clue, then removing unnecessary plain clues. At least one empty clue is retained, but no numbered clue is required. Uniqueness alone is not the clue-selection criterion.
4. Record the shallowest successful depth and every forced move. Independently enumerate legal snake paths to verify exactly one solution. This separate search prunes unreachable endpoints and impossible empty regions; it does not choose the clues.

### Deduction solver

`fillObvious` repeatedly checks whether each unknown cell may be snake or empty. It commits a value only when the other value violates a constraint. Checks cover snake degrees, loops, premature endpoint connection, the total empty-cell requirement, region sizes, duplicate finished sizes, and numbered regions.

When forced moves stop, the solver temporarily assigns a cell and propagates the consequences. It commits the opposite value only if that hypothesis leads to a contradiction within the depth limit. Finding a successful branch is **not** accepted as proof that its first move is forced. Nested assumptions stay adjacent to the last assumed cell, following the Rust solver's local lookahead strategy.

- Depth **0**: immediate constraint deductions only.
- Depth **1** (default): one hypothetical assignment followed by forced moves.
- Depth **2**: up to two nested hypothetical assignments, each followed by forced moves.

The outer hypothesis counts toward this depth; this convention is not numerically identical to the Rust `max_assume_depth` argument. The port recomputes components on small typed-array boards rather than porting Rust's union-find structures. Clue selection uses a bounded, randomized candidate set rather than Rust's frontier of up to 100 intermediate states. These are deliberate implementation differences, not a claim of a line-for-line port.

The solver receives only the fixed clues and a partial board; tests replace the hidden solution with unknown cells and verify unchanged deductions. Generated `moves` now follow the actual deduction trace, rather than snake-path order. Exports include each move's value, depth, and reason plus the shallowest successful depth, forced/lookahead move counts, constraint checks, and clue trials. These are solver-relative difficulty measures, not a calibrated human difficulty rating.

```sh
pnpm generate:logic-snake --seed autumn-pack --count 12
# Only plain empty clues (no numbers):
pnpm generate:logic-snake --seed plain-pack --count 6 --numbered-clue-chance 0
# Require direct deductions, with no hypothetical lookahead:
pnpm generate:logic-snake --seed direct-pack --count 6 --max-assumption-depth 0
# Optional custom size and assumption limit:
pnpm generate:logic-snake --seed more-rooms --count 3 --width 6 --height 6 --top 5 --max-assumption-depth 1
```

The command writes JSON under `src/levels/numbered/`, automatically loaded after the original collection. Existing files are never overwritten. To reproduce the latest mixed-clue batch without changing playable assets:

```sh
node games/logic-snake/scripts/generate.ts --seed mixed-v4 --count 12 --out /tmp/logic-snake-reproduction
```

The six version-3 puzzles at levels 17–22 increase from 6×6 to 8×8, with 1, 1, 1, 2, 2, and 3 numbered clues. All six stall at depth 0 and finish at depth 1. Their one-level contradiction steps range from 1 to 16, with all remaining moves directly forced. Fresh IDs prevent saved marks from the previous generated batches being applied to changed boards; the original 13 puzzles and tutorials retain their IDs.

The additional version-4 batch at levels 23–34 also solves at depth 1, with four boards each at 6×6, 7×7, and 8×8. Three have only plain empty clues, two combine plain and numbered clues, and seven need numbered clues only after pruning. Earlier level IDs, boards, and numbering are preserved. `--numbered-clue-chance` accepts 0 through 1 and controls candidate selection; solver-based selection and pruning determine the final mix, so 0.5 does not promise half the final clues will have numbers. Seeds, generation version, and probability are stored for reproducibility; version-3 generation remains available programmatically via `generationVersion: 3`.

The generator accepts dimensions from 2 through 8. Layout construction has a two-million-constraint-check budget, each deduction attempt has a 250,000-check budget, and independent uniqueness verification has a two-million-path-node budget. Budget exhaustion is reported separately from contradiction, completion, or uniqueness. No puzzle is exported unless its final deduction solve and independent uniqueness verification both finish successfully. Failed generation requests should be retried with another seed or smaller board. Generation remains an offline command.

The original JSON format is extended with optional `region_clues` triples `[x, y, size]` using zero-based coordinates, and a `generation` object containing reproducibility and deduction data. Numbered cells must be empty in the solution and are also included in `initial_open`. Old puzzles without these extensions still load.

### Performance

Run `node games/logic-snake/scripts/benchmark.ts` to reproduce generation and solving measurements. The following measurements for the original six version-3 puzzles were collected locally on Node 24.13.0, using the median of three runs per puzzle after a solver warm-up. Generation includes layout construction, candidate clue trials, clue removal, difficulty assessment, and independent uniqueness verification. Solve time measures only solving the finished puzzle from its givens.

| Puzzle             | Board | Numbers | Depth | Forced / lookahead | Generate ms | Solve ms | Solver checks |
| ------------------ | ----- | ------: | ----: | -----------------: | ----------: | -------: | ------------: |
| Hidden rooms       | 6×6   |       1 |     1 |             29 / 4 |        23.6 |      3.9 |          8191 |
| Less to go on      | 6×6   |       1 |     1 |             32 / 1 |         9.9 |      0.2 |           384 |
| Between the bends  | 7×7   |       1 |     1 |            30 / 16 |       230.3 |     27.1 |         49565 |
| Long division      | 7×7   |       2 |     1 |             37 / 8 |       220.2 |      4.6 |          5195 |
| Uncharted corners  | 8×8   |       2 |     1 |             57 / 3 |      1232.8 |      3.3 |          3894 |
| The long way round | 8×8   |       3 |     1 |            47 / 12 |       491.0 |      7.8 |          7205 |

Times depend on hardware, seed, and system load; these measurements are not a Rust-versus-TypeScript comparison. Constraint-check counts are deterministic and stored with the puzzle.

- `src/generation/solver.ts`: forced assignments, bounded contradiction lookahead, and layout backtracking.
- `src/generation/generator.ts`: seeded clue trials, deduction-preserving clue removal, and independent uniqueness search.
- `src/generation/types.ts`: stored deduction trace and generation statistics.
- `scripts/generate.ts`: batch generation and safe JSON export.
- `scripts/benchmark.ts`: repeatable generation/solving benchmark.
- `src/game/level-format.ts`: original and numbered puzzle import/export.
- `src/generation/solver.test.ts`: exhaustive small-board validation, ambiguous-puzzle soundness, hidden-solution independence, and budget behavior.
- `src/generation/generator.test.ts`: reproducibility, deduction trace, depth controls, uniqueness, and independent brute-force comparisons.
