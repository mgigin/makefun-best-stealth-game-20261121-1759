// Drawing only: simulation state in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred. Vision cones are drawn as
// raycast polygons clipped by walls and crates, so cover visibly cuts
// a cone — what the player sees is what the guard sees.
//
// The scene is lit like a moonlit vault: a darkness layer with light
// pools punched out around guards, cameras, the sapphire, the exit
// and the player, so lit ground reads as danger and shadow as safety.
// Cones get a second additive pass after the darkness so they glow
// like torchlight. Ambient dust motes drift through the light.

import { COLS, FIELD, FONT, PALETTE, ROWS, TILE } from './config.js';
import { TILE_CRATE, TILE_SHADOW, TILE_WALL, blocksSight, tileAt } from './geometry.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_STARE } from './guards.js';

const CONE_RAYS = 26;
const RAY_STEP = 8;

/** Deterministic per-tile hash, so floor detail never flickers. */
function tileHash(col, row) {
  return ((col * 73856093) ^ (row * 19349663) ^ ((col + row) * 83492791)) >>> 0;
}

function conePolygon(grid, watcher) {
  const points = [{ x: watcher.x, y: watcher.y }];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle =
      watcher.angle - watcher.visionHalfAngle + (2 * watcher.visionHalfAngle * i) / CONE_RAYS;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let travelled = 0;
    while (travelled < watcher.visionRange) {
      travelled += RAY_STEP;
      const x = watcher.x + dx * travelled;
      const y = watcher.y + dy * travelled;
      if (blocksSight(tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE)))) break;
    }
    const reach = Math.min(travelled, watcher.visionRange);
    points.push({ x: watcher.x + dx * reach, y: watcher.y + dy * reach });
  }
  return points;
}

function conePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function coneRgb(watcher, isCamera) {
  if (isCamera) return watcher.suspicion > 0.45 ? '255, 90, 120' : '110, 200, 255';
  if (watcher.state === GUARD_CHASE) return '255, 70, 70';
  if (watcher.suspicion > 0.25) return '255, 150, 60';
  return '255, 214, 90';
}

function drawCone(ctx, grid, watcher, isCamera) {
  const points = conePolygon(grid, watcher);
  const rgb = coneRgb(watcher, isCamera);
  const gradient = ctx.createRadialGradient(
    watcher.x, watcher.y, 8,
    watcher.x, watcher.y, watcher.visionRange,
  );
  gradient.addColorStop(0, `rgba(${rgb}, 0.42)`);
  gradient.addColorStop(0.55, `rgba(${rgb}, 0.22)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0.04)`);
  conePath(ctx, points);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Second, additive cone pass after the darkness layer: torch glow. */
function drawConeGlow(ctx, grid, watcher, isCamera) {
  const points = conePolygon(grid, watcher);
  const rgb = coneRgb(watcher, isCamera);
  conePath(ctx, points);
  ctx.fillStyle = `rgba(${rgb}, 0.16)`;
  ctx.fill();
}

function drawWallTile(ctx, x, y) {
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(x, y, TILE, TILE);
  // Lit top face with a soft falloff, darker south face.
  const top = ctx.createLinearGradient(x, y, x, y + TILE);
  top.addColorStop(0, PALETTE.wallTop);
  top.addColorStop(0.22, PALETTE.wall);
  top.addColorStop(0.78, PALETTE.wall);
  top.addColorStop(1, PALETTE.wallSide);
  ctx.fillStyle = top;
  ctx.fillRect(x, y, TILE, TILE);
  // Panel seam and rivets.
  ctx.strokeStyle = PALETTE.wallSeam;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  ctx.fillStyle = PALETTE.wallSeam;
  for (const [rx, ry] of [[5, 5], [TILE - 5, 5], [5, TILE - 5], [TILE - 5, TILE - 5]]) {
    ctx.beginPath();
    ctx.arc(x + rx, y + ry, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrateTile(ctx, x, y) {
  ctx.fillStyle = PALETTE.crate;
  ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
  // Wood planks.
  ctx.strokeStyle = PALETTE.cratePlank;
  ctx.lineWidth = 1.5;
  for (const py of [y + 13, y + 23, y + 33]) {
    ctx.beginPath();
    ctx.moveTo(x + 3, py);
    ctx.lineTo(x + TILE - 3, py);
    ctx.stroke();
  }
  ctx.strokeStyle = PALETTE.crateEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + TILE - 3, y + TILE - 3);
  ctx.moveTo(x + TILE - 3, y + 3);
  ctx.lineTo(x + 3, y + TILE - 3);
  ctx.stroke();
  // Metal corner brackets.
  ctx.fillStyle = '#5a627e';
  for (const [cx, cy] of [[x + 3, y + 3], [x + TILE - 9, y + 3], [x + 3, y + TILE - 9], [x + TILE - 9, y + TILE - 9]]) {
    ctx.fillRect(cx, cy, 6, 6);
  }
}

function drawTiles(ctx, grid) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const tile = tileAt(grid, col, row);
      const x = col * TILE;
      const y = row * TILE;
      const hash = tileHash(col, row);
      if (tile === TILE_WALL) {
        drawWallTile(ctx, x, y);
        // Drop shadow onto the floor to the south.
        if (tileAt(grid, col, row + 1) !== TILE_WALL) {
          const shade = ctx.createLinearGradient(x, y + TILE, x, y + TILE + 12);
          shade.addColorStop(0, PALETTE.wallShadow);
          shade.addColorStop(1, 'rgba(2, 4, 10, 0)');
          ctx.fillStyle = shade;
          ctx.fillRect(x, y + TILE, TILE, 12);
        }
      } else if (tile === TILE_CRATE) {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        ctx.fillRect(x, y, TILE, TILE);
        drawCrateTile(ctx, x, y);
      } else if (tile === TILE_SHADOW) {
        ctx.fillStyle = PALETTE.shadowFloor;
        ctx.fillRect(x, y, TILE, TILE);
        // Faint cool rim so shadow reads as a place, not a hole.
        ctx.strokeStyle = 'rgba(90, 120, 200, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        // Shadow grass: deterministic blades so cover reads as cover.
        ctx.strokeStyle = 'rgba(93, 168, 95, 0.55)';
        ctx.lineWidth = 1.6;
        for (let b = 0; b < 6; b += 1) {
          const bx = x + 5 + ((hash >> (b * 4)) % 30);
          const by = y + 12 + ((hash >> (b * 4 + 2)) % 22);
          const lean = ((hash >> (b * 3)) % 7) - 3;
          ctx.beginPath();
          ctx.moveTo(bx, by + 7);
          ctx.quadraticCurveTo(bx + lean * 0.4, by, bx + lean, by - 7);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        ctx.fillRect(x, y, TILE, TILE);
        // Grout lines.
        ctx.strokeStyle = PALETTE.floorGrout;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        // Deterministic speckles.
        if (hash % 5 === 0) {
          ctx.fillStyle = PALETTE.floorSpeckle;
          for (let s = 0; s < 3; s += 1) {
            const sx = x + 6 + ((hash >> (s * 5)) % 28);
            const sy = y + 6 + ((hash >> (s * 5 + 2)) % 28);
            ctx.fillRect(sx, sy, 2, 2);
          }
        }
        // Moonlight through the observatory glass: slanted patches.
        if (hash % 7 === 0) {
          ctx.fillStyle = PALETTE.moonPatch;
          ctx.beginPath();
          ctx.moveTo(x + 8, y + TILE);
          ctx.lineTo(x + 20, y);
          ctx.lineTo(x + 34, y);
          ctx.lineTo(x + 22, y + TILE);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

function drawExit(ctx, exit, hasSapphire, time) {
  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  // Door frame and light spill.
  ctx.fillStyle = '#1d2b26';
  ctx.fillRect(exit.x - 20, exit.y - 20, 40, 40);
  ctx.fillStyle = PALETTE.exitDoor;
  ctx.fillRect(exit.x - 17, exit.y - 17, 34, 34);
  ctx.fillStyle = 'rgba(87, 230, 176, 0.18)';
  ctx.fillRect(exit.x - 17, exit.y - 17, 34, 10);
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
  // Pedestal ring on the floor.
  ctx.strokeStyle = 'rgba(111, 211, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(sapphire.x, sapphire.y + 14, 16, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
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
  // Rotating glint cross.
  const glint = (Math.sin(time * 3.1) + 1) / 2;
  ctx.strokeStyle = `rgba(232, 249, 255, ${0.25 + 0.55 * glint})`;
  ctx.lineWidth = 1.6;
  const arm = 7 + 5 * glint;
  ctx.beginPath();
  ctx.moveTo(x - arm, y - 8);
  ctx.lineTo(x + arm, y - 8);
  ctx.moveTo(x, y - 8 - arm * 0.6);
  ctx.lineTo(x, y - 8 + arm * 0.6);
  ctx.stroke();
}

function drawShadowEllipse(ctx, body) {
  ctx.fillStyle = 'rgba(2, 4, 10, 0.4)';
  ctx.beginPath();
  ctx.ellipse(body.x, body.y + body.radius * 0.55, body.radius * 0.95, body.radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, player, time) {
  drawShadowEllipse(ctx, player);
  const bob = player.moving ? Math.sin(time * 11) * 1.1 : 0;
  const x = player.x;
  const y = player.y + bob;
  const ex = Math.cos(player.angle);
  const ey = Math.sin(player.angle);
  // Scarf trailing behind the facing direction.
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.moveTo(x - ex * 8, y - ey * 8);
  ctx.lineTo(x - ex * 22 - ey * 4, y - ey * 22 + ex * 4);
  ctx.lineTo(x - ex * 22 + ey * 4, y - ey * 22 - ex * 4);
  ctx.closePath();
  ctx.fill();
  // Cloak.
  ctx.fillStyle = PALETTE.playerCloak;
  ctx.beginPath();
  ctx.arc(x, y, player.radius + 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Face toward the facing direction, hood rim behind it.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(x + ex * 3.5, y + ey * 3.5, player.radius - 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.playerTrim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, player.radius + 1.5, player.angle + 0.9, player.angle + Math.PI * 2 - 0.9);
  ctx.stroke();
  // Eyes.
  const px = -ey;
  const py = ex;
  ctx.fillStyle = PALETTE.playerTrim;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + ex * 7 + px * side * 4, y + ey * 7 + py * side * 4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuardBody(ctx, guard, time) {
  drawShadowEllipse(ctx, guard);
  const moving = guard.state !== GUARD_STARE;
  const bob = moving ? Math.sin(time * 9 + guard.x * 0.05) * 1 : 0;
  const x = guard.x;
  const y = guard.y + bob;
  const ex = Math.cos(guard.angle);
  const ey = Math.sin(guard.angle);
  const px = -ey;
  const py = ex;
  const fill = guard.sentinel ? PALETTE.sentinel : PALETTE.guard;
  const trim = guard.sentinel ? PALETTE.sentinelTrim : PALETTE.guardTrim;
  // Facing wedge first, so the body circle sits on top of it.
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, guard.radius + 7, guard.angle - 0.5, guard.angle + 0.5);
  ctx.closePath();
  ctx.fill();
  // Shoulder pads.
  ctx.fillStyle = trim;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + px * side * (guard.radius - 1), y + py * side * (guard.radius - 1), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Uniform body.
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, guard.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Cap: a trim arc across the front of the head.
  ctx.strokeStyle = trim;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, guard.radius - 2.5, guard.angle - 1.15, guard.angle + 1.15);
  ctx.stroke();
  // Flashlight at the front edge.
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath();
  ctx.arc(x + ex * (guard.radius + 2), y + ey * (guard.radius + 2), 3, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = trim;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + ex * 5 + px * side * 4.5, y + ey * 5 + py * side * 4.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpeechBubble(ctx, x, y, text) {
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  const width = ctx.measureText(text).width + 16;
  const height = 22;
  const bx = Math.min(x, FIELD.width - width - 8);
  const by = Math.max(70, y - height);
  ctx.fillStyle = 'rgba(245, 242, 230, 0.96)';
  ctx.beginPath();
  ctx.roundRect(bx, by, width, height, 5);
  ctx.fill();
  // Tail pointing back at the guard.
  ctx.beginPath();
  ctx.moveTo(bx + 10, by + height);
  ctx.lineTo(bx + 4, by + height + 8);
  ctx.lineTo(bx + 20, by + height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#26221a';
  ctx.textAlign = 'left';
  ctx.fillText(text, bx + 8, by + 15);
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
  let line = '';
  if (guard.state === GUARD_CHASE) {
    mark = '!';
    line = 'Thief! There!';
  } else if (guard.state === GUARD_STARE) {
    mark = '?';
    line = 'What was that?';
  } else if (guard.state === GUARD_INVESTIGATE) {
    mark = '?';
    line = 'Coming!';
  }
  if (mark) {
    // Circled badge above the head, speech bubble beside it.
    const badgeX = guard.x;
    const badgeY = guard.y - guard.radius - 30;
    ctx.fillStyle = guard.state === GUARD_CHASE ? PALETTE.danger : '#3a2f14';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = guard.state === GUARD_CHASE ? '#ffd7d7' : PALETTE.accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = guard.state === GUARD_CHASE ? '#ffffff' : PALETTE.accent;
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mark, badgeX, badgeY + 4.5);
    drawSpeechBubble(ctx, badgeX + 14, badgeY - 4, line);
  }
}

/** Faint dashed patrol loops: where the guards walk, drawn on the floor. */
function drawPatrolPaths(ctx, guards) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 212, 255, 0.20)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 6]);
  for (const guard of guards) {
    if (guard.sentinel || guard.route.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(guard.route[0].x, guard.route[0].y);
    for (const point of guard.route) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** Annotated callouts for staged scenes: label box + leader line. */
function drawCallouts(ctx, callouts) {
  if (!callouts || callouts.length === 0) return;
  ctx.font = '600 13.5px "Segoe UI", system-ui, sans-serif';
  for (const callout of callouts) {
    const width = ctx.measureText(callout.text).width + 18;
    const height = 24;
    const lx = Math.max(8, Math.min(callout.labelX, FIELD.width - width - 8));
    const ly = Math.max(70, Math.min(callout.labelY, FIELD.height - height - 40));
    ctx.strokeStyle = 'rgba(232, 236, 255, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(callout.x, callout.y);
    ctx.lineTo(lx + width / 2, ly + height / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(245, 242, 230, 0.96)';
    ctx.beginPath();
    ctx.arc(callout.x, callout.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 13, 28, 0.92)';
    ctx.fillRect(lx, ly, width, height);
    ctx.strokeStyle = 'rgba(232, 236, 255, 0.85)';
    ctx.strokeRect(lx, ly, width, height);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'left';
    ctx.fillText(callout.text, lx + 9, ly + 16);
  }
}

function drawCameraBody(ctx, camera, time) {
  const { x, y } = camera;
  // Mount plate.
  ctx.fillStyle = PALETTE.cameraTrim;
  ctx.fillRect(x - 11, y - 11, 22, 22);
  ctx.strokeStyle = PALETTE.cameraBody;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 11, y - 11, 22, 22);
  // Barrel toward the facing direction.
  const ex = Math.cos(camera.angle);
  const ey = Math.sin(camera.angle);
  ctx.fillStyle = PALETTE.cameraBody;
  ctx.beginPath();
  ctx.arc(x + ex * 5, y + ey * 5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b2233';
  ctx.beginPath();
  ctx.arc(x + ex * 8, y + ey * 8, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 225, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(x + ex * 9, y + ey * 9, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // Blinking LED: green calm, amber watching, red alarm.
  const blink = Math.sin(time * 4 + camera.phase) > 0;
  const led = camera.cooldown > 0
    ? (blink ? '#ff5a5a' : '#7a2020')
    : camera.suspicion > 0.45
      ? '#ffb84d'
      : '#57e6b0';
  ctx.fillStyle = led;
  ctx.beginPath();
  ctx.arc(x - 7, y - 7, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Suspicion ring while the camera is locking on.
  if (camera.suspicion > 0.02 && camera.cooldown <= 0) {
    ctx.strokeStyle = camera.suspicion > 0.75 ? PALETTE.danger : PALETTE.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + camera.suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPebbles(ctx, pebbles, time) {
  for (const pebble of pebbles) {
    if (!pebble.landed) {
      const x = pebble.x + (pebble.tx - pebble.x) * pebble.t;
      const y = pebble.y + (pebble.ty - pebble.y) * pebble.t - Math.sin(pebble.t * Math.PI) * 14;
      // Faint arc trail.
      ctx.strokeStyle = 'rgba(207, 214, 242, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pebble.x, pebble.y);
      ctx.quadraticCurveTo(
        (pebble.x + pebble.tx) / 2,
        (pebble.y + pebble.ty) / 2 - 16,
        x, y,
      );
      ctx.stroke();
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

function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Slow ambient dust, purely a function of time so it never pops. */
function drawDust(ctx, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 42; i += 1) {
    const seed = i * 137.5;
    const x = ((seed * 7.3 + time * (4 + (i % 5))) % FIELD.width + FIELD.width) % FIELD.width;
    const y = ((seed * 3.1 + Math.sin(time * 0.3 + i) * 26 + FIELD.height) % FIELD.height + FIELD.height) % FIELD.height;
    const twinkle = 0.25 + 0.2 * Math.sin(time * 1.7 + i * 2.3);
    ctx.globalAlpha = Math.max(0.05, twinkle);
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  // Cache the fit: setting canvas.width/height clears the bitmap, so it
  // must happen at most once per frame and only when the size changes.
  // draw() computes the fit; overlay() reuses it instead of refitting
  // (a second fit would wipe the world draw() just painted).
  let cached = null;
  // Offscreen darkness layer, kept at logical resolution.
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = FIELD.width;
  lightCanvas.height = FIELD.height;
  const lightCtx = lightCanvas.getContext('2d');

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

  function punchLight(x, y, radius, strength) {
    const gradient = lightCtx.createRadialGradient(x, y, 4, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${strength})`);
    gradient.addColorStop(0.6, `rgba(255, 255, 255, ${strength * 0.55})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    lightCtx.fillStyle = gradient;
    lightCtx.beginPath();
    lightCtx.arc(x, y, radius, 0, Math.PI * 2);
    lightCtx.fill();
  }

  function drawLighting(world) {
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.clearRect(0, 0, FIELD.width, FIELD.height);
    lightCtx.fillStyle = PALETTE.darkness;
    lightCtx.fillRect(0, 0, FIELD.width, FIELD.height);
    lightCtx.globalCompositeOperation = 'destination-out';
    for (const guard of world.guards) punchLight(guard.x, guard.y, 135, 0.95);
    for (const camera of world.cameras) punchLight(camera.x, camera.y, 75, 0.8);
    if (!world.hasSapphire) {
      punchLight(world.sapphire.x, world.sapphire.y, 95 + 10 * Math.sin(world.time * 2.4), 0.9);
    }
    punchLight(world.exit.x, world.exit.y, world.hasSapphire ? 95 : 55, 0.85);
    punchLight(world.player.x, world.player.y, 78, 0.75);
    lightCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0);
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
      drawPatrolPaths(ctx, world.guards);
      for (const guard of world.guards) drawCone(ctx, world.grid, guard, false);
      for (const camera of world.cameras) drawCone(ctx, world.grid, camera, true);
      // Walls and crates again over the cones, so cover reads as cover.
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const tile = tileAt(world.grid, col, row);
          if (tile !== TILE_WALL && tile !== TILE_CRATE) continue;
          const x = col * TILE;
          const y = row * TILE;
          if (tile === TILE_WALL) drawWallTile(ctx, x, y);
          else drawCrateTile(ctx, x, y);
        }
      }

      drawExit(ctx, world.exit, world.hasSapphire, world.time);
      if (!world.hasSapphire) drawSapphire(ctx, world.sapphire, world.time);
      drawPebbles(ctx, world.pebbles, world.time);

      // Darkness with light pools, then a glow pass so cones still read.
      drawLighting(world);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const guard of world.guards) drawConeGlow(ctx, world.grid, guard, false);
      for (const camera of world.cameras) drawConeGlow(ctx, world.grid, camera, true);
      ctx.restore();

      // Noise ring: how far the player's footsteps carry right now.
      if (world.player.noiseRadius > 0) {
        ctx.strokeStyle = 'rgba(255, 215, 94, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(world.player.x, world.player.y, world.player.noiseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const camera of world.cameras) drawCameraBody(ctx, camera, world.time);
      for (const guard of world.guards) {
        drawGuardBody(ctx, guard, world.time);
        drawGuardState(ctx, guard);
      }
      drawPlayer(ctx, world.player, world.time);
      if (world.hasSapphire) {
        ctx.fillStyle = PALETTE.sapphire;
        ctx.beginPath();
        ctx.arc(world.player.x + 9, world.player.y - 9, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      drawParticles(ctx, world.particles);
      drawDust(ctx, world.time);
      drawCallouts(ctx, world.callouts);

      // Moonlight vignette: edges fall off, the middle stays readable.
      const gradient = ctx.createRadialGradient(
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
      );
      gradient.addColorStop(0, 'rgba(4, 6, 16, 0)');
      gradient.addColorStop(1, 'rgba(4, 6, 16, 0.42)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);

      // Alert pulse: red edges throb while any guard is chasing.
      if (world.guards.some((guard) => guard.state === GUARD_CHASE)) {
        const pulse = 0.16 + 0.12 * Math.sin(world.time * 6);
        const alert = ctx.createRadialGradient(
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.38,
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
        );
        alert.addColorStop(0, 'rgba(255, 40, 40, 0)');
        alert.addColorStop(1, `rgba(255, 40, 40, ${pulse})`);
        ctx.fillStyle = alert;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }

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
