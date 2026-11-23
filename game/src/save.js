// One-slot localStorage save for Karang Bay.
const KEY = 'karangbay-save-v1';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      x: p.x, y: p.y, hp: p.hp, money: p.money,
      hasPistol: p.hasPistol, ammo: p.ammo, mag: p.mag,
      heat: state.wanted.heat,
      missionIndex: state.mission.index,
      timeOfDay: state.timeOfDay,
      seed: state.seed,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadSaveData() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function hasSave() { return !!loadSaveData(); }

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function applySave(state, data) {
  if (!data) return false;
  const p = state.player;
  if (Number.isFinite(data.x)) p.x = data.x;
  if (Number.isFinite(data.y)) p.y = data.y;
  if (Number.isFinite(data.hp)) p.hp = data.hp;
  if (Number.isFinite(data.money)) p.money = data.money;
  p.hasPistol = !!data.hasPistol;
  p.ammo = data.ammo ?? 0;
  p.mag = data.mag ?? 0;
  state.wanted.heat = data.heat ?? 0;
  state.wanted.bust = 0;
  state.mission.index = data.missionIndex ?? 0;
  state.mission.step = 0;
  state.mission.data = {};
  if (Number.isFinite(data.timeOfDay)) state.timeOfDay = data.timeOfDay;
  return true;
}
