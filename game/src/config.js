// Every tuning number and colour for Starlight Vault in one place.
// The playfield is a fixed 1280x720 logical area (32x18 tiles of 40 px);
// the renderer scales it to the window, so no rule depends on screen size.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = FIELD.width / TILE; // 32
export const ROWS = FIELD.height / TILE; // 18

/** Fixed simulation step: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  sneakSpeed: 92,
  walkSpeed: 168,
  runSpeed: 262,
  /** Noise radius in pixels per gait; guards inside it hear the player. */
  sneakNoise: 0,
  walkNoise: 46,
  runNoise: 118,
  pebbleRange: 320,
  pebbleSpeed: 520,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 74,
  investigateSpeed: 118,
  chaseSpeed: 205,
  visionRange: 212,
  visionHalfAngle: 0.62, // radians, ~35.5 degrees each side
  /** Suspicion gained per second at point blank in full light, walking. */
  spotRate: 1.15,
  /** Suspicion lost per second while the player stays unseen. */
  calmRate: 0.22,
  /** Suspicion gained per second from hearing the player run nearby. */
  hearRate: 0.55,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  memorySeconds: 2.6,
  /** Seconds a guard looks around at an investigation point. */
  lookSeconds: 1.6,
  catchDistance: 26,
};

export const GAME = {
  lives: 3,
  pebblesPerFloor: 4,
  /** Detection multiplier while the player stands on a shadow tile. */
  shadowCover: 0.35,
  /** Detection multiplier while the player sneaks. */
  sneakCover: 0.55,
  /** Detection multiplier while the player runs (easier to spot). */
  runExposure: 1.5,
};

/** Wall-mounted security cameras: they sweep, they watch, they call guards. */
export const CAMERA = {
  visionRange: 190,
  visionHalfAngle: 0.46, // radians, ~26 degrees each side
  /** Suspicion gained per second at point blank in full light. */
  spotRate: 0.85,
  /** Suspicion lost per second while the player stays unseen. */
  calmRate: 0.3,
  /** Seconds a camera stays blind after raising an alarm. */
  alarmCooldown: 4,
};

export const PALETTE = {
  backdrop: '#070a14',
  floor: '#232a44',
  floorAlt: '#262e4c',
  floorGrout: '#1b2138',
  floorSpeckle: 'rgba(160, 175, 230, 0.10)',
  moonPatch: 'rgba(150, 180, 255, 0.07)',
  shadowFloor: '#12172a',
  wall: '#3d4a7a',
  wallTop: '#6678b5',
  wallSide: '#2c3760',
  wallSeam: 'rgba(12, 16, 34, 0.45)',
  wallShadow: 'rgba(2, 4, 10, 0.35)',
  crate: '#8a6a3b',
  crateEdge: '#a9834e',
  cratePlank: 'rgba(60, 40, 16, 0.35)',
  exitDoor: '#2e8b6e',
  exitGlow: '#57e6b0',
  sapphire: '#6fd3ff',
  sapphireCore: '#e8f9ff',
  player: '#ffd75e',
  playerTrim: '#2b2b3d',
  playerCloak: '#b8912f',
  guard: '#e85d5d',
  guardTrim: '#5e2430',
  sentinel: '#c792ff',
  sentinelTrim: '#3d245e',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 150, 60, 0.30)',
  coneAlert: 'rgba(255, 70, 70, 0.34)',
  coneEdge: 'rgba(255, 230, 150, 0.45)',
  cameraBody: '#8fd8ff',
  cameraTrim: '#1d3a52',
  cameraCone: 'rgba(110, 200, 255, 0.20)',
  cameraConeAlert: 'rgba(255, 90, 120, 0.32)',
  darkness: 'rgba(3, 5, 14, 0.52)',
  hudText: '#e8ecff',
  hudDim: '#9aa5cf',
  hudPanel: 'rgba(10, 13, 28, 0.82)',
  accent: '#ffd75e',
  danger: '#ff6b6b',
  good: '#57e6b0',
};

export const FONT = {
  title: '700 64px "Segoe UI", system-ui, sans-serif',
  heading: '700 30px "Segoe UI", system-ui, sans-serif',
  body: '500 19px "Segoe UI", system-ui, sans-serif',
  small: '500 15px "Segoe UI", system-ui, sans-serif',
  hud: '700 17px "Segoe UI", system-ui, sans-serif',
};
