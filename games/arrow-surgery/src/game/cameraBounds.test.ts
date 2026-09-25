import { describe, expect, it } from 'vitest';
import { boardFit, cameraReturnTarget } from './cameraBounds';
import { CELL_SIZE } from './arrowGeometry';

const grid = { columns: 12, rows: 10 };
const size = { width: 800, height: 600 };

describe('camera return bounds', () => {
  it('allows free panning while the grid is still partially visible', () => {
    const halfWidth = ((grid.columns - 1) * CELL_SIZE * boardFit(grid, size)) / 2;
    const camera = { x: size.width / 2 + halfWidth - 1, y: 0, zoom: 1 };
    expect(cameraReturnTarget(camera, grid, size)).toBe(camera);
  });

  it.each([
    [2000, 0],
    [-2000, 0],
    [0, 2000],
    [0, -2000],
    [2000, -2000],
  ])('brings an offscreen grid back from (%s, %s)', (x, y) => {
    const result = cameraReturnTarget({ x, y, zoom: 1 }, grid, size);
    const fit = boardFit(grid, size);
    const halfWidth = ((grid.columns - 1) * CELL_SIZE * fit) / 2;
    const halfHeight = ((grid.rows - 1) * CELL_SIZE * fit) / 2;
    expect(Math.abs(result.x)).toBeLessThanOrEqual(size.width / 2 + halfWidth - 120);
    expect(Math.abs(result.y)).toBeLessThanOrEqual(size.height / 2 + halfHeight - 120);
    expect(result.zoom).toBe(1);
    if (x === 0) expect(result.x).toBe(0);
    if (y === 0) expect(result.y).toBe(0);
    expect(cameraReturnTarget(result, grid, size)).toBe(result);
  });

  it('uses the zoomed bounds instead of pulling large visible boards back', () => {
    const largeGrid = { columns: 1024, rows: 1024 };
    const camera = { x: 2000, y: -2000, zoom: 256 };
    expect(cameraReturnTarget(camera, largeGrid, size)).toBe(camera);
    const returned = cameraReturnTarget({ ...camera, x: 1e6 }, largeGrid, size);
    expect(returned.x).toBeLessThan(1e6);
    expect(returned.y).toBe(camera.y);
    expect(returned.zoom).toBe(256);
  });

  it('handles a single-column grid on a small screen at minimum zoom', () => {
    const smallGrid = { columns: 1, rows: 10 };
    const viewport = { width: 320, height: 400 };
    const result = cameraReturnTarget({ x: 1000, y: -1000, zoom: 0.45 }, smallGrid, viewport);
    expect(result.x).toBeLessThan(viewport.width / 2);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(result.zoom).toBe(0.45);
    expect(cameraReturnTarget(result, smallGrid, viewport)).toBe(result);
  });

  it('rechecks an offscreen grid after the viewport shrinks', () => {
    const camera = { x: 500, y: 0, zoom: 1 };
    expect(cameraReturnTarget(camera, grid, size)).toBe(camera);
    expect(cameraReturnTarget(camera, grid, { width: 320, height: 400 }).x).toBeLessThan(500);
  });

  it('does not move the camera when its viewport is hidden', () => {
    const camera = { x: 2000, y: 0, zoom: 1 };
    expect(cameraReturnTarget(camera, grid, { width: 0, height: 0 })).toBe(camera);
  });
});
