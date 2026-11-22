// Security cameras: fixed sentries that sweep their gaze back and
// forth on a sine. They cannot catch anyone themselves — fill a
// camera's suspicion meter and it raises the alarm, sending the
// nearest guard to the player's position. Cameras share the guards'
// cover rules (shadow and sneaking help, running hurts), so the
// player's stealth toolkit works on them too; the difference is
// rhythm — a camera's sweep is predictable, so timing beats hiding.

import { CAMERA, GAME } from './config.js';
import { visionStrength } from './geometry.js';

export const CAM_EVENT_ALARM = 1; // suspicion filled: call a guard over
export const CAM_EVENT_CURIOUS = 2; // suspicion crossed the watch threshold

const WATCH_THRESHOLD = 0.45;

export function createCamera(def) {
  return {
    x: def.x,
    y: def.y,
    baseAngle: def.angle,
    sweepAmp: def.sweep ?? 0.7,
    sweepSpeed: def.speed ?? 0.55,
    phase: def.phase ?? 0,
    angle: def.angle,
    visionRange: CAMERA.visionRange,
    visionHalfAngle: CAMERA.visionHalfAngle,
    suspicion: 0,
    cooldown: 0,
    clock: 0,
  };
}

/**
 * Advances one camera by dt seconds. `player` is the same record the
 * guards sense. Returns CAM_EVENT_* flags.
 */
export function updateCamera(grid, camera, player, dt) {
  let events = 0;
  camera.clock += dt;
  camera.angle =
    camera.baseAngle + Math.sin(camera.clock * camera.sweepSpeed + camera.phase) * camera.sweepAmp;

  if (camera.cooldown > 0) {
    camera.cooldown -= dt;
    camera.suspicion = Math.max(0, camera.suspicion - CAMERA.calmRate * dt);
    return events;
  }

  const seen = visionStrength(grid, camera, player.x, player.y);
  let cover = 1;
  if (player.inShadow) cover *= GAME.shadowCover;
  if (player.gait === 'sneak') cover *= GAME.sneakCover;
  if (player.gait === 'run') cover *= GAME.runExposure;

  const wasCalm = camera.suspicion < WATCH_THRESHOLD;
  if (seen > 0) {
    camera.suspicion += seen * cover * CAMERA.spotRate * dt;
  } else {
    camera.suspicion -= CAMERA.calmRate * dt;
  }
  camera.suspicion = Math.max(0, Math.min(1, camera.suspicion));

  if (camera.suspicion >= 1) {
    events |= CAM_EVENT_ALARM;
    camera.suspicion = 0.35;
    camera.cooldown = CAMERA.alarmCooldown;
  } else if (wasCalm && camera.suspicion >= WATCH_THRESHOLD) {
    events |= CAM_EVENT_CURIOUS;
  }
  return events;
}
