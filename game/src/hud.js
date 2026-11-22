// Heads-up display and full-screen panels: the top bar (floor, lives,
// pebbles, sapphire, worst suspicion), the objective line, and the
// title / pause / floor-clear / win / game-over screens. All text the
// player reads lives here; render.js only paints the world.

import { FIELD, FONT, PALETTE } from './config.js';

function panel(ctx, width, height) {
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  return { x, y };
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, FIELD.width / 2, y);
}

export function drawHud(ctx, state) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(0, 0, FIELD.width, 46);
  ctx.font = FONT.hud;
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(state.floorName, 16, 30);

  const lives = '♥'.repeat(Math.max(0, state.lives));
  ctx.fillText(`Lives ${lives}`, 420, 30);
  ctx.fillText(`Pebbles ${state.pebbles}`, 560, 30);
  ctx.fillStyle = state.hasSapphire ? PALETTE.sapphire : PALETTE.hudDim;
  ctx.fillText(state.hasSapphire ? 'Sapphire ◆ in hand' : 'Sapphire ◆ waiting', 700, 30);

  // Worst guard suspicion, as a labelled meter.
  const meterX = 980;
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('Spotted', meterX, 30);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(meterX + 86, 17, 150, 14);
  ctx.fillStyle = state.worstSuspicion > 0.75 ? PALETTE.danger : PALETTE.accent;
  ctx.fillRect(meterX + 87, 18, 148 * state.worstSuspicion, 12);

  // Objective line under the bar.
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.hudDim;
  const objective = state.hasSapphire
    ? 'Reach the EXIT door unseen'
    : 'Steal the Star Sapphire, then reach the EXIT';
  ctx.fillText(objective, 16, 68);

  // Gait indicator, bottom left.
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(10, FIELD.height - 44, 300, 34);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.hudText;
  const gaitLabel = { sneak: 'SNEAKING · silent', walk: 'WALKING · soft steps', run: 'RUNNING · loud!' }[state.gait];
  ctx.fillText(gaitLabel, 20, FIELD.height - 22);
  if (state.inShadow) {
    ctx.fillStyle = PALETTE.good;
    ctx.fillText('in shadow', 190, FIELD.height - 22);
  }

  // Controls reminder, bottom right.
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(FIELD.width - 470, FIELD.height - 44, 460, 34);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('WASD move · Shift run · C sneak · Click throw pebble · P pause', FIELD.width - 460, FIELD.height - 22);
}

export function drawTitle(ctx) {
  panel(ctx, 720, 430);
  centerText(ctx, 'STARLIGHT VAULT', 235, FONT.title, PALETTE.accent);
  centerText(ctx, 'Steal the Star Sapphire from the moonlit observatory vault.', 285, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Three floors. Guards with vision cones and sharp ears.', 318, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Hide in shadow, hug the crates, and slip out the EXIT unseen.', 351, FONT.body, PALETTE.hudText);
  centerText(ctx, 'WASD / arrows — move        Shift — run (loud)', 405, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'Hold C — sneak (silent)     Click — throw a pebble', 432, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'A glimpse makes a guard stare. Break away and he calms down.', 459, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'Fill his meter and he chases. Guard footsteps pan in stereo —', 486, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'listen for a patrol around the corner.', 513, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'Press SPACE to begin', 562, FONT.heading, PALETTE.good);
}

export function drawPaused(ctx) {
  panel(ctx, 420, 180);
  centerText(ctx, 'PAUSED', 330, FONT.heading, PALETTE.accent);
  centerText(ctx, 'Press P or SPACE to keep sneaking', 375, FONT.body, PALETTE.hudText);
}

export function drawFloorClear(ctx, floorName, seconds, timesSpotted) {
  panel(ctx, 560, 240);
  centerText(ctx, 'FLOOR CLEAR', 300, FONT.heading, PALETTE.good);
  centerText(ctx, floorName, 340, FONT.body, PALETTE.hudText);
  centerText(ctx, `Time ${seconds.toFixed(1)}s · Spotted ${timesSpotted}×`, 375, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Press SPACE for the next floor', 425, FONT.body, PALETTE.accent);
}

export function drawWin(ctx, seconds, timesSpotted) {
  panel(ctx, 640, 300);
  centerText(ctx, 'THE STAR SAPPHIRE IS YOURS', 280, FONT.heading, PALETTE.sapphire);
  centerText(ctx, 'You crossed all three floors and vanished into the night.', 325, FONT.body, PALETTE.hudText);
  centerText(ctx, `Total time ${seconds.toFixed(1)}s · Spotted ${timesSpotted}×`, 365, FONT.body, PALETTE.hudText);
  const rank = timesSpotted === 0 ? 'Ghost — never seen' : timesSpotted <= 3 ? 'Shadow — barely a rumour' : 'Lucky — the vault remembers you';
  centerText(ctx, `Rank: ${rank}`, 405, FONT.body, PALETTE.accent);
  centerText(ctx, 'Press SPACE to play again', 460, FONT.body, PALETTE.good);
}

export function drawGameOver(ctx, floorName) {
  panel(ctx, 560, 260);
  centerText(ctx, 'CAUGHT!', 300, FONT.heading, PALETTE.danger);
  centerText(ctx, `The guards cornered you on ${floorName}.`, 345, FONT.body, PALETTE.hudText);
  centerText(ctx, 'The Star Sapphire stays in the vault… this time.', 380, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Press SPACE to try again', 435, FONT.body, PALETTE.accent);
}

export function drawCaughtBanner(ctx) {
  ctx.fillStyle = 'rgba(120, 10, 10, 0.55)';
  ctx.fillRect(0, FIELD.height / 2 - 40, FIELD.width, 80);
  centerText(ctx, 'SPOTTED — RUN!', FIELD.height / 2 + 12, FONT.heading, '#ffffff');
}
