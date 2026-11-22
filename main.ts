// Hand-in program for the best-stealth-game-20261121-1759 entry (Node 22,
// standard library only). The game is the static site under game/ beside
// this file; the program copies game/ and screenshots/ into the output
// directory and writes dossier.json with the kit's vendored buildDossier,
// so the scorer can rebuild the same dossier byte for byte.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly with a clear message if the game folder is missing, instead
// of letting cpSync throw a cryptic ENOENT deep in the copy.
if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('game/index.html not found beside main.ts; run from the repository root');
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's gate: at most 4 screenshots of 256 KiB, at most
// 993 entries and 48 MiB under game/, paths at most 1000 bytes, and the
// dossier text capped at 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
