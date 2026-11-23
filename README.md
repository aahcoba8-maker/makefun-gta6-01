# Karang Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aahcoba8-maker/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aahcoba8-maker/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 2D top-down open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). No engine, no
assets, no build step — plain HTML5 canvas and ES modules.

## The game

Raka comes home to **Karang Bay**, a harbour city of five districts —
Pelabuhan (the port), Pasar Lama (the old market), Kota Tua, Bukit Hijau
and Pantai Karang beach. Bara's crew runs the market, debts are piling up,
and Inspector Sinta's police are watching every corner. Work jobs for
Mara, race for Dodi, rob the wrong minimarket, and survive one last night
under the GARUDA-1 searchlight.

## Story missions

1. **Paket untuk Mara** — fetch a package from the port, deliver it to Mara ($150)
2. **Tagihan Pasar Lama** — collect three debts around the market ($200)
3. **Taksi Gelap** — a 75-second dash to the south dock ($260)
4. **Suara di Pelabuhan** — check three points around the docks ($220)
5. **Balapan Karang** — a five-checkpoint race across the city ($300)
6. **Minimarket** — rob the Kota Tua minimarket, then lose three stars ($350)
7. **Teman Lama** — escort Dodi from Pay-n-Spray to the clinic ($320)
8. **Malam di Bukit Hijau** — the finale: night falls, GARUDA-1 rises, run for the beach ($500)

## Features

- Living traffic on a signalled road grid, pedestrians who flee from crime scenes
- Witness-gated wanted system: heat only rises when someone sees the crime;
  five star levels bring foot officers, Inspector Sinta, patrol cars and,
  from three stars, the GARUDA-1 helicopter with a searchlight
- Bust meter, Pay-n-Spray escapes, safehouse saves, clinic respawns
- Pistol combat with reloads, melee, a rival crew holding turf, chain-reacting barrels
- Procedural WebAudio: engine, siren, shots, explosions and a bass-line loop
- Full day cycle (24 h in 260 s), rain, live minimap, localStorage save slot

## Controls

- **WASD / arrows** — walk & drive · **E** — enter car / interact
- **Mouse** — aim, **click** — shoot / punch · **R** — reload
- **Shift** — run · **Space** — handbrake · **P** — pause · **M** — mute

## Tech

Vanilla JavaScript ES modules (`game/src/`), one canvas, zero dependencies.
`node serve.ts` serves the game locally on port 8080; `main.ts` is the
make.fun entrypoint that assembles the submission dossier.
