# Sudoku

A familiar puzzle with new possibilities. Open `/games/sudoku/` from the collection page.

## Rules and progression

Fill every cell with a number from 1 to the board's size. Each row, column, and outlined region contains every number exactly once. The 18-level collection starts with gentle classic 9×9 puzzles, introduces individual features on small boards, then combines them. Each level has an explanation and feature badges in the level picker. All levels are available immediately; completion is tracked separately.

| Feature   | Rule                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sizes     | 4×4 uses 1–4; 6×6 uses 1–6; 9×9 uses 1–9; 12×12 uses 1–12.                                                                                                                                                                         |
| Boxes     | Regular regions are 2×2, 2×3, 3×3, or 3×4 respectively.                                                                                                                                                                            |
| Jigsaw    | Connected regions replace boxes. Each region still contains exactly as many cells as there are numbers. Follow the thick outlines.                                                                                                 |
| Colors    | Each color group contains every number once, in addition to the other rules. Groups have letters A/B/C as well as colors; uncolored cells have no color constraint. There are two groups on 4×4 boards and three on larger boards. |
| Diagonals | Both dotted corner-to-corner diagonals contain every number once.                                                                                                                                                                  |

## Controls

- Select a cell, then use the number pad or type a number. Given numbers cannot be edited.
- Switch **Input order** to **Number first** to choose a number and place it in multiple cells by clicking. The active number stays selected and its existing entries are highlighted. This also works with pencil marks. Arrow-key navigation only moves focus; Enter or Space places the chosen number. Switching puzzles clears the chosen number, while your input-order preference is remembered across levels and reloads.
- Arrow keys move between cells; Home/End move to the first/last cell in a row.
- On 12×12 boards, A/B/C enter **10/11/12**. These remain decimal numbers on the board.
- N toggles pencil marks. Entering a number removes that candidate from notes in its row, column, region, and any active color/diagonal groups.
- Delete, Backspace, or 0 erases the selected cell.
- Ctrl/Cmd Z undoes; Ctrl/Cmd Shift Z or Ctrl/Cmd Y redoes. Keyboard controls apply while a board cell has focus.
- Hints explain naked or hidden singles, flag entries inconsistent with the unique solution, or explicitly offer a reveal if no single is available. Hints never place a number without an additional click.
- Repeated numbers show a conflict marker, including repeats in color groups or diagonals. Filling the grid only wins when every active rule is satisfied.
- Restart clears the puzzle and can itself be undone.

Progress, notes, history (up to 100 steps), completions, and the latest custom puzzle are stored locally under `puzzle-craze.sudoku.v1`. Saved data is validated; unavailable browser storage does not prevent play. Switching campaign levels preserves their individual runs. Creating a new custom puzzle replaces the previous custom slot.

## Custom generator

Choose any supported size, rectangular or jigsaw regions, optional color groups and diagonals, clue density, and a seed. The same seed and settings produce the same puzzle for this generator version. Generation runs in a cancellable Web Worker. Closing the dialog terminates it; long-running generation is bounded and reports an error rather than silently dropping a rule.

The generator first creates a full solution. For jigsaws it trades equal-valued boundary cells between neighboring regions while keeping both regions connected and maintaining their size. It assigns one occurrence of each number to each color group, then removes clues only when a bounded solver proves there is exactly one solution. Exhausting the solver's node budget never counts as proof of uniqueness.

Gentle puzzles additionally have a complete solving path using naked and hidden singles. Balanced and sparse settings target lower clue counts, not a formal difficulty rating; the rules and uniqueness requirements may leave more clues than the target. All rules can be combined.

The campaign is generated ahead of time and checked in, so playing it never waits for generation:

```sh
pnpm sudoku:levels       # Rebuild from src/game/catalog.ts (Node 24+)
pnpm exec prettier --write games/sudoku/src/game/levels.json
pnpm exec vitest run games/sudoku
```

Tests cover every size/region/color/diagonal combination, unique campaign solutions, reproducible seeds, connected regions, gentle solving paths, rule-specific conflicts, notes, undo/redo, and saved-data recovery.
