import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, RefreshCw, Upload } from 'lucide-react';
import { Modal } from './Modal';
import { MAX_SIDE } from '../game/grid';
import type { GeneratedPuzzle, GenerationProgress } from '../generation/generator';
import { analyzeImage, pixelsToMask, shapeMask } from '../generation/masks';
import type { Shape } from '../generation/masks';

export function downloadPuzzle(puzzle: GeneratedPuzzle) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(puzzle, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `arrow-surgery-${puzzle.generation.seed.replace(/[^a-z0-9_-]/gi, '-').slice(0, 50) || 'puzzle'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Generator({
  onClose,
  onPlay,
  onOriginal,
}: {
  onClose: () => void;
  onPlay: (puzzle: GeneratedPuzzle) => void;
  onOriginal: () => void;
}) {
  const [shape, setShape] = useState<Shape | 'image'>('rectangle');
  const [columns, setColumns] = useState(24);
  const [rows, setRows] = useState(24);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1000000)));
  const [length, setLength] = useState(10);
  const [repair, setRepair] = useState(true);
  const [manualThreshold, setManualThreshold] = useState<number | null>(null);
  const [invert, setInvert] = useState(false);
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [imageName, setImageName] = useState('My silhouette');
  const [loadingImage, setLoadingImage] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GeneratedPuzzle | null>(null);
  const worker = useRef<Worker | null>(null);
  const imageRequest = useRef(0);
  const preview = useRef<HTMLCanvasElement>(null);
  const validSize = [columns, rows].every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_SIDE);
  const imagePixels = useMemo(() => {
    if (!validSize || !source || shape !== 'image') return null;
    const canvas = document.createElement('canvas');
    canvas.width = columns;
    canvas.height = rows;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const scale = Math.min(columns / source.width, rows / source.height);
    const w = source.width * scale,
      h = source.height * scale;
    ctx.drawImage(source, (columns - w) / 2, (rows - h) / 2, w, h);
    return ctx.getImageData(0, 0, columns, rows).data;
  }, [columns, rows, validSize, shape, source]);
  const imageAnalysis = useMemo(
    () => (imagePixels ? analyzeImage(imagePixels) : null),
    [imagePixels],
  );
  const threshold = manualThreshold ?? imageAnalysis?.threshold ?? 128;
  const histogramMax = imageAnalysis?.histogram.reduce((max, n) => Math.max(max, n), 1) ?? 1;
  const mask = useMemo(() => {
    if (!validSize) return new Uint8Array();
    if (shape !== 'image') return shapeMask(shape, columns, rows);
    return imagePixels
      ? pixelsToMask(imagePixels, threshold, invert)
      : new Uint8Array(columns * rows);
  }, [columns, rows, validSize, shape, imagePixels, threshold, invert]);
  const filled = useMemo(() => mask.reduce((sum, n) => sum + n, 0), [mask]);

  useEffect(() => {
    setResult(null);
    setError('');
  }, [mask, seed, length, repair]);
  useEffect(
    () => () => {
      source?.close();
    },
    [source],
  );
  useEffect(
    () => () => {
      worker.current?.terminate();
      imageRequest.current++;
    },
    [],
  );
  useEffect(() => {
    const canvas = preview.current;
    if (!canvas || !validSize) return;
    canvas.width = columns;
    canvas.height = rows;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(columns, rows);
    const final = result?.generation.finalMask.join('');
    for (let i = 0; i < mask.length; i++) {
      const enabled = final ? final[i] === '1' : Boolean(mask[i]);
      const added = enabled && !mask[i],
        removed = !enabled && mask[i];
      const color = added
        ? [66, 169, 154]
        : removed
          ? [239, 129, 110]
          : enabled
            ? [130, 112, 223]
            : [237, 237, 229];
      pixels.data.set([...color, 255], i * 4);
    }
    ctx.putImageData(pixels, 0, 0);
  }, [mask, columns, rows, validSize, result]);

  const cancel = () => {
    worker.current?.terminate();
    worker.current = null;
    setProgress(null);
  };
  const generate = () => {
    cancel();
    setResult(null);
    setError('');
    setProgress({ phase: 'Starting a fresh tangle', fraction: 0 });
    const instance = new Worker(new URL('../generation/generator.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    instance.onmessage = (event) => {
      if (worker.current !== instance) return;
      if (event.data.type === 'progress') setProgress(event.data.progress);
      else {
        if (event.data.type === 'result') setResult(event.data.result);
        else setError(event.data.message);
        cancel();
      }
    };
    instance.onerror = () => {
      if (worker.current === instance) {
        setError('Generation was interrupted. Try a smaller board.');
        cancel();
      }
    };
    instance.postMessage({
      columns,
      rows,
      mask,
      seed,
      length,
      repair,
      name:
        shape === 'image'
          ? imageName
          : {
              rectangle: 'A fresh tangle',
              heart: 'Heartstrings',
              cat: 'A curious cat',
              butterfly: 'Butterfly effect',
            }[shape],
    });
  };
  const upload = async (file?: File) => {
    if (!file) return;
    const request = ++imageRequest.current;
    setError('');
    setLoadingImage(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
      const bitmap = await createImageBitmap(file);
      if (request !== imageRequest.current) {
        bitmap.close();
        return;
      }
      setSource(bitmap);
      setManualThreshold(null);
      setInvert(false);
      setImageName(file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'My silhouette');
      setShape('image');
    } catch (error) {
      if (request === imageRequest.current)
        setError(error instanceof Error ? error.message : 'Could not read that image.');
    } finally {
      if (request === imageRequest.current) setLoadingImage(false);
    }
  };

  return (
    <Modal title="Make a little tangle." onClose={onClose} className="generator-modal">
      <p className="modal-lead">
        Fill a board, follow a silhouette, or turn your own image into a puzzle.
      </p>
      <div className="generator-layout">
        <div className="mask-preview">
          <canvas
            ref={preview}
            aria-label="Shape preview. Purple points will be filled with arrows; green marks additions and coral marks removals."
          />
          <strong>{filled.toLocaleString()} points to fill</strong>
          <span>
            {result
              ? `${result.generation.stats.arrows.toLocaleString()} arrows · 100% covered`
              : 'Every purple point becomes part of an arrow.'}
          </span>
          {result && (
            <span>
              {result.generation.repairs.length
                ? `Shape edits: ${result.generation.repairs.filter((r) => r.enabled).length} added · ${result.generation.repairs.filter((r) => !r.enabled).length} removed`
                : 'Original shape preserved.'}
            </span>
          )}
        </div>
        <fieldset className="generator-fields" disabled={Boolean(progress) || loadingImage}>
          <label>
            Shape
            <select value={shape} onChange={(e) => setShape(e.target.value as Shape | 'image')}>
              <option value="rectangle">Filled rectangle</option>
              <option value="heart">Heart</option>
              <option value="cat">Cat</option>
              <option value="butterfly">Butterfly</option>
              <option value="image" disabled={!source}>
                My image
              </option>
            </select>
          </label>
          <label className="upload-button">
            <Upload size={16} />{' '}
            {loadingImage ? 'Reading image…' : 'Use an image · color works too'}
            <input
              aria-label="Upload silhouette image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {shape === 'image' && (
            <>
              <label>
                <span>
                  Image threshold · {threshold} {manualThreshold === null ? '(auto)' : '(manual)'}
                </span>
                <svg
                  className="image-histogram"
                  viewBox="0 0 256 42"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {imageAnalysis &&
                    Array.from(imageAnalysis.histogram, (n, value) => (
                      <rect
                        key={value}
                        x={value}
                        y={40 - (36 * n) / histogramMax}
                        width="1"
                        height={(36 * n) / histogramMax}
                        fill={
                          (invert ? value >= threshold : value < threshold) ? '#8270df' : '#c7c5be'
                        }
                      />
                    ))}
                  <line
                    x1={threshold}
                    x2={threshold}
                    y1="0"
                    y2="42"
                    stroke="#dc7865"
                    strokeWidth="2"
                  />
                </svg>
                <input
                  aria-label="Image threshold"
                  type="range"
                  min="1"
                  max="255"
                  value={threshold}
                  onChange={(e) => setManualThreshold(Number(e.target.value))}
                />
              </label>
              <div className="threshold-note">
                <span>Color becomes gray. Auto finds a quiet gap between shades.</span>
                <button
                  type="button"
                  disabled={manualThreshold === null}
                  onClick={() => setManualThreshold(null)}
                >
                  Use auto cutoff
                </button>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={invert}
                  onChange={(e) => setInvert(e.target.checked)}
                />{' '}
                Use light pixels instead of dark
              </label>
            </>
          )}
          <div className="size-presets">
            {[24, 64, 256, 512].map((size) => (
              <button
                type="button"
                key={size}
                className={columns === size && rows === size ? 'selected' : ''}
                onClick={() => {
                  setColumns(size);
                  setRows(size);
                }}
              >
                {size} × {size}
              </button>
            ))}
          </div>
          <div className="field-pair">
            <label>
              Width
              <input
                type="number"
                min="1"
                max={MAX_SIDE}
                value={columns || ''}
                onChange={(e) => setColumns(Number(e.target.value))}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min="1"
                max={MAX_SIDE}
                value={rows || ''}
                onChange={(e) => setRows(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Seed
            <div className="seed-field">
              <input value={seed} maxLength={256} onChange={(e) => setSeed(e.target.value)} />
              <button
                type="button"
                className="icon-button"
                aria-label="Random seed"
                onClick={() => setSeed(String(Math.floor(Math.random() * 1000000)))}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </label>
          <label>
            Arrow length · {length}
            <input
              type="range"
              min="4"
              max="24"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </label>
          <label className="check-label">
            <input type="checkbox" checked={repair} onChange={(e) => setRepair(e.target.checked)} />{' '}
            Allow small shape repairs
          </label>
        </fieldset>
      </div>
      {!validSize && (
        <p className="generation-error" role="alert">
          Choose whole-number dimensions from 1 to {MAX_SIDE}.
        </p>
      )}
      {error && (
        <p className="generation-error" role="alert">
          {error}
        </p>
      )}
      {progress && (
        <div className="generation-progress" role="status">
          <progress value={progress.fraction} max="1" />
          <span>{progress.phase}…</span>
          <button onClick={cancel}>Cancel</button>
        </div>
      )}
      <div className="generator-actions">
        {result ? (
          <>
            <button className="secondary-button" onClick={() => downloadPuzzle(result)}>
              <Download size={17} /> Save puzzle
            </button>
            <button className="primary-button" onClick={() => onPlay(result)}>
              Play this tangle <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <button
            className="primary-button"
            disabled={Boolean(progress) || loadingImage || !validSize || filled === 0}
            onClick={generate}
          >
            Weave my puzzle <ArrowRight size={18} />
          </button>
        )}
      </div>
      <button className="original-level" onClick={onOriginal} disabled={Boolean(progress)}>
        Return to First light
      </button>
      <p className="generator-note">
        Images stay on your device. Same seed and settings, same puzzle. Up to 1,024 × 1,024 points.
      </p>
    </Modal>
  );
}
