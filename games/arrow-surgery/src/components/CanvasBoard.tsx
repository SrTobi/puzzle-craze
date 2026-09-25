import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardProps } from './Board';
import { advance, COLORS, direction, directionName, pathLength, roundedPath } from '../game/engine';
import { ARROW_WIDTH, CELL_SIZE as CELL, headPath, shaftPoints } from '../game/arrowGeometry';
import { PuzzleIndex } from '../game/puzzleIndex';
import { pickArrow } from '../game/hitTesting';
import { attemptDistance, impactGlow } from '../game/motion';
import type { Arrow, Point } from '../game/types';
import { boardFit } from '../game/cameraBounds';

export function CanvasBoard({
  level,
  removed,
  flights,
  queued,
  attempts,
  hint,
  camera,
  onTap,
  reducedMotion,
}: BoardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const motion = useRef<HTMLCanvasElement>(null);
  const [aimed, setAimed] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const { size, camera: view } = camera;
  const fit = boardFit(level.grid, size);
  const scale = fit * view.zoom;
  const offsetX = ((level.grid.columns - 1) * CELL) / 2,
    offsetY = ((level.grid.rows - 1) * CELL) / 2;
  const tx = size.width / 2 + view.x - offsetX * scale,
    ty = size.height / 2 + view.y - offsetY * scale;
  const index = useMemo(() => {
    const value = new PuzzleIndex(level.arrows, level.grid);
    removed.forEach((id) => value.remove(id));
    return value;
  }, [level, removed]);
  const shapes = useMemo(
    () =>
      level.arrows.map((arrow) => {
        const points: Point[] = arrow.points.map(([x, y]) => [x * CELL, y * CELL]);
        let left = Infinity,
          top = Infinity,
          right = -Infinity,
          bottom = -Infinity;
        for (const [x, y] of points) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
        return {
          arrow,
          points,
          line: new Path2D(roundedPath(shaftPoints(points))),
          head: new Path2D(headPath(points.at(-1)!, direction(arrow))),
          path: new Path2D(roundedPath(points)),
          left,
          top,
          right,
          bottom,
          length: pathLength(points),
        };
      }),
    [level],
  );
  const queuedSet = useMemo(() => new Set(queued), [queued]);
  const attempting = useMemo(() => new Set(attempts.map((a) => a.id)), [attempts]);
  const active = useMemo(() => level.arrows.filter((_, i) => index.alive[i]), [level, index]);
  const selected = (keyboard && active.find((a) => a.id === keyboard)) || active[0];
  const pick = ([x, y]: Point) => {
    const rect = camera.ref.current!.getBoundingClientRect();
    const point: Point = [(x - rect.left - tx) / scale, (y - rect.top - ty) / scale];
    return pickArrow(point, index.near(point), (arrow) => !index.hit(arrow));
  };
  const setup = (element: HTMLCanvasElement) => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(size.width * ratio)),
      height = Math.max(1, Math.round(size.height * ratio));
    if (element.width !== width) element.width = width;
    if (element.height !== height) element.height = height;
    const ctx = element.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * tx, ratio * ty);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  };
  const visible = (shape: (typeof shapes)[number]) =>
    shape.right * scale + tx > -30 &&
    shape.left * scale + tx < size.width + 30 &&
    shape.bottom * scale + ty > -30 &&
    shape.top * scale + ty < size.height + 30;
  const halo = (ctx: CanvasRenderingContext2D, path: Path2D, color: string, opacity: number) => {
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = 23;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  };
  useEffect(() => {
    const ctx = setup(canvas.current!);
    if (scale * CELL > 12) {
      ctx.fillStyle = '#d8dcd1';
      const left = Math.max(0, Math.floor(-tx / scale / CELL)),
        right = Math.min(level.grid.columns - 1, Math.ceil((size.width - tx) / scale / CELL));
      const top = Math.max(0, Math.floor(-ty / scale / CELL)),
        bottom = Math.min(level.grid.rows - 1, Math.ceil((size.height - ty) / scale / CELL));
      ctx.beginPath();
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          ctx.moveTo(x * CELL + 2.625, y * CELL);
          ctx.arc(x * CELL, y * CELL, 2.625, 0, Math.PI * 2);
        }
      ctx.fill();
    }
    const batches = new Map<string, { line: Path2D; head: Path2D }>();
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i],
        id = shape.arrow.id;
      if (!index.alive[i] || attempting.has(id) || !visible(shape)) continue;
      const color = queuedSet.has(id) ? '#e52243' : COLORS[shape.arrow.color].main;
      if (queuedSet.has(id)) halo(ctx, shape.path, color, 0.16);
      let batch = batches.get(color);
      if (!batch) {
        batch = { line: new Path2D(), head: new Path2D() };
        batches.set(color, batch);
      }
      // At overview scales, continuous strokes read better than subpixel arrowheads.
      batch.line.addPath(scale > 0.13 ? shape.line : shape.path);
      if (scale > 0.13) batch.head.addPath(shape.head);
    }
    for (const [color, batch] of batches) {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(ARROW_WIDTH, 0.75 / scale);
      ctx.stroke(batch.line);
      ctx.fill(batch.head);
    }
  }, [shapes, index, queuedSet, attempting, scale, tx, ty, size]);

  useEffect(() => {
    let frame = 0;
    // Cap spark work in large queues; every queued arrow still stays red.
    const sparking =
      reducedMotion || scale < 0.35
        ? []
        : [...queuedSet]
            .map((id) => shapes[index.byId.get(id)!])
            .filter((s) => !attempting.has(s.arrow.id) && visible(s))
            .slice(0, 100);
    const draw = (now: number) => {
      const ctx = setup(motion.current!);
      for (const id of new Set([hint, aimed, focused ? selected?.id : null])) {
        if (!id) continue;
        const i = index.byId.get(id);
        if (i !== undefined && index.alive[i] && !attempting.has(id) && visible(shapes[i]))
          halo(
            ctx,
            shapes[i].path,
            queuedSet.has(id) ? '#e52243' : COLORS[shapes[i].arrow.color].main,
            0.23,
          );
      }
      const drawArrow = (arrow: Arrow, points: Point[], red: boolean, impact = 0, alpha = 1) => {
        const color = red ? '#e52243' : COLORS[arrow.color].main;
        if (red) halo(ctx, new Path2D(roundedPath(points)), color, 0.16 + impact * 0.3);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = ARROW_WIDTH;
        ctx.stroke(new Path2D(roundedPath(shaftPoints(points))));
        ctx.fill(new Path2D(headPath(points.at(-1)!, direction(arrow))));
        ctx.globalAlpha = 1;
      };
      for (const attempt of attempts) {
        const shape = shapes[index.byId.get(attempt.id)!];
        const distance = reducedMotion ? 0 : attemptDistance(attempt, now) * CELL;
        drawArrow(
          shape.arrow,
          advance(shape.points, distance),
          reducedMotion || now >= attempt.started + attempt.outward,
          impactGlow(attempt, now),
        );
      }
      for (const flight of flights) {
        const shape = shapes[index.byId.get(flight.id)!];
        const progress = Math.max(0, Math.min(1, (now - flight.started) / flight.duration));
        const exit =
          shape.length +
          (Math.hypot(size.width, size.height) + Math.hypot(view.x, view.y)) / scale +
          offsetX +
          offsetY;
        const points = reducedMotion
          ? shape.points
          : advance(
              shape.points,
              flight.fromDistance * CELL +
                (exit - flight.fromDistance * CELL) * progress * progress,
            );
        // Ignore arrows whose animated geometry has already left the viewport.
        let left = Infinity,
          top = Infinity,
          right = -Infinity,
          bottom = -Infinity;
        for (const [x, y] of points) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
        if (
          right * scale + tx < -CELL ||
          left * scale + tx > size.width + CELL ||
          bottom * scale + ty < -CELL ||
          top * scale + ty > size.height + CELL
        )
          continue;
        drawArrow(shape.arrow, points, flight.queued, 0, reducedMotion ? 1 - progress : 1);
      }
      for (let i = 0; i < sparking.length; i++) {
        const shape = sparking[i],
          head = shape.points.at(-1)!;
        const [dx, dy] = direction(shape.arrow);
        for (let j = 0; j < 3; j++) {
          const t = (now / 1700 + j / 3 + i * 0.13) % 1;
          if (t > 0.6) continue;
          const along = -8 - t * 25,
            across = (j % 2 ? -1 : 1) * (8 + t * 18);
          ctx.globalAlpha = (1 - t / 0.6) * 0.9;
          ctx.fillStyle = j % 2 ? '#ff713f' : '#e52243';
          ctx.beginPath();
          ctx.arc(
            head[0] + along * dx - across * dy,
            head[1] + along * dy + across * dx,
            1.8,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (flights.length || attempts.length || sparking.length) frame = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [
    shapes,
    index,
    queuedSet,
    attempting,
    attempts,
    flights,
    reducedMotion,
    scale,
    tx,
    ty,
    size,
    hint,
    aimed,
    focused,
    selected?.id,
  ]);

  return (
    <div
      ref={camera.ref}
      className={`board-shell canvas-board ${camera.dragging ? 'dragging' : ''} ${aimed ? 'aiming' : ''}`}
      {...camera.pointerHandlers}
      onPointerMove={(event) => {
        camera.pointerHandlers.onPointerMove(event);
        setAimed(
          event.buttons === 0 && event.pointerType !== 'touch'
            ? (pick([event.clientX, event.clientY])?.id ?? null)
            : null,
        );
      }}
      onPointerLeave={() => setAimed(null)}
      onPointerUp={(event) => {
        const point = camera.pointerHandlers.onPointerUp(event);
        if (point) {
          const arrow = pick(point);
          if (arrow) {
            setKeyboard(arrow.id);
            onTap(arrow.id);
          }
        }
        setAimed(null);
      }}
    >
      <canvas
        ref={canvas}
        className="board"
        tabIndex={0}
        role="group"
        aria-label="Puzzle board. Drag to pan, scroll to zoom. Use arrow keys to choose an arrow and Enter to launch it."
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            if (!active.length) return;
            const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
            const at = selected ? active.indexOf(selected) : 0;
            const next = active[(at + offset + active.length) % active.length];
            setKeyboard(next.id);
            const head = next.points.at(-1)!;
            camera.focusPoint([head[0] * CELL, head[1] * CELL], [offsetX, offsetY], fit);
          } else if ((event.key === 'Enter' || event.key === ' ') && selected) {
            event.preventDefault();
            onTap(selected.id);
          }
        }}
      />
      <canvas ref={motion} className="motion-canvas" aria-hidden="true" />
      {focused && (
        <div className="canvas-selection" role="status">
          {selected
            ? `${COLORS[selected.color].name} arrow ${selected.id}, pointing ${directionName(selected)}${queuedSet.has(selected.id) ? ', queued' : index.hit(selected) ? ', blocked' : ', clear'}. Arrow keys to choose · Enter to launch.`
            : 'All clear.'}
        </div>
      )}
    </div>
  );
}
