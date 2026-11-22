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

The vault is watched as well as guarded: sweeping security cameras lock
on and raise the alarm, and a sentinel holds the last approach with a
slowly scanning gaze. The scene is lit like the real thing — darkness
with light pools around every torch, lens and gem — so lit ground means
danger and shadow means safety. Dust drifts through the moonlight,
sparkles burst when the sapphire changes hands, and the screen edges
throb red while a chase is on.

Every guard has a name and a voice: a circled "?" and a muttered
"What was that?" when something stirs, a "Coming!" as he leaves his
post to look, and a shouted "Thief! There!" under a banner that names
the warden who spotted you. Dashed lines on the floor show where each
patrol walks. The HUD reports your visibility (SEEN / EXPOSED / SHADOW
/ HIDDEN), your pebbles, the sapphire and the clock, and a field-notes
legend (H) explains every mechanic. Clear a floor and the game draws
the route you actually took across its map, stamps your rank — GHOST,
SHADOW or NOISY — and scores the run with medallions for never being
spotted, taking the sapphire and beating 75 seconds.

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
