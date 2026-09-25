import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { advance, COLORS, direction, directionName, pathLength, roundedPath } from '../game/engine';
import type { Arrow, Level, Point } from '../game/types';
import type { useCamera } from '../hooks/useCamera';
import { ARROW_WIDTH, CELL_SIZE as CELL, headPath, shaftPoints } from '../game/arrowGeometry';
import { pickArrow } from '../game/hitTesting';
import { attemptDistance, impactGlow } from '../game/motion';
import type { BlockedAttempt, Flight } from '../game/motion';
import { PuzzleIndex } from '../game/puzzleIndex';
import { CanvasBoard } from './CanvasBoard';

const PALETTE = { ...COLORS, queued: { main: '#e52243', light: '#ff5141', name: 'Queued' } };
const SPARKS = [
  { x: -8, y: -9, toX: 0, toY: -26, delay: 0 },
  { x: -5, y: 8, toX: 8, toY: 23, delay: -0.55 },
  { x: -22, y: -5, toX: -32, toY: -20, delay: -1.1 },
  { x: -28, y: 5, toX: -38, toY: 20, delay: -1.65 },
];
export interface BoardProps {
  level: Level;
  removed: readonly string[];
  flights: Flight[];
  queued: readonly string[];
  attempts: BlockedAttempt[];
  hint: string | null;
  camera: ReturnType<typeof useCamera>;
  onTap: (id: string) => void;
  reducedMotion: boolean;
}

function ArrowShape({
  arrow,
  points,
  flying = false,
  queued = false,
  red = false,
  impact = 0,
  highlighted = false,
  obstructing = false,
  aimed = false,
  onTap,
}: {
  arrow: Arrow;
  points: Point[];
  flying?: boolean;
  queued?: boolean;
  red?: boolean;
  impact?: number;
  highlighted?: boolean;
  obstructing?: boolean;
  aimed?: boolean;
  onTap: (id: string) => void;
}) {
  const color = COLORS[arrow.color];
  const paint = `url(#color-${red ? 'queued' : arrow.color})`;
  const [dx, dy] = direction(arrow);
  const head = points.at(-1)!;
  const path = roundedPath(points);
  const shaft = roundedPath(shaftPoints(points));
  const activateAccessibly = () => {
    if (flying) return;
    onTap(arrow.id);
    requestAnimationFrame(() => {
      if (document.activeElement === document.body)
        document.querySelector<SVGGElement>('.arrow[role="button"]')?.focus();
    });
  };
  return (
    <g
      className={`arrow ${flying ? 'flying' : ''} ${red ? 'queued' : ''} ${highlighted ? 'hinted' : ''} ${obstructing ? 'obstructing' : ''} ${aimed ? 'aimed' : ''}`}
      style={
        {
          '--arrow-color': red ? PALETTE.queued.main : color.main,
          '--impact': impact,
        } as CSSProperties
      }
      data-arrow={flying ? undefined : arrow.id}
      data-state={flying ? 'flying' : queued ? 'queued' : 'idle'}
      role={flying ? undefined : 'button'}
      tabIndex={flying ? undefined : 0}
      aria-label={
        flying
          ? undefined
          : `${color.name} arrow ${arrow.id}, pointing ${directionName(arrow)}${queued ? ', queued for automatic launch' : ''}`
      }
      aria-hidden={flying || undefined}
      onClick={(event) => {
        if (event.detail === 0) activateAccessibly();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateAccessibly();
        }
      }}
    >
      <path className="arrow-halo" d={path} />
      <g className="arrow-ink">
        <path className="arrow-line" d={shaft} stroke={paint} strokeWidth={ARROW_WIDTH} />
        <path className="arrow-head" d={headPath(head, [dx, dy])} style={{ fill: paint }} />
      </g>
      {red && !flying && (
        <g
          className="queued-sparks"
          aria-hidden="true"
          transform={`translate(${head[0]} ${head[1]}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`}
        >
          {SPARKS.map((spark, index) => (
            <g
              key={index}
              className="queued-spark"
              style={
                {
                  '--spark-x': `${spark.x}px`,
                  '--spark-y': `${spark.y}px`,
                  '--spark-to-x': `${spark.toX}px`,
                  '--spark-to-y': `${spark.toY}px`,
                  '--spark-delay': `${spark.delay}s`,
                } as CSSProperties
              }
            >
              {index % 2 === 0 ? <path d="M -3 0 H 3 M 0 -3 V 3" /> : <circle r="1.8" />}
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

export function Board(props: BoardProps) {
  return props.level.arrows.length > 500 ||
    props.level.grid.columns * props.level.grid.rows > 16000 ? (
    <CanvasBoard {...props} />
  ) : (
    <SvgBoard {...props} />
  );
}

function SvgBoard({
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
  const [now, setNow] = useState(0);
  const [aimed, setAimed] = useState<string | null>(null);
  const { size, camera: view } = camera;
  const fit = Math.max(
    0.0001,
    Math.min(
      (size.width - 70) / Math.max(CELL, (level.grid.columns - 1) * CELL),
      (size.height - 62) / Math.max(CELL, (level.grid.rows - 1) * CELL),
      1.18,
    ),
  );
  const scale = fit * view.zoom;
  const offsetX = ((level.grid.columns - 1) * CELL) / 2;
  const offsetY = ((level.grid.rows - 1) * CELL) / 2;
  const active = level.arrows.filter((arrow) => !removed.includes(arrow.id));
  const index = useMemo(() => {
    const value = new PuzzleIndex(level.arrows, level.grid);
    removed.forEach((id) => value.remove(id));
    return value;
  }, [level, removed]);
  const pickAt = ([clientX, clientY]: Point) => {
    const rect = camera.ref.current!.getBoundingClientRect();
    const point: Point = [
      (clientX - rect.left - size.width / 2 - view.x) / scale + offsetX,
      (clientY - rect.top - size.height / 2 - view.y) / scale + offsetY,
    ];
    return pickArrow(point, index.near(point), (arrow) => !index.hit(arrow));
  };
  const animating = flights.length > 0 || attempts.length > 0;
  useEffect(() => {
    if (!animating) return;
    let frame: number;
    const tick = (time: number) => {
      setNow(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animating]);

  return (
    <div ref={camera.ref} className="board-shell">
      <svg
        className={`board ${camera.dragging ? 'dragging' : ''} ${aimed && active.some((arrow) => arrow.id === aimed) ? 'aiming' : ''}`}
        aria-label="Puzzle board. Activate an arrow to send it out. Drag to pan and scroll to zoom."
        {...camera.pointerHandlers}
        onPointerMove={(event) => {
          camera.pointerHandlers.onPointerMove(event);
          setAimed(
            event.buttons === 0 && event.pointerType !== 'touch'
              ? (pickAt([event.clientX, event.clientY])?.id ?? null)
              : null,
          );
        }}
        onPointerLeave={() => setAimed(null)}
        onPointerUp={(event) => {
          const point = camera.pointerHandlers.onPointerUp(event);
          if (!point) return;
          const arrow = pickAt(point);
          setAimed(null);
          if (arrow) onTap(arrow.id);
        }}
      >
        <defs>
          <pattern id="grid-pattern" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <circle r="1.7" className="grid-dots" />
          </pattern>
          {Object.entries(PALETTE).map(([key, color]) => (
            <linearGradient
              key={key}
              id={`color-${key}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={(level.grid.columns - 1) * CELL}
              y2={(level.grid.rows - 1) * CELL}
            >
              <stop offset="0%" stopColor={color.light} />
              <stop offset="100%" stopColor={color.main} />
            </linearGradient>
          ))}
        </defs>
        <g
          transform={`translate(${size.width / 2 + view.x} ${size.height / 2 + view.y}) scale(${scale}) translate(${-offsetX} ${-offsetY})`}
        >
          <rect
            x={-CELL}
            y={-CELL}
            width={(level.grid.columns + 1) * CELL}
            height={(level.grid.rows + 1) * CELL}
            fill="url(#grid-pattern)"
            aria-hidden="true"
          />
          {active.map((arrow) => {
            const attempt = attempts.find((item) => item.id === arrow.id);
            const points: Point[] = arrow.points.map(([x, y]) => [x * CELL, y * CELL]);
            const waiting = queued.includes(arrow.id);
            const red =
              waiting && (!attempt || reducedMotion || now >= attempt.started + attempt.outward);
            return (
              <ArrowShape
                key={arrow.id}
                arrow={arrow}
                points={
                  attempt && !reducedMotion
                    ? advance(points, attemptDistance(attempt, now) * CELL)
                    : points
                }
                queued={waiting}
                red={red}
                impact={attempt ? impactGlow(attempt, now) : 0}
                obstructing={attempts.some(
                  (item) => item.by === arrow.id && impactGlow(item, now) > 0,
                )}
                highlighted={hint === arrow.id}
                aimed={aimed === arrow.id}
                onTap={onTap}
              />
            );
          })}
          {flights.map((flight) => {
            const arrow = level.arrows.find((item) => item.id === flight.id)!;
            const points: Point[] = arrow.points.map(([x, y]) => [x * CELL, y * CELL]);
            const progress = Math.max(0, Math.min(1, (now - flight.started) / flight.duration));
            const exitDistance =
              pathLength(points) +
              (Math.hypot(size.width, size.height) + Math.hypot(view.x, view.y)) / scale +
              offsetX +
              offsetY;
            return (
              <g key={flight.id} opacity={reducedMotion ? 1 - progress : 1}>
                <ArrowShape
                  arrow={arrow}
                  points={
                    reducedMotion
                      ? points
                      : advance(
                          points,
                          flight.fromDistance * CELL +
                            (exitDistance - flight.fromDistance * CELL) * progress * progress,
                        )
                  }
                  flying
                  queued={flight.queued}
                  red={flight.queued}
                  onTap={onTap}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
