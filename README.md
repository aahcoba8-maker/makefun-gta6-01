# Karang Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aahcoba8-maker/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aahcoba8-maker/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Karang Bay** is a top-down open-world crime game that runs entirely in the
browser. It was written from scratch for the make.fun gta6-01 bounty: no game
engine, no downloaded assets, no build step. One HTML page, one canvas, and a
folder of plain ES modules are the whole thing.

## Welcome to Karang Bay

You play Raka, back in his home town after too long away. Karang Bay is a
harbour city split into five districts, each with its own streets, traffic
and trouble:

- **Pelabuhan** — the working port: docks, cranes, warehouses
- **Pasar Lama** — the old market, where Bara's crew collects its debts
- **Kota Tua** — the old town, minimarket included (yes, it can be robbed)
- **Bukit Hijau** — the green hill, quiet until the finale turns it loose
- **Pantai Karang** — the beach the whole story eventually runs towards

Mara hands out the jobs, Dodi drives like he means it, and Inspector Sinta's
police force keeps notes on everything you do in public.

## Story missions

Eight missions carry the story from your first errand to one last night:

1. **Paket untuk Mara** — pick up a package at the port, bring it to Mara ($150)
2. **Tagihan Pasar Lama** — shake down three debtors around the market ($200)
3. **Taksi Gelap** — get a fare to the south dock in 75 seconds ($260)
4. **Suara di Pelabuhan** — investigate three spots on the docks ($220)
5. **Balapan Karang** — five checkpoints, one race, whole city ($300)
6. **Minimarket** — rob the Kota Tua minimarket, then shake three stars ($350)
7. **Teman Lama** — escort Dodi from the Pay-n-Spray to the clinic ($320)
8. **Malam di Bukit Hijau** — night falls, the GARUDA-1 helicopter comes up,
   and the only way out is the beach ($500)

Progress autosaves, so a busted run never costs you the whole story.

## The wanted system

Crime only counts when somebody sees it. Heat builds through five star
levels, and every level answers differently: foot officers first, then
Inspector Sinta herself, then patrol cars — and from three stars up, the
GARUDA-1 helicopter joins the chase with a searchlight you have to stay out
of. Get caught and the bust meter decides whether you walk away; lose the
cops and a Pay-n-Spray will quietly forget your plates.

## How to run it

You need Node 22 or newer. There is nothing to install.

Play the game in your browser:

```
node main.ts --serve
```

then open http://localhost:3000/ (set the `PORT` environment variable to
change the port). The server in `main.ts` serves the game page at `/` and
the game files alongside it. A lighter dev-only alternative also ships in
the repo: `node serve.ts` serves just the `game/` folder on port 8080.

Run without arguments, `node main.ts` does the other half of this file's
job: it assembles the make.fun submission dossier (game files, screenshots
and `dossier.json`) into `$MAKEFUN_OUTPUT_DIR`.

## Controls

- **WASD / arrow keys** — move on foot, steer when driving
- **E** — get in or out of a car, talk, interact
- **Mouse** — aim · **left click** — shoot or punch · **R** — reload
- **Shift** — sprint · **Space** — handbrake · **P** — pause · **M** — mute

## Features

- A living city: signalled intersections, flowing traffic, pedestrians who
  scatter when a crime scene erupts near them
- Witness-based wanted levels with a bust meter, Pay-n-Spray escapes,
  safehouse saves and clinic respawns
- Pistol fights with reloads, melee, a rival crew defending its turf, and
  barrels that chain-react when they go up
- Sound built live with WebAudio — engines, sirens, gunfire, explosions and
  a procedural bass loop; nothing is a recorded file
- A full day in 260 seconds: dawn, noon, dusk, night, plus rain, a live
  minimap and a localStorage save slot

## Tech

Vanilla JavaScript ES modules under `game/src/`, rendered on a single
canvas, zero dependencies. `main.ts` at the root is the entrypoint: it
serves the game for players and assembles the submission dossier for the
contest.
