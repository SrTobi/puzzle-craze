import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { GameBreadcrumb } from '../../../shared/components/GameBreadcrumb';
import { links } from '../../../shared/links';
import { Dialog } from './Dialog';
import { liquidColor, Tube } from './Tube';
import { isSolved, isSorted, legalMoves, pourAmount, type Move } from './game/engine';
import {
  catalogEntry,
  colorCount,
  initialLevel,
  isLevelNumber,
  TOTAL_LEVELS,
  type Level,
} from './game/levels';
import { configurationKey } from './game/analysis';
import { COLOR_STAGES } from './game/colorStages';
import { useLevelAnalysis } from './useLevelAnalysis';
import { AnalysisPanel } from './AnalysisPanel';
import { freshRun, loadProgress, STORAGE_KEY, validBoard, type Run } from './game/storage';
import { availablePourSide, reservePour } from './game/pours';
import { PourAnimation, type AnimatedPour } from './PourAnimation';
import { POUR_DURATION, visibleAmount } from './game/pourTimeline';

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [message, setMessage] = useState('Choose a tube. Find a little flow.');
  const [dialog, setDialog] = useState<'levels' | 'help' | null>(null);
  const [animations, setAnimations] = useState<AnimatedPour[]>([]);
  const nextPourId = useRef(0);
  const pouring = animations.length > 0;
  const [animationTime, setAnimationTime] = useState(0);
  useEffect(() => {
    if (!pouring) return;
    let frame: number;
    function tick(now: number) {
      setAnimationTime(now);
      setAnimations((active) =>
        active.some((pour) => now - pour.startedAt >= POUR_DURATION)
          ? active.filter((pour) => now - pour.startedAt < POUR_DURATION)
          : active,
      );
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pouring]);
  const [saved, setSaved] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const levelNumber = Number(progress.selected);
  const analysis = useLevelAnalysis(levelNumber);
  const loading = !analysis.ready;
  const placeholder = useMemo<Level>(
    () => ({
      ...initialLevel(levelNumber),
      board: [],
    }),
    [levelNumber],
  );
  const level = analysis.ready?.level ?? placeholder;
  const run = useMemo(() => {
    const saved = progress.runs[level.id];
    return saved && validBoard(saved.board, level) ? saved : freshRun(level);
  }, [progress.runs, level]);
  const [jump, setJump] = useState(progress.selected);
  const [pickerStart, setPickerStart] = useState(4);
  const [jumpError, setJumpError] = useState('');
  const positionKey = configurationKey(run.board);
  const position = !loading && analysis.position?.key === positionKey ? analysis.position : null;
  useEffect(() => {
    if (!loading) analysis.inspect(run.board);
  }, [run.board, loading, analysis.inspect]);
  useEffect(() => {
    if (position && position.id === null) {
      setProgress((p) => ({ ...p, runs: { ...p.runs, [level.id]: freshRun(level) } }));
      setMessage(
        'The saved configuration was not part of this level. Restored its starting layout.',
      );
    }
  }, [position, level]);
  const { board, moves, history } = run;
  const solved = !loading && !pouring && isSolved(board);
  const sorted = board.filter(isSorted).length;
  const stuck =
    !loading && !pouring && !solved && (position?.unwinnable || legalMoves(board).length === 0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [progress]);

  function replaceRun(next: Run) {
    setProgress((p) => ({ ...p, runs: { ...p.runs, [level.id]: next } }));
    setSelected(null);
    setHint(null);
  }
  function undo() {
    if (loading || pouring || !history.length) return;
    replaceRun({ board: history.at(-1)!, history: history.slice(0, -1), moves: moves - 1 });
    setMessage('One step back. A fresh perspective.');
  }
  function restart() {
    if (loading || pouring) return;
    replaceRun(freshRun(level));
    setMessage('A fresh start. Take your time.');
  }
  function showHint() {
    if (pouring || solved) return;
    if (loading || !position) return;
    if (position.hint) {
      setHint(position.hint);
      setSelected(position.hint.from);
      setMessage(
        `Shortest route: pour tube ${position.hint.from + 1} into tube ${position.hint.to + 1}.`,
      );
    } else {
      setMessage('This configuration is unwinnable. Undo a pour or restart.');
    }
  }

  function selectLevel(id: string) {
    if (pouring || !isLevelNumber(Number(id))) return;
    id = String(Number(id));
    setJump(id);
    setJumpError('');
    setProgress((p) => ({ ...p, selected: id }));
    setSelected(null);
    setHint(null);
    setDialog(null);
    setMessage('Choose a tube. Find a little flow.');
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        dialog ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.target instanceof HTMLInputElement
      )
        return;
      if (event.key.toLowerCase() === 'u') {
        event.preventDefault();
        undo();
      }
      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        showHint();
      }
      if (event.key === 'Escape') {
        setSelected(null);
        setHint(null);
        setMessage('Selection cleared. Choose any tube.');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function tapTube(index: number) {
    if (loading || solved) return;
    const moving = animations.some(({ move }) => move.from === index);
    const receiving = animations.some(({ move }) => move.to === index);
    if (moving || (selected === null && receiving)) {
      setMessage('Let that tube finish pouring, then pick it up. You can use another tube now.');
      return;
    }
    if (selected === index) {
      setSelected(null);
      setHint(null);
      setMessage('Selection cleared. Choose any tube.');
      return;
    }
    if (selected === null) {
      if (!board[index].length) {
        setMessage('Choose a tube with liquid first.');
        return;
      }
      setSelected(index);
      setHint(null);
      setMessage(
        `Tube ${index + 1} selected. Pour into an empty tube or onto ${liquidColor(board[index].at(-1)!).name.toLowerCase()}.`,
      );
      return;
    }
    const move = { from: selected, to: index };
    if (!pourAmount(board, move)) {
      setMessage(
        board[index].length === 4
          ? 'That tube is full. Choose another, or tap the selected tube to put it down.'
          : 'Colors must match at the top. Choose another tube, or tap the selected tube to put it down.',
      );
      return;
    }
    const container = boardRef.current!;
    const bounds = container.getBoundingClientRect();
    const source = container
      .querySelector(`[data-tube="${selected}"] .water-glass`)!
      .getBoundingClientRect();
    const sourceSlot = container
      .querySelector(`[data-tube="${selected}"] .water-glass-slot`)!
      .getBoundingClientRect();
    const target = container
      .querySelector(`[data-tube="${index}"] .water-glass-slot`)!
      .getBoundingClientRect();
    const reservation = reservePour(
      run,
      animations,
      move,
      source.left < target.left ? 'left' : 'right',
    );
    if (!reservation) {
      setMessage(
        'Both sides of that tube are busy. Choose another tube or wait for a pour to finish.',
      );
      return;
    }
    const scale = source.width / 72;
    const lipX = source.width / 2;
    const lipY = 16 * scale;
    const offset = (reservation.side === 'left' ? -9 : 9) * scale;
    const id = nextPourId.current++;
    const startedAt = performance.now();
    setAnimationTime(startedAt);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      setAnimations((active) => [
        ...active,
        {
          id,
          move,
          side: reservation.side,
          liquid: reservation.liquid,
          amount: reservation.liquid.length - reservation.run.board[move.from].length,
          startedAt,
          x: target.left - sourceSlot.left + offset,
          y: target.top - sourceSlot.top - 48,
          startY: source.top - sourceSlot.top,
          style: {
            left: sourceSlot.left - bounds.left - container.clientLeft,
            top: sourceSlot.top - bounds.top - container.clientTop,
            width: source.width,
            transformOrigin: `${lipX}px ${lipY}px`,
          } as CSSProperties,
          stream: {
            left: target.left - bounds.left - container.clientLeft + lipX + offset - 2,
            top: target.top - bounds.top - container.clientTop + lipY - 48,
            height: 53,
            backgroundColor: liquidColor(board[selected].at(-1)!).color,
          },
        },
      ]);
    setProgress((previous) => ({
      ...previous,
      runs: { ...previous.runs, [level.id]: reservation.run },
      completed:
        isSolved(reservation.run.board) && !previous.completed.includes(level.id)
          ? [...previous.completed, level.id]
          : previous.completed,
    }));
    setSelected(null);
    setHint(null);
    setMessage('Let it flow. You can pour another tube while this one settles.');
  }

  return (
    <div className="water-app">
      <header className="water-topbar">
        <GameBreadcrumb>
          <a className="water-brand" href={links.waterSort}>
            <FlaskConical size={27} />
            <span>
              Water <span>Sort</span>
              <b>.</b>
            </span>
          </a>
        </GameBreadcrumb>
        <button
          className="water-help"
          aria-label="How to play"
          disabled={pouring}
          onClick={() => setDialog('help')}
        >
          <CircleHelp size={18} />
          <span>How to play</span>
        </button>
      </header>
      <main className="water-main">
        <div className="water-heading">
          <div>
            <button
              className="water-level-picker"
              disabled={pouring}
              onClick={() => {
                setJump(progress.selected);
                setPickerStart(4 + Math.floor(Math.max(0, level.number - 4) / 20) * 20);
                setDialog('levels');
              }}
            >
              THE COLOR LAB{' '}
              <span>
                {level.number <= 3 ? `TUTORIAL ${level.number}` : `LEVEL ${level.number}`}
              </span>
              <ChevronDown size={14} />
            </button>
            <h1>{level.name}</h1>
            <p>
              {level.number <= 3
                ? 'Your first steps in the color lab.'
                : `Seed ${level.seed} · ${level.colors} colors · ${level.number < 10 ? 'Find your flow.' : 'Every choice counts.'}`}
            </p>
          </div>
          <div className="water-progress">
            <div>
              <FlaskConical size={23} />
            </div>
            <span>
              <strong>
                {sorted}
                <span> / {level.colors}</span>
              </strong>
              <small>COLORS SORTED</small>
            </span>
          </div>
        </div>
        <div className="water-workspace">
          <section className="water-play" aria-label="Water sorting puzzle">
            <div className="water-board-meta">
              <span>
                <span className="water-status-dot" />{' '}
                {level.colors <= 3
                  ? 'A gentle beginning'
                  : level.colors <= 5
                    ? 'Finding your flow'
                    : 'A deeper experiment'}
              </span>
              <span>
                {moves} {moves === 1 ? 'pour' : 'pours'}
              </span>
            </div>
            {loading ? (
              <div className="water-generation" role="status">
                <FlaskConical size={34} />
                <h2>
                  {analysis.error
                    ? 'Analysis could not finish'
                    : analysis.paused
                      ? 'Analysis paused'
                      : 'Exploring every configuration…'}
                </h2>
                {analysis.error ? (
                  <p>{analysis.error}</p>
                ) : (
                  <>
                    <p>
                      {analysis.progress
                        ? `${analysis.progress.discovered.toLocaleString()} configurations found · ${analysis.progress.explored.toLocaleString()} processed`
                        : 'Restoring this puzzle and checking every route.'}
                    </p>
                    {analysis.progress && (
                      <p>
                        {analysis.progress.emptyTubes} empty{' '}
                        {analysis.progress.emptyTubes === 1 ? 'bottle' : 'bottles'} ·{' '}
                        {analysis.progress.phase === 'exploring'
                          ? 'Enumerating the complete graph'
                          : analysis.progress.phase === 'distances'
                            ? 'Computing shortest paths'
                            : 'Calculating statistics'}
                      </p>
                    )}
                    {analysis.paused ? (
                      <>
                        <p>
                          Exact statistics need the complete graph. Continue to explore more states;
                          larger graphs use more memory. Nothing has been labeled unwinnable yet.
                        </p>
                        <button className="water-next" onClick={analysis.resume}>
                          Continue analysis
                          <ArrowRight size={17} />
                        </button>
                      </>
                    ) : (
                      <button onClick={analysis.pause}>Pause analysis</button>
                    )}
                  </>
                )}
                <button onClick={() => setDialog('levels')}>Choose another level</button>
              </div>
            ) : (
              <>
                <div className={`water-board ${pouring ? 'is-pouring' : ''}`} ref={boardRef}>
                  <div className="water-tubes" data-count={board.length}>
                    {board.map((tube, index) => {
                      const target =
                        selected !== null &&
                        !!pourAmount(board, { from: selected, to: index }) &&
                        availablePourSide(animations, { from: selected, to: index }) !== null;
                      const moving = animations.some(({ move }) => move.from === index);
                      const receiving = animations.some(({ move }) => move.to === index);
                      return (
                        <button
                          key={index}
                          data-tube={index}
                          className={`water-tube ${selected === index ? 'is-selected' : ''} ${target ? 'is-target' : ''} ${isSorted(tube) ? 'is-sorted' : ''} ${hint?.to === index ? 'is-hint' : ''} ${moving ? 'is-source' : ''} ${receiving ? 'is-receiving' : ''}`}
                          aria-label={`Tube ${index + 1}: ${
                            tube.length
                              ? tube
                                  .map((c) => liquidColor(c).name)
                                  .reverse()
                                  .join(', ') + ', top to bottom'
                              : 'empty'
                          }${isSorted(tube) ? ', sorted' : ''}`}
                          aria-pressed={selected === index}
                          aria-disabled={solved || moving || (selected === null && receiving)}
                          onClick={() => tapTube(index)}
                        >
                          <span className="water-tube-mark">
                            {isSorted(tube) ? (
                              <Check size={16} />
                            ) : hint?.to === index ? (
                              <ArrowRight size={16} />
                            ) : (
                              <span />
                            )}
                          </span>
                          <span className="water-glass-slot">
                            <Tube
                              liquid={tube}
                              amount={visibleAmount(
                                tube.length,
                                animations.filter(({ move }) => move.to === index),
                                animationTime,
                              )}
                            />
                          </span>
                          <span className="water-tube-number">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {animations.map((pour) => (
                    <PourAnimation key={pour.id} pour={pour} now={animationTime} />
                  ))}
                </div>
                <div
                  className={`water-feedback ${solved ? 'is-complete' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {solved ? (
                    <>
                      <Sparkles size={19} />
                      <strong>Beautifully balanced.</strong> Every color has found its place.
                    </>
                  ) : stuck ? (
                    'This configuration is unwinnable. Undo a move or restart to find a route to the goal.'
                  ) : (
                    message
                  )}
                </div>
                <div className="water-controls">
                  <button onClick={undo} disabled={pouring || !history.length}>
                    <Undo2 size={19} />
                    Undo<kbd>U</kbd>
                  </button>
                  <button onClick={restart} disabled={pouring || !moves}>
                    <RotateCcw size={18} />
                    Restart
                  </button>
                  <button onClick={showHint} disabled={pouring || solved || !position}>
                    <Lightbulb size={19} />
                    Hint<kbd>H</kbd>
                  </button>
                </div>
                {solved && level.number < TOTAL_LEVELS && (
                  <button
                    className="water-next"
                    onClick={() => selectLevel(String(level.number + 1))}
                  >
                    Next experiment <ArrowRight size={18} />
                  </button>
                )}
              </>
            )}
            {solved && level.number === TOTAL_LEVELS && (
              <p className="water-feedback is-complete">
                Final experiment solved. Explore the collection or replay your favorites.
              </p>
            )}
            <p className="water-board-foot">
              No timer. No rush. Just one thoughtful pour at a time.
            </p>
          </section>
          {analysis.ready && (
            <AnalysisPanel
              key={level.number}
              ready={analysis.ready}
              position={position}
              moves={moves}
              completed={progress.completed.length}
              page={analysis.page}
              requestPage={analysis.requestPage}
            />
          )}
        </div>
        {!saved && (
          <p className="water-save-warning" role="status">
            Progress could not be saved. Keep this tab open to continue playing.
          </p>
        )}
      </main>
      <footer className="water-footer">
        <span>POUR. PAUSE. FIND YOUR FLOW.</span>
        <span>Puzzle Craze · Small games, curious minds.</span>
      </footer>
      {dialog && (
        <Dialog
          title={dialog === 'help' ? 'A little color chemistry' : 'Choose an experiment'}
          onClose={() => setDialog(null)}
        >
          {dialog === 'levels' ? (
            <div>
              <form
                className="water-level-jump"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!isLevelNumber(Number(jump))) {
                    setJumpError(`Choose a level from 1 to ${TOTAL_LEVELS}.`);
                    return;
                  }
                  selectLevel(jump);
                }}
              >
                <label htmlFor="water-level-number">Go to a level (1–1,000)</label>
                <div>
                  <input
                    id="water-level-number"
                    type="number"
                    min="1"
                    max={TOTAL_LEVELS}
                    step="1"
                    value={jump}
                    onChange={(event) => setJump(event.target.value)}
                  />
                  <button type="submit">
                    Go <ArrowRight size={16} />
                  </button>
                </div>
                {jumpError && <p role="alert">{jumpError}</p>}
              </form>
              <p className="water-analysis-caption">
                1–3: guided tutorials · 4–9: easy warm-ups.
                <br />
                New colors arrive gradually:
                <br />
                {COLOR_STAGES.map(
                  ({ first, last, colors }) => `${first}–${last}: ${colors.join(' or ')} colors`,
                ).join(' · ')}
              </p>
              <div className="water-level-list">
                {[
                  1,
                  2,
                  3,
                  ...Array.from(
                    { length: Math.min(20, TOTAL_LEVELS - pickerStart + 1) },
                    (_, i) => pickerStart + i,
                  ),
                ].map((number) => (
                  <button
                    key={number}
                    aria-current={number === level.number ? 'true' : undefined}
                    onClick={() => selectLevel(String(number))}
                  >
                    <span>{String(number).padStart(2, '0')}</span>
                    <span>
                      <strong>
                        {number <= 3 ? initialLevel(number).name : `Experiment ${number}`}
                      </strong>
                      <small>
                        {number <= 3 ? 'Tutorial' : `Seed ${catalogEntry(number)?.seed}`} ·{' '}
                        {colorCount(number)} colors
                      </small>
                    </span>
                    {progress.completed.includes(String(number)) ? (
                      <CheckCheck size={19} aria-label="Completed" />
                    ) : (
                      <ArrowRight size={17} />
                    )}
                  </button>
                ))}
              </div>
              <div className="water-page-controls">
                <button
                  disabled={pickerStart === 4}
                  onClick={() => setPickerStart(Math.max(4, pickerStart - 20))}
                >
                  Previous levels
                </button>
                <button
                  disabled={pickerStart + 20 > TOTAL_LEVELS}
                  onClick={() => setPickerStart(pickerStart + 20)}
                >
                  More levels <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="water-rules">
              <p>
                Tap a tube to lift it, then tap another to pour. You can pour into an empty tube or
                onto the same color, if there is room.
              </p>
              <p>
                The whole matching group at the top moves together, up to the available space. Each
                tube holds four layers.
              </p>
              <p>Finish with every tube either empty or full of a single color.</p>
              <p>
                Tap the selected tube again or press Escape to put it down. Undo and hints are
                always free. You can pour other tubes while a pour is in progress. Two tubes can
                pour into the same destination together, one from each side.
              </p>
              <p>
                The first 20 levels use three colors. Then 30 levels mix three and four colors,
                followed by ten levels with four colors. Repeat that pattern with four/five,
                five/six, and six/seven colors; from level 171, stay at seven. Within each range,
                puzzles run from higher to lower average winning-to-losing choice ratios: higher is
                easier. Every challenge from level 10 has traps and needs at least ten pours to
                solve. The collection contains 1,000 levels, each with a saved seed and color count.
              </p>
              <p>
                The sidebar shows exact shortest distances and which configurations cannot win. Hint
                chooses an improving move on a shortest route. Liquid color names are included in
                each tube’s screen-reader label.
              </p>
              <p>
                <strong>Keyboard:</strong> Tab between tubes, Enter or Space to select and pour.{' '}
                <kbd>U</kbd> to undo, <kbd>H</kbd> for a hint.
              </p>
              <button className="water-next" onClick={() => setDialog(null)}>
                Let’s mix things up
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
