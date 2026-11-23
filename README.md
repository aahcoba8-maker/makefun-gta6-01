# Karang Bay

[![make.fun bounty](https://make.fun/api/competitions/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/api/competitions/gta6-01/rank.svg?user=aahcoba8-maker&repo=makefun-gta6-01)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/api/competitions/gta6-01/reward.svg?user=aahcoba8-maker&repo=makefun-gta6-01)](https://make.fun/bounty/gta6-01)

**Karang Bay** is a complete 2D top-down open-world crime game that runs
entirely in the browser — one coastal city, five districts, eight missions,
a full wanted system, and a helicopter that really wants to meet you.
Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## Story

Raka arrives in the bay city of Karang Bay with $120 and a name that is
already dirty. Mara offers him work, Bara runs the old market with an iron
fist, Dodi fixes cars and sprains ankles, and Inspector Sinta watches it
all from GARUDA-1, the police helicopter. Eight jobs separate Raka from
owning the bay: a package run, a debt collection, a 75-second dock pickup,
a port investigation, a five-checkpoint street race, a minimarket robbery,
an escort across town, and one long night in Bukit Hijau that ends on
Pantai Karang beach.

## The city

- **Pelabuhan** — the port in the east: container stacks, cranes, docks and
  two ships, KARANG EXPRESS and TELUK 08.
- **Pasar Lama** — the old market: shops, awnings, the Gun Shop.
- **Kota Tua** — the old town, home of the minimarket.
- **Bukit Hijau** — the green hills, quiet by day, decisive by night.
- **Pantai Karang** — the beach on the sea wall.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Walk / drive |
| Shift | Run |
| E | Enter/exit car, talk, use shops, advance dialog |
| Mouse click / hold | Punch, or aim and fire the pistol |
| Space | Handbrake (drift) |
| R | Reload |
| M | Mute |
| Esc / P | Pause |

## Features

- Open world with day/night cycle, rain, street lighting and a live minimap.
- Driving with an arcade drift model, traffic AI that obeys lanes and red
  lights, pedestrians who flee from trouble, car theft and collisions.
- A five-star wanted system: heat is only added when a crime is witnessed,
  foot officers and Inspector Sinta give chase, patrol cars ram from two
  stars, and GARUDA-1 joins at three with a searchlight that counts as eyes.
  Lose them at Dodi's Pay-n-Spray or the safehouse — or get BUSTED.
- Combat: fists, a purchasable pistol with magazines and reloads, a rival
  crew holding Pasar Lama and the port, their leader Bara, and explosive
  barrels that chain.
- Eight sequential missions with named dialog, timers, a checkpoint race,
  an escort and a robbery that only pays once the stars are gone.
- Shops that matter: Gun Shop (pistol $250, ammo $40), Clinic ($30),
  Pay-n-Spray ($100 and a clean slate), safehouse saving to localStorage.
- Procedural WebAudio: engine, sirens, gunfire, explosions and a bass loop.
  No audio files, no assets, no network — everything is drawn and sounded
  by code.

## Tech

Vanilla JavaScript ES modules on a single canvas, zero dependencies.
The world, traffic and missions are seeded and deterministic. `main.ts`
(the make.fun entrypoint) packages the game folder and screenshots into
the submission dossier; `serve.ts` runs the game locally:

```sh
node serve.ts   # http://localhost:8080
```

Deterministic screenshot staging for judging lives in `shots.json` and
`game/src/shots.js` (`?shot=chase|street|night|title&seed=1`).

## License

MIT — see `LICENSE`.
