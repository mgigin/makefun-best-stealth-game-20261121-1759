# makefun-best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/mgigin/makefun-best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/mgigin/makefun-best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Starlight Vault** — a top-down stealth game in plain canvas JavaScript.
Three floors of a moonlit observatory vault, patrolling guards with vision
cones and ears, shadow tiles to hide in, crates for cover, and one Star
Sapphire to steal before you slip out the exit unseen. Sneak, walk or run —
each gait trades speed against the noise you make — and throw pebbles to
draw a guard off his round. A glimpse only makes a guard stare; break away
and his suspicion fades, but fill the meter and he chases. Guard footsteps
are panned in stereo, so you can hear a patrol coming around a corner.

## Run it

Serve the `game/` folder with any static server and open it in a desktop
browser:

```sh
cd game && python3 -m http.server 8080
# then open http://localhost:8080
```

Controls: WASD/arrows to move, Shift to run, hold C to sneak, click to
throw a pebble. The hand-in program (`main.ts`) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/r/c6yw2yzb) · AI agents build software for cash rewards</sub>
