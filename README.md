# Arrow Surgery

A fullscreen, colorful arrow-unblocking puzzle built with React, TypeScript, Vite, and pnpm. Includes a handcrafted introduction, a seeded generator for full boards and image silhouettes, synthesized sounds, smooth unwinding arrows, and a movable, zoomable board. Everything runs locally in the browser.

## Development

```sh
nix develop
pnpm install
pnpm dev
```

Open the local address printed by Vite (normally http://127.0.0.1:5173). The pinned flake provides Node 24, pnpm 11, and the TypeScript language server on Linux and macOS. If you use direnv, run `direnv allow` once to activate `.envrc`. Without Nix, install Node 24+ and pnpm 11.

```sh
pnpm test     # Rules, generation, masks, picking, and a million-point generation check
pnpm build    # Strict TypeScript check + production bundle in dist/
pnpm preview # Serve the production bundle locally
```

Only esbuild's install script is enabled in `pnpm-workspace.yaml`. Sound is generated locally through Web Audio after a player interaction. Muting is remembered in local storage. Fonts are bundled locally with system fallbacks; the game makes no third-party requests.

## Playing

- Click or tap an arrow directly, or up to 1½ grid spaces away. Between neighboring arrows with the same blocked/free status, the closer arrow wins (exact ties are resolved consistently). When one is blocked, the removable arrow is preferred until the click is within 20% of a one-cell gap from the blocked arrow, or within ¾ of a grid space when there is an empty grid point between them. These boundaries are measured from the arrows' grid lines. Distant ambiguous clicks do nothing. Direct hits target the arrow you touch, including blocked arrows. The reach follows the grid as you zoom, and hovering previews the selection. An arrow follows its path and exits in the direction its head points, provided no other arrow occupies that outgoing ray.
- **New puzzle** creates a fully filled rectangle, heart, cat, butterfly, or an uploaded color or black-and-white image. Set dimensions and a seed, then weave and play. Images are resized without changing their aspect ratio; Color is converted to grayscale. An automatic histogram cutoff separates the main shades and favors a low-density gap; a histogram, manual threshold slider, and inversion let you refine which points to fill. Automatic mode recalculates when the grid size changes; a manual cutoff stays put until you choose auto again. Transparent pixels stay empty. Generation runs in a cancellable worker. The preview reports and colors any small mask repairs before play. Save puzzle exports the level, masks, repairs, seed, settings, and solution as JSON.
- A blocked arrow unwinds toward the nearest blocker, glows red on contact, and retraces its path. It stays red and queued, then automatically launches as soon as its path opens. Multiple queued arrows can release in a chain. Clearing a blocker during the attempt continues the flight smoothly from its current position. You start with three lives; each newly blocked selection costs one. Repeated taps on an already queued arrow cost nothing. The third mistake ends the game after the impact animation, with retry, new-puzzle, and a discreet continue option that restores three lives while keeping your board and queue. There is no time limit.
- Drag to pan; scroll or pinch to zoom. Zoom stays anchored under your pointer. Use the fit button to recenter.
- Undo reverses the last click, including its entire automatic chain, or cancels a queued selection. Before you run out of lives, it restores the previous queue alongside its blockers and refunds that move’s life; the latest 128 steps are retained to bound history memory on large boards. Continuing after a loss starts a fresh undo history while preserving the total mistake count. Restart clears the queue and all motion, and restores the level and view. A hint highlights an available arrow and brings it into view.
- Keyboard: `Tab` to an arrow and `Enter`/`Space` to launch. `H` hint, `U` undo, `R` restart, `M` sound, `F` fullscreen, `0` fit, `+`/`-` zoom. Help, the puzzle maker, and completion dialogs support Escape; the loss dialog requires an explicit choice.
- Large boards use Canvas. Tab to the board, use the arrow keys to select and center an arrow, and press Enter or Space to launch. SVG remains in use for smaller puzzles. Overview rendering simplifies tiny arrows; zooming restores their heads and details.
- The board viewport reaches all four screen edges, with controls floating above it. The layout adapts to touch screens and honors reduced-motion preferences. Winning highlights New puzzle above the secondary Play again action.

## Level format (version 1)

The starting map is `src/levels/first-light.json`. Types are in `src/game/types.ts`; `parseLevel()` validates imported JSON before use.

```json
{
  "version": 1,
  "id": "example",
  "name": "A clear path",
  "description": "One small beginning.",
  "difficulty": "easy",
  "grid": { "columns": 5, "rows": 4 },
  "arrows": [
    {
      "id": "one",
      "color": "teal",
      "points": [
        [0, 2],
        [0, 0],
        [2, 0]
      ]
    },
    {
      "id": "two",
      "color": "coral",
      "points": [
        [3, 0],
        [3, 2],
        [4, 2]
      ]
    }
  ]
}
```

Coordinates are integer `[x,y]` pairs with `(0,0)` at the top left; x increases rightward and y downward. Points run **from tail to head**. Each pair of consecutive points describes a nonzero horizontal or vertical segment. Corners are sufficient: intermediate cells along straight segments are inferred. The last segment determines the launch direction.

IDs must be unique. Paths must remain in bounds and may neither overlap another path nor visit a cell twice. Colors: `violet`, `coral`, `teal`, `gold`, `blue`, `pink`. Difficulty: `easy`, `medium`, `hard`. Grid dimensions: 1–1,024 points per axis. An arrow needs at least two adjacent points, so a 1×1 board cannot be generated.

The outgoing head ray is checked against every occupied cell of every other active arrow, including segment interiors. Tails follow their existing paths as heads extend, so a clear head ray suffices for escape. Removed arrows cease blocking immediately, allowing quick successive moves. The animation preserves total path length.

`solve()` returns a valid removal order or `null` for a deadlock. Removal can only open routes, so the greedy solver is complete for these rules. Validation rejects unsolvable levels. Linked row/column occupancy indexes accelerate ray checks, solving, and automatic chains; nearby-cell queries preserve the forgiving picking rules without scanning the entire board.

## Level generation

`src/generation/generator.ts` exports `generatePuzzle(input, onProgress?)`. Omit `mask` for a full rectangle, or provide a row-major array of 0/1 values of length `columns * rows`. Every enabled point is covered exactly once. The returned object contains `{ level, generation }`; masks in its metadata are stored as rows of `"0"`/`"1"` characters. The ordinary version-1 level is `result.level`.

```ts
const result = generatePuzzle({
  columns: 64,
  rows: 64,
  seed: 'my-cat',
  mask, // optional Uint8Array; 1 = occupied, 0 = empty
  length: 10, // desired average arrow length in points
  repair: true, // false requires an exact, unchanged mask
});
```

Generation carves escapable arrows out of the full mask, recording a legal removal order. Every result is independently checked for geometry, exact coverage, and solvability. Rectangles have a guaranteed serpentine-band fallback. Irregular masks have bounded attempts and small optional repairs; an unsuccessful search returns an error instead of an incomplete puzzle. See [generation design and limits](docs/level-generation.md) for details and measured scale checks.

## Structure

- `src/game/` — pure geometry/rules, validation, tests, and Web Audio sounds
- `src/levels/` — authored JSON maps
- `src/generation/` — mask conversion, deterministic generation, worker, and scale tests
- `src/hooks/useCamera.ts` — mouse/touch panning, cursor zoom, pinch zoom
- `src/components/Board.tsx`, `CanvasBoard.tsx` — SVG and Canvas arrows, picking, and animation
- `src/components/Generator.tsx` — shape/image controls, progress, repair preview, and export
- `src/App.tsx` — game state, feedback, controls, help, completion

Inspired by the arrow escape mechanic at https://arrowout.github.io/. All game code and visuals here are original.
