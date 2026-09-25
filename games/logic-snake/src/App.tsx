import { useCallback, useEffect, useMemo, useReducer, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Eraser,
  Grid2X2,
  Lightbulb,
  LockKeyhole,
  Redo2,
  RotateCcw,
  Route,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { GameBreadcrumb } from '../../../shared/components/GameBreadcrumb';
import { links } from '../../../shared/links';
import { Board } from './components/Board';
import { Dialog } from './components/Dialog';
import {
  analyze,
  historyReducer,
  initialBoard,
  markCell,
  nextHint,
  type Cell,
  type Level,
  type Tool,
} from './game/engine';
import { audio, moveSound, readMuted, SOUND_STORAGE_KEY } from './game/audio';
import { levels } from './game/levels';
import { loadProgress, STORAGE_KEY } from './game/storage';

export default function App() {
  const [progress, setProgress] = useState(() => loadProgress(levels));
  const [muted, setMuted] = useState(readMuted);
  const [saved, setSaved] = useState(true);
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const level = levels.find((level) => level.id === progress.selected)!;
  const index = levels.indexOf(level);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [progress]);
  useEffect(() => {
    audio.muted = muted;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(muted));
    } catch {
      // Sound still works when browser storage is unavailable.
    }
  }, [muted]);
  function toggleSound() {
    audio.muted = !muted;
    setMuted(!muted);
    if (muted) audio.play('snake');
  }
  const updateBoard = useCallback((id: string, board: Cell[], solved: boolean) => {
    setProgress((previous) => ({
      ...previous,
      boards: { ...previous.boards, [id]: board },
      completed:
        solved && !previous.completed.includes(id)
          ? [...previous.completed, id]
          : previous.completed,
    }));
  }, []);
  function selectLevel(id: string) {
    setProgress((previous) => ({ ...previous, selected: id }));
    setPicker(false);
  }
  return (
    <div className="snake-app">
      <header className="snake-topbar">
        <GameBreadcrumb>
          <a className="snake-brand" href={links.logicSnake} aria-label="Logic Snake home">
            <Route size={31} strokeWidth={2.3} />
            <span>
              Logic <span className="brand-light">Snake</span>
              <span className="brand-period">.</span>
            </span>
          </a>
        </GameBreadcrumb>
        <nav className="snake-header-actions" aria-label="Game navigation">
          <button
            className="snake-icon-button"
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
            title={muted ? 'Turn sound on' : 'Mute sound'}
            onClick={toggleSound}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button className="snake-help" aria-label="How to play" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            <span>How to play</span>
          </button>
        </nav>
      </header>
      <Game
        key={level.id}
        level={level}
        index={index}
        restored={progress.boards[level.id]}
        onChange={updateBoard}
        onPicker={() => setPicker(true)}
        onNext={() =>
          index < levels.length - 1 ? selectLevel(levels[index + 1].id) : setPicker(true)
        }
      />
      {!saved && (
        <p className="snake-storage-warning" role="status">
          Progress could not be saved. Keep this tab open.
        </p>
      )}
      {picker && (
        <Dialog title="Choose a puzzle" onClose={() => setPicker(false)}>
          <div className="snake-level-list">
            {levels.map((item, i) => (
              <button
                key={item.id}
                className={item.id === level.id ? 'selected' : ''}
                onClick={() => selectLevel(item.id)}
                aria-current={item.id === level.id ? 'true' : undefined}
              >
                <span className="level-list-number">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.width} × {item.height} · Regions 1–{item.top}
                  </small>
                </span>
                {progress.completed.includes(item.id) ? (
                  <CheckCheck size={20} aria-label="Completed" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            ))}
          </div>
          <p className="snake-dialog-foot">
            {progress.completed.length} of {levels.length} puzzles completed
          </p>
        </Dialog>
      )}
      {help && (
        <Dialog title="How to play" onClose={() => setHelp(false)}>
          <div className="snake-rule">
            <span>
              <Route size={23} />
            </span>
            <div>
              <h3>One snake, two endpoints</h3>
              <p>
                Connect the two round endpoints with one continuous snake. It moves up, down, left,
                or right. It cannot branch, form a loop, or touch itself along an edge. Diagonal
                contact is fine.
              </p>
            </div>
          </div>
          <div className="snake-rule">
            <span>
              <Grid2X2 size={23} />
            </span>
            <div>
              <h3>Empty regions</h3>
              <p>
                Empty cells touching along an edge form a region. Crosses help you keep track, but
                once the snake is complete, remaining empty cells are filled in for you. Make
                exactly one region of each size shown beside the board. The board’s edge counts as a
                boundary.
              </p>
            </div>
          </div>
          <div className="snake-rule">
            <span>
              <LockKeyhole size={21} />
            </span>
            <div>
              <h3>Fixed clues</h3>
              <p>
                Locked cells are clues and cannot change. A number appears when an empty region is
                fully surrounded by snake or the board edge. Coral marks a rule conflict.
              </p>
            </div>
          </div>
          <div className="snake-shortcuts">
            <strong>Controls</strong>
            <p>
              Choose Snake, Empty, or Erase, then tap a cell. Tap the same mark again to clear it.
              Right-click or Shift-click to mark empty.
            </p>
            <p>
              <kbd>S</kbd> Snake <kbd>E</kbd> Empty <kbd>X</kbd> Erase <kbd>U</kbd> Undo{' '}
              <kbd>H</kbd> Hint
            </p>
            <p>
              Tab to a cell, use arrow keys to move, and Space or Enter to mark. Hints reveal one
              cell from the original solution.
            </p>
          </div>
          <button className="snake-primary" onClick={() => setHelp(false)}>
            Got it <ArrowRight size={17} />
          </button>
        </Dialog>
      )}
    </div>
  );
}

function Game({
  level,
  index,
  restored,
  onChange,
  onPicker,
  onNext,
}: {
  level: Level;
  index: number;
  restored?: Cell[];
  onChange: (id: string, board: Cell[], solved: boolean) => void;
  onPicker: () => void;
  onNext: () => void;
}) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: restored ?? initialBoard(level),
    future: [],
  });
  const [tool, setTool] = useState<Tool>('snake');
  const [notice, setNotice] = useState('');
  const [hint, setHint] = useState<ReturnType<typeof nextHint>>(null);
  const [restart, setRestart] = useState(false);
  const board = history.present;
  const analysis = useMemo(() => analyze(level, board), [level, board]);
  const marked = analysis.solved ? board.length : board.length - analysis.unknown;
  const displayBoard = analysis.solved
    ? board.map((cell): Cell => (cell === 'unknown' ? 'empty' : cell))
    : board;
  const finishedRegions = analysis.used.filter((count) => count === 1).length;
  useEffect(
    () => onChange(level.id, board, analysis.solved),
    [level.id, board, analysis.solved, onChange],
  );
  function edit(next: Cell[], move: 'mark' | 'restart' = 'mark') {
    audio.play(moveSound(level, board, next, move));
    dispatch({ type: 'edit', board: next });
    setHint(null);
    setNotice('');
  }
  function mark(index: number, alternate = false) {
    if (level.clues.includes(index)) {
      setNotice('This clue is fixed.');
      return;
    }
    if (analysis.solved) return;
    edit(markCell(level, board, index, alternate ? 'empty' : tool));
  }
  function undo() {
    const previous = history.past.at(-1);
    if (previous) audio.play(moveSound(level, board, previous, 'undo'));
    dispatch({ type: 'undo' });
    setHint(null);
    setNotice('');
  }
  function redo() {
    const next = history.future[0];
    if (next) audio.play(moveSound(level, board, next, 'redo'));
    dispatch({ type: 'redo' });
    setHint(null);
    setNotice('');
  }
  function giveHint() {
    const next = nextHint(level, board);
    setHint(next);
    if (next) audio.play('hint');
    setNotice('');
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
        return;
      }
      if (key === 's') setTool('snake');
      else if (key === 'e') setTool('empty');
      else if (key === 'x') setTool('erase');
      else if (key === 'u') undo();
      else if (key === 'h' && !analysis.solved) giveHint();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });
  return (
    <main className="snake-game">
      <section className="snake-levelbar" aria-label="Current puzzle">
        <div>
          <button className="snake-level-picker" onClick={onPicker}>
            <span>{String(index + 1).padStart(2, '0')}</span> PUZZLES <ChevronDown size={13} />
          </button>
          <h1>{level.name}</h1>
        </div>
        <div className="snake-progress">
          <div
            className="snake-progress-ring"
            style={{ '--progress': `${(marked / board.length) * 100}%` } as CSSProperties}
          >
            {analysis.solved ? <Check size={23} /> : <Route size={23} />}
          </div>
          <div>
            <strong>
              {String(marked).padStart(2, '0')}
              <span> / {board.length}</span>
            </strong>
            <small>CELLS MARKED</small>
          </div>
        </div>
      </section>
      <div className="snake-workspace">
        <section className="snake-play" aria-label="Logic Snake puzzle">
          <Board
            level={level}
            board={displayBoard}
            regions={analysis.regions}
            errors={analysis.errors}
            hint={hint?.index ?? null}
            onMark={mark}
          />
          <div className="snake-mark-tools" role="group" aria-label="Cell marking tool">
            <button
              aria-pressed={tool === 'snake'}
              onClick={() => setTool('snake')}
              className={tool === 'snake' ? 'active' : ''}
            >
              <Route size={18} />
              Snake<kbd>S</kbd>
            </button>
            <button
              aria-pressed={tool === 'empty'}
              onClick={() => setTool('empty')}
              className={tool === 'empty' ? 'active empty-tool' : ''}
            >
              <X size={18} />
              Empty<kbd>E</kbd>
            </button>
            <button
              aria-pressed={tool === 'erase'}
              onClick={() => setTool('erase')}
              className={tool === 'erase' ? 'active' : ''}
            >
              <Eraser size={17} />
              Erase<kbd>X</kbd>
            </button>
          </div>
          <p
            className={`snake-status${analysis.errors.size ? ' conflict' : ''}`}
            role="status"
            aria-live="polite"
          >
            {analysis.solved
              ? ''
              : hint
                ? `Row ${Math.floor(hint.index / level.width) + 1}, column ${(hint.index % level.width) + 1} should be ${hint.cell === 'empty' ? 'empty' : 'snake'}.`
                : notice ||
                  analysis.messages[0] ||
                  (analysis.unknown === 0
                    ? 'Check the empty regions: each size is needed exactly once.'
                    : '')}
          </p>
          {hint && (
            <button
              className="snake-apply-hint"
              onClick={() => {
                const next = [...board];
                next[hint.index] = hint.cell;
                edit(next);
              }}
            >
              Apply hint <ArrowRight size={15} />
            </button>
          )}
        </section>
        <aside className="snake-aside">
          <div className="snake-regions-heading">
            <h2>Empty regions</h2>
            <Grid2X2 size={17} />
          </div>
          <p>Leave one empty region of each size.</p>
          <div className="snake-region-list" aria-label="Required empty region sizes">
            {analysis.used.map((count, i) => (
              <div
                key={i}
                className={`snake-region-row${count === 1 ? ' done' : count > 1 ? ' conflict' : ''}`}
                aria-label={`Size ${i + 1}: ${count === 1 ? 'complete' : count > 1 ? 'duplicate' : 'needed'}`}
              >
                <span className="region-number">{i + 1}</span>
                <span className="region-mini" aria-hidden="true">
                  {Array.from({ length: i + 1 }, (_, j) => (
                    <i key={j} />
                  ))}
                </span>
                <span className="region-state">
                  {count === 1 ? <Check size={15} /> : count > 1 ? <X size={15} /> : <span />}
                </span>
              </div>
            ))}
          </div>
          <div className="snake-region-total">
            <span>
              {finishedRegions} of {level.top} regions found
            </span>
            <span>{Math.round((finishedRegions / level.top) * 100)}%</span>
          </div>
          <div className="snake-region-progress">
            <span style={{ width: `${(finishedRegions / level.top) * 100}%` }} />
          </div>
          <div className="snake-legend">
            <span>
              <i className="legend-clue" />
              Fixed clue
            </span>
            <span>
              <i className="legend-empty" />
              Empty space
            </span>
          </div>
        </aside>
      </div>
      {analysis.solved && (
        <section className="snake-win" aria-label="Puzzle complete">
          <Sparkles size={24} />
          <div>
            <h2>Puzzle complete</h2>
          </div>
          <button className="snake-primary" onClick={onNext}>
            {index === levels.length - 1 ? 'Choose a puzzle' : 'Next puzzle'}
            <ArrowRight size={17} />
          </button>
        </section>
      )}
      <div className="snake-controls">
        <div className="snake-action-toolbar">
          <button onClick={undo} disabled={!history.past.length} title="Undo (U)">
            <Undo2 size={18} />
            <span>Undo</span>
          </button>
          <button onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={18} />
            <span>Redo</span>
          </button>
          <button onClick={() => setRestart(true)}>
            <RotateCcw size={17} />
            <span>Restart</span>
          </button>
          <span className="snake-divider" />
          <button className="snake-hint-button" onClick={giveHint} disabled={analysis.solved}>
            <Lightbulb size={18} />
            <span>Hint</span>
            <kbd>H</kbd>
          </button>
        </div>
        <button className="snake-browse" onClick={onPicker}>
          <Grid2X2 size={16} />
          Puzzles{' '}
          <span>
            {index + 1} / {levels.length}
          </span>
        </button>
      </div>
      {restart && (
        <Dialog title="Restart puzzle?" onClose={() => setRestart(false)}>
          <p className="snake-dialog-lead">
            Clear your marks and keep the original clues. You can undo the restart if you change
            your mind.
          </p>
          <div className="snake-dialog-actions">
            <button onClick={() => setRestart(false)}>Keep playing</button>
            <button
              className="snake-primary"
              onClick={() => {
                edit(initialBoard(level), 'restart');
                setRestart(false);
              }}
            >
              Restart <RotateCcw size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
