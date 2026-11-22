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
import { CAM_EVENT_ALARM, CAM_EVENT_CURIOUS, createCamera, updateCamera } from './cameras.js';
import { tileCenter } from './geometry.js';
import {
  ACTION_CONFIRM,
  ACTION_NOTES,
  ACTION_PAUSE,
  ACTION_REPLAY,
  ACTION_TITLE,
  createInput,
} from './input.js';
import { createRenderer } from './render.js';
import {
  drawCaughtBanner,
  drawFieldNotes,
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

const GUARD_NAMES = ['Hale', 'Noor', 'Bram', 'Ives', 'Vale', 'Odo', 'Ruth', 'Cato'];

const game = {
  screen: SCREEN_TITLE,
  floorIndex: 0,
  lives: GAME.lives,
  timesSpotted: 0,
  floorSpotted: 0,
  floorCloseCalls: 0,
  floorPebblesThrown: 0,
  totalTime: 0,
  floorTime: 0,
  notesOn: false,
  world: null,
};

/** A small burst of glowing particles (pickup sparkle, dust, alarm). */
function spawnParticles(world, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.3 + Math.random() * 0.7);
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - speed * 0.25,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      size,
      color,
    });
  }
}

function updateParticles(world, dt) {
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 26 * dt; // gentle settle
    p.vx *= 1 - 1.6 * dt;
    p.vy *= 1 - 1.6 * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
}

function loadFloor(index) {
  const floor = FLOORS[index];
  const level = parseLevel(floor);
  const guards = level.guardSpawns.map(createGuard);
  guards.forEach((guard, i) => {
    guard.name = GUARD_NAMES[i % GUARD_NAMES.length];
  });
  game.world = {
    grid: level.grid,
    player: createPlayer(level.playerStart, GAME.pebblesPerFloor),
    guards,
    cameras: level.cameraSpawns.map(createCamera),
    sapphire: level.sapphire,
    exit: level.exit,
    hasSapphire: false,
    pebbles: [],
    particles: [],
    route: [{ x: level.playerStart.x, y: level.playerStart.y }],
    callouts: [],
    closeCallArmed: true,
    time: 0,
    caughtFlash: 0,
    floorName: floor.name,
  };
  game.floorTime = 0;
  game.floorSpotted = 0;
  game.floorCloseCalls = 0;
  game.floorPebblesThrown = 0;
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
  world.cameras = level.cameraSpawns.map(createCamera);
  world.pebbles = [];
  world.particles = [];
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
  if (stepped) {
    audio.playerStep(world.player.gait);
    if (world.player.gait === 'run') {
      spawnParticles(world, world.player.x, world.player.y + 8, 2, '#9aa5cf', 26, 0.5, 2.4);
    }
  }

  // Record the route for the floor-clear map (one point per 7 px).
  const lastRoute = world.route[world.route.length - 1];
  if (Math.hypot(world.player.x - lastRoute.x, world.player.y - lastRoute.y) > 7) {
    world.route.push({ x: world.player.x, y: world.player.y });
  }

  for (const click of input.takeClicks()) {
    if (world.player.pebbles > 0) {
      world.player.pebbles -= 1;
      game.floorPebblesThrown += 1;
      world.pebbles.push(throwPebble(world.player, click.x, click.y));
    }
  }
  for (const pebble of world.pebbles) {
    if (updatePebble(pebble, dt)) {
      pebble.landedAt = world.time;
      audio.pebbleLand();
      spawnParticles(world, pebble.tx, pebble.ty, 7, '#cfd6f2', 42, 0.45, 2.2);
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
      game.floorSpotted += 1;
      audio.spotted();
      spawnParticles(world, guard.x, guard.y - 14, 10, '#ff6b6b', 55, 0.5, 2.6);
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

  // Cameras sweep and watch; a full meter sends the nearest guard over.
  for (const camera of world.cameras) {
    const camEvents = updateCamera(world.grid, camera, world.player, dt);
    if (camEvents & CAM_EVENT_CURIOUS) audio.curious();
    if (camEvents & CAM_EVENT_ALARM) {
      audio.alarm();
      spawnParticles(world, camera.x, camera.y, 12, '#ff5a78', 60, 0.6, 2.6);
      let nearest = null;
      let nearestDistance = Infinity;
      for (const guard of world.guards) {
        const distance = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = guard;
        }
      }
      if (nearest) {
        distractGuard(nearest, world.player.x, world.player.y);
        nearest.suspicion = Math.max(nearest.suspicion, 0.6);
      }
      status.textContent = 'A camera spotted you — a guard is coming to look!';
    }
  }

  // A close call: suspicion nearly filled but the chase never began.
  const worstNow = world.guards.reduce((worst, guard) => Math.max(worst, guard.suspicion), 0);
  if (world.closeCallArmed && worstNow > 0.8 && !anyChasing(world)) {
    game.floorCloseCalls += 1;
    world.closeCallArmed = false;
  } else if (worstNow < 0.4) {
    world.closeCallArmed = true;
  }

  updateParticles(world, dt);

  if (!world.hasSapphire) {
    const distance = Math.hypot(world.player.x - world.sapphire.x, world.player.y - world.sapphire.y);
    if (distance < PICKUP_DISTANCE) {
      world.hasSapphire = true;
      audio.pickup();
      spawnParticles(world, world.sapphire.x, world.sapphire.y, 26, '#6fd3ff', 85, 0.9, 3);
      spawnParticles(world, world.sapphire.x, world.sapphire.y, 12, '#e8f9ff', 45, 1.1, 2);
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
  const cameraSuspicion = world.cameras.reduce(
    (worst, camera) => Math.max(worst, camera.cooldown > 0 ? 0 : camera.suspicion),
    0,
  );
  const chasing = world.guards.find((guard) => guard.state === GUARD_CHASE);
  const visibility = chasing
    ? 'SEEN'
    : world.player.inShadow && world.player.gait === 'sneak'
      ? 'HIDDEN'
      : world.player.inShadow
        ? 'SHADOW'
        : 'EXPOSED';
  const statusLine = chasing
    ? 'alarm'
    : worstSuspicion > 0.25 || cameraSuspicion > 0.25
      ? 'suspicious'
      : 'quiet';
  drawHud(ctx, {
    floorName: world.floorName,
    lives: game.lives,
    pebbles: world.player.pebbles,
    pebblesMax: GAME.pebblesPerFloor,
    hasSapphire: world.hasSapphire,
    worstSuspicion,
    cameraSuspicion,
    time: game.floorTime,
    animTime: world.time,
    gait: world.player.gait,
    inShadow: world.player.inShadow,
    visibility,
    statusLine,
  });
  if (game.notesOn && game.screen === SCREEN_PLAY) drawFieldNotes(ctx);
  if (game.screen === SCREEN_TITLE) drawTitle(ctx);
  else if (game.screen === SCREEN_PAUSED) drawPaused(ctx);
  else if (game.screen === SCREEN_CLEAR) {
    drawFloorClear(ctx, {
      floorName: world.floorName,
      floorIndex: game.floorIndex,
      seconds: game.floorTime,
      floorSpotted: game.floorSpotted,
      closeCalls: game.floorCloseCalls,
      pebblesThrown: game.floorPebblesThrown,
      hasSapphire: world.hasSapphire,
      grid: world.grid,
      route: world.route,
      guards: world.guards,
      sapphire: world.sapphire,
      exit: world.exit,
    });
  } else if (game.screen === SCREEN_WIN) drawWin(ctx, game.totalTime, game.timesSpotted);
  else if (game.screen === SCREEN_OVER) drawGameOver(ctx, world.floorName);
  else if (game.screen === SCREEN_PLAY && chasing) drawCaughtBanner(ctx, chasing.name || 'the guard');
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_NOTES) game.notesOn = !game.notesOn;
  if (actions & ACTION_REPLAY && (game.screen === SCREEN_CLEAR || game.screen === SCREEN_WIN || game.screen === SCREEN_OVER)) {
    if (game.screen !== SCREEN_CLEAR) {
      game.floorIndex = 0;
      game.lives = GAME.lives;
      game.timesSpotted = 0;
      game.totalTime = 0;
    }
    loadFloor(game.floorIndex);
    game.screen = SCREEN_PLAY;
  }
  if (actions & ACTION_TITLE && game.screen !== SCREEN_TITLE) {
    game.floorIndex = 0;
    game.lives = GAME.lives;
    game.timesSpotted = 0;
    game.totalTime = 0;
    loadFloor(0);
    game.screen = SCREEN_TITLE;
  }
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
  if (name === 'clear') {
    // Not in shots.json: a posed floor-clear screen (route map, stamp,
    // stats) so the completion layout can be eyeballed on demand.
    game.floorIndex = 0;
    loadFloor(0);
    game.screen = SCREEN_CLEAR;
    const world = game.world;
    world.hasSapphire = true;
    game.floorTime = 54;
    game.floorCloseCalls = 1;
    game.floorPebblesThrown = 2;
    const waypoints = [[1, 1], [1, 5], [3, 10], [6, 10], [6, 5], [10, 5], [10, 12], [14, 12], [14, 5], [18, 5], [18, 10], [22, 10], [22, 3], [26, 3], [30, 1], [30, 15]];
    world.route = waypoints.map(([col, row]) => tileCenter(col, row));
    placeAt(world.player, 30, 15, 0);
    world.time = 5;
    game.notesOn = false;
  } else if (name === 'title') {
    game.floorIndex = 0;
    loadFloor(0);
    game.screen = SCREEN_TITLE;
    const world = game.world;
    world.guards.forEach((guard, i) => {
      guard.angle = [0.5, 2.6, -2.8][i % 3];
    });
    world.cameras[0].angle = Math.PI - 0.4;
    world.time = 2;
    game.notesOn = false;
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
    world.cameras[0].angle = Math.PI - 0.3;
    world.cameras[0].suspicion = 0.72;
    spawnParticles(world, chaser.x, chaser.y - 14, 10, '#ff6b6b', 55, 0.5, 2.6);
    spawnParticles(world, world.player.x - 14, world.player.y + 8, 5, '#9aa5cf', 26, 0.5, 2.4);
    world.time = 4;
    game.floorTime = 99;
    game.notesOn = false;
    world.callouts = [
      { x: world.player.x, y: world.player.y, text: 'YOU: seen — break their line of sight', labelX: world.player.x - 150, labelY: world.player.y + 120 },
    ];
  } else if (name === 'exit') {
    game.floorIndex = 2;
    loadFloor(2);
    game.screen = SCREEN_PLAY;
    const world = game.world;
    world.hasSapphire = true;
    placeAt(world.player, 29, 15, 0);
    world.player.gait = 'sneak';
    world.guards.forEach((guard, i) => {
      guard.angle = [0.5, 2.4, -0.8, -2.1, 1.6][i % 5];
    });
    world.cameras.forEach((camera, i) => {
      camera.angle = [1.9, 2.7, -1.2][i % 3];
    });
    spawnParticles(world, world.player.x, world.player.y - 6, 14, '#6fd3ff', 40, 1.0, 2.6);
    world.time = 7;
    game.floorTime = 71;
    game.notesOn = true;
    world.callouts = [
      { x: world.exit.x, y: world.exit.y, text: 'EXIT: opens once you hold the sapphire', labelX: world.exit.x - 320, labelY: world.exit.y - 90 },
      { x: world.player.x, y: world.player.y, text: 'YOU: hidden where the cone stops at the crates', labelX: world.player.x - 330, labelY: world.player.y + 60 },
    ];
  } else {
    // cover: floor 2 mid-sneak — a pebble arcs toward a curious guard
    // while a camera sweeps the corridor and cones cross the shadows.
    game.floorIndex = 1;
    loadFloor(1);
    game.screen = SCREEN_PLAY;
    const world = game.world;
    placeAt(world.player, 13, 8, 0.35);
    world.player.gait = 'sneak';
    world.player.inShadow = true;
    world.player.moving = true;
    world.guards.forEach((guard, i) => {
      guard.angle = [0.4, -2.4, -1.1, 2.8][i % 4];
    });
    const curious = world.guards[1];
    placeAt(curious, 17, 8, Math.PI);
    curious.state = GUARD_STARE;
    curious.suspicion = 0.52;
    world.cameras[0].angle = Math.PI / 2 + 0.45;
    world.cameras[0].suspicion = 0.25;
    world.cameras[1].angle = Math.PI + 0.5;
    const from = tileCenter(13, 8);
    const to = tileCenter(16, 8);
    world.pebbles.push({
      x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0.55, duration: 0.6, landed: false,
    });
    spawnParticles(world, world.sapphire.x, world.sapphire.y, 8, '#6fd3ff', 30, 1.0, 2.4);
    world.time = 3;
    game.floorTime = 53;
    game.notesOn = true;
    world.callouts = [
      { x: world.player.x, y: world.player.y, text: 'YOU: in the shadow grass, unseen', labelX: world.player.x - 90, labelY: world.player.y + 130 },
      { x: to.x, y: to.y, text: 'PEBBLE: pulls a guard off his post', labelX: to.x + 60, labelY: to.y + 90 },
      { x: world.sapphire.x, y: world.sapphire.y, text: 'THE SAPPHIRE, left unguarded', labelX: world.sapphire.x - 300, labelY: world.sapphire.y + 70 },
    ];
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
