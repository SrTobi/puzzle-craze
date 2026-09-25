import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { isSnake, neighbors, type Cell, type Level, type Region } from '../game/engine';

export function Board({
  level,
  board,
  errors,
  regions,
  hint,
  onMark,
}: {
  level: Level;
  board: Cell[];
  errors: Set<number>;
  regions: Region[];
  hint: number | null;
  onMark: (index: number, alternate?: boolean) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent, index: number) {
    const x = index % level.width;
    const deltas: Record<string, number> = {
      ArrowUp: -level.width,
      ArrowDown: level.width,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    if (
      (event.key === 'ArrowLeft' && x === 0) ||
      (event.key === 'ArrowRight' && x === level.width - 1)
    )
      return;
    refs.current[index + delta]?.focus();
  }
  return (
    <div
      className="snake-board"
      role="group"
      aria-label={`${level.width} by ${level.height} puzzle board`}
      style={{ '--columns': level.width } as CSSProperties}
    >
      {board.map((cell, i) => {
        const locked = level.clues.includes(i);
        const region = regions.find((region) => region.cells.includes(i));
        const invalid = errors.has(i);
        const snake = isSnake(cell);
        const adjacent = neighbors(level, i).filter((n) => isSnake(board[n]));
        const description = cell === 'head' ? 'endpoint' : cell;
        return (
          <button
            key={i}
            ref={(node) => {
              refs.current[i] = node;
            }}
            className={`snake-cell cell-${cell}${locked ? ' is-clue' : ''}${invalid ? ' is-invalid' : ''}${hint === i ? ' is-hint' : ''}${region?.closed ? ' is-enclosed' : ''}`}
            aria-label={`Row ${Math.floor(i / level.width) + 1}, column ${(i % level.width) + 1}: ${description}${locked ? ', fixed clue' : ''}${invalid ? ', conflict' : ''}`}
            aria-disabled={locked}
            onClick={(event) => onMark(i, event.shiftKey)}
            onContextMenu={(event) => {
              event.preventDefault();
              onMark(i, true);
            }}
            onKeyDown={(event) => navigate(event, i)}
          >
            {snake && (
              <svg viewBox="0 0 100 100" aria-hidden="true" className="snake-piece">
                {adjacent.map((n) => (
                  <path
                    key={n}
                    d={`M50 50 L${n === i - 1 ? 0 : n === i + 1 ? 100 : 50} ${n === i - level.width ? 0 : n === i + level.width ? 100 : 50}`}
                  />
                ))}
                <circle cx="50" cy="50" r={cell === 'head' ? 25 : 18} />
                {cell === 'head' && (
                  <g className="snake-eyes">
                    <circle cx="42" cy="43" r="4" />
                    <circle cx="58" cy="43" r="4" />
                    <path d="M43 57q7 7 14 0" />
                  </g>
                )}
              </svg>
            )}
            {cell === 'unknown' && <span className="cell-dot" />}
            {cell === 'empty' &&
              (region?.closed ? (
                <span className="region-size">{region.cells.length}</span>
              ) : (
                <span className="empty-mark">×</span>
              ))}
            {locked && <LockKeyhole className="clue-lock" size={9} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
