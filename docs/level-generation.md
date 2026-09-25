# Level generation requirements

Requirements and implementation notes for generator version 1. Open **New puzzle** to generate a level; the handcrafted First light introduction remains available.

## Coverage and shape

- Full coverage is the default: every grid point in a rectangular board belongs to exactly one arrow, including its head, body, or tail. An arrow normally spans multiple points; this does not mean one separate arrow per point.
- The generator must also accept an explicit binary mask with one value per grid point. Enabled points must be occupied exactly once; disabled points must remain empty. Full rectangular boards are simply masks with every point enabled.
- All intermediate points along straight arrow segments count toward coverage. Paths stay orthogonal, within bounds, and cannot overlap or revisit a point.
- Masks may contain holes, disconnected parts, narrow features, or non-square bounds. Empty points are empty space, not walls: an outgoing ray can cross a hole and hit an arrow in another part of the shape. Solvability must therefore be checked across the whole board.
- Color and black-and-white images of animals, objects, and other silhouettes are supported inputs. Image import should produce the same binary mask accepted by the generator, keeping image processing separate from puzzle construction.

## Mask repairs

Preserve the original mask whenever generation succeeds. Try alternative arrow partitions and orientations before changing the silhouette. Failing to generate within a search budget is not proof that a shape is impossible.

Small automatic mask repairs are allowed when needed. Prefer local edits that preserve recognizable features, such as joining an isolated point to a nearby part of the shape or adjusting a narrow connection. Under the current rules an arrow needs at least two adjacent points, so a one-point component cannot be covered exactly. Removing an isolated speck can also be reasonable when it is image noise rather than a meaningful detail.

Keep both the original and repaired masks and report the added/removed points. Bound the amount of repair; do not turn an awkward shape into an unrelated rectangle just to finish generation. If a suitable result cannot be found within the work and repair budgets, return a clear failure with diagnostics. A successful result must cover the repaired mask completely, without unexplained gaps.

## Implemented generation approach

The earlier idea of repeatedly adding random arrows with clear exit paths guarantees a removal order, but does not guarantee full coverage: it can strand unused points. It is not sufficient on its own for these requirements.

Generation starts with every enabled point occupied and partitions the mask while establishing its solution:

1. Maintain the exposed ends of occupied rows and columns. Choose a head with a clear outgoing ray and an adjacent body point behind it.
2. Carve a self-avoiding tail through remaining occupied points, favoring straight steps while allowing bends. Avoid steps that would strand multiple isolated leftovers; a single isolated neighbor becomes a forced continuation. Once the arrow is carved, record it as the next legal removal.
3. Repeat until the mask is covered. Retry unsuccessful partitions with deterministic randomness. Full rectangles fall back to narrow serpentine bands when needed; their exit rays stay inside their own bands, preserving a known solution without introducing gaps.
4. For irregular masks, try six unchanged-mask partitions first. Optional repairs then pair isolated leftovers by adding adjacent points, or trim thin dead ends and retry. The default edit budget is `max(2, floor(enabledPoints * 0.02))`, with at most twelve rounds and 28 total attempts. Full rectangles are never repaired. `repair: false` forbids edits, and `maxRepairs` overrides the irregular-mask budget.
5. Independently validate the final geometry, exact mask coverage, and solvability, then replay the recorded removal order to verify the witness. Output is committed to the game only after these checks pass.

This is a bounded heuristic for irregular shapes, not a complete decision procedure for whether any solution exists. A difficult mask can still return a useful error even if some other partition would work. The rectangular fallback can look more regular than a successful random carving. Difficulty scoring, candidate ranking, and local rerouting can be refined later; generated levels currently use the `medium` label without a calibrated difficulty guarantee.

Exports contain `{ level, generation }`. `level` uses the existing version-1 arrow format. `generation` stores original/final masks as binary strings per row, point repairs, seed, generator version, desired length, repair budget, solution order, and statistics including initial free arrows, attempts, and fallback use. Importing an image is local; resize preserves aspect ratio, grayscale threshold/inversion creates the binary mask, and transparent pixels stay disabled. Auto cutoff builds a 256-bin luminance histogram from opaque resized pixels, uses Otsu between-class variance to identify useful separations, then selects the center of the widest lowest-density interval within 98% of the best score. A seven-bin window suppresses tiny noisy gaps. Flat images use a deterministic fallback; a uniformly white image stays empty unless inverted. A histogram preview, manual slider, and auto reset expose the result for adjustment. Auto recomputes for a new image or grid size; manual adjustments persist across resizing.

## Large boards

The implemented limit is 1,024 points per axis (1,048,576 total points). This is a bounded working limit rather than a claim of unlimited grids or a frame-rate guarantee on every device.

- Generation and validation run in a Web Worker. Progress reports stages/attempts; cancellation terminates the worker and prevents stale results from replacing a puzzle.
- Typed arrays store masks, ownership, and linked occupied neighbors along rows/columns. Solving and automatic releases watch each arrow's current blocker and update affected arrows after departures. Undo retains 128 steps to bound history growth.
- Pointer picking queries nearby occupied points and uses the same distance and blocked/free preference rules as the original board. Blockers outside the pointer neighborhood are still considered through the global index.
- All rays and solutions are checked globally, including across holes and disconnected mask components.
- Boards with more than 500 arrows or 16,000 bounding-grid points use Canvas. Static paths are cached, drawn in color batches, and culled outside the viewport. Animation/hover uses a separate layer; tiny arrows use an overview representation. Smaller boards retain SVG, with a repeating grid pattern replacing one DOM node per point.
- Camera fit accounts for the entire board and supports up to 256× relative zoom. Hints and keyboard arrow navigation center and zoom to an arrow on large boards. Sparks are capped to 100 visible queued arrows and sound to twelve notes per release action; all arrows still release normally, and queued glow stays steady.

Measured in this development environment: a fully covered 1,024×1,024 rectangle with seed `million` and desired length 16 generated and validated in approximately four seconds, producing 65,651 arrows using the serpentine fallback. A 256×256 cat with seed `big-cat` generated in about one second, with 4,793 arrows and eleven reported removed points. Times vary with hardware, mask, seed, and memory pressure. Browser checks cover generation, image upload, repair reporting, and large-board rendering separately from these algorithm benchmarks.

## Acceptance checks

- Every enabled point in the final mask is covered exactly once, and every disabled point is empty.
- Every arrow is valid, and replaying the recorded removal order clears the entire board legally.
- An unchanged mask is attempted first; repairs stay local, within budget, and are reported. Disabling repair never silently changes the mask.
- Cover full rectangles, silhouettes, holes, separated components aligned along exit rays, thin branches, isolated points, empty masks, and very narrow grids. Empty or unsuitable inputs produce a useful result or diagnostic, never an invalid level.
- Keep the million-point generation test and browser scale checks. Further profiling should include peak memory and frame times on slower devices; their performance has not been characterized yet.
- A fixed seed, mask, settings, and generator version reproduce the same output. Cancellation and bounded failure work without leaving partial levels in play.

## Reference implementation

[sergev/goarrows](https://github.com/sergev/goarrows) is an MIT-licensed reference for growing arrow tails and rejecting unsolvable boards. Its [growth algorithm](https://github.com/sergev/goarrows/blob/main/game/gen_grow.go) and [acceptance policy](https://github.com/sergev/goarrows/blob/main/game/gen.go) are useful references, but its allowance for unused cells does not meet our full-coverage requirement by itself.
