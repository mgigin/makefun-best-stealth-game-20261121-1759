// The three floors of the Starlight Vault. Each map is 32x18 tiles:
//   # wall   . floor   S shadow floor   C crate (cover)
//   P player start   * Star Sapphire   X exit door
// Guard routes are tile-coordinate waypoint loops, walked in order.
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
      { route: [[25, 9], [30, 9], [30, 11], [25, 11]], phase: 3 },
      { route: [[8, 13], [13, 13], [13, 15], [8, 15]], phase: 0 },
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
    const route = def.route.map(([col, row]) => tileCenter(col, row));
    const start = route[def.phase % route.length];
    return { x: start.x, y: start.y, route, waypoint: (def.phase + 1) % route.length };
  });
  return { grid, playerStart, sapphire, exit, guardSpawns, tileSize: TILE };
}
