import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveSound, SnakeAudio } from './audio';
import { initialBoard, markCell, type Cell, type Level } from './engine';
import { levels } from './levels';

afterEach(() => vi.unstubAllGlobals());

describe('sound feedback', () => {
  const level = levels[0];

  it('stays quiet for unchanged boards and fixed clues', () => {
    const board = initialBoard(level);
    expect(moveSound(level, board, [...board])).toBeNull();
    expect(moveSound(level, board, markCell(level, board, level.clues[0], 'snake'))).toBeNull();
    expect(moveSound(level, level.solution, [...level.solution])).toBeNull();
  });

  it('plays a win when the snake is complete even without empty marks', () => {
    const complete = level.solution.map((cell): Cell => (cell === 'empty' ? 'unknown' : cell));
    const before = [...complete];
    before[complete.indexOf('snake')] = 'unknown';
    expect(moveSound(level, before, complete)).toBe('win');
    expect(moveSound(level, before, complete, 'redo')).toBe('win');
    expect(moveSound(level, complete, before, 'undo')).toBe('undo');
  });

  it('distinguishes a completed region from an ordinary mark', () => {
    const board: Cell[] = ['head', 'unknown', 'head', 'empty', 'unknown', 'unknown'];
    const small: Level = {
      id: 'small',
      name: 'Small',
      width: 3,
      height: 2,
      top: 3,
      solution: board,
      clues: [0, 2],
      moves: [],
    };
    const next = [...board];
    next[4] = 'snake';
    expect(moveSound(small, board, next)).toBe('region');
    expect(moveSound(small, next, board)).toBe('erase');
  });

  it('reports new conflicts without repeating them on unrelated marks', () => {
    const board: Cell[] = [
      'head',
      'snake',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'head',
    ];
    const small: Level = {
      id: 'small',
      name: 'Small',
      width: 3,
      height: 3,
      top: 3,
      solution: board,
      clues: [0, 8],
      moves: [],
    };
    const conflict = [...board];
    conflict[3] = 'snake';
    expect(moveSound(small, board, conflict)).toBe('conflict');
    const next = [...conflict];
    next[4] = 'empty';
    expect(moveSound(small, conflict, next)).toBe('empty');
  });
});

describe('optional audio', () => {
  it('does not create audio on startup or while muted', () => {
    const context = vi.fn();
    vi.stubGlobal('AudioContext', context);
    const audio = new SnakeAudio();
    audio.play(null);
    expect(context).not.toHaveBeenCalled();
    audio.muted = true;
    audio.play('win');
    expect(context).not.toHaveBeenCalled();
  });

  it('continues safely when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => new SnakeAudio().play('snake')).not.toThrow();
  });

  it('stops all scheduled notes immediately when muted', () => {
    const parameter = () => ({
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const voices: { stop: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        currentTime = 0;
        destination = {};
        createGain() {
          return { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
        }
        createOscillator() {
          const voice = {
            frequency: parameter(),
            connect: (gain: unknown) => gain,
            start: vi.fn(),
            stop: vi.fn(),
            disconnect: vi.fn(),
          };
          voices.push(voice);
          return voice;
        }
      },
    );
    const audio = new SnakeAudio();
    audio.play('win');
    expect(voices).toHaveLength(4);
    audio.muted = true;
    for (const voice of voices) expect(voice.stop).toHaveBeenLastCalledWith();
    audio.play('hint');
    expect(voices).toHaveLength(4);
  });
});
