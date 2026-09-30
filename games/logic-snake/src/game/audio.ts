import { analyze, type Cell, type Level } from './engine';

type Move = 'mark' | 'undo' | 'redo' | 'restart';
type Sound =
  'snake' | 'empty' | 'erase' | 'region' | 'conflict' | 'hint' | 'win' | Exclude<Move, 'mark'>;
type Note = [frequency: number, delay: number, duration: number, end?: number];

const sounds: Record<Sound, Note[]> = {
  snake: [[440, 0, 0.12, 587]],
  empty: [[740, 0, 0.09, 660]],
  erase: [[330, 0, 0.1, 220]],
  undo: [[392, 0, 0.12, 294]],
  redo: [[294, 0, 0.12, 392]],
  restart: [
    [392, 0, 0.1],
    [294, 0.08, 0.16],
  ],
  conflict: [[180, 0, 0.14, 140]],
  hint: [
    [659, 0, 0.18],
    [880, 0.1, 0.24],
  ],
  region: [
    [587, 0, 0.18],
    [784, 0.09, 0.25],
  ],
  win: [
    [523, 0, 0.35],
    [659, 0.12, 0.35],
    [784, 0.24, 0.4],
    [1047, 0.36, 0.6],
  ],
};

/** Select feedback for an actual player move, never for loading a saved board. */
export function moveSound(
  level: Level,
  before: Cell[],
  after: Cell[],
  move: Move = 'mark',
): Sound | null {
  const changed = after.findIndex((cell, i) => cell !== before[i]);
  if (changed === -1) return null;
  const previous = analyze(level, before);
  const next = analyze(level, after);
  if (next.solved && !previous.solved) return 'win';
  if (move !== 'mark') return move;
  if ([...next.errors].some((index) => !previous.errors.has(index))) return 'conflict';
  if (!next.errors.size && next.used.some((count, i) => count === 1 && previous.used[i] !== 1))
    return 'region';
  return after[changed] === 'unknown' ? 'erase' : after[changed] === 'empty' ? 'empty' : 'snake';
}

/** Quiet synthesized notes, initialized only in response to a player action. */
export class SnakeAudio {
  private context: AudioContext | undefined;
  private voices = new Set<OscillatorNode>();
  private silent = false;

  set muted(value: boolean) {
    this.silent = value;
    if (value) {
      for (const oscillator of this.voices) oscillator.stop();
      this.voices.clear();
    }
  }

  play(sound: Sound | null) {
    if (this.silent || sound === null) return;
    try {
      if (!this.context || this.context.state === 'closed') this.context = new AudioContext();
      const context = this.context;
      if (context.state === 'suspended') void context.resume().catch(() => {});
      for (const [frequency, delay, duration, end = frequency] of sounds[sound]) {
        const when = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, when);
        oscillator.frequency.exponentialRampToValueAtTime(end, when + duration);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.045, when + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          this.voices.delete(oscillator);
        };
        oscillator.start(when);
        oscillator.stop(when + duration + 0.02);
        this.voices.add(oscillator);
      }
    } catch {
      // Audio is optional; unsupported or blocked audio must never interrupt a move.
    }
  }
}

export const audio = new SnakeAudio();
export const SOUND_STORAGE_KEY = 'puzzle-craze.logic-snake.muted';

export function readMuted() {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
