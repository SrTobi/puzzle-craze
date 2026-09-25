import { CELL_SIZE } from './arrowGeometry';
import type { Level } from './types';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export function boardFit(grid: Level['grid'], size: ViewportSize) {
  return Math.max(
    0.0001,
    Math.min(
      (size.width - 70) / Math.max(CELL_SIZE, (grid.columns - 1) * CELL_SIZE),
      (size.height - 62) / Math.max(CELL_SIZE, (grid.rows - 1) * CELL_SIZE),
      1.18,
    ),
  );
}

// Leave partially visible boards alone. Once a grid leaves an axis completely,
// return enough of it to grab again, without changing the player's zoom.
export function cameraReturnTarget(
  camera: Camera,
  grid: Level['grid'],
  size: ViewportSize,
): Camera {
  if (size.width <= 0 || size.height <= 0) return camera;
  const scale = boardFit(grid, size) * camera.zoom;
  const returnAxis = (offset: number, viewport: number, points: number) => {
    const extent = Math.max(CELL_SIZE, (points - 1) * CELL_SIZE) * scale;
    const outside = (viewport + extent) / 2;
    if (Math.abs(offset) < outside) return offset;
    const visible = Math.min(120, viewport / 4, extent);
    return Math.sign(offset) * (outside - visible);
  };
  const x = returnAxis(camera.x, size.width, grid.columns);
  const y = returnAxis(camera.y, size.height, grid.rows);
  return x === camera.x && y === camera.y ? camera : { ...camera, x, y };
}
