// Heads-up display and full-screen panels. The top bar carries the
// job (floor) name, the objective with a live status line, and the
// thief's instruments: visibility state, pebble pips, sapphire count
// and the floor timer. A field-notes legend (toggle H) explains every
// mechanic in the vault's own language, an alert banner names the
// guard who spotted you, and the floor-clear screen draws the route
// you actually took, stamps your rank and scores the run. All text
// the player reads lives here; render.js only paints the world.

import { COLS, FIELD, FONT, PALETTE, ROWS, TILE } from './config.js';
import { TILE_CRATE, TILE_SHADOW, TILE_WALL, tileAt } from './geometry.js';

const SERIF = 'Georgia, "Times New Roman", serif';

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

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function drawEye(ctx, x, y, color, open) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 11, y);
  ctx.quadraticCurveTo(x, y - (open ? 9 : 3), x + 11, y);
  ctx.quadraticCurveTo(x, y + (open ? 9 : 3), x - 11, y);
  ctx.stroke();
  if (open) {
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHud(ctx, state) {
  // --- Top bar ------------------------------------------------------
  ctx.fillStyle = 'rgba(7, 10, 22, 0.92)';
  ctx.fillRect(0, 0, FIELD.width, 64);
  ctx.fillStyle = 'rgba(255, 215, 94, 0.35)';
  ctx.fillRect(0, 64, FIELD.width, 1);

  // Left: title + floor (the "job") + lives.
  ctx.textAlign = 'left';
  ctx.font = `700 24px ${SERIF}`;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText('STARLIGHT VAULT', 16, 28);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(state.floorName.toUpperCase(), 16, 50);
  ctx.fillStyle = PALETTE.danger;
  ctx.fillText('♥'.repeat(Math.max(0, state.lives)), 250, 50);

  // Centre: objective + live status line.
  ctx.textAlign = 'center';
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(
    state.hasSapphire ? 'ESCAPE THROUGH THE EXIT, UNSEEN' : 'STEAL THE STAR SAPPHIRE',
    FIELD.width / 2,
    28,
  );
  const status = {
    quiet: ['● ALL QUIET', PALETTE.good],
    suspicious: ['● A GUARD IS SUSPICIOUS', '#ffb84d'],
    alarm: ['● ALARM! BREAK THEIR SIGHT AND HIDE', PALETTE.danger],
  }[state.statusLine];
  ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = status[1];
  ctx.fillText(status[0], FIELD.width / 2, 52);

  // Right: visibility, pebble pips, sapphire, timer.
  const visColor = {
    SEEN: PALETTE.danger,
    EXPOSED: '#ffb84d',
    SHADOW: '#7db4ff',
    HIDDEN: PALETTE.good,
  }[state.visibility];
  drawEye(ctx, 858, 24, visColor, state.visibility === 'SEEN' || state.visibility === 'EXPOSED');
  ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = visColor;
  ctx.fillText(state.visibility, 918, 30);
  ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('VISIBILITY', 918, 48);

  for (let i = 0; i < state.pebblesMax; i += 1) {
    ctx.beginPath();
    ctx.arc(985 + i * 18, 24, 6, 0, Math.PI * 2);
    if (i < state.pebbles) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.fill();
    } else {
      ctx.strokeStyle = PALETTE.hudDim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('PEBBLES', 1005, 48);

  ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = state.hasSapphire ? PALETTE.sapphire : PALETTE.hudText;
  ctx.fillText(state.hasSapphire ? '1 / 1' : '0 / 1', 1115, 30);
  ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('SAPPHIRE', 1115, 48);

  ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(formatTime(state.time), 1215, 30);
  ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('TIME', 1215, 48);
  ctx.textAlign = 'left';

  // During an alarm the banner owns the strip under the top bar, so
  // the lock-on chip and the meter step below it.
  const alertOffset = state.statusLine === 'alarm' ? 96 : 0;

  // Camera lock-on warning, blinking while a camera is watching you.
  if (state.cameraSuspicion > 0.3) {
    const blink = Math.sin(state.animTime * 6) > -0.2;
    ctx.fillStyle = blink ? 'rgba(120, 20, 40, 0.85)' : 'rgba(80, 14, 28, 0.85)';
    ctx.fillRect(FIELD.width / 2 - 110, 74 + alertOffset, 220, 30);
    ctx.strokeStyle = PALETTE.danger;
    ctx.strokeRect(FIELD.width / 2 - 110, 74 + alertOffset, 220, 30);
    ctx.font = FONT.hud;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd7de';
    ctx.fillText('● CAMERA LOCK-ON', FIELD.width / 2, 95 + alertOffset);
    ctx.textAlign = 'left';
  }

  // Worst-suspicion meter, tucked under the top bar on the right.
  const meterX = FIELD.width - 216;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(meterX, 74 + alertOffset, 200, 12);
  const heat = ctx.createLinearGradient(meterX, 0, meterX + 200, 0);
  heat.addColorStop(0, PALETTE.good);
  heat.addColorStop(0.55, PALETTE.accent);
  heat.addColorStop(1, PALETTE.danger);
  ctx.fillStyle = heat;
  ctx.fillRect(meterX + 1, 75 + alertOffset, 198 * state.worstSuspicion, 10);
  ctx.strokeStyle = 'rgba(232, 236, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX + 0.5, 74.5 + alertOffset, 199, 11);
  ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('SPOTTED METER', meterX, 100 + alertOffset);

  // --- Bottom bar: gait left, control hints across ------------------
  ctx.fillStyle = 'rgba(7, 10, 22, 0.92)';
  ctx.fillRect(0, FIELD.height - 32, FIELD.width, 32);
  ctx.fillStyle = 'rgba(255, 215, 94, 0.35)';
  ctx.fillRect(0, FIELD.height - 32, FIELD.width, 1);
  ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.accent;
  const gaitLabel = { sneak: 'SNEAKING · silent', walk: 'WALKING · soft steps', run: 'RUNNING · loud!' }[state.gait];
  ctx.fillText(gaitLabel, 16, FIELD.height - 11);
  if (state.inShadow) {
    ctx.fillStyle = PALETTE.good;
    ctx.fillText('· in shadow', 215, FIELD.height - 11);
  }
  ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD / ARROWS move    SHIFT run    C sneak    CLICK throw a pebble    H field notes    P pause',
    FIELD.width / 2 + 130,
    FIELD.height - 11,
  );
  ctx.textAlign = 'left';
}

const FIELD_NOTES = [
  ['cone', 'Guard + vision cone (what they see)'],
  ['hatch', 'Blind spot behind crates: safe'],
  ['light', 'Light pools: you are seen from afar'],
  ['grass', 'Shadow grass: hidden unless close'],
  ['noise', 'Running: loud, guards hear you'],
  ['path', 'Dashed lines: where guards walk'],
  ['camera', 'Cameras sweep and call guards'],
  ['exit', 'EXIT: opens once you hold the sapphire'],
];

function drawNoteIcon(ctx, kind, x, y) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'cone') {
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(-6, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 214, 90, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(12, -7);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'hatch') {
    ctx.strokeStyle = '#7dd8c3';
    ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 5 - 4, 6);
      ctx.lineTo(i * 5 + 4, -6);
      ctx.stroke();
    }
  } else if (kind === 'light') {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    g.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
    g.addColorStop(1, 'rgba(255, 236, 170, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'grass') {
    ctx.strokeStyle = '#5da85f';
    ctx.lineWidth = 1.8;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 5, 7);
      ctx.quadraticCurveTo(i * 5 + 2, 0, i * 5 + (i % 2 ? 4 : -3), -7);
      ctx.stroke();
    }
  } else if (kind === 'noise') {
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 1.6;
    for (const r of [4, 8]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (kind === 'path') {
    ctx.strokeStyle = 'rgba(232, 236, 255, 0.8)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(-11, 5);
    ctx.lineTo(0, -5);
    ctx.lineTo(11, 5);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (kind === 'camera') {
    ctx.fillStyle = PALETTE.cameraBody;
    ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = '#0b2233';
    ctx.beginPath();
    ctx.arc(3, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'exit') {
    ctx.strokeStyle = PALETTE.exitGlow;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-8, -7, 16, 14);
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(8, -2);
    ctx.moveTo(-8, 3);
    ctx.lineTo(8, 3);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFieldNotes(ctx) {
  const x = 14;
  const y = 120;
  const width = 308;
  const height = 44 + FIELD_NOTES.length * 27;
  ctx.fillStyle = 'rgba(8, 10, 24, 0.88)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = 'rgba(255, 215, 94, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);
  ctx.font = `700 17px ${SERIF}`;
  ctx.fillStyle = PALETTE.accent;
  ctx.textAlign = 'left';
  ctx.fillText('FIELD NOTES', x + 14, y + 28);
  ctx.font = '500 14.5px "Segoe UI", system-ui, sans-serif';
  FIELD_NOTES.forEach(([kind, text], i) => {
    const rowY = y + 56 + i * 27;
    drawNoteIcon(ctx, kind, x + 22, rowY - 5);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(text, x + 42, rowY);
  });
}

function drawTitleArt(ctx) {
  // Starfield across the whole backdrop.
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 173.3) % FIELD.width;
    const y = (i * 97.7) % FIELD.height;
    const size = 0.8 + ((i * 31) % 10) / 6;
    ctx.globalAlpha = 0.35 + ((i * 17) % 10) / 18;
    ctx.fillStyle = '#dbe7ff';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Crescent moon, top right.
  ctx.fillStyle = '#f4ecd2';
  ctx.beginPath();
  ctx.arc(FIELD.width - 120, 96, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.backdrop;
  ctx.beginPath();
  ctx.arc(FIELD.width - 104, 86, 30, 0, Math.PI * 2);
  ctx.fill();
  // The Star Sapphire itself, glowing above the panel.
  const gx = FIELD.width / 2;
  const gy = 108;
  ctx.save();
  ctx.shadowColor = PALETTE.sapphire;
  ctx.shadowBlur = 34;
  ctx.fillStyle = PALETTE.sapphire;
  ctx.beginPath();
  ctx.moveTo(gx, gy - 34);
  ctx.lineTo(gx + 26, gy);
  ctx.lineTo(gx, gy + 34);
  ctx.lineTo(gx - 26, gy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.sapphireCore;
  ctx.beginPath();
  ctx.moveTo(gx, gy - 16);
  ctx.lineTo(gx + 12, gy);
  ctx.lineTo(gx, gy + 16);
  ctx.lineTo(gx - 12, gy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawTitle(ctx) {
  drawTitleArt(ctx);
  panel(ctx, 720, 430);
  centerText(ctx, 'STARLIGHT VAULT', 235, FONT.title, PALETTE.accent);
  centerText(ctx, 'Steal the Star Sapphire from the moonlit observatory vault.', 285, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Three floors. Guards with vision cones and sharp ears.', 318, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Hide in shadow, hug the crates, and slip out the EXIT unseen.', 351, FONT.body, PALETTE.hudText);
  centerText(ctx, 'WASD / arrows — move        Shift — run (loud)', 405, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'Hold C — sneak (silent)     Click — throw a pebble', 432, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'H — field notes     P — pause', 459, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'A glimpse makes a guard stare. Break away and he calms down.', 486, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'Fill his meter and he chases. Cameras sweep — time their gaze.', 513, FONT.small, PALETTE.hudDim);
  centerText(ctx, 'Press SPACE to begin', 562, FONT.heading, PALETTE.good);
}

export function drawPaused(ctx) {
  panel(ctx, 420, 180);
  centerText(ctx, 'PAUSED', 330, FONT.heading, PALETTE.accent);
  centerText(ctx, 'Press P or SPACE to keep sneaking', 375, FONT.body, PALETTE.hudText);
}

function rankFor(floorSpotted) {
  if (floorSpotted === 0) return { stamp: 'GHOST', tagline: 'Nobody will ever know you were there.', color: PALETTE.good };
  if (floorSpotted === 1) return { stamp: 'SHADOW', tagline: 'One glimpse, quickly doubted.', color: '#ffb84d' };
  return { stamp: 'NOISY', tagline: 'They knew. They just could not hold you.', color: PALETTE.danger };
}

function drawStamp(ctx, cx, cy, text, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.045);
  ctx.font = `700 44px ${SERIF}`;
  const width = ctx.measureText(text).width + 56;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(-width / 2, -32, width, 64);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-width / 2 + 5, -27, width - 10, 54);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 16);
  ctx.restore();
}

function drawMedallion(ctx, cx, cy, label, earned) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fillStyle = earned ? '#e8b93c' : 'rgba(120, 128, 160, 0.35)';
  ctx.fill();
  ctx.strokeStyle = earned ? '#fff0b8' : 'rgba(232, 236, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = earned ? '#5e4a08' : 'rgba(232, 236, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (earned) {
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 9, cy - 6);
  } else {
    ctx.moveTo(cx - 6, cy - 6);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.moveTo(cx + 6, cy - 6);
    ctx.lineTo(cx - 6, cy + 6);
  }
  ctx.stroke();
  ctx.font = '500 12.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = earned ? PALETTE.hudText : PALETTE.hudDim;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + 40);
  ctx.restore();
}

function drawRouteMap(ctx, data, x, y, width, height) {
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  const mapW = FIELD.width * scale;
  const mapH = FIELD.height * scale;
  const ox = x + (width - mapW) / 2;
  const oy = y + (height - mapH) / 2;
  ctx.fillStyle = '#0b0f20';
  ctx.fillRect(ox - 6, oy - 6, mapW + 12, mapH + 12);
  ctx.strokeStyle = 'rgba(255, 215, 94, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox - 6, oy - 6, mapW + 12, mapH + 12);
  const tile = TILE * scale;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const t = tileAt(data.grid, col, row);
      if (t === TILE_WALL) ctx.fillStyle = '#2c3760';
      else if (t === TILE_CRATE) ctx.fillStyle = '#8a6a3b';
      else if (t === TILE_SHADOW) ctx.fillStyle = '#141b30';
      else ctx.fillStyle = '#1d2542';
      ctx.fillRect(ox + col * tile, oy + row * tile, tile, tile);
    }
  }
  // Sapphire + exit markers.
  ctx.fillStyle = PALETTE.sapphire;
  ctx.beginPath();
  ctx.arc(ox + data.sapphire.x * scale, oy + data.sapphire.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.exitGlow;
  ctx.fillRect(ox + data.exit.x * scale - 5, oy + data.exit.y * scale - 5, 10, 10);
  // The route, dashed, every step of the way.
  if (data.route.length > 1) {
    ctx.strokeStyle = '#5ee8d8';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(ox + data.route[0].x * scale, oy + data.route[0].y * scale);
    for (const point of data.route) ctx.lineTo(ox + point.x * scale, oy + point.y * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Where the guards stood at the end.
  for (const guard of data.guards) {
    const gx = ox + guard.x * scale;
    const gy = oy + guard.y * scale;
    ctx.fillStyle = guard.sentinel ? PALETTE.sentinel : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(gx, gy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(guard.angle) * 9, gy + Math.sin(guard.angle) * 9);
    ctx.stroke();
  }
  ctx.font = '500 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.textAlign = 'left';
  ctx.fillText('— your route', ox, oy + mapH + 26);
  ctx.fillText('● where the guards stood at the end', ox + 120, oy + mapH + 26);
}

export function drawFloorClear(ctx, data) {
  ctx.fillStyle = 'rgba(4, 6, 14, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const rank = rankFor(data.floorSpotted);

  // Left: the route map.
  ctx.textAlign = 'left';
  ctx.font = `700 21px ${SERIF}`;
  ctx.fillStyle = PALETTE.accent;
  const floorShort = data.floorName.replace(/^Floor \d+ · /, '').toUpperCase();
  ctx.fillText(`THE ROUTE YOU TOOK THROUGH ${floorShort}`, 34, 108);
  ctx.font = 'italic 500 15px Georgia, serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('The Star Sapphire taken, out through the exit. Every step of the way, drawn.', 34, 132);
  drawRouteMap(ctx, data, 34, 150, 720, 420);

  // Right: verdict, stamp, stats, medallions, buttons.
  const rx = 800;
  ctx.strokeStyle = 'rgba(255, 215, 94, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx - 24, 84);
  ctx.lineTo(rx - 24, FIELD.height - 60);
  ctx.stroke();
  ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`FLOOR ${data.floorIndex + 1} DONE`, rx, 108);
  ctx.font = `700 34px ${SERIF}`;
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(data.floorSpotted === 0 ? 'CLEAN GETAWAY' : 'ROUGH GETAWAY', rx, 146);
  drawStamp(ctx, rx + 150, 205, rank.stamp, rank.color);
  ctx.font = 'italic 500 16px Georgia, serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(rank.tagline, rx, 262);

  const stats = [
    ['Time', formatTime(data.seconds)],
    ['Times spotted', String(data.floorSpotted)],
    ['Close calls', String(data.closeCalls)],
    ['Pebbles thrown', String(data.pebblesThrown)],
    ['Sapphire', data.hasSapphire ? '1 / 1' : '0 / 1'],
  ];
  ctx.font = '500 17px "Segoe UI", system-ui, sans-serif';
  stats.forEach(([label, value], i) => {
    const y = 302 + i * 30;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.textAlign = 'left';
    ctx.fillText(label, rx, y);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'right';
    ctx.fillText(value, rx + 400, y);
  });
  ctx.textAlign = 'left';

  drawMedallion(ctx, rx + 60, 492, 'Never spotted', data.floorSpotted === 0);
  drawMedallion(ctx, rx + 200, 492, 'Sapphire taken', data.hasSapphire);
  drawMedallion(ctx, rx + 340, 492, 'Under 75s', data.seconds < 75);

  // Buttons (keyboard-driven: SPACE next, R replay, T title).
  ctx.fillStyle = 'rgba(255, 215, 94, 0.14)';
  ctx.fillRect(rx, 556, 400, 52);
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, 556, 400, 52);
  ctx.font = '700 19px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.accent;
  ctx.textAlign = 'center';
  ctx.fillText('NEXT FLOOR', rx + 200, 582);
  ctx.font = '500 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SPACE', rx + 200, 600);
  ctx.strokeStyle = 'rgba(232, 236, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx, 620, 192, 42);
  ctx.strokeRect(rx + 208, 620, 192, 42);
  ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('REPLAY  (R)', rx + 96, 647);
  ctx.fillText('TITLE  (T)', rx + 304, 647);
  ctx.textAlign = 'left';
}

export function drawWin(ctx, seconds, timesSpotted) {
  panel(ctx, 680, 360);
  centerText(ctx, 'THE STAR SAPPHIRE IS YOURS', 250, FONT.heading, PALETTE.sapphire);
  centerText(ctx, 'You crossed all three floors and vanished into the night.', 292, FONT.body, PALETTE.hudText);
  const rank = rankFor(timesSpotted);
  drawStamp(ctx, FIELD.width / 2, 348, rank.stamp, rank.color);
  centerText(ctx, rank.tagline, 408, 'italic 500 16px Georgia, serif', PALETTE.hudDim);
  centerText(ctx, `Total time ${formatTime(seconds)} · Spotted ${timesSpotted}×`, 442, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Press SPACE to play again', 488, FONT.body, PALETTE.good);
}

export function drawGameOver(ctx, floorName) {
  panel(ctx, 560, 260);
  centerText(ctx, 'CAUGHT!', 300, FONT.heading, PALETTE.danger);
  centerText(ctx, `The guards cornered you on ${floorName}.`, 345, FONT.body, PALETTE.hudText);
  centerText(ctx, 'The Star Sapphire stays in the vault… this time.', 380, FONT.body, PALETTE.hudText);
  centerText(ctx, 'Press SPACE to try again', 435, FONT.body, PALETTE.accent);
}

export function drawCaughtBanner(ctx, guardName) {
  ctx.fillStyle = 'rgba(120, 10, 10, 0.5)';
  ctx.fillRect(0, 78, FIELD.width, 84);
  ctx.fillStyle = 'rgba(255, 107, 107, 0.85)';
  ctx.fillRect(FIELD.width / 2 - 320, 78, 640, 2);
  ctx.fillRect(FIELD.width / 2 - 320, 160, 640, 2);
  ctx.font = `700 34px ${SERIF}`;
  ctx.fillStyle = '#ff8a8a';
  ctx.textAlign = 'center';
  ctx.fillText(`SPOTTED BY WARDEN ${guardName.toUpperCase()}`, FIELD.width / 2, 118);
  ctx.font = 'italic 500 17px Georgia, serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('Run. Break their line of sight. Hide.', FIELD.width / 2, 146);
  ctx.textAlign = 'left';
}
