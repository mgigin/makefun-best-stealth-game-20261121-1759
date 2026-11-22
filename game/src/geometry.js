// Tile geometry: which tiles block movement and sight, circle-vs-tile
// collision, line-of-sight sampling and vision-cone tests. Pure math,
// no drawing and no browser, so the rules can be reasoned about alone.

import { COLS, ROWS, TILE } from './config.js';

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_CRATE = 2;
export const TILE_SHADOW = 3;

/** True when a tile stops a body (walls and crates). */
export function isSolid(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE;
}

/** True when a tile blocks a guard's view (walls and crates). */
export function blocksSight(tile) {
  return tile === TILE_WALL || tile === TILE_CRATE;
}

export function tileAt(grid, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return TILE_WALL;
  return grid[row * COLS + col];
}

export function tileAtPoint(grid, x, y) {
  return tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

/**
 * Moves a circle by (dx, dy), sliding along solid tiles one axis at a
 * time so a body hugs walls instead of sticking to them.
 */
export function moveCircle(grid, body, dx, dy) {
  body.x += dx;
  resolveAxis(grid, body, true);
  body.y += dy;
  resolveAxis(grid, body, false);
}

function resolveAxis(grid, body, horizontal) {
  const r = body.radius;
  const minCol = Math.floor((body.x - r) / TILE);
  const maxCol = Math.floor((body.x + r) / TILE);
  const minRow = Math.floor((body.y - r) / TILE);
  const maxRow = Math.floor((body.y + r) / TILE);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isSolid(tileAt(grid, col, row))) continue;
      const left = col * TILE;
      const top = row * TILE;
      const nearX = Math.max(left, Math.min(body.x, left + TILE));
      const nearY = Math.max(top, Math.min(body.y, top + TILE));
      const offX = body.x - nearX;
      const offY = body.y - nearY;
      if (offX * offX + offY * offY >= r * r) continue;
      if (horizontal) {
        body.x = body.x < left + TILE / 2 ? left - r : left + TILE + r;
      } else {
        body.y = body.y < top + TILE / 2 ? top - r : top + TILE + r;
      }
    }
  }
}

/**
 * True when nothing sight-blocking sits between two points. Samples the
 * segment every few pixels; cheap and steady for tile-sized blockers.
 */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (blocksSight(tileAtPoint(grid, x0 + dx * t, y0 + dy * t))) return false;
  }
  return true;
}

/** Smallest signed angle from a to b, in [-PI, PI]. */
export function angleDifference(a, b) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Turns `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current, target, maxStep) {
  const diff = angleDifference(current, target);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/**
 * How clearly a guard sees a point: 0 when outside the cone, beyond
 * range or behind cover; otherwise 1 at point blank fading to 0 at the
 * cone's rim, so a glimpse at the edge only nudges suspicion.
 */
export function visionStrength(grid, guard, x, y) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > guard.visionRange) return 0;
  const facing = Math.atan2(dy, dx);
  const offAxis = Math.abs(angleDifference(guard.angle, facing));
  if (offAxis > guard.visionHalfAngle) return 0;
  if (!hasLineOfSight(grid, guard.x, guard.y, x, y)) return 0;
  const rangeFade = 1 - distance / guard.visionRange;
  const edgeFade = 1 - offAxis / guard.visionHalfAngle;
  return Math.min(1, 0.25 + 0.75 * rangeFade) * (0.35 + 0.65 * edgeFade);
}
