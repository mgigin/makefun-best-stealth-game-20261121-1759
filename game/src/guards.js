// Guard behaviour: patrol a waypoint loop, grow suspicious on a glimpse
// or a noise, investigate, chase at full suspicion, then calm down and
// return to the round. Suspicion is a 0..1 meter: a glimpse fills it a
// little and breaking away lets it drain, so a near miss is recoverable
// but standing in the open is not. updateGuard returns event flags the
// caller turns into sound and HUD changes.

import { GAME, GUARD } from './config.js';
import { moveCircle, turnToward, visionStrength } from './geometry.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_STARE = 'stare';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_RETURN = 'return';

export const EVENT_SPOTTED = 1; // suspicion filled: the chase begins
export const EVENT_CAUGHT = 2; // the guard reached the player
export const EVENT_STEP = 4; // a footstep landed (for positional audio)
export const EVENT_CURIOUS = 8; // suspicion crossed the stare threshold

const TURN_RATE = 3.4; // radians per second
const ARRIVE = 8; // pixels: close enough to a waypoint
const STEP_DISTANCE = 48; // pixels of travel per footstep

export function createGuard(spawn) {
  const next = spawn.route[spawn.waypoint];
  return {
    x: spawn.x,
    y: spawn.y,
    radius: GUARD.radius,
    angle: spawn.sentinel
      ? spawn.sweepBase
      : Math.atan2(next.y - spawn.y, next.x - spawn.x),
    visionRange: GUARD.visionRange,
    visionHalfAngle: GUARD.visionHalfAngle,
    route: spawn.route,
    waypoint: spawn.waypoint,
    state: GUARD_PATROL,
    suspicion: 0,
    targetX: spawn.x,
    targetY: spawn.y,
    lastSeenX: spawn.x,
    lastSeenY: spawn.y,
    memory: 0,
    lookTimer: 0,
    lookBase: 0,
    stepCarry: 0,
    stuckTimer: 0,
    lastX: spawn.x,
    lastY: spawn.y,
    // Sentinels hold one post and sweep their gaze instead of walking
    // a route; everything else (senses, chase, investigate) is shared.
    sentinel: Boolean(spawn.sentinel),
    homeX: spawn.x,
    homeY: spawn.y,
    sweepBase: spawn.sweepBase ?? 0,
    sweepAmp: spawn.sweepAmp ?? 0.8,
    sweepSpeed: spawn.sweepSpeed ?? 0.5,
    clock: 0,
    // Display name for the alert banner; main.js assigns the roster.
    name: '',
  };
}

function walkToward(grid, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return 0;
  guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), TURN_RATE * dt);
  const step = Math.min(distance, speed * dt);
  const beforeX = guard.x;
  const beforeY = guard.y;
  moveCircle(grid, guard, (dx / distance) * step, (dy / distance) * step);
  const moved = Math.hypot(guard.x - beforeX, guard.y - beforeY);
  guard.stepCarry += moved;
  return moved;
}

function takeFootsteps(guard) {
  let events = 0;
  while (guard.stepCarry >= STEP_DISTANCE) {
    guard.stepCarry -= STEP_DISTANCE;
    events |= EVENT_STEP;
  }
  return events;
}

/** Sends a guard to look at a noise (a thrown pebble landing). */
export function distractGuard(guard, x, y) {
  if (guard.state === GUARD_CHASE) return;
  guard.state = GUARD_INVESTIGATE;
  guard.targetX = x;
  guard.targetY = y;
  guard.lookTimer = 0;
  guard.suspicion = Math.max(guard.suspicion, 0.35);
}

function nearestWaypoint(guard) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < guard.route.length; i += 1) {
    const point = guard.route[i];
    const distance = Math.hypot(point.x - guard.x, point.y - guard.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * Advances one guard by dt seconds. `player` carries the player's
 * position, gait ('sneak' | 'walk' | 'run'), noise radius and whether
 * the player stands in shadow. Returns EVENT_* flags.
 */
export function updateGuard(grid, guard, player, dt) {
  let events = 0;
  guard.clock += dt;

  // --- Senses -------------------------------------------------------
  const seen = visionStrength(grid, guard, player.x, player.y);
  let cover = 1;
  if (player.inShadow) cover *= GAME.shadowCover;
  if (player.gait === 'sneak') cover *= GAME.sneakCover;
  if (player.gait === 'run') cover *= GAME.runExposure;
  if (seen > 0) {
    guard.suspicion += seen * cover * GUARD.spotRate * dt;
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    guard.memory = GUARD.memorySeconds;
  }
  const heardDistance = Math.hypot(player.x - guard.x, player.y - guard.y);
  if (player.noiseRadius > 0 && heardDistance < player.noiseRadius) {
    guard.suspicion += GUARD.hearRate * dt * (1 - heardDistance / player.noiseRadius);
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    if (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN) {
      guard.targetX = player.x;
      guard.targetY = player.y;
    }
  }
  if (seen === 0 && guard.state !== GUARD_CHASE) {
    guard.suspicion -= GUARD.calmRate * dt;
  }
  guard.suspicion = Math.max(0, Math.min(1, guard.suspicion));

  // --- State changes --------------------------------------------------
  if (guard.suspicion >= 1 && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_CHASE;
    events |= EVENT_SPOTTED;
  } else if (
    guard.suspicion >= 0.45 &&
    (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN)
  ) {
    guard.state = GUARD_STARE;
    guard.lookTimer = 0.9;
    events |= EVENT_CURIOUS;
  }

  // --- Movement per state ---------------------------------------------
  if (guard.state === GUARD_PATROL) {
    if (guard.sentinel) {
      // Hold the post: sweep the gaze on a slow sine instead of walking.
      guard.angle = guard.sweepBase + Math.sin(guard.clock * guard.sweepSpeed) * guard.sweepAmp;
    } else {
      const point = guard.route[guard.waypoint];
      walkToward(grid, guard, point.x, point.y, GUARD.patrolSpeed, dt);
      if (Math.hypot(point.x - guard.x, point.y - guard.y) < ARRIVE) {
        guard.waypoint = (guard.waypoint + 1) % guard.route.length;
      }
    }
  } else if (guard.state === GUARD_STARE) {
    guard.angle = turnToward(
      guard.angle,
      Math.atan2(guard.lastSeenY - guard.y, guard.lastSeenX - guard.x),
      TURN_RATE * dt,
    );
    guard.lookTimer -= dt;
    if (guard.lookTimer <= 0) {
      if (guard.suspicion >= 0.3) {
        guard.state = GUARD_INVESTIGATE;
        guard.targetX = guard.lastSeenX;
        guard.targetY = guard.lastSeenY;
        guard.lookTimer = 0;
      } else {
        guard.state = GUARD_RETURN;
        guard.waypoint = nearestWaypoint(guard);
      }
    }
  } else if (guard.state === GUARD_INVESTIGATE) {
    const distance = Math.hypot(guard.targetX - guard.x, guard.targetY - guard.y);
    if (distance > ARRIVE) {
      walkToward(grid, guard, guard.targetX, guard.targetY, GUARD.investigateSpeed, dt);
    } else {
      if (guard.lookTimer <= 0) {
        guard.lookTimer = GUARD.lookSeconds;
        guard.lookBase = guard.angle;
      }
      guard.lookTimer -= dt;
      guard.angle = guard.lookBase + Math.sin(guard.lookTimer * 2.2) * 0.9;
      if (guard.lookTimer <= 0) {
        guard.state = GUARD_RETURN;
        guard.waypoint = nearestWaypoint(guard);
      }
    }
  } else if (guard.state === GUARD_CHASE) {
    if (seen > 0) guard.memory = GUARD.memorySeconds;
    else guard.memory -= dt;
    walkToward(grid, guard, guard.lastSeenX, guard.lastSeenY, GUARD.chaseSpeed, dt);
    if (guard.memory <= 0) {
      guard.state = GUARD_INVESTIGATE;
      guard.targetX = guard.lastSeenX;
      guard.targetY = guard.lastSeenY;
      guard.lookTimer = 0;
      guard.suspicion = 0.55;
    }
  } else if (guard.state === GUARD_RETURN) {
    const point = guard.route[guard.waypoint];
    walkToward(grid, guard, point.x, point.y, GUARD.investigateSpeed, dt);
    if (Math.hypot(point.x - guard.x, point.y - guard.y) < ARRIVE) {
      guard.state = GUARD_PATROL;
      guard.waypoint = (guard.waypoint + 1) % guard.route.length;
    }
  }

  // --- Stuck recovery: never let a guard wedge on a corner forever ---
  const drift = Math.hypot(guard.x - guard.lastX, guard.y - guard.lastY);
  if (drift < 1.5 && guard.state !== GUARD_STARE) {
    guard.stuckTimer += dt;
    if (guard.stuckTimer > 1.4) {
      guard.stuckTimer = 0;
      if (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN) {
        guard.waypoint = (guard.waypoint + 1) % guard.route.length;
        guard.state = GUARD_PATROL;
      } else if (guard.state === GUARD_INVESTIGATE) {
        guard.state = GUARD_RETURN;
        guard.waypoint = nearestWaypoint(guard);
      }
    }
  } else {
    guard.stuckTimer = 0;
  }
  guard.lastX = guard.x;
  guard.lastY = guard.y;

  events |= takeFootsteps(guard);

  // --- Capture ---------------------------------------------------------
  if (
    heardDistance < GUARD.catchDistance &&
    (guard.state === GUARD_CHASE || guard.suspicion > 0.6)
  ) {
    events |= EVENT_CAUGHT;
  }
  return events;
}
