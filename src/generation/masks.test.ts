import { describe, expect, it } from 'vitest';
import { analyzeImage, pixelsToMask } from './masks';

const pixels = (values: number[]) => Uint8ClampedArray.from(values.flatMap((v) => [v, v, v, 255]));

describe('automatic grayscale cutoff', () => {
  it('chooses the middle of a wide histogram gap, not the edge of a peak', () => {
    const data = pixels([...Array<number>(50).fill(40), ...Array<number>(50).fill(210)]);
    const { threshold, histogram } = analyzeImage(data);
    expect(threshold).toBeGreaterThan(110);
    expect(threshold).toBeLessThan(140);
    expect(histogram[40]).toBe(50);
    expect(histogram[210]).toBe(50);
    expect(pixelsToMask(data, threshold, false).reduce((a, b) => a + b, 0)).toBe(50);
  });

  it('separates colors according to their grayscale brightness', () => {
    const data = new Uint8ClampedArray([240, 30, 40, 255, 20, 220, 100, 255]);
    const { threshold } = analyzeImage(data);
    expect([...pixelsToMask(data, threshold, false)]).toEqual([1, 0]);
    expect([...pixelsToMask(data, threshold, true)]).toEqual([0, 1]);
  });

  it('ignores transparent pixels for the histogram and for both mask polarities', () => {
    const data = new Uint8ClampedArray([...pixels([60, 180]), ...Array<number>(100).fill(0)]);
    const analysis = analyzeImage(data);
    expect(analysis).toEqual(analyzeImage(pixels([60, 180])));
    expect([...pixelsToMask(data, analysis.threshold, false)].slice(2)).toEqual(Array(25).fill(0));
    expect([...pixelsToMask(data, analysis.threshold, true)].slice(2)).toEqual(Array(25).fill(0));
  });

  it('keeps a small foreground separate from a much larger background', () => {
    const data = pixels([...Array<number>(15).fill(35), ...Array<number>(985).fill(235)]);
    const { threshold } = analyzeImage(data);
    expect(pixelsToMask(data, threshold, false).reduce((a, b) => a + b, 0)).toBe(15);
  });

  it('finds a low-density valley even when the gap contains noise', () => {
    const data = pixels([
      ...Array.from({ length: 200 }, (_, i) => 25 + (i % 20)),
      ...Array.from({ length: 200 }, (_, i) => 205 + (i % 20)),
      ...Array.from({ length: 180 }, (_, i) => 30 + i),
    ]);
    const { threshold } = analyzeImage(data);
    expect(threshold).toBeGreaterThan(80);
    expect(threshold).toBeLessThan(170);
  });

  it('handles smooth gradients without selecting an empty or full board', () => {
    const data = pixels(Array.from({ length: 256 }, (_, i) => i));
    expect(analyzeImage(data).threshold).toBeGreaterThan(105);
    expect(analyzeImage(data).threshold).toBeLessThan(150);
  });

  it('has deterministic fallbacks for blank, flat, and transparent images', () => {
    expect(analyzeImage(new Uint8Array()).threshold).toBe(128);
    expect(analyzeImage(new Uint8Array(40)).histogram.reduce((a, b) => a + b, 0)).toBe(0);
    for (const value of [0, 90, 254, 255]) {
      const data = pixels([value, value]);
      const { threshold } = analyzeImage(data);
      expect(threshold).toBe(value === 255 ? 255 : value + 1);
      expect([...pixelsToMask(data, threshold, false)]).toEqual(value === 255 ? [0, 0] : [1, 1]);
    }
  });

  it('rejects incomplete RGBA data', () => {
    expect(() => analyzeImage(new Uint8Array(3))).toThrow('Invalid image pixels');
  });
});
