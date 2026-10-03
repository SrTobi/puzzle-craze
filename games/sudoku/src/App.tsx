import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Eraser,
  Grid3X3,
  Lightbulb,
  Pencil,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { GameBreadcrumb } from '../../../shared/components/GameBreadcrumb';
import { Board } from './components/Board';
import { Dialog } from './components/Dialog';
import { Features, features } from './components/Features';
import { Generator } from './components/Generator';
import { catalog } from './game/catalog';
import levelData from './game/levels.json';
import {
  conflicts,
  enterValue,
  freshRun,
  isSolved,
  logicalHint,
  peers,
  redo,
  undo,
} from './game/engine';
import { loadProgress, STORAGE_KEY } from './game/storage';
import { COLOR_NAMES, type Puzzle, type Hint, type Run } from './game/types';

const levels = levelData as Puzzle[];

export default function App() {
  const [progress, setProgress] = useState(() => loadProgress(levels));
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [dialog, setDialog] = useState<'levels' | 'help' | 'generator' | null>(null);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState('Pick a cell. Find a little clarity.');
  const custom = progress.selected === 'custom';
  const levelIndex = levels.findIndex((p) => p.id === progress.selected);
  const puzzle = custom ? progress.custom! : levels[levelIndex];
  const lesson = custom
    ? 'Your rules, your pace. Every row, column, and active group needs each number exactly once.'
    : catalog[levelIndex].lesson;
  const run = useMemo(
    () => progress.runs[progress.selected] ?? freshRun(puzzle),
    [progress.runs, progress.selected, puzzle],
  );
  const related = useMemo(() => peers(puzzle), [puzzle]);
  const errors = useMemo(() => conflicts(puzzle, run.board), [puzzle, run.board]);
  const solved = isSolved(puzzle, run.board);
  const filled = run.board.filter(Boolean).length;
  const completed = progress.completed.filter((id) => id !== 'custom').length;
  const size = puzzle.options.size;
  const numberFirst = progress.inputMode === 'number-first';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [progress]);
  useEffect(() => {
    const id = progress.selected;
    if (solved && !progress.completed.includes(id))
      setProgress((p) =>
        p.completed.includes(id) ? p : { ...p, completed: [...p.completed, id] },
      );
  }, [solved, progress.completed, progress.selected]);

  function replaceRun(next: Run, feedback = '') {
    setProgress((p) => ({ ...p, runs: { ...p.runs, [p.selected]: next } }));
    setHint(null);
    if (feedback) setMessage(feedback);
  }
  function placeValue(cell: number, value: number) {
    if (solved) return;
    if (puzzle.givens[cell]) {
      setMessage('That number is a starting clue. Choose an empty cell.');
      return;
    }
    const next = enterValue(puzzle, run, cell, value, pencil);
    replaceRun(
      next,
      pencil && value
        ? 'A possibility, penciled in.'
        : value
          ? 'One number closer.'
          : 'A little space to rethink.',
    );
  }
  function input(value: number) {
    if (solved) return;
    if (numberFirst && value > 0) {
      setSelectedNumber(value);
      setHint(null);
      setMessage(`Selected ${value}. Click cells to ${pencil ? 'pencil it in' : 'place it'}.`);
    } else if (selected !== null) placeValue(selected, value);
  }
  function activateCell(cell: number) {
    setSelected(cell);
    if (numberFirst && selectedNumber !== null) placeValue(cell, selectedNumber);
  }
  function changeInputMode(mode: 'cell-first' | 'number-first') {
    setProgress((p) => ({ ...p, inputMode: mode }));
    setSelectedNumber(null);
    setHint(null);
    setMessage(
      mode === 'number-first'
        ? 'Choose a number, then click cells to place it.'
        : 'Choose a cell, then a number.',
    );
  }
  function selectLevel(id: string) {
    setProgress((p) => ({ ...p, selected: id }));
    setSelected(null);
    setSelectedNumber(null);
    setHint(null);
    setPencil(false);
    setDialog(null);
    setMessage('Pick a cell. Find a little clarity.');
  }
  function playCustom(next: Puzzle) {
    setProgress((p) => ({
      ...p,
      selected: 'custom',
      custom: next,
      completed: p.completed.filter((id) => id !== 'custom'),
      runs: { ...p.runs, custom: freshRun(next) },
    }));
    setSelected(null);
    setSelectedNumber(null);
    setHint(null);
    setPencil(false);
    setDialog(null);
    setMessage('Made just for you. Take your time.');
  }
  function showHint() {
    if (solved) return;
    const wrong = run.board.findIndex((v, i) => v !== 0 && v !== puzzle.solution[i]);
    let next: Hint;
    if (wrong !== -1)
      next = {
        cell: wrong,
        value: 0,
        reveal: false,
        message: `Check row ${Math.floor(wrong / size) + 1}, column ${(wrong % size) + 1}. This entry does not fit the puzzle’s unique solution. Clear it and try again.`,
      };
    else {
      const logical = logicalHint(puzzle, run.board, related);
      const cell = selected !== null && !run.board[selected] ? selected : run.board.indexOf(0);
      next = logical ?? {
        cell,
        value: puzzle.solution[cell],
        reveal: true,
        message: `No single-candidate deduction is available. You can reveal ${puzzle.solution[cell]} at row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}, or keep exploring.`,
      };
    }
    setSelected(next.cell);
    setHint(next);
  }
  function reset() {
    const fresh = freshRun(puzzle);
    replaceRun(
      { ...fresh, history: [...run.history.slice(-99), { board: run.board, notes: run.notes }] },
      'A fresh page. Undo can bring your entries back.',
    );
  }
  const undoMove = () => replaceRun(undo(run), 'One step back. A fresh perspective.');
  const redoMove = () => replaceRun(redo(run), 'That step is back in place.');

  return (
    <div className="sudoku-app">
      <header className="sudoku-topbar">
        <GameBreadcrumb>
          <Grid3X3 size={22} />
          <span>
            sudoku<span className="sudoku-brand-dot">.</span>
          </span>
        </GameBreadcrumb>
        <button className="sudoku-help" onClick={() => setDialog('help')}>
          <CircleHelp size={17} />
          <span>How to play</span>
        </button>
      </header>
      <main className="sudoku-main">
        <div className="sudoku-heading">
          <div>
            <p className="sudoku-eyebrow">A FAMILIAR PUZZLE. NEW POSSIBILITIES.</p>
            <h1>A place for every number.</h1>
            <p>A little logic. A fresh shape. One lovely moment of clarity.</p>
          </div>
          <span className="sudoku-collection-count">
            <CheckCheck size={17} />
            {completed} / {levels.length}
            <small>DISCOVERED</small>
          </span>
        </div>
        <div className="sudoku-workspace">
          <section className="sudoku-play" aria-label="Sudoku puzzle">
            <div className="sudoku-board-heading">
              <button className="sudoku-level-picker" onClick={() => setDialog('levels')}>
                <span>
                  {custom ? 'CUSTOM PUZZLE' : `LEVEL ${String(levelIndex + 1).padStart(2, '0')}`}
                </span>
                <strong>{puzzle.name}</strong>
                <ChevronDown size={16} />
              </button>
              <span className="sudoku-fill-count">
                {filled}
                <span> / {size * size}</span>
              </span>
            </div>
            <div className="sudoku-board-features">
              <Features options={puzzle.options} />
              <span>{puzzle.givens.filter(Boolean).length} starting clues</span>
            </div>
            <details className="sudoku-mobile-lesson" key={puzzle.id}>
              <summary>
                <Lightbulb size={14} /> This puzzle’s rules
              </summary>
              <p>{lesson}</p>
            </details>
            <Board
              puzzle={puzzle}
              run={run}
              selected={selected}
              highlightedNumber={
                numberFirst ? selectedNumber : selected === null ? null : run.board[selected]
              }
              numberFirst={numberFirst}
              related={new Set(selected === null ? [] : related[selected])}
              errors={errors}
              hint={hint?.cell ?? null}
              onSelect={setSelected}
              onActivate={activateCell}
              onInput={input}
              onNoteToggle={() => {
                if (!solved) setPencil((p) => !p);
              }}
              onUndo={undoMove}
              onRedo={redoMove}
            />
            <div className="sudoku-feedback" aria-live="polite">
              {solved ? (
                <>
                  <CheckCheck size={17} />
                  <strong>Everything in its place. Beautifully solved.</strong>
                </>
              ) : errors.size ? (
                <>
                  <span className="sudoku-conflict-symbol">!</span>
                  <span>A number repeats in an active group. Check the marked cells.</span>
                </>
              ) : (
                <span>{message}</span>
              )}
            </div>
            {hint && !solved && (
              <div className="sudoku-hint" role="status">
                <Lightbulb size={18} />
                <p>{hint.message}</p>
                <button
                  onClick={() =>
                    replaceRun(
                      enterValue(puzzle, run, hint.cell, hint.value, false),
                      hint.value ? 'A little nudge forward.' : 'Space to try again.',
                    )
                  }
                >
                  {hint.value === 0 ? 'Clear cell' : hint.reveal ? 'Reveal number' : 'Place number'}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="sudoku-entry-mode" role="group" aria-label="Input order">
              <span>Input order</span>
              <div>
                <button aria-pressed={!numberFirst} onClick={() => changeInputMode('cell-first')}>
                  Cell first
                </button>
                <button aria-pressed={numberFirst} onClick={() => changeInputMode('number-first')}>
                  Number first
                </button>
              </div>
            </div>
            <div
              className="sudoku-keypad"
              role="group"
              aria-label={
                numberFirst
                  ? 'Choose a number to place'
                  : pencil
                    ? 'Pencil in a possibility'
                    : 'Enter a number'
              }
              data-size={size}
            >
              {Array.from({ length: size }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  disabled={
                    solved ||
                    (!numberFirst && (selected === null || Boolean(puzzle.givens[selected])))
                  }
                  className={`${pencil ? 'is-pencil' : ''}${numberFirst && selectedNumber === value ? ' is-active' : ''}`}
                  onClick={() => input(value)}
                  aria-label={`${numberFirst ? 'Select' : pencil ? 'Note' : 'Enter'} ${value}`}
                  aria-pressed={numberFirst ? selectedNumber === value : undefined}
                >
                  <span>{value}</span>
                  <small>
                    {run.board.filter((n) => n === value).length === size ? (
                      <Check size={10} aria-label="All placed" />
                    ) : value > 9 ? (
                      String.fromCharCode(55 + value)
                    ) : (
                      ''
                    )}
                  </small>
                </button>
              ))}
            </div>
            <div className="sudoku-tools" role="group" aria-label="Puzzle controls">
              <button
                onClick={undoMove}
                disabled={!run.history.length}
                title="Undo · Ctrl or Cmd Z"
              >
                <Undo2 size={18} />
                <span>Undo</span>
              </button>
              <button
                onClick={redoMove}
                disabled={!run.future.length}
                title="Redo · Ctrl or Cmd Shift Z"
              >
                <Redo2 size={18} />
                <span>Redo</span>
              </button>
              <button
                onClick={() => setPencil((p) => !p)}
                aria-pressed={pencil}
                disabled={solved}
                title="Pencil marks · N"
              >
                <Pencil size={18} />
                <span>Notes {pencil ? 'on' : 'off'}</span>
              </button>
              <button
                onClick={() => input(0)}
                disabled={selected === null || Boolean(puzzle.givens[selected]) || solved}
                title="Erase · Backspace or Delete"
              >
                <Eraser size={18} />
                <span>Erase</span>
              </button>
              <button onClick={showHint} disabled={solved}>
                <Lightbulb size={18} />
                <span>Hint</span>
              </button>
              <button onClick={reset} disabled={!run.history.length && !solved}>
                <RotateCcw size={18} />
                <span>Restart</span>
              </button>
            </div>
            {solved && (
              <button
                className="sudoku-primary sudoku-next"
                onClick={() =>
                  custom || levelIndex === levels.length - 1
                    ? setDialog('generator')
                    : selectLevel(levels[levelIndex + 1].id)
                }
              >
                {custom || levelIndex === levels.length - 1
                  ? 'Make another puzzle'
                  : 'Discover the next puzzle'}
                <ArrowRight size={18} />
              </button>
            )}
            <p className="sudoku-board-foot">
              {numberFirst
                ? selectedNumber === null
                  ? 'Choose a number above, then click cells to place it.'
                  : pencil
                    ? `Pencil ${selectedNumber} · click cells to add or remove this possibility.`
                    : `Placing ${selectedNumber} · click cells to fill them. Choose another number to switch.`
                : pencil
                  ? 'Pencil mode · tap a number to add or remove a possibility.'
                  : 'Select a cell, then choose a number. There’s no rush.'}
              <br />
              <span>
                Arrow keys to move · N for notes · Delete to erase
                {size === 12 ? ' · A / B / C for 10 / 11 / 12' : ''}
              </span>
            </p>
            {!saved && (
              <p className="sudoku-error" role="status">
                Your browser could not save progress. You can keep playing in this tab.
              </p>
            )}
          </section>
          <aside className="sudoku-aside">
            <div className="sudoku-lesson">
              <div className="sudoku-lesson-icon">
                <Sparkles size={22} />
              </div>
              <p className="sudoku-eyebrow">
                {custom ? 'YOUR LITTLE EXPERIMENT' : catalog[levelIndex].chapter}
              </p>
              <h2>{custom ? 'A puzzle, your way.' : puzzle.name}</h2>
              <p>{lesson}</p>
            </div>
            <div className="sudoku-rules">
              <h3>This puzzle’s rules</h3>
              <p className="sudoku-rule-base">
                Use <strong>1–{size}</strong> once in every row and column.
              </p>
              {features(puzzle.options)
                .filter((f) => f.key !== 'size')
                .map(({ key, Icon, label, description }) => (
                  <div className="sudoku-rule" key={key}>
                    <Icon size={18} />
                    <p>
                      <strong>{label}</strong>
                      <span>{description}.</span>
                    </p>
                  </div>
                ))}
            </div>
            {puzzle.options.colors && (
              <div className="sudoku-color-legend" aria-label="Color groups">
                {[...new Set(puzzle.colors)]
                  .filter((c) => c >= 0)
                  .sort()
                  .map((color) => (
                    <span key={color} data-color={color}>
                      <b>{String.fromCharCode(65 + color)}</b>
                      {COLOR_NAMES[color]}
                      <small>1–{size}</small>
                    </span>
                  ))}
              </div>
            )}
            <div className="sudoku-generator-card">
              <SlidersHorizontal size={21} />
              <h3>What if you made the rules?</h3>
              <p>
                Pick a size. Bend the boxes. Add a splash of color. Find your own kind of puzzle.
              </p>
              <button onClick={() => setDialog('generator')}>
                Create a puzzle
                <ArrowRight size={16} />
              </button>
            </div>
            {custom && (
              <p className="sudoku-seed-note">
                Seed: <strong>{puzzle.options.seed}</strong>
                <br />
                {puzzle.options.density} clues · saved on this device
              </p>
            )}
          </aside>
        </div>
      </main>
      <footer className="sudoku-footer">
        <span>A LITTLE LOGIC GOES A LONG WAY.</span>
        <span>No timer. No hurry. Just you and the next number.</span>
      </footer>
      {dialog === 'generator' && (
        <Generator
          onClose={() => setDialog(null)}
          onPlay={playCustom}
          previous={progress.custom?.options}
        />
      )}
      {dialog === 'levels' && (
        <Dialog title="Small steps. New possibilities." onClose={() => setDialog(null)} wide>
          <p className="sudoku-dialog-lead">
            Start with the familiar, then discover one new rule at a time. Every puzzle is open to
            explore.
          </p>
          <div className="sudoku-levels">
            {catalog.map((level, index) => (
              <div key={level.id}>
                {(index === 0 || catalog[index - 1].chapter !== level.chapter) && (
                  <h3>{level.chapter}</h3>
                )}
                <button
                  className="sudoku-level-row"
                  aria-current={progress.selected === level.id ? 'true' : undefined}
                  onClick={() => selectLevel(level.id)}
                >
                  <span className="sudoku-level-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="sudoku-level-info">
                    <strong>{level.name}</strong>
                    <Features options={level.options} />
                  </span>
                  {progress.completed.includes(level.id) ? (
                    <Check size={18} aria-label="Completed" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
          {progress.custom && (
            <button className="sudoku-custom-resume" onClick={() => selectLevel('custom')}>
              <SlidersHorizontal size={18} />
              <span>
                Continue your custom puzzle
                <Features options={progress.custom.options} />
              </span>
              <ArrowRight size={17} />
            </button>
          )}
          <button
            className="sudoku-primary sudoku-create-level"
            onClick={() => setDialog('generator')}
          >
            Create a custom puzzle
            <ArrowRight size={17} />
          </button>
        </Dialog>
      )}
      {dialog === 'help' && (
        <Dialog title="A place for every number." onClose={() => setDialog(null)}>
          <div className="sudoku-help-copy">
            <p>
              Fill every cell with a number from <strong>1 to the board’s size</strong>. Each row,
              column, and thickly outlined region must contain every number exactly once.
            </p>
            <p>
              <strong>Jigsaw regions</strong> replace rectangular boxes with connected shapes.
              Follow the thick outlines.
            </p>
            <p>
              <strong>Color groups</strong> add another rule: every group of the same color and
              letter (A, B, or C) needs every number once. Uncolored cells have no color rule.
            </p>
            <p>
              <strong>Diagonals</strong> add the same rule to both dotted corner-to-corner lines.
              Feature badges show which rules are active.
            </p>
            <p>
              Select a cell, then use the keypad or your keyboard. <strong>Notes</strong> hold
              possibilities; entering a number removes that pencil mark from its peers. Given
              numbers stay fixed. Repeated entries are marked with an exclamation point.
            </p>
            <p>
              Prefer choosing a number first? Switch <strong>Input order</strong> to{' '}
              <strong>Number first</strong>, choose a number, then click any editable cells to place
              it repeatedly. This also works with notes. Arrow keys only move the selection; Enter
              or Space places the chosen number. Your input order is remembered in this browser.
            </p>
            <p>
              <strong>Hints</strong> explain a single-candidate deduction when one is available.
              They can also check a mistaken entry or offer an explicit reveal. Nothing is placed
              until you choose it.
            </p>
            <p>
              <strong>Keyboard:</strong> arrows move, 1–9 enter numbers, A/B/C enter 10/11/12 on a
              12×12 board, N toggles notes, and Delete clears a cell. Ctrl/Cmd Z undoes; Shift
              Ctrl/Cmd Z redoes.
            </p>
            <p>
              Progress and your latest custom puzzle are saved in this browser. There’s no timer and
              no penalty for trying.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
