// shots.js — deterministic screenshot staging via ?shot=<name>&seed=1.
// Dialog panels are always skipped here so they never cover the frame.
import { setMissionIndex, skipTalkSteps } from './missions.js';

export function getShotName() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('shot');
  } catch (e) { return null; }
}

function makeCar(state, x, y, angle, color, police) {
  const car = {
    x, y, angle, w: 34, h: 19, color, police: !!police,
    kind: police ? 'patrol' : 'car', speed: 0, vx: 0, vy: 0,
    hp: 170, driver: null, wrecked: false,
  };
  state.vehicles.push(car);
  return car;
}

export function applyShot(state, name) {
  const p = state.player;
  if (state.notices) state.notices.length = 0; // drop boot notices; staging adds its own
  if (name === 'chase') {
    state.dayTime = 11;
    setMissionIndex(state, 5); // M6 — Minimarket
    skipTalkSteps(state);
    const y = 601; // eastbound lane of the 12T boulevard
    const car = makeCar(state, 820, y, 0, '#e5ad55', false);
    car.speed = 165; car.vx = 160; car.driver = 'player';
    p.vehicle = car; p.x = car.x; p.y = car.y; p.face = 0;
    const cop1 = makeCar(state, 756, y, 0, '#e8e8e8', true);
    cop1.speed = 162; cop1.driver = 'officer';
    const cop2 = makeCar(state, 692, y + 3, 0, '#dfe5ea', true);
    cop2.speed = 158; cop2.driver = 'officer';
    state.wanted.heat = 215;
    state.wanted.level = 3;
    state.wanted.contact = true;
    state.heli = { x: car.x - 44, y: car.y - 108 };
    state.mode = 'play';
  } else if (name === 'street') {
    state.dayTime = 17.32; // 17:19, late afternoon
    setMissionIndex(state, 0); // M1 — Paket untuk Mara
    skipTalkSteps(state);
    p.x = 850; p.y = 322; p.face = -1.1;
    state.mode = 'play';
  } else if (name === 'night') {
    setMissionIndex(state, 7); // M8 — Malam di Bukit Hijau (forces night)
    skipTalkSteps(state);
    state.dayTime = 21.4; // 21:24
    state.rain = true;
    p.x = 816; p.y = 1008; p.face = -0.8;
    state.wanted.heat = 215;
    state.wanted.level = 3;
    state.wanted.contact = true;
    const cop = makeCar(state, 902, 1012, -0.5, '#e8e8e8', true);
    cop.driver = 'officer';
    state.heli = { x: p.x - 44, y: p.y - 108 };
    state.mode = 'play';
  } else if (name === 'title') {
    state.dayTime = 10.5;
    state.mode = 'title';
    // Coast + port: containers, cranes and both ships in one frame.
    state.cameraOverride = { x: 832, y: 96 };
  }
  state.dialog = null;
}
