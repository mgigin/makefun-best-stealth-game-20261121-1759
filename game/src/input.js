// Keyboard and mouse input. Held keys give a movement direction and a
// gait; one-shot presses (confirm, pause) and mouse clicks (pebble
// throws) are queued so a press between frames is never lost. Mouse
// positions are converted from window pixels to the 1280x720 playfield
// by the caller, which knows the current scale.

import { FIELD } from './config.js';
import { GAIT_RUN, GAIT_SNEAK, GAIT_WALK } from './player.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_NOTES = 4;
export const ACTION_REPLAY = 8;
export const ACTION_TITLE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const SNEAK = new Set(['KeyC', 'ControlLeft', 'ControlRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const NOTES = new Set(['KeyH']);
const REPLAY = new Set(['KeyR']);
const TITLE = new Set(['KeyT']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, sneak: false };
  let actions = 0;
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (RUN.has(event.code)) held.run = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (NOTES.has(event.code)) {
      if (!event.repeat) actions |= ACTION_NOTES;
    } else if (REPLAY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_REPLAY;
    } else if (TITLE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_TITLE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (RUN.has(event.code)) held.run = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = held.sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    clicks.push({
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    });
  });

  return {
    /** Current movement direction (not normalised; the player does that). */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** Gait asked for by the held modifier keys. */
    gait() {
      if (held.sneak) return GAIT_SNEAK;
      if (held.run) return GAIT_RUN;
      return GAIT_WALK;
    },
    /** One-shot actions pressed since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queued mouse clicks in playfield coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
