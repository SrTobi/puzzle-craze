# Logic Snake

A browser adaptation of the Flutter `logic_snake_puzzle` project, with a new interface in the visual style of Arrow Surgery: warm paper, sage paths, soft colors, Manrope/DM Sans, and quiet controls.

Play at `/games/logic-snake/`. Run the shared development, test, and build commands from the repository root.

## Tutorials

New players begin with three guided levels before the original collection:

1. **Meet in the middle** — one missing segment between two endpoints, with no empty cells.
2. **A little detour** — mark one cell empty, then connect the endpoints around it.
3. **Room for two** — use a fixed clue and create empty regions of sizes 1 and 2.

The guide points an arrow at the next cell, highlights the needed marking tool, and explains each move. Players can hide guidance and solve freely. Prompts follow the actual board, including after undo, restart, or reload. The tutorials are levels 1–3 in the normal list, followed by the original puzzles as levels 4–16. Original puzzle IDs and saved boards remain unchanged. Existing players can open levels 1–3 in the puzzle picker or use the tutorial link in **How to play**.

## Rules

- Connect the two fixed endpoints with one continuous snake using edge-adjacent cells. Each endpoint has exactly one snake neighbor; each body cell has exactly two. No branches, self-touching along edges, or disconnected loops. Diagonal contact is allowed.
- Empty cells connected along edges form a region; the board edge also bounds a region. Crossing them out is optional: a completed snake wins as soon as all remaining cells form the required regions, and those cells are shown as empty automatically.
- Create exactly one empty region of each required size. The tutorials start with none, then size 1, then sizes 1–2. The original collection uses sizes 1–6 on a 7×7 board and 1–7 on an 8×8 board.
- Locked cells are starting clues. A region receives a number when it no longer touches an unknown cell. Coral marks a rule conflict.

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
