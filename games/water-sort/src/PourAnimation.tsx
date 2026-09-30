import type { CSSProperties } from 'react';
import { Tube } from './Tube';
import type { ActivePour } from './game/pours';

import { pourTimeline } from './game/pourTimeline';
export type AnimatedPour = ActivePour & {
  id: number;
  liquid: number[];
  amount: number;
  startedAt: number;
  x: number;
  y: number;
  startY: number;
  style: CSSProperties;
  stream: CSSProperties;
};

export function PourAnimation({ pour, now }: { pour: AnimatedPour; now: number }) {
  const phase = pourTimeline(pour.startedAt, now);

  return (
    <div
      className="water-animation"
      data-pour-side={pour.side}
      data-pour-from={pour.move.from}
      data-pour-to={pour.move.to}
      aria-hidden="true"
    >
      <div
        className="water-flying-tube"
        style={{
          ...pour.style,
          transform: `translate(${pour.x * phase.travel}px, ${pour.y * phase.travel + pour.startY * phase.lift}px) rotate(${(pour.side === 'left' ? 105 : -105) * phase.travel}deg)`,
        }}
      >
        <Tube liquid={pour.liquid} amount={pour.liquid.length - pour.amount * phase.transferred} />
      </div>
      <div
        className="water-stream"
        style={{
          ...pour.stream,
          opacity: phase.stream * 0.9,
          transform: `scaleY(${phase.stream})`,
        }}
      />
    </div>
  );
}
