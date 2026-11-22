// Boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. Screens:
// title, play, paused, floor-clear, win and game over.
//
// ?shot=cover|title|alert|exit stages a still scene for screenshots
// instead of running the loop, paints it and sets window.__shotReady.

import { GAME, STEP } from './config.js';
import { FLOORS, parseLevel } from './levels.js';
import {
  EVENT_CAUGHT,
  EVENT_CURIOUS,
  EVENT_SPOTTED,
  EVENT_STEP,
  GUARD_CHASE,
  GUARD_STARE,
  createGuard,
  distractGuard,
  updateGuard,
} from './guards.js';
import { createPlayer, throwPebble, updatePebble, updatePlayer } from './player.js';
import { tileCenter } from './geometry.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import {
  drawCaughtBanner,
  drawFloorClear,
  drawGameOver,
  drawHud,
  drawPaused,
  drawTitle,
  drawWin,
} from './hud.js';
import { createAudio } from './audio.js';

const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';
const SCREEN_CLEAR = 'clear';
const SCREEN_WIN = 'win';
const SCREEN_OVER = 'over';
const MAX_FRAME = 0.25;
const PICKUP_DISTANCE = 26;
const EXIT_DISTANCE = 28;
const PEBBLE_EARSHOT = 300;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = createAudio();
window.addEventListener('keydown', () => audio.unlock());
canvas.addEventListener('pointerdown', () => audio.unlock());

const game = {
  screen: SCREEN_TITLE,
  floorIndex: 0,
  lives: GAME.lives,
  timesSpotted: 0,
  totalTime: 0,
  floorTime: 0,
  world: null,
};

function loadFloor(index) {
  const floor = FLOORS[index];
  const level = parseLevel(floor);
  game.world = {
    grid: level.grid,
    player: createPlayer(level.playerStart, GAME.pebblesPerFloor),
    guards: level.guardSpawns.map(createGuard),
    sapphire: level.sapphire,
    exit: level.exit,
    hasSapphire: false,
    pebbles: [],
    time: 0,
    caughtFlash: 0,
    floorName: floor.name,
  };
  game.floorTime = 0;
  status.textContent = `${floor.name}. Steal the Star Sapphire and reach the exit unseen.`;
}

function resetPositions() {
  const level = parseLevel(FLOORS[game.floorIndex]);
  const world = game.world;
  const fresh = createPlayer(level.playerStart, world.player.pebbles);
  world.player.x = fresh.x;
  world.player.y = fresh.y;
  world.player.angle = fresh.angle;
  world.guards = level.guardSpawns.map(createGuard);
  world.pebbles = [];
}

function anyChasing(world) {
  return world.guards.some((guard) => guard.state === GUARD_CHASE);
}

function stepWorld(dt) {
  const world = game.world;
  world.time += dt;
  game.floorTime += dt;
  game.totalTime += dt;
  if (world.caughtFlash > 0) world.caughtFlash = Math.max(0, world.caughtFlash - dt * 1.6);

  const stepped = updatePlayer(world.grid, world.player, input.direction(), input.gait(), dt);
  if (stepped) audio.playerStep(world.player.gait);

  for (const click of input.takeClicks()) {
    if (world.player.pebbles > 0) {
      world.player.pebbles -= 1;
      world.pebbles.push(throwPebble(world.player, click.x, click.y));
    }
  }
  for (const pebble of world.pebbles) {
    if (updatePebble(pebble, dt)) {
      pebble.landedAt = world.time;
      audio.pebbleLand();
      for (const guard of world.guards) {
        if (Math.hypot(guard.x - pebble.tx, guard.y - pebble.ty) < PEBBLE_EARSHOT) {
          distractGuard(guard, pebble.tx, pebble.ty);
        }
      }
    }
  }
  world.pebbles = world.pebbles.filter((pebble) => !pebble.landed || world.time - pebble.landedAt < 2.5);

  let caught = false;
  for (const guard of world.guards) {
    const events = updateGuard(world.grid, guard, world.player, dt);
    if (events & EVENT_SPOTTED) {
      game.timesSpotted += 1;
      audio.spotted();
      status.textContent = 'Spotted! Break line of sight and hide.';
    }
    if (events & EVENT_CURIOUS) audio.curious();
    if (events & EVENT_STEP) {
      const distance = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      const pan = Math.max(-1, Math.min(1, (guard.x - world.player.x) / 380));
      audio.guardStep(pan, Math.max(0, 1 - distance / 540));
    }
    if (events & EVENT_CAUGHT) caught = true;
  }

  if (!world.hasSapphire) {
    const distance = Math.hypot(world.player.x - world.sapphire.x, world.player.y - world.sapphire.y);
    if (distance < PICKUP_DISTANCE) {
      world.hasSapphire = true;
      audio.pickup();
      status.textContent = 'Star Sapphire in hand. Reach the exit unseen.';
    }
  }

  if (caught) {
    game.lives -= 1;
    world.caughtFlash = 1;
    audio.caught();
    if (game.lives <= 0) {
      game.screen = SCREEN_OVER;
      status.textContent = 'Caught. Game over.';
    } else {
      resetPositions();
      status.textContent = `Caught! ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left.`;
    }
    return;
  }

  if (world.hasSapphire) {
    const distance = Math.hypot(world.player.x - world.exit.x, world.player.y - world.exit.y);
    if (distance < EXIT_DISTANCE) {
      audio.floorClear();
      if (game.floorIndex >= FLOORS.length - 1) {
        game.screen = SCREEN_WIN;
        status.textContent = 'You escaped with the Star Sapphire.';
      } else {
        game.screen = SCREEN_CLEAR;
        status.textContent = 'Floor clear.';
      }
    }
  }
}

function drawFrame() {
  const world = game.world;
  renderer.draw(world);
  const ctx = renderer.overlay();
  const worstSuspicion = world.guards.reduce((worst, guard) => Math.max(worst, guard.suspicion), 0);
  drawHud(ctx, {
    floorName: world.floorName,
    lives: game.lives,
    pebbles: world.player.pebbles,
    hasSapphire: world.hasSapphire,
    worstSuspicion,
    gait: world.player.gait,
    inShadow: world.player.inShadow,
  });
  if (game.screen === SCREEN_TITLE) drawTitle(ctx);
  else if (game.screen === SCREEN_PAUSED) drawPaused(ctx);
  else if (game.screen === SCREEN_CLEAR) drawFloorClear(ctx, world.floorName, game.floorTime, game.timesSpotted);
  else if (game.screen === SCREEN_WIN) drawWin(ctx, game.totalTime, game.timesSpotted);
  else if (game.screen === SCREEN_OVER) drawGameOver(ctx, world.floorName);
  else if (game.screen === SCREEN_PLAY && anyChasing(world)) drawCaughtBanner(ctx);
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSED;
    else if (game.screen === SCREEN_PAUSED) game.screen = SCREEN_PLAY;
  }
  if (actions & ACTION_CONFIRM) {
    if (game.screen === SCREEN_TITLE) {
      game.screen = SCREEN_PLAY;
    } else if (game.screen === SCREEN_PAUSED) {
      game.screen = SCREEN_PLAY;
    } else if (game.screen === SCREEN_CLEAR) {
      game.floorIndex += 1;
      loadFloor(game.floorIndex);
      game.screen = SCREEN_PLAY;
    } else if (game.screen === SCREEN_WIN || game.screen === SCREEN_OVER) {
      game.floorIndex = 0;
      game.lives = GAME.lives;
      game.timesSpotted = 0;
      game.totalTime = 0;
      loadFloor(0);
      game.screen = SCREEN_PLAY;
    }
  }
  if (game.screen !== SCREEN_PLAY) input.takeClicks();
}

function placeAt(body, col, row, angle) {
  const point = tileCenter(col, row);
  body.x = point.x;
  body.y = point.y;
  if (angle !== undefined) body.angle = angle;
}

/** Still scenes for screenshots: real game state, posed by hand. */
function stageShot(name) {
  if (name === 'title') {
    game.floorIndex = 0;
    loadFloor(0);
    game.screen = SCREEN_TITLE;
  } else if (name === 'alert') {
    game.floorIndex = 0;
    loadFloor(0);
    game.screen = SCREEN_PLAY;
    const world = game.world;
    placeAt(world.player, 19, 8, 0);
    world.player.gait = 'run';
    world.player.noiseRadius = 118;
    world.player.moving = true;
    const chaser = world.guards[1];
    placeAt(chaser, 16, 8, 0);
    chaser.state = GUARD_CHASE;
    chaser.suspicion = 1;
    const starer = world.guards[2];
    placeAt(starer, 26, 10, Math.PI);
    starer.state = GUARD_STARE;
    starer.suspicion = 0.65;
    world.time = 4;
  } else if (name === 'exit') {
    game.floorIndex = 2;
    loadFloor(2);
    game.screen = SCREEN_PLAY;
    const world = game.world;
    world.hasSapphire = true;
    placeAt(world.player, 29, 15, 0);
    world.player.gait = 'sneak';
    world.guards.forEach((guard, i) => {
      guard.angle = [0.5, 2.4, -0.8, 1.6, -2.2][i % 5];
    });
    world.time = 7;
  } else {
    // cover: floor 2 mid-sneak, cones and cover on show.
    game.floorIndex = 1;
    loadFloor(1);
    game.screen = SCREEN_PLAY;
    const world = game.world;
    placeAt(world.player, 10, 5, 0.6);
    world.player.gait = 'sneak';
    world.player.inShadow = true;
    world.guards.forEach((guard, i) => {
      guard.angle = [0.4, 2.2, -1.1, 1.2][i % 4];
    });
    world.guards[1].suspicion = 0.3;
    world.time = 3;
  }
  drawFrame();
  drawFrame();
  window.__shotReady = true;
}

loadFloor(0);

if (shot) {
  stageShot(shot);
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handleActions();
    if (game.screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
        if (game.screen !== SCREEN_PLAY) break;
      }
    }
    drawFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
