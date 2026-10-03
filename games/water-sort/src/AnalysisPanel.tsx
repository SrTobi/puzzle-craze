import { useState } from 'react';
import { ArrowLeft, ArrowRight, FlaskConical } from 'lucide-react';
import type { PositionStats, StateFilter } from './game/analysis';
import type { AnalysisPage, AnalysisReady } from './useLevelAnalysis';
import { liquidColor } from './Tube';

const count = (value: number) => value.toLocaleString();
export function AnalysisPanel({
  ready,
  position,
  moves,
  completed,
  page,
  requestPage,
}: {
  ready: AnalysisReady;
  position: PositionStats | null;
  moves: number;
  completed: number;
  page: AnalysisPage | null;
  requestPage: (offset: number, filter: StateFilter) => void;
}) {
  const [filter, setFilter] = useState<StateFilter>('all');
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const { level, summary } = ready;
  function changePage(next: number, nextFilter = filter) {
    setOffset(next);
    setFilter(nextFilter);
    requestPage(next, nextFilter);
  }
  return (
    <aside className="water-analysis" aria-label="Level analysis">
      {level.tutorial && (
        <div className="water-tutorial">
          <FlaskConical size={20} />
          <div>
            <h2>Tutorial {level.number} of 3</h2>
            <p>{level.tutorial}</p>
          </div>
        </div>
      )}
      <p className="water-eyebrow">THE SCIENCE OF THIS MIX</p>
      <h2>Every route, explored.</h2>
      <p className="water-analysis-caption">
        {level.tutorial ? 'Guided layout' : `Seed ${level.seed}`} · {level.colors} colors ·{' '}
        {level.board.length - level.colors} empty tubes
      </p>
      {level.difficulty && (
        <section className="water-position" aria-label="Difficulty rating">
          <h3>
            {level.number < 10 ? 'Warm-up' : 'Challenge'} · {level.number} / 1,000
          </h3>
          <strong>
            {level.difficulty.winningLosingRatio === null
              ? 'Only winning choices'
              : `${level.difficulty.winningLosingRatio.toFixed(2)} : 1 winning / losing`}
          </strong>
          <dl>
            <dt>Average winning moves</dt>
            <dd>{level.difficulty.averageWinningMoves.toFixed(2)}</dd>
            <dt>Average losing moves</dt>
            <dd>{level.difficulty.averageLosingMoves.toFixed(2)}</dd>
            <dt>Winnable states with a trap</dt>
            <dd>{count(level.difficulty.trapStates)}</dd>
          </dl>
          <p>
            Higher ratios are easier. Average winning choices ÷ losing choices at configurations
            with at least one losing choice. A winning choice keeps a route to the goal open.
            Configurations with no losing choices are excluded from this ratio.
          </p>
        </section>
      )}
      <section
        className={`water-position ${position?.unwinnable ? 'is-unwinnable' : ''}`}
        aria-label="Current configuration"
      >
        <h3>
          Your configuration{' '}
          {position?.id !== null && position?.id !== undefined ? `#${position.id}` : ''}
        </h3>
        <strong>
          {!position
            ? 'Analyzing…'
            : position.unwinnable
              ? 'Unwinnable'
              : position.distance === 0
                ? 'Solved'
                : `${position.distance} moves to win`}
        </strong>
        {position?.unwinnable && (
          <p>No route reaches the goal from here, even if pours remain. Undo or restart.</p>
        )}
        <dl>
          <dt>Improving moves</dt>
          <dd>{position ? `${position.improvingMoves} / ${position.legalMoves}` : '—'}</dd>
          <dt>Moves into losing states</dt>
          <dd>{position?.losingMoves ?? '—'}</dd>
          <dt>Same distance / farther</dt>
          <dd>{position ? `${position.neutralMoves} / ${position.worseningMoves}` : '—'}</dd>
          <dt>Pours used + shortest remaining</dt>
          <dd>{position?.distance !== null && position ? moves + position.distance : '—'}</dd>
        </dl>
      </section>
      <h3>The complete graph</h3>
      <dl className="water-stat-list">
        <dt>Starting shortest path</dt>
        <dd>{summary.startDistance} pours</dd>
        <dt>Normalized configurations</dt>
        <dd>{count(summary.configurations)}</dd>
        <dt>Winnable</dt>
        <dd>{count(summary.winnable)}</dd>
        <dt>Unwinnable</dt>
        <dd>{count(summary.unwinnable)}</dd>
        <dt>Average improving moves</dt>
        <dd>{summary.averageImprovingMoves.toFixed(2)}</dd>
        <dt>Average distinct improving outcomes</dt>
        <dd>{summary.averageImprovingOutcomes.toFixed(2)}</dd>
        <dt>Mean / longest shortest path</dt>
        <dd>
          {summary.averageDistance.toFixed(1)} / {summary.maxDistance}
        </dd>
        <dt>Distinct transitions</dt>
        <dd>{count(summary.transitions)}</dd>
        <dt>Legal pours across all states</dt>
        <dd>{count(summary.legalMoves)}</dd>
        <dt>Normalized self-loops</dt>
        <dd>{count(summary.selfLoops)}</dd>
        <dt>States with no legal moves</dt>
        <dd>{count(summary.deadEnds)}</dd>
        <dt>Winning configurations</dt>
        <dd>{summary.winningConfigurations}</dd>
        <dt>Analysis time</dt>
        <dd>{(ready.elapsedMs / 1000).toFixed(2)} s</dd>
      </dl>
      <p className="water-stats-explainer">
        Improving-move and distance averages give equal weight to every winnable configuration,
        including the goal (zero improving moves). Different bottle choices count separately;
        equivalent outcomes count once in the graph. One pour is one move, even when pours overlap.
      </p>
      {ready.attempts.length > 1 && (
        <details>
          <summary>Empty-bottle search · {ready.attempts.length} attempts</summary>
          <ul>
            {ready.attempts.map((attempt) => (
              <li key={attempt.emptyTubes}>
                {attempt.emptyTubes} empty: {count(attempt.configurations)} configurations ·{' '}
                {attempt.winnable ? 'solvable' : 'no winning state'}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details
        open={open}
        onToggle={(event) => {
          const next = event.currentTarget.open;
          setOpen(next);
          if (next && !page) requestPage(offset, filter);
        }}
      >
        <summary>Explore every configuration</summary>
        <label className="water-state-filter">
          Show{' '}
          <select
            value={filter}
            onChange={(event) => changePage(0, event.target.value as StateFilter)}
          >
            <option value="all">All configurations</option>
            <option value="winnable">Winnable only</option>
            <option value="unwinnable">Unwinnable only</option>
          </select>
        </label>
        {!page ? (
          <p role="status">Loading configurations…</p>
        ) : (
          <>
            <p className="water-analysis-caption">
              {page.total ? `${page.offset + 1}–${page.offset + page.rows.length}` : '0'} of{' '}
              {count(page.total)}
            </p>
            <div className="water-state-rows">
              {page.rows.map((row) => (
                <details key={row.id}>
                  <summary>
                    <span>#{row.id}</span>
                    <span>{row.distance === null ? 'Unwinnable' : `${row.distance} to win`}</span>
                    <span>
                      {row.improvingMoves}/{row.legalMoves} improve
                    </span>
                  </summary>
                  <div className="water-mini-board">
                    {row.board.map((tube, i) => (
                      <div
                        key={i}
                        className="water-mini-tube"
                        aria-label={`Tube ${i + 1}, bottom to top: ${tube.map((c) => liquidColor(c).name).join(', ') || 'empty'}`}
                        title={`Bottom to top: ${tube.map((c) => liquidColor(c).name).join(', ') || 'empty'}`}
                      >
                        {tube.map((c, j) => (
                          <span key={j} style={{ background: liquidColor(c).color }} />
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <div className="water-page-controls">
              <button
                aria-label="Previous configurations"
                disabled={!offset}
                onClick={() => changePage(Math.max(0, offset - 10))}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                aria-label="Next configurations"
                disabled={offset + 10 >= page.total}
                onClick={() => changePage(offset + 10)}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </details>
      <p className="water-collection-progress">
        {count(completed)} experiments completed · Keep exploring.
      </p>
    </aside>
  );
}
