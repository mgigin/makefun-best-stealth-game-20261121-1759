// The three floors of the Starlight Vault. Each map is 32x18 tiles:
//   # wall   . floor   S shadow floor   C crate (cover)
//   P player start   * Star Sapphire   X exit door
// Guard routes are tile-coordinate waypoint loops, walked in order;
// a guard marked `sentinel` holds its post and sweeps its gaze
// instead. Cameras are tile-coordinate posts with a base facing
// (radians) and a sweep width — they watch, and raise the alarm.
// parseLevel turns a floor definition into the grid and spawn points
// the simulation runs on.

import { COLS, ROWS, TILE } from './config.js';
import { TILE_CRATE, TILE_FLOOR, TILE_SHADOW, TILE_WALL, tileCenter } from './geometry.js';

export const FLOORS = [
  {
    name: 'Floor 1 · The Antechamber',
    map: [
      '################################',
      '#P.....#......#.......#.......*#',
      '#......#......#.......#........#',
      '#..CC..#..CC..#..CC...#..CC....#',
      '#......#......#.......#........#',
      '#..SS......SS......SS......SS..#',
      '#..SS..####...####...####..SS..#',
      '#......#......#.......#........#',
      '#..CC..#..CC..#..CC...#..CC....#',
      '#......#......#.......#........#',
      '#..SS......SS......SS......SS..#',
      '#..SS..####...####...####..SS..#',
      '#......#......#.......#........#',
      '#..CC..#..CC..#..CC...#..CC....#',
      '#......#......#.......#........#',
      '#......#......#.......#.......X#',
      '#......#......#.......#........#',
      '################################',
    ],
    guards: [
      { route: [[2, 7], [6, 7], [6, 12], [2, 12]], phase: 0 },
      { route: [[15, 9], [21, 9]], phase: 0 },
      { route: [[27, 7], [30, 7], [30, 12], [27, 12]], phase: 1 },
    ],
    // One camera watches the sapphire column — an easy first lesson
    // in timing a sweep.
    cameras: [{ at: [30, 5], angle: Math.PI, sweep: 0.55, speed: 0.5, phase: 0 }],
  },
  {
    name: 'Floor 2 · The Gallery',
    map: [
      '################################',
      '#P....#.....#.....#.....#.....*#',
      '#.....#.....#.....#.....#......#',
      '#..C..#..C..#..C..#..C..#..C...#',
      '#.....#.....#.....#.....#......#',
      '#..SS....SS.....SS.....SS..SS..#',
      '#.####.####.####.####.####.#####',
      '#.....#.....#.....#.....#......#',
      '#..C..#..C..#..C..#..C..#..C...#',
      '#.....#.....#.....#.....#......#',
      '#..SS....SS.....SS.....SS..SS..#',
      '#.####.####.####.####.####.#####',
      '#.....#.....#.....#.....#......#',
      '#..C..#..C..#..C..#..C..#..C...#',
      '#.....#.....#.....#.....#......#',
      '#.....#.....#.....#.....#.....X#',
      '#.....#.....#.....#.....#......#',
      '################################',
    ],
    guards: [
      { route: [[2, 2], [5, 2], [5, 4], [2, 4]], phase: 0 },
      { route: [[14, 7], [17, 7], [17, 9], [14, 9]], phase: 1 },
      { route: [[20, 12], [23, 12], [23, 14], [20, 14]], phase: 3 },
      { route: [[26, 2], [30, 2], [30, 4], [26, 4]], phase: 2 },
    ],
    cameras: [
      { at: [15, 5], angle: Math.PI / 2, sweep: 0.7, speed: 0.6, phase: 1.2 },
      { at: [29, 13], angle: Math.PI, sweep: 0.6, speed: 0.45, phase: 3.1 },
    ],
  },
  {
    name: 'Floor 3 · The Star Vault',
    map: [
      '################################',
      '#P....#.......#.......#.......*#',
      '#.....#..CCC..#..CCC..#..CCC...#',
      '#..S..#.......#.......#....S...#',
      '#..S..####.####.####.####..S...#',
      '#.....#.......#.......#........#',
      '#..C..#..SS...#...SS..#..SS....#',
      '#.....#..SS...#...SS..#..SS....#',
      '#.####.####.####.####.####.#####',
      '#.....#.......#.......#........#',
      '#..C..#..SS...#...SS..#..SS....#',
      '#.....#..SS...#...SS..#..SS....#',
      '#..S..####.####.####.####..S...#',
      '#..S..#.......#.......#....S...#',
      '#.....#..CCC..#..CCC..#..CCC...#',
      '#.....#.......#.......#.......X#',
      '#.....#.......#.......#........#',
      '################################',
    ],
    guards: [
      { route: [[2, 5], [5, 5], [5, 7], [2, 7]], phase: 0 },
      { route: [[8, 1], [13, 1], [13, 3], [8, 3]], phase: 1 },
      { route: [[17, 5], [21, 5], [21, 7], [17, 7]], phase: 2 },
      // A sentinel holds the south-east approach and sweeps it.
      { sentinel: true, at: [27, 10], angle: -Math.PI / 2, sweep: 0.85, speed: 0.5 },
      { route: [[8, 13], [13, 13], [13, 15], [8, 15]], phase: 0 },
    ],
    cameras: [
      { at: [15, 5], angle: Math.PI / 2, sweep: 0.65, speed: 0.55, phase: 0.4 },
      { at: [21, 10], angle: Math.PI, sweep: 0.6, speed: 0.65, phase: 2.2 },
      { at: [29, 13], angle: -Math.PI / 2, sweep: 0.7, speed: 0.5, phase: 4.0 },
    ],
  },
];

/**
 * Parses one floor definition into simulation data: the tile grid,
 * the player's start, the sapphire and exit positions, and one spawn
 * record per guard (position plus its patrol route in pixels).
 */
export function parseLevel(floor) {
  const grid = new Array(COLS * ROWS).fill(TILE_FLOOR);
  let playerStart = tileCenter(1, 1);
  let sapphire = tileCenter(COLS - 2, 1);
  let exit = tileCenter(COLS - 2, ROWS - 2);
  for (let row = 0; row < ROWS; row += 1) {
    const line = floor.map[row] ?? '';
    for (let col = 0; col < COLS; col += 1) {
      const ch = line[col] ?? '#';
      const index = row * COLS + col;
      if (ch === '#') grid[index] = TILE_WALL;
      else if (ch === 'C') grid[index] = TILE_CRATE;
      else if (ch === 'S') grid[index] = TILE_SHADOW;
      else grid[index] = TILE_FLOOR;
      if (ch === 'P') playerStart = tileCenter(col, row);
      else if (ch === '*') sapphire = tileCenter(col, row);
      else if (ch === 'X') exit = tileCenter(col, row);
    }
  }
  const guardSpawns = floor.guards.map((def) => {
    if (def.sentinel) {
      const home = tileCenter(def.at[0], def.at[1]);
      return {
        x: home.x,
        y: home.y,
        route: [home],
        waypoint: 0,
        sentinel: true,
        sweepBase: def.angle,
        sweepAmp: def.sweep,
        sweepSpeed: def.speed,
      };
    }
    const route = def.route.map(([col, row]) => tileCenter(col, row));
    const start = route[def.phase % route.length];
    return { x: start.x, y: start.y, route, waypoint: (def.phase + 1) % route.length };
  });
  const cameraSpawns = (floor.cameras ?? []).map((def) => {
    const point = tileCenter(def.at[0], def.at[1]);
    return { x: point.x, y: point.y, angle: def.angle, sweep: def.sweep, speed: def.speed, phase: def.phase };
  });
  return { grid, playerStart, sapphire, exit, guardSpawns, cameraSpawns, tileSize: TILE };
}
