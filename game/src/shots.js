// shots.js — deterministic screenshot staging, driven by the URL
// params ?shot=<name>&seed=1 that serve.ts / the capture step use.
// Each function arranges real entities (the same shapes traffic.js,
// police.js and combat.js maintain) so the first frames already show
// the intended scene: main.js applies the shot right after creating
// the world, then the normal loop takes over.
import { TILE, WORLD } from './config.js';
import { setMissionIndex, skipTalkSteps } from './missions.js';

const T = TILE;

function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, w: 34, h: 19,
    color: opts.color || '#b85145',
    police: !!opts.police,
    speed: opts.speed || 0, vx: opts.vx || 0, vy: opts.vy || 0,
    hp: 160, ai: opts.ai || null, driver: !!opts.driver, occupied: false,
  };
}

function putPlayerInCar(state, car) {
  state.vehicles.push(car);
  car.occupied = true;
  const p = state.player;
  p.vehicle = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function setHeat(state, heat) {
  if (!state.wanted) return;
  state.wanted.heat = heat;
  state.wanted.lastCrimeAt = state.time || 0;
}

function stageChase(state) {
  // On the ROAD_Y=12 boulevard, heading east at speed, mid-M6.
  const y = 12 * T + 17;
  const car = makeCar(770, y, 0, { color: '#c9a227', speed: 176, vx: 176 });
  putPlayerInCar(state, car);
  const p1 = makeCar(694, y - 10, 0, { police: true, ai: 'patrol', color: '#e8e6df', speed: 168, vx: 168, driver: true });
  const p2 = makeCar(664, y + 14, 0, { police: true, ai: 'patrol', color: '#e8e6df', speed: 162, vx: 162, driver: true });
  state.vehicles.push(p1, p2);
  setHeat(state, 215); // 3 stars: GARUDA-1 joins
  state.heli = { x: state.player.x - 30, y: state.player.y - 84, angle: 0, lightOn: true };
  setMissionIndex(state, 5); // M6 — Minimarket, objective + minimap marker
  skipTalkSteps(state); // open on the robbery action, not Mara's dialog
  state.dayTime = 11;
}

function stageStreet(state) {
  // On foot in Pasar Lama, a short stroll from the Gun Shop, with
  // neighbours around and traffic rolling past on ROAD_X=16.
  const p = state.player;
  p.x = 17 * T + 14;
  p.y = 6 * T + 20;
  p.angle = -0.6;
  const rngPeds = [
    { x: p.x - 52, y: p.y + 26 }, { x: p.x + 66, y: p.y - 18 },
    { x: p.x + 30, y: p.y + 58 }, { x: p.x - 88, y: p.y - 40 },
  ];
  for (const s of rngPeds) {
    state.peds.push({
      x: s.x, y: s.y, r: 6, color: '#53a06a', angle: 1, speed: 44,
      hp: 30, state: 'walk', fleeT: 0, fleeFrom: null, wp: null, vx: 0, vy: 0,
    });
  }
  const parked = makeCar(16 * T + 8, 9 * T, Math.PI / 2, { color: '#4f7fa8', driver: true });
  state.vehicles.push(parked);
  setMissionIndex(state, 0); // M1 objective + marker on the HUD
  skipTalkSteps(state); // stroll the street, not Mara's dialog panel
  state.dayTime = 17.3; // late afternoon, long shadows, not yet night
}

function stageNight(state) {
  // M8 in Bukit Hijau: on foot under GARUDA-1's searchlight, rain on.
  // Staged west of the BUKIT_POINT lookout (20T, 22T): inside its goto
  // radius the meeting would complete instantly and cut to dialog.
  const p = state.player;
  p.x = 17 * T;
  p.y = 21 * T;
  p.angle = 0.7;
  setMissionIndex(state, 7); // M8 — Malam di Bukit Hijau
  skipTalkSteps(state); // under the searchlight, not in a dialog
  setHeat(state, 215);
  state.heli = { x: p.x - 44, y: p.y - 108, angle: 0, lightOn: true };
  const patrol = makeCar(21 * T + 17, 19 * T, 2.6, { police: true, ai: 'patrol', color: '#e8e6df', driver: true });
  state.vehicles.push(patrol);
  state.rain = true;
  state.dayTime = 21.4;
}

function stageTitle(state) {
  // The start screen floats over the coast: camera locked on the
  // beach, the docks, the container rows and both ships.
  state.cameraOverride = { x: WORLD.width - 1280, y: 120 };
  state.dayTime = 10.5;
}

export function applyShot(state, name) {
  if (name === 'chase') stageChase(state);
  else if (name === 'street') stageStreet(state);
  else if (name === 'night') stageNight(state);
  else if (name === 'title') stageTitle(state);
}
