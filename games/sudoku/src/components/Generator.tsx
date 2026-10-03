import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Dices,
  Grid3X3,
  LoaderCircle,
  MoveDiagonal,
  Palette,
  Puzzle as PuzzleIcon,
} from 'lucide-react';
import { Dialog } from './Dialog';
import { Features } from './Features';
import { SIZES, type Options, type Puzzle } from '../game/types';

export function Generator({
  onClose,
  onPlay,
  previous,
}: {
  onClose: () => void;
  onPlay: (puzzle: Puzzle) => void;
  previous?: Options;
}) {
  const [options, setOptions] = useState<Options>(
    () =>
      previous ?? {
        size: 9,
        regions: 'boxes',
        colors: false,
        diagonal: false,
        density: 'gentle',
        seed: String(Math.floor(Math.random() * 1_000_000)),
      },
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timeout.current);
    },
    [],
  );
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timeout.current);
    setBusy(false);
  }
  function update(next: Partial<Options>) {
    setOptions((o) => ({ ...o, ...next }));
    setError('');
  }
  function generate() {
    stop();
    setError('');
    setBusy(true);
    setMessage('Finding a grid that fits your rules…');
    try {
      const instance = new Worker(new URL('../game/generator.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = instance;
      instance.onmessage = (event) => {
        if (worker.current !== instance) return;
        if (event.data.type === 'progress') setMessage(event.data.message);
        else {
          stop();
          if (event.data.type === 'result') onPlay(event.data.puzzle);
          else setError(event.data.message);
        }
      };
      instance.onerror = () => {
        if (worker.current === instance) {
          stop();
          setError('Generation was interrupted. Please try again.');
        }
      };
      timeout.current = setTimeout(() => {
        if (worker.current === instance) {
          stop();
          setError('This seed is taking too long. Try a new seed.');
        }
      }, 30_000);
      instance.postMessage(options);
    } catch {
      stop();
      setError('The generator could not start. Reload the page and try again.');
    }
  }
  return (
    <Dialog title="Make it your own." onClose={onClose} wide>
      <p className="sudoku-dialog-lead">A familiar puzzle. Your own mix of possibilities.</p>
      <div className="sudoku-generator-layout">
        <div className="sudoku-recipe">
          <Grid3X3 size={46} strokeWidth={1} />
          <strong>
            {options.size} × {options.size}
          </strong>
          <p>
            Numbers 1–{options.size}.<br />
            Every group, exactly once.
          </p>
          <Features options={options} />
          <p className="sudoku-recipe-foot">
            Every generated puzzle is checked for exactly one solution.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <fieldset className="sudoku-generator-fields" disabled={busy}>
            <legend className="sr-only">Puzzle options</legend>
            <label>
              Board size
              <select
                value={options.size}
                onChange={(e) => update({ size: Number(e.target.value) as Options['size'] })}
              >
                {SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} × {size} · numbers 1–{size}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Outlined regions
              <select
                value={options.regions}
                onChange={(e) => update({ regions: e.target.value as Options['regions'] })}
              >
                <option value="boxes">Classic rectangular boxes</option>
                <option value="jigsaw">Connected jigsaw shapes</option>
              </select>
            </label>
            <label className="sudoku-checkbox">
              <input
                type="checkbox"
                checked={options.colors}
                onChange={(e) => update({ colors: e.target.checked })}
              />
              <Palette size={17} />
              <span>
                Color groups<small>Each lettered color needs 1–{options.size} once.</small>
              </span>
            </label>
            <label className="sudoku-checkbox">
              <input
                type="checkbox"
                checked={options.diagonal}
                onChange={(e) => update({ diagonal: e.target.checked })}
              />
              <MoveDiagonal size={17} />
              <span>
                Both diagonals<small>Corner to corner, every number once.</small>
              </span>
            </label>
            {options.regions === 'jigsaw' && (
              <p className="sudoku-field-note">
                <PuzzleIcon size={14} /> Each shape has {options.size} connected cells.
              </p>
            )}
            <label>
              Clue density
              <select
                value={options.density}
                onChange={(e) => update({ density: e.target.value as Options['density'] })}
              >
                <option value="gentle">Gentle · more clues</option>
                <option value="balanced">Balanced · fewer clues</option>
                <option value="sparse">Sparse · room to think</option>
              </select>
            </label>
            <p className="sudoku-field-note">
              Gentle puzzles can be solved with single-candidate deductions. Other settings aim for
              fewer clues; difficulty varies with the rules.
            </p>
            <label>
              Seed
              <div className="sudoku-seed-field">
                <input
                  aria-label="Seed"
                  required
                  maxLength={80}
                  value={options.seed}
                  onChange={(e) => update({ seed: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Random seed"
                  title="Random seed"
                  onClick={() =>
                    update({ seed: String(Math.floor(Math.random() * 1_000_000_000)) })
                  }
                >
                  <Dices size={19} />
                </button>
              </div>
            </label>
            <p className="sudoku-field-note">
              The same seed and settings make the same puzzle. Your most recent custom puzzle is
              saved here.
            </p>
            <button className="sudoku-primary" type="submit" disabled={!options.seed.trim()}>
              <span>Generate & play</span>
              <ArrowRight size={17} />
            </button>
          </fieldset>
          {busy && (
            <div className="sudoku-generation" role="status">
              <LoaderCircle className="sudoku-spin" size={18} />
              <span>{message}</span>
              <button type="button" onClick={stop}>
                Cancel
              </button>
            </div>
          )}
          {error && (
            <p className="sudoku-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </Dialog>
  );
}
