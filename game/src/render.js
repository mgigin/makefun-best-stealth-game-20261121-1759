// Drawing only: simulation state in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred. Vision cones are drawn as
// raycast polygons clipped by walls and crates, so cover visibly cuts
// a cone — what the player sees is what the guard sees.

import { COLS, FIELD, FONT, PALETTE, ROWS, TILE } from './config.js';
import { TILE_CRATE, TILE_SHADOW, TILE_WALL, blocksSight, tileAt } from './geometry.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_STARE } from './guards.js';

const CONE_RAYS = 26;
const RAY_STEP = 8;

function conePolygon(grid, guard) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle =
      guard.angle - guard.visionHalfAngle + (2 * guard.visionHalfAngle * i) / CONE_RAYS;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let travelled = 0;
    while (travelled < guard.visionRange) {
      travelled += RAY_STEP;
      const x = guard.x + dx * travelled;
      const y = guard.y + dy * travelled;
      if (blocksSight(tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE)))) break;
    }
    const reach = Math.min(travelled, guard.visionRange);
    points.push({ x: guard.x + dx * reach, y: guard.y + dy * reach });
  }
  return points;
}

function drawCone(ctx, grid, guard) {
  const points = conePolygon(grid, guard);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  if (guard.state === GUARD_CHASE) ctx.fillStyle = PALETTE.coneAlert;
  else if (guard.suspicion > 0.25) ctx.fillStyle = PALETTE.coneSuspicious;
  else ctx.fillStyle = PALETTE.coneCalm;
  ctx.fill();
  ctx.strokeStyle = PALETTE.coneEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawTiles(ctx, grid) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const tile = tileAt(grid, col, row);
      const x = col * TILE;
      const y = row * TILE;
      if (tile === TILE_WALL) {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x, y, TILE, 7);
      } else if (tile === TILE_CRATE) {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = PALETTE.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else if (tile === TILE_SHADOW) {
        ctx.fillStyle = PALETTE.shadowFloor;
        ctx.fillRect(x, y, TILE, TILE);
      } else {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
}

function drawExit(ctx, exit, hasSapphire, time) {
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.fillStyle = PALETTE.exitDoor;
  ctx.fillRect(exit.x - 17, exit.y - 17, 34, 34);
  ctx.strokeStyle = PALETTE.exitGlow;
  ctx.lineWidth = 3;
  ctx.strokeRect(exit.x - 17, exit.y - 17, 34, 34);
  ctx.fillStyle = PALETTE.exitGlow;
  ctx.font = FONT.small;
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exit.x, exit.y + 5);
  if (hasSapphire) {
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = PALETTE.exitGlow;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 30 + 6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSapphire(ctx, sapphire, time) {
  const bob = Math.sin(time * 2.4) * 3;
  const x = sapphire.x;
  const y = sapphire.y + bob;
  ctx.save();
  ctx.shadowColor = PALETTE.sapphire;
  ctx.shadowBlur = 18;
  ctx.fillStyle = PALETTE.sapphire;
  ctx.beginPath();
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x + 10, y);
  ctx.lineTo(x, y + 13);
  ctx.lineTo(x - 10, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.sapphireCore;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + 4.5, y);
  ctx.lineTo(x, y + 6);
  ctx.lineTo(x - 4.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBody(ctx, body, fill, trim) {
  // Facing wedge first, so the body circle sits on top of it.
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.moveTo(body.x, body.y);
  ctx.arc(body.x, body.y, body.radius + 7, body.angle - 0.5, body.angle + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Eyes: two dots toward the facing direction.
  const ex = Math.cos(body.angle);
  const ey = Math.sin(body.angle);
  const px = -ey;
  const py = ex;
  ctx.fillStyle = trim;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      body.x + ex * 5 + px * side * 4.5,
      body.y + ey * 5 + py * side * 4.5,
      2.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawGuardState(ctx, guard) {
  if (guard.suspicion > 0.02) {
    const width = 30;
    const x = guard.x - width / 2;
    const y = guard.y - guard.radius - 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x - 1, y - 1, width + 2, 7);
    ctx.fillStyle = guard.state === GUARD_CHASE ? PALETTE.danger : PALETTE.accent;
    ctx.fillRect(x, y, width * guard.suspicion, 5);
  }
  let mark = '';
  if (guard.state === GUARD_CHASE) mark = '!';
  else if (guard.state === GUARD_STARE || guard.state === GUARD_INVESTIGATE) mark = '?';
  if (mark) {
    ctx.fillStyle = guard.state === GUARD_CHASE ? PALETTE.danger : PALETTE.accent;
    ctx.font = FONT.heading;
    ctx.textAlign = 'center';
    ctx.fillText(mark, guard.x, guard.y - guard.radius - 24);
  }
}

function drawPebbles(ctx, pebbles, time) {
  for (const pebble of pebbles) {
    if (!pebble.landed) {
      const x = pebble.x + (pebble.tx - pebble.x) * pebble.t;
      const y = pebble.y + (pebble.ty - pebble.y) * pebble.t - Math.sin(pebble.t * Math.PI) * 14;
      ctx.fillStyle = '#cfd6f2';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const age = time - pebble.landedAt;
      if (age < 0.6) {
        ctx.strokeStyle = `rgba(207, 214, 242, ${0.7 * (1 - age / 0.6)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pebble.tx, pebble.ty, 6 + age * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#9aa5cf';
      ctx.beginPath();
      ctx.arc(pebble.tx, pebble.ty, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  // Cache the fit: setting canvas.width/height clears the bitmap, so it
  // must happen at most once per frame and only when the size changes.
  // draw() computes the fit; overlay() reuses it instead of refitting
  // (a second fit would wipe the world draw() just painted).
  let cached = null;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    cached = {
      scale,
      offsetX: (canvas.width - FIELD.width * scale) / 2,
      offsetY: (canvas.height - FIELD.height * scale) / 2,
    };
    return cached;
  }

  return {
    /** Paints one frame of the world (no HUD; hud.js draws that). */
    draw(world) {
      const { scale, offsetX, offsetY } = fit();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

      drawTiles(ctx, world.grid);
      for (const guard of world.guards) drawCone(ctx, world.grid, guard);
      // Walls and crates again over the cones, so cover reads as cover.
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const tile = tileAt(world.grid, col, row);
          if (tile !== TILE_WALL && tile !== TILE_CRATE) continue;
          const x = col * TILE;
          const y = row * TILE;
          if (tile === TILE_WALL) {
            ctx.fillStyle = PALETTE.wall;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = PALETTE.wallTop;
            ctx.fillRect(x, y, TILE, 7);
          } else {
            ctx.fillStyle = PALETTE.crate;
            ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
            ctx.strokeStyle = PALETTE.crateEdge;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
            ctx.beginPath();
            ctx.moveTo(x + 3, y + 3);
            ctx.lineTo(x + TILE - 3, y + TILE - 3);
            ctx.moveTo(x + TILE - 3, y + 3);
            ctx.lineTo(x + 3, y + TILE - 3);
            ctx.stroke();
          }
        }
      }

      drawExit(ctx, world.exit, world.hasSapphire, world.time);
      if (!world.hasSapphire) drawSapphire(ctx, world.sapphire, world.time);
      drawPebbles(ctx, world.pebbles, world.time);

      // Noise ring: how far the player's footsteps carry right now.
      if (world.player.noiseRadius > 0) {
        ctx.strokeStyle = 'rgba(255, 215, 94, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(world.player.x, world.player.y, world.player.noiseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const guard of world.guards) {
        drawBody(ctx, guard, PALETTE.guard, PALETTE.guardTrim);
        drawGuardState(ctx, guard);
      }
      drawBody(ctx, world.player, PALETTE.player, PALETTE.playerTrim);
      if (world.hasSapphire) {
        ctx.fillStyle = PALETTE.sapphire;
        ctx.beginPath();
        ctx.arc(world.player.x + 9, world.player.y - 9, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Moonlight vignette: edges fall off, the middle stays readable.
      const gradient = ctx.createRadialGradient(
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
      );
      gradient.addColorStop(0, 'rgba(4, 6, 16, 0)');
      gradient.addColorStop(1, 'rgba(4, 6, 16, 0.42)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);

      // Caught flash.
      if (world.caughtFlash > 0) {
        ctx.fillStyle = `rgba(255, 60, 60, ${0.35 * world.caughtFlash})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
    },
    /** Raw context + transform for hud.js overlays (same fit as draw). */
    overlay() {
      const { scale, offsetX, offsetY } = cached ?? fit();
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      return ctx;
    },
  };
}
