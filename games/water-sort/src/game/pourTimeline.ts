export const POUR_DURATION = 1200;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

export function pourTimeline(startedAt: number, now: number) {
  const progress = clamp((now - startedAt) / POUR_DURATION);
  return {
    progress,
    // Transfer only while the bottle is tilted and the stream is visible.
    transferred: clamp((progress - 0.32) / 0.4),
    travel: progress < 0.32 ? ease(progress / 0.32) : 1 - ease(clamp((progress - 0.76) / 0.24)),
    lift: 1 - ease(clamp(progress / 0.32)),
    stream: Math.min(clamp((progress - 0.32) / 0.04), clamp((0.76 - progress) / 0.04)),
  };
}

export function visibleAmount(
  finalAmount: number,
  incoming: { amount: number; startedAt: number }[],
  now: number,
) {
  return (
    finalAmount -
    incoming.reduce(
      (remaining, pour) =>
        remaining + pour.amount * (1 - pourTimeline(pour.startedAt, now).transferred),
      0,
    )
  );
}
