// save.js — one localStorage slot for Karang Bay.
const KEY = 'karangbay-save-v1';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      x: Math.round(p.x), y: Math.round(p.y),
      hp: Math.round(p.hp), money: p.money,
      hasGun: !!p.hasGun, ammo: p.ammo,
      heat: Math.round(state.wanted ? state.wanted.heat : 0),
      missionIndex: state.missionIndex || 0,
      dayTime: state.dayTime, seed: state.seed,
      carColor: p.vehicle ? p.vehicle.color : null,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSaveData() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() { return !!loadSaveData(); }

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}

export function applySave(state, data) {
  if (!data) return false;
  const p = state.player;
  if (p.vehicle) { p.vehicle.driver = null; p.vehicle = null; }
  p.x = data.x; p.y = data.y; p.vx = 0; p.vy = 0;
  p.hp = Math.min(p.maxHp, data.hp || 100);
  p.money = data.money || 0;
  p.hasGun = !!data.hasGun;
  p.ammo = data.ammo || 0;
  p.mag = 12; p.reloading = 0; p.dead = false;
  if (state.wanted) {
    state.wanted.heat = data.heat || 0;
    state.wanted.level = 0;
    state.wanted.contact = false;
  }
  state.dayTime = typeof data.dayTime === 'number' ? data.dayTime : 10;
  return true;
}
