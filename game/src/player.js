// The player: three gaits that trade speed against noise and exposure.
// Sneaking is slow and silent, walking is the middle road, running is
// fast but loud and easy to spot. The player also carries the pebbles
// used to pull a guard off his round.

import { PLAYER } from './config.js';
import { TILE_SHADOW, moveCircle, tileAtPoint } from './geometry.js';

export const GAIT_SNEAK = 'sneak';
export const GAIT_WALK = 'walk';
export const GAIT_RUN = 'run';

export function createPlayer(start, pebbles) {
  return {
    x: start.x,
    y: start.y,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    gait: GAIT_WALK,
    noiseRadius: 0,
    inShadow: false,
    moving: false,
    pebbles,
    stepCarry: 0,
  };
}

const GAIT_TABLE = {
  [GAIT_SNEAK]: { speed: PLAYER.sneakSpeed, noise: PLAYER.sneakNoise, step: 40 },
  [GAIT_WALK]: { speed: PLAYER.walkSpeed, noise: PLAYER.walkNoise, step: 52 },
  [GAIT_RUN]: { speed: PLAYER.runSpeed, noise: PLAYER.runNoise, step: 64 },
};

/**
 * Moves the player for one step. `move` is a unit-ish direction from
 * input; `gait` is the gait the held keys ask for. Sets the noise
 * radius guards will hear and whether the player stands in shadow.
 * Returns true when a footstep lands (for soft player audio).
 */
export function updatePlayer(grid, player, move, gait, dt) {
  player.gait = gait;
  const spec = GAIT_TABLE[gait];
  const length = Math.hypot(move.x, move.y);
  player.moving = length > 0.01;
  let stepped = false;
  if (player.moving) {
    const nx = move.x / length;
    const ny = move.y / length;
    player.angle = Math.atan2(ny, nx);
    const beforeX = player.x;
    const beforeY = player.y;
    moveCircle(grid, player, nx * spec.speed * dt, ny * spec.speed * dt);
    player.stepCarry += Math.hypot(player.x - beforeX, player.y - beforeY);
    if (player.stepCarry >= spec.step) {
      player.stepCarry -= spec.step;
      stepped = true;
    }
  }
  player.noiseRadius = player.moving ? spec.noise : 0;
  player.inShadow = tileAtPoint(grid, player.x, player.y) === TILE_SHADOW;
  return stepped;
}

/** A thrown pebble: flies straight, then lands and makes its noise. */
export function throwPebble(player, tx, ty) {
  const dx = tx - player.x;
  const dy = ty - player.y;
  const distance = Math.hypot(dx, dy);
  const reach = Math.min(distance, PLAYER.pebbleRange);
  const scale = distance > 0.001 ? reach / distance : 0;
  return {
    x: player.x,
    y: player.y,
    tx: player.x + dx * scale,
    ty: player.y + dy * scale,
    t: 0,
    duration: Math.max(0.12, reach / PLAYER.pebbleSpeed),
    landed: false,
  };
}

/** Advances a pebble; returns true on the step it lands. */
export function updatePebble(pebble, dt) {
  if (pebble.landed) return false;
  pebble.t += dt / pebble.duration;
  if (pebble.t >= 1) {
    pebble.t = 1;
    pebble.landed = true;
    pebble.x = pebble.tx;
    pebble.y = pebble.ty;
    return true;
  }
  return false;
}
