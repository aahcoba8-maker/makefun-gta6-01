// save.js — Karang Bay persistence on localStorage. One save slot:
// Raka's vitals and wallet, the wanted heat, the mission index, the
// clock and the world seed. Saving happens at the safehouse (main.js
// watches for the interact press there) and automatically after every
// completed mission (missions.js calls saveGame).
const KEY = 'karangbay-save-v1';

export function hasSave() {
  try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}

export function saveGame(state) {
  if (!state || !state.player) return false;
  const p = state.player;
  const data = {
    v: 1,
    seed: state.world ? state.world.seed : 1,
    player: {
      x: Math.round(p.x), y: Math.round(p.y),
      health: p.health, money: p.money,
      hasPistol: !!p.hasPistol, ammoInMag: p.ammoInMag, reserveAmmo: p.reserveAmmo,
    },
    wantedHeat: state.wanted ? state.wanted.heat : 0,
    missionIndex: state.mission ? state.mission.index : 0,
    dayTime: state.dayTime ?? 9.5,
    time: Math.round(state.time || 0),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSaveData() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !data.player) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Applies a loaded save onto a freshly built state. Returns the saved
// mission index so main.js can hand it to missions.setMissionIndex.
export function applySave(state, data) {
  if (!data) return 0;
  const p = state.player;
  const sp = data.player;
  p.x = sp.x; p.y = sp.y;
  p.vx = 0; p.vy = 0;
  p.vehicle = null;
  p.dead = false;
  p.health = Math.min(p.maxHealth, Math.max(10, sp.health || 100));
  p.money = sp.money || 0;
  p.hasPistol = !!sp.hasPistol;
  p.ammoInMag = sp.ammoInMag || 0;
  p.reserveAmmo = sp.reserveAmmo || 0;
  if (state.wanted) {
    state.wanted.heat = data.wantedHeat || 0;
    state.wanted.lastCrimeAt = -99;
    state.wanted.bust = 0;
  }
  state.dayTime = data.dayTime ?? state.dayTime;
  state.time = data.time || 0;
  return data.missionIndex || 0;
}
