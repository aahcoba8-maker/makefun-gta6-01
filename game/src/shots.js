// Deterministic screenshot staging for Karang Bay.
// ?shot=<chase|street|night|title>&seed=1 sets up one composed frame:
// dialog is always suppressed in shot mode so panels never cover it.
import { SEA_X, TILE, WORLD } from './config.js';
import { makeCar } from './traffic.js';
import { heatToLevel } from './police.js';
import { skipDialog } from './missions.js';

export function parseShotParams() {
  try {
    const q = new URLSearchParams(window.location.search);
    const seedRaw = q.get('seed');
    return {
      shot: q.get('shot'),
      seed: seedRaw ? parseInt(seedRaw, 10) : null,
    };
  } catch {
    return { shot: null, seed: null };
  }
}

function setWanted(state, heat) {
  state.wanted.heat = heat;
  state.wanted.level = heatToLevel(heat);
  state.wanted.lastCrimeAt = state.time;
}

export function stageShot(state, name) {
  state.shotMode = true;
  state.dialog = null;
  state.dialogQueue = [];
  const p = state.player;
  if (name === 'chase') {
    const car = makeCar(21 * TILE + 17, 12 * TILE + 17, 0, '#e8b93c', { hp: 100 });
    car.speed = 150;
    p.vehicle = car;
    p.x = car.x; p.y = car.y;
    const cop1 = makeCar(car.x - 64, car.y - 15, 0, '#e8e8e8', { police: true, hp: 130 });
    cop1.speed = 150;
    const cop2 = makeCar(car.x - 112, car.y + 19, 0, '#e8e8e8', { police: true, hp: 130 });
    cop2.speed = 150;
    state.cars.push(cop1, cop2);
    state.heli = { x: p.x - 95, y: p.y - 115 };
    setWanted(state, 215);
    state.mission.index = 5;
    state.mission.step = 2;
    state.objective = 'M6 MINIMARKET: Kabur sampai bintang hilang!';
    state.marker = null;
    state.timeOfDay = 10.5;
    state.mode = 'play';
  } else if (name === 'street') {
    p.x = 830; p.y = 302;
    state.mission.index = 0;
    state.objective = 'M1 PAKET UNTUK MARA: Ambil paket di Pelabuhan';
    state.marker = { x: SEA_X - 140, y: 210 };
    state.timeOfDay = 17.4;
    state.mode = 'play';
  } else if (name === 'night') {
    p.x = 16 * TILE + 17;
    p.y = 22 * TILE + 17;
    state.timeOfDay = 21.4;
    state.rain = true;
    const cop = makeCar(p.x - 95, p.y + 34, 0, '#e8e8e8', { police: true, hp: 130 });
    state.cars.push(cop);
    state.heli = { x: p.x - 100, y: p.y - 118 };
    setWanted(state, 300);
    state.mission.index = 7;
    state.mission.step = 1;
    state.objective = 'M8 MALAM DI BUKIT HIJAU: Kabur ke Pantai Karang!';
    state.marker = { x: 31 * TILE, y: 24 * TILE };
    state.mode = 'play';
  } else if (name === 'title') {
    state.mode = 'title';
    state.cameraOverride = { x: WORLD.width - 1280, y: 150 };
    state.timeOfDay = 15.5;
    state.objective = '';
    state.marker = null;
  }
  skipDialog(state);
  state.dialog = null;
  state.dialogQueue = [];
}
