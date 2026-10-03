import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { COLOR_NAMES, type Puzzle, type Run } from '../game/types';

export function Board({
  puzzle,
  run,
  selected,
  highlightedNumber,
  numberFirst,
  related,
  errors,
  hint,
  onSelect,
  onActivate,
  onInput,
  onNoteToggle,
  onUndo,
  onRedo,
}: {
  puzzle: Puzzle;
  run: Run;
  selected: number | null;
  highlightedNumber: number | null;
  numberFirst: boolean;
  related: Set<number>;
  errors: Set<number>;
  hint: number | null;
  onSelect: (cell: number) => void;
  onActivate: (cell: number) => void;
  onInput: (value: number) => void;
  onNoteToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const size = puzzle.options.size;
  function keydown(event: KeyboardEvent, index: number) {
    if (event.altKey) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
      }
      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        onRedo();
      }
      return;
    }
    const row = Math.floor(index / size),
      col = index % size;
    const target = {
      ArrowUp: index - size,
      ArrowDown: index + size,
      ArrowLeft: col > 0 ? index - 1 : index,
      ArrowRight: col < size - 1 ? index + 1 : index,
      Home: row * size,
      End: row * size + size - 1,
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      refs.current[target]?.focus();
      return;
    }
    let value = -1;
    if (/^[1-9]$/.test(event.key)) value = Number(event.key);
    if (size === 12 && /^[abc]$/i.test(event.key))
      value = event.key.toLowerCase().charCodeAt(0) - 87;
    if (['Backspace', 'Delete', '0'].includes(event.key)) value = 0;
    if (value >= 0 && value <= size) {
      event.preventDefault();
      onInput(value);
    }
    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      onNoteToggle();
    }
  }
  return (
    <div
      className="sudoku-board"
      role="group"
      aria-label={`${size} by ${size} Sudoku board. Use arrow keys to move, ${numberFirst ? 'numbers to choose a value, Enter or Space to place it' : 'numbers to fill'}, N for notes.`}
      style={{ '--size': size } as CSSProperties}
      data-size={size}
    >
      {run.board.map((value, i) => {
        const row = Math.floor(i / size),
          col = i % size;
        const region = puzzle.regions[i],
          color = puzzle.colors[i];
        const fixed = Boolean(puzzle.givens[i]);
        const notes = Array.from({ length: size }, (_, n) => n + 1).filter(
          (n) => run.notes[i] & (1 << (n - 1)),
        );
        const sameValue = value !== 0 && highlightedNumber === value;
        const isSelected = !numberFirst && selected === i;
        const diagonal = puzzle.options.diagonal && (row === col || row + col === size - 1);
        return (
          <button
            key={i}
            ref={(node) => {
              refs.current[i] = node;
            }}
            className={[
              'sudoku-cell',
              fixed ? 'is-given' : '',
              related.has(i) ? 'is-related' : '',
              isSelected ? 'is-selected' : '',
              sameValue ? 'is-matching' : '',
              errors.has(i) ? 'is-conflict' : '',
              hint === i ? 'is-hint' : '',
              row > 0 && puzzle.regions[i - size] !== region ? 'edge-top' : '',
              col > 0 && puzzle.regions[i - 1] !== region ? 'edge-left' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-color={color}
            tabIndex={i === (selected ?? 0) ? 0 : -1}
            aria-label={`Row ${row + 1}, column ${col + 1}: ${value || 'empty'}${fixed ? ', given' : ''}, region ${region + 1}${color >= 0 ? `, ${COLOR_NAMES[color]} group ${String.fromCharCode(65 + color)}` : ''}${diagonal ? ', diagonal' : ''}${notes.length ? `, notes ${notes.join(', ')}` : ''}${errors.has(i) ? ', conflict' : ''}`}
            aria-pressed={numberFirst ? undefined : isSelected}
            onFocus={() => onSelect(i)}
            onClick={() => onActivate(i)}
            onKeyDown={(e) => keydown(e, i)}
          >
            {color >= 0 && (
              <span className="sudoku-color-letter" aria-hidden="true">
                {String.fromCharCode(65 + color)}
              </span>
            )}
            {value ? (
              <span className="sudoku-digit">{value}</span>
            ) : notes.length > 0 ? (
              <span
                className="sudoku-cell-notes"
                style={{ '--note-columns': size === 4 ? 2 : size === 12 ? 4 : 3 } as CSSProperties}
                aria-hidden="true"
              >
                {Array.from({ length: size }, (_, n) => (
                  <span key={n}>{notes.includes(n + 1) ? n + 1 : ''}</span>
                ))}
              </span>
            ) : null}
            {errors.has(i) && (
              <span className="sudoku-conflict-mark" aria-hidden="true">
                !
              </span>
            )}
          </button>
        );
      })}
      {puzzle.options.diagonal && (
        <svg
          className="sudoku-diagonals"
          viewBox={`0 0 ${size * 100} ${size * 100}`}
          aria-hidden="true"
        >
          <path d={`M0 0 L${size * 100} ${size * 100} M${size * 100} 0 L0 ${size * 100}`} />
        </svg>
      )}
    </div>
  );
}
