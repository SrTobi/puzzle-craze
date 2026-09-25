export type Shape = 'rectangle' | 'heart' | 'cat' | 'butterfly';

export function shapeMask(shape: Shape, columns: number, rows: number): Uint8Array {
  const mask = new Uint8Array(columns * rows);
  const ellipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const u = ((x + 0.5) / columns) * 2 - 1,
        v = ((y + 0.5) / rows) * 2 - 1;
      let enabled = true;
      if (shape === 'heart') {
        const a = u * 1.2,
          b = -v * 1.2;
        enabled = (a * a + b * b - 1) ** 3 - a * a * b ** 3 <= 0;
      } else if (shape === 'cat') {
        const ear = (cx: number) => v > -0.97 && v < -0.32 && Math.abs(u - cx) < (v + 0.97) * 0.6;
        enabled =
          ellipse(u, v, 0, -0.24, 0.62, 0.52) ||
          ellipse(u, v, 0, 0.43, 0.47, 0.52) ||
          ear(-0.43) ||
          ear(0.43) ||
          (ellipse(u, v, 0.53, 0.47, 0.4, 0.43) && !ellipse(u, v, 0.52, 0.34, 0.24, 0.3));
      } else if (shape === 'butterfly') {
        enabled =
          ellipse(u, v, 0, 0.02, 0.1, 0.82) ||
          ellipse(u, v, -0.47, -0.32, 0.46, 0.56) ||
          ellipse(u, v, 0.47, -0.32, 0.46, 0.56) ||
          ellipse(u, v, -0.37, 0.46, 0.32, 0.42) ||
          ellipse(u, v, 0.37, 0.46, 0.32, 0.42);
      }
      mask[y * columns + x] = Number(enabled);
    }
  return mask;
}

function gray(data: ArrayLike<number>, i: number): number {
  return Math.round(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722);
}

/** Separate the main grayscale populations, then prefer a quiet valley between them. */
export function analyzeImage(data: ArrayLike<number>): {
  histogram: Uint32Array;
  threshold: number;
} {
  if (data.length % 4) throw new Error('Invalid image pixels.');
  const histogram = new Uint32Array(256);
  let count = 0,
    sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const value = gray(data, i);
    histogram[value]++;
    count++;
    sum += value;
  }
  // Empty and flat images have no meaningful separation. Keep opaque midtones filled.
  if (!count) return { histogram, threshold: 128 };
  const scores = new Float64Array(256);
  let leftCount = 0,
    leftSum = 0,
    bestScore = 0;
  for (let t = 1; t <= 255; t++) {
    leftCount += histogram[t - 1];
    leftSum += histogram[t - 1] * (t - 1);
    const rightCount = count - leftCount;
    if (!leftCount || !rightCount) continue;
    const difference = leftSum / leftCount - (sum - leftSum) / rightCount;
    scores[t] = (leftCount / count) * (rightCount / count) * difference ** 2;
    bestScore = Math.max(bestScore, scores[t]);
  }
  if (!bestScore) return { histogram, threshold: Math.min(255, Math.round(sum / count) + 1) };

  // Otsu's split avoids empty/full boards. Within 98% of that separation, seek the
  // lowest seven-bin density so a tiny noisy gap cannot pull the cutoff into a peak.
  const density = new Float64Array(256).fill(Infinity);
  let quietest = Infinity;
  for (let t = 1; t <= 255; t++) {
    if (scores[t] < bestScore * 0.98) continue;
    let weight = 0;
    for (let v = Math.max(0, t - 3); v <= Math.min(255, t + 3); v++) weight += histogram[v];
    density[t] = weight;
    quietest = Math.min(quietest, weight);
  }
  // Use the center of the widest equally quiet interval instead of hugging a peak.
  let threshold = 128,
    widest = 0;
  for (let start = 1; start <= 255; start++) {
    if (density[start] !== quietest) continue;
    let end = start;
    while (end < 255 && density[end + 1] === quietest) end++;
    const middle = Math.round((start + end) / 2),
      width = end - start + 1;
    if (width > widest || (width === widest && scores[middle] > scores[threshold])) {
      widest = width;
      threshold = middle;
    }
    start = end;
  }
  return { histogram, threshold };
}

/** Convert color to grayscale; transparent pixels stay empty at every cutoff. */
export function pixelsToMask(
  data: ArrayLike<number>,
  threshold: number,
  invert: boolean,
): Uint8Array {
  if (data.length % 4 || !Number.isFinite(threshold) || threshold < 0 || threshold > 255)
    throw new Error('Invalid image pixels or threshold.');
  const mask = new Uint8Array(data.length / 4);
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4;
    const luminance = gray(data, i);
    mask[p] = Number(
      data[i + 3] >= 128 && (invert ? luminance >= threshold : luminance < threshold),
    );
  }
  return mask;
}
