import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Hand,
  Heart,
  HeartCrack,
  Lightbulb,
  Maximize,
  Minus,
  MoveUpRight,
  Plus,
  RotateCcw,
  Scan,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
  X,
  Download,
} from 'lucide-react';
import { Board } from './components/Board';
import { Modal } from './components/Modal';
import { audio } from './game/audio';
import { availableArrows, parseLevel } from './game/engine';
import firstLight from './levels/first-light.json';
import { MAX_ZOOM, useCamera } from './hooks/useCamera';
import { usePuzzle } from './hooks/usePuzzle';
import { Generator, downloadPuzzle } from './components/Generator';
import type { GeneratedPuzzle } from './generation/generator';
import type { Level } from './game/types';
import { CELL_SIZE } from './game/arrowGeometry';
import { MAX_LIVES } from './game/playState';
import { GameBreadcrumb } from '../../../shared/components/GameBreadcrumb';
import { links } from '../../../shared/links';
import { boardFit } from './game/cameraBounds';

const originalLevel = parseLevel(firstLight);
const palette = ['#8270df', '#ef816e', '#43a99b', '#e5b247', '#639dd8', '#d87fa6'];

function readMuted() {
  try {
    return localStorage.getItem('arrow-surgery:muted') === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const [puzzle, setPuzzle] = useState<{
    level: Level;
    generated?: GeneratedPuzzle;
    revision: number;
  }>({ level: originalLevel, revision: 0 });
  return (
    <Game
      key={puzzle.revision}
      level={puzzle.level}
      generated={puzzle.generated}
      onGenerated={(generated) =>
        setPuzzle((old) => ({ level: generated.level, generated, revision: old.revision + 1 }))
      }
      onOriginal={() => setPuzzle((old) => ({ level: originalLevel, revision: old.revision + 1 }))}
    />
  );
}

function Game({
  level,
  generated,
  onGenerated,
  onOriginal,
}: {
  level: Level;
  generated?: GeneratedPuzzle;
  onGenerated: (puzzle: GeneratedPuzzle) => void;
  onOriginal: () => void;
}) {
  const [making, setMaking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    kind: 'hint' | 'blocked' | 'success';
  } | null>(null);
  const [muted, setMuted] = useState(readMuted);
  const [help, setHelp] = useState(false);
  const [win, setWin] = useState(false);
  const [hints, setHints] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const {
    removed,
    queued,
    attempts,
    flights,
    collisions: mistakes,
    lives,
    lost,
    resume,
    canUndo,
    tap,
    reset: resetPuzzle,
    undo: undoPuzzle,
  } = usePuzzle(level, reducedMotion);
  const completed = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearFeedback = useCallback(() => {
    clearTimeout(feedbackTimer.current);
  }, []);

  useEffect(() => clearFeedback, [clearFeedback]);
  useEffect(() => {
    audio.muted = muted;
    try {
      localStorage.setItem('arrow-surgery:muted', String(muted));
    } catch {
      /* Storage is optional. */
    }
  }, [muted]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    const fullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    query.addEventListener('change', change);
    document.addEventListener('fullscreenchange', fullscreenChange);
    return () => {
      query.removeEventListener('change', change);
      document.removeEventListener('fullscreenchange', fullscreenChange);
    };
  }, []);

  const showFeedback = useCallback((message: string, kind: 'hint' | 'blocked' | 'success') => {
    clearTimeout(feedbackTimer.current);
    setToast({ message, kind });
    feedbackTimer.current = setTimeout(() => {
      setToast(null);
      setHint(null);
    }, 3400);
  }, []);

  const launch = useCallback(
    (id: string) => {
      setHint(null);
      const result = tap(id);
      if (result === 'queued') {
        showFeedback('One life lost. This arrow will fly when its path clears.', 'blocked');
      } else if (result === 'launched') {
        setToast(null);
      }
    },
    [tap, showFeedback],
  );

  const camera = useCamera(level.grid, reducedMotion);
  const { reset: resetCamera, zoomAt, focusPoint, size } = camera;

  useEffect(() => {
    if (
      !lost &&
      removed.length === level.arrows.length &&
      flights.length === 0 &&
      !completed.current
    ) {
      completed.current = true;
      setWin(true);
      setToast(null);
      audio.win();
    }
  }, [removed.length, flights.length, level, lost]);

  const restart = useCallback(() => {
    clearFeedback();
    resetPuzzle();
    completed.current = false;
    setHint(null);
    setToast(null);
    setWin(false);
    setHints(0);
    resetCamera();
  }, [clearFeedback, resetPuzzle, resetCamera]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    undoPuzzle();
    completed.current = false;
    setWin(false);
    setHint(null);
    showFeedback('One step back. Take your time.', 'success');
  }, [canUndo, undoPuzzle, showFeedback]);

  const giveHint = useCallback(() => {
    const available = availableArrows(level.arrows.filter((arrow) => !removed.includes(arrow.id)));
    if (!available.length) return;
    setHint(available[0].id);
    setHints((count) => count + 1);
    if (level.grid.columns > 40 || level.grid.rows > 40) {
      const head = available[0].points.at(-1)!;
      const center: readonly [number, number] = [
        ((level.grid.columns - 1) * CELL_SIZE) / 2,
        ((level.grid.rows - 1) * CELL_SIZE) / 2,
      ];
      const fit = boardFit(level.grid, size);
      focusPoint([head[0] * CELL_SIZE, head[1] * CELL_SIZE], center, fit);
    } else resetCamera();
    showFeedback('Follow the glow. This arrow has a clear way out.', 'hint');
    audio.hint();
  }, [removed, resetCamera, showFeedback, level, size, focusPoint]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else showFeedback('Your browser already has the full game view.', 'success');
    } catch {
      showFeedback('Fullscreen is unavailable in this browser window.', 'success');
    }
  }, [showFeedback]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        help ||
        win ||
        lost ||
        making ||
        (event.target instanceof HTMLElement &&
          (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) ||
            event.target.isContentEditable))
      )
        return;
      const actions: Record<string, () => void> = {
        h: giveHint,
        u: undo,
        r: restart,
        m: () => setMuted((value) => !value),
        f: () => void toggleFullscreen(),
        '0': resetCamera,
        '+': () => zoomAt(1.2),
        '=': () => zoomAt(1.2),
        '-': () => zoomAt(1 / 1.2),
      };
      const action = actions[event.key.toLowerCase()];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [giveHint, undo, restart, resetCamera, zoomAt, toggleFullscreen, help, win, lost, making]);

  const freed = removed.length;
  const total = level.arrows.length;
  const isComplete = freed === total;

  return (
    <main className="app">
      <header className="topbar">
        <GameBreadcrumb>
          <a
            className="brand"
            href={links.arrowSurgery}
            aria-label="Restart Arrow Surgery"
            onClick={(event) => {
              event.preventDefault();
              restart();
            }}
          >
            <span className="brand-icon">
              <MoveUpRight size={25} strokeWidth={2.8} />
              <MoveUpRight size={25} strokeWidth={2.8} />
            </span>
            <span>
              arrow<span className="brand-light">surgery</span>
              <span className="brand-period">.</span>
            </span>
          </a>
        </GameBreadcrumb>
        <div className="header-actions">
          <button
            className="new-puzzle-button"
            aria-label="New puzzle"
            onClick={() => setMaking(true)}
          >
            <Sparkles size={17} />
            <span>New puzzle</span>
          </button>
          {generated && (
            <button
              className="icon-button"
              aria-label="Save puzzle JSON"
              title="Save puzzle and generation details"
              onClick={() => downloadPuzzle(generated)}
            >
              <Download size={17} />
            </button>
          )}
          <button
            className="icon-button sound-button"
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
            title="Toggle sound (M)"
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            <span className={`sound-dot ${muted ? 'muted' : ''}`} />
          </button>
          <button
            className="icon-button"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen (F)"
            onClick={() => void toggleFullscreen()}
          >
            <Maximize size={19} />
          </button>
          <span className="header-divider" />
          <button className="help-button" aria-label="How to play" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            <span>How to play</span>
          </button>
        </div>
      </header>

      <section className="game" aria-label="Arrow Surgery puzzle">
        <div className="level-bar">
          <div className="level-info">
            <h1>{level.name}</h1>
            {generated && <p>{level.description}</p>}
          </div>
          <div className="progress-box" aria-label={`${freed} of ${total} arrows freed`}>
            <div
              className="progress-ring"
              style={{ '--progress': `${(freed / total) * 100}%` } as CSSProperties}
            >
              {isComplete ? <Check size={21} /> : <ArrowUpRight size={22} />}
            </div>
            <div>
              <div className="progress-count">
                {String(freed).padStart(2, '0')}
                <span> / {total}</span>
              </div>
              <div className="progress-label">ARROWS FREED</div>
              <div
                className="lives"
                role="status"
                aria-label={`${lives} of ${MAX_LIVES} lives remaining`}
              >
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <Heart
                    key={i}
                    size={16}
                    className={i < lives ? 'life-full' : 'life-empty'}
                    aria-hidden="true"
                  />
                ))}
                <span>
                  {lives} {lives === 1 ? 'life' : 'lives'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="play-area">
          <Board
            level={level}
            removed={removed}
            flights={flights}
            queued={queued}
            attempts={attempts}
            hint={hint}
            camera={camera}
            onTap={launch}
            reducedMotion={reducedMotion}
          />
          {isComplete && flights.length === 0 && !win && (
            <div className="empty-board">
              <Sparkles size={36} />
              <h2>A little lighter.</h2>
              <button className="primary-button" onClick={() => setMaking(true)}>
                New puzzle <ArrowRight size={18} />
              </button>
              <button className="next-chapter" onClick={restart}>
                Play again
              </button>
            </div>
          )}
          <div
            className={`board-message ${toast ? `has-toast ${toast.kind}` : ''}`}
            role="status"
            aria-live="polite"
          >
            {toast ? (
              <>
                {toast.kind === 'hint' ? (
                  <Lightbulb size={17} />
                ) : toast.kind === 'blocked' ? (
                  <X size={17} />
                ) : (
                  <Check size={17} />
                )}
                <span>{toast.message}</span>
              </>
            ) : queued.length > 0 ? (
              <span>
                {queued.length} {queued.length === 1 ? 'arrow waiting' : 'arrows waiting'}. Clear a
                path to release {queued.length === 1 ? 'it' : 'them'}.
              </span>
            ) : freed === 0 ? (
              <span>Tap an arrow to launch it.</span>
            ) : null}
          </div>
        </div>

        <footer className="game-footer">
          <div className="gesture-note">
            <Hand size={17} />
            <span>
              Drag to pan<span className="note-dot">·</span>Scroll to zoom
            </span>
          </div>
          <div className="action-toolbar" aria-label="Game controls">
            <button className="tool-button" onClick={restart} title="Restart level (R)">
              <RotateCcw size={18} />
              <span>Restart</span>
            </button>
            <span className="toolbar-divider" />
            <button
              className="tool-button hint-button"
              onClick={giveHint}
              disabled={isComplete || lost}
              title="Show a clear arrow (H)"
            >
              <Lightbulb size={19} />
              <span>Hint</span>
              <span className="keycap">H</span>
            </button>
          </div>
          <div className="zoom-controls" aria-label="Map controls">
            <button
              className="icon-button"
              aria-label="Zoom out"
              onClick={() => zoomAt(1 / 1.2)}
              disabled={camera.camera.zoom <= 0.45}
            >
              <Minus size={17} />
            </button>
            <span className="zoom-value">{Math.round(camera.camera.zoom * 100)}%</span>
            <button
              className="icon-button"
              aria-label="Zoom in"
              onClick={() => zoomAt(1.2)}
              disabled={camera.camera.zoom >= MAX_ZOOM}
            >
              <Plus size={17} />
            </button>
            <span className="zoom-divider" />
            <button
              className="icon-button"
              aria-label="Center and fit board"
              title="Center and fit (0)"
              onClick={resetCamera}
            >
              <Scan size={18} />
            </button>
          </div>
        </footer>
      </section>

      {making && (
        <Generator onClose={() => setMaking(false)} onPlay={onGenerated} onOriginal={onOriginal} />
      )}

      {help && (
        <Modal title="A little untangling." onClose={() => setHelp(false)}>
          <p className="modal-lead">Clear the board, one arrow at a time. There’s no rush.</p>
          <div className="help-step">
            <span className="step-icon violet">
              <MoveUpRight size={26} />
            </span>
            <div>
              <h3>Follow the arrow</h3>
              <p>
                Click or tap any part of an arrow. It unwinds and flies away in the direction its
                head points.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span className="step-icon coral">
              <Undo2 size={26} />
            </span>
            <div>
              <h3>Make a little space</h3>
              <p>
                A blocked arrow travels to the obstacle, glows red, and returns. It stays queued in
                red and flies automatically when you clear its path. Each newly blocked arrow costs
                one of your three lives. After the third mistake, retry, start a new puzzle, or
                sneak in three more lives. Before you run out, Undo restores your last move and
                life.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span className="step-icon teal">
              <Hand size={25} />
            </span>
            <div>
              <h3>Find your perspective</h3>
              <p>
                Drag to move the map. Scroll or pinch to zoom. The fit button brings everything back
                into view.
              </p>
            </div>
          </div>
          <div className="shortcut-list">
            <span>
              <kbd>H</kbd> Hint
            </span>
            <span>
              <kbd>U</kbd> Undo
            </span>
            <span>
              <kbd>R</kbd> Restart
            </span>
            <span>
              <kbd>M</kbd> Sound
            </span>
            <span>
              <kbd>0</kbd> Fit
            </span>
          </div>
          <p className="keyboard-note">Keyboard: Tab to an arrow, then press Enter or Space.</p>
          <button className="primary-button" onClick={() => setHelp(false)}>
            Let’s find some flow <ArrowRight size={18} />
          </button>
        </Modal>
      )}

      {lost && !making && attempts.length === 0 && flights.length === 0 && (
        <Modal
          title="A knot too many."
          onClose={() => {}}
          dismissible={false}
          className="loss-modal"
        >
          <div className="loss-emblem" aria-hidden="true">
            <HeartCrack size={38} strokeWidth={1.6} />
          </div>
          <p className="modal-lead">
            Three bumps, no hearts left. A fresh start might do the trick.
          </p>
          <p className="loss-progress">
            {freed.toLocaleString()} of {total.toLocaleString()} arrows freed
          </p>
          <button className="primary-button" onClick={restart}>
            Try again <RotateCcw size={17} />
          </button>
          <button className="secondary-button" onClick={() => setMaking(true)}>
            New puzzle <Sparkles size={17} />
          </button>
          <button
            className="continue-button"
            onClick={() => {
              resume();
              setToast(null);
              setHint(null);
              clearFeedback();
            }}
          >
            …or quietly continue with 3 more lives
          </button>
        </Modal>
      )}

      {win && (
        <Modal title="A little lighter." onClose={() => setWin(false)} className="win-modal">
          {!reducedMotion && (
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 30 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      '--i': i,
                      '--color': palette[i % palette.length],
                      '--left': `${(i * 37) % 100}%`,
                      '--delay': `${(i % 7) * -0.23}s`,
                      '--rotate': `${i * 41}deg`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          <div className="win-emblem">
            <Sparkles size={39} strokeWidth={1.6} />
          </div>
          <span className="eyebrow">{generated ? 'YOUR TANGLE' : 'LEVEL 01'} · ALL CLEAR</span>
          <p className="modal-lead">
            {total.toLocaleString()} arrows, a little patience, and a lovely bit of clarity.
          </p>
          <div className="win-stats">
            <div>
              <strong>
                {total.toLocaleString()}
                <span>/{total.toLocaleString()}</span>
              </strong>
              <span>arrows freed</span>
            </div>
            <div>
              <strong>{hints}</strong>
              <span>{hints === 1 ? 'little hint' : 'little hints'}</span>
            </div>
            <div>
              <strong>{mistakes}</strong>
              <span>{mistakes === 1 ? 'gentle bump' : 'gentle bumps'}</span>
            </div>
          </div>
          <button
            className="primary-button"
            autoFocus
            onClick={() => {
              setWin(false);
              setMaking(true);
            }}
          >
            New puzzle <ArrowRight size={17} />
          </button>
          <button className="next-chapter" onClick={restart}>
            Play again
          </button>
        </Modal>
      )}
    </main>
  );
}
