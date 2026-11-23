// missions.js — 8 sequential missions for Karang Bay: dialog panels,
// objective text + world marker, timers, escort, robbery and the finale.
import { TILE } from './config.js';
import { levelForHeat } from './police.js';
import { pushNotice, resolveMove } from './player.js';
import { saveGame } from './save.js';
import { sfx } from './audio.js';

const T = (v) => v * TILE;
export const MISSIONS = [
  { title: 'M1 — Paket untuk Mara', reward: 150, steps: [
    { t: 'talk', name: 'Mara', text: 'Raka, akhirnya sampai juga. Ambil paketku di Pasar Lama — jangan dibuka, jangan tanya.' },
    { t: 'goto', x: T(17.5), y: T(8), label: 'Ambil paket di Pasar Lama' },
    { t: 'talk', name: 'Mara', text: 'Bagus. Cepat, bersih, tidak banyak tanya. Karang Bay butuh orang seperti kamu. $150 untukmu.' },
  ] },
  { title: 'M2 — Tagihan Pasar Lama', reward: 200, steps: [
    { t: 'talk', name: 'Dodi', text: 'Bro, Juragan Kopi utang tiga bulan. Tagih yang sopan ya… tapi jangan pulang tangan kosong.' },
    { t: 'goto', x: T(20), y: T(11), label: 'Temui Juragan Kopi di Pasar Lama' },
    { t: 'talk', name: 'Juragan Kopi', text: 'Iya iya, ini uangnya! Bilang ke Dodi jangan kirim orang sangar lagi…' },
    { t: 'goto', x: T(15.5), y: T(12.5), label: 'Antar uang tagihan ke Dodi' },
  ] },
  { title: 'M3 — Taksi Gelap', reward: 260, steps: [
    { t: 'talk', name: 'Mara', text: 'Ada penumpang di dermaga selatan, buru-buru kabur dari kota. 75 detik, Raka. Jangan sampai telat.' },
    { t: 'timed', x: 1650, y: 531, seconds: 75, label: 'Jemput penumpang di dermaga selatan' },
    { t: 'talk', name: 'Penumpang', text: 'Tepat waktu! Kalau bukan kamu, saya sudah tidur sama ikan. Ini ongkosnya, lebih.' },
  ] },
  { title: 'M4 — Suara di Pelabuhan', reward: 220, steps: [
    { t: 'talk', name: 'Mara', text: 'Semalam ada suara kontainer dibuka paksa. Cek tiga titik di pelabuhan, foto dengan matamu saja.' },
    { t: 'goto', x: 1530, y: 150, label: 'Periksa kontainer utara' },
    { t: 'goto', x: 1560, y: 470, label: 'Periksa dermaga tengah' },
    { t: 'goto', x: 1620, y: 300, label: 'Periksa gudang timur' },
    { t: 'talk', name: 'Mara', text: 'Segel dirusak semua… Ini kerjaan orang dalam. Terima kasih, Raka.' },
  ] },
  { title: 'M5 — Balapan Karang', reward: 300, steps: [
    { t: 'talk', name: 'Dodi', text: 'Balapan keliling kota, lima titik, siapa cepat dia dapat. Kalah jangan nangis ya, Bro.' },
    { t: 'race', pts: [[353, 353], [785, 353], [1265, 593], [1025, 1073], [593, 833]], label: 'Balapan Karang — kejar titik berikutnya' },
    { t: 'talk', name: 'Dodi', text: 'Gila, kamu ngebut kayak dikejar setan. Hadiahnya sah jadi milikmu.' },
  ] },
  { title: 'M6 — Minimarket', reward: 350, steps: [
    { t: 'talk', name: 'Mara', text: 'Minimarket di Kota Tua menyimpan brankas Bara. Ambil isinya — lalu hilang sampai polisi lelah.' },
    { t: 'rob', x: T(25), y: T(6), label: 'Rampok minimarket di Kota Tua' },
    { t: 'escape', label: 'Kabur — hilangkan semua bintang!' },
    { t: 'talk', name: 'Mara', text: 'Bersih. Bara pasti lagi ngamuk sekarang. Ini bagianmu.' },
  ] },
  { title: 'M7 — Teman Lama', reward: 320, steps: [
    { t: 'talk', name: 'Dodi', text: 'Bro, kakiku keseleo di Pay-n-Spray. Jemput aku, antar ke Klinik. Jangan ditinggal ya.' },
    { t: 'escortStart' },
    { t: 'escort', x: T(22), y: T(18), label: 'Antar Dodi ke Klinik' },
    { t: 'talk', name: 'Dodi', text: 'Makasih, Bro. Teman lama memang nggak ada duanya.' },
  ] },
  { title: 'M8 — Malam di Bukit Hijau', reward: 500, steps: [
    { t: 'night' },
    { t: 'talk', name: 'Mara', text: 'Malam ini penentuan. Temui orangku di Bukit Hijau — apapun yang terjadi, akhiri di Pantai Karang.' },
    { t: 'goto', x: T(18), y: T(20), label: 'Ke titik temu di Bukit Hijau' },
    { t: 'heat', amount: 320 },
    { t: 'talk', name: 'Inspektur Sinta', text: 'Di sini GARUDA-1. Raka, berhenti! Karang Bay tidak cukup besar untuk kita berdua!' },
    { t: 'goto', x: 1610, y: T(24), label: 'Kabur ke Pantai Karang!' },
    { t: 'talk', name: 'Mara', text: 'Kamu berhasil. Mulai malam ini, Karang Bay punya nama baru: namamu, Raka.' },
  ] },
];

export function createMissions(state) {
  state.missionIndex = state.missionIndex || 0;
  state.mission = null;
  state.dialog = null;
  startMission(state, state.missionIndex);
  return state;
}

export function setMissionIndex(state, i) {
  state.missionIndex = Math.max(0, Math.min(MISSIONS.length, i));
  state.dialog = null;
  startMission(state, state.missionIndex);
}

function startMission(state, idx) {
  if (idx >= MISSIONS.length) {
    state.mission = null;
    state.objective = 'Karang Bay milikmu — jelajahi kota';
    state.marker = null;
    return;
  }
  const def = MISSIONS[idx];
  state.mission = { def, step: 0, raceIdx: 0, active: true };
  state.objective = def.title;
  state.marker = null;
  pushNotice(state, def.title);
  settleInstant(state);
}

function settleInstant(state) {
  const m = state.mission;
  if (!m) return;
  let guard = 0;
  while (m.step < m.def.steps.length && guard++ < 8) {
    const s = m.def.steps[m.step];
    if (s.t === 'night') { state.dayTime = 20.4; m.step += 1; continue; }
    if (s.t === 'heat') {
      state.wanted.heat = Math.max(state.wanted.heat, s.amount);
      state.wanted.level = levelForHeat(state.wanted.heat);
      state.wanted.lastCrimeAt = state.time;
      pushNotice(state, 'GARUDA-1 mengunci posisimu!');
      m.step += 1; continue;
    }
    if (s.t === 'escortStart') {
      const spray = state.world.stores.find(v => v.type === 'spray');
      state.escort = { x: spray.x + 14, y: spray.y + 16, r: 6, color: '#e8c39a', kind: 'dodi', name: 'Dodi', hp: 999, dead: false };
      m.step += 1; continue;
    }
    break;
  }
  const s = m.def.steps[m.step];
  if (s && s.t === 'timed') state.missionTimer = s.seconds;
  if (s && s.t === 'race') { state.missionTimer = 150; m.raceIdx = 0; }
}

function advance(state) {
  const m = state.mission;
  if (!m) return;
  state.dialog = null;
  m.step += 1;
  if (m.step >= m.def.steps.length) { completeMission(state); return; }
  settleInstant(state);
}

function completeMission(state) {
  const m = state.mission;
  const reward = m.def.reward;
  state.player.money += reward;
  pushNotice(state, `${m.def.title} selesai — +$${reward}`);
  sfx(state, 'cash');
  state.mission = null;
  state.marker = null;
  state.escort = null;
  state.missionIndex += 1;
  saveGame(state);
  startMission(state, state.missionIndex);
}

export function skipTalkSteps(state) {
  const m = state.mission;
  if (!m) { state.dialog = null; return; }
  let guard = 0;
  while (m.step < m.def.steps.length && m.def.steps[m.step].t === 'talk' && guard++ < 10) {
    m.step += 1;
  }
  state.dialog = null;
  if (m.step >= m.def.steps.length) { completeMission(state); return; }
  settleInstant(state);
}

function playerRef(state) { return state.player.vehicle || state.player; }

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m || state.mode !== 'play') { if (!m) state.dialog = null; return; }
  const s = m.def.steps[m.step];
  if (!s) { completeMission(state); return; }
  const ref = playerRef(state);
  if (s.t === 'talk') {
    state.dialog = { name: s.name, text: s.text };
    state.objective = m.def.title;
    state.marker = null;
    if (state.input.interactPressed || state.input.attackPressed) advance(state);
    return;
  }
  state.dialog = null;
  if (s.t === 'goto' || s.t === 'rob') {
    state.objective = `${m.def.title}: ${s.label}`;
    state.marker = { x: s.x, y: s.y };
    if (Math.hypot(ref.x - s.x, ref.y - s.y) < 32) {
      if (s.t === 'rob') {
        state.wanted.heat = Math.max(state.wanted.heat, 215);
        state.wanted.level = levelForHeat(state.wanted.heat);
        state.wanted.lastCrimeAt = state.time;
        pushNotice(state, 'MINIMARKET DIRAMPOK — kabur dan hilangkan jejak!');
        sfx(state, 'boom');
      }
      advance(state);
    }
    return;
  }
  if (s.t === 'timed') {
    state.missionTimer -= dt;
    state.objective = `${m.def.title}: ${s.label} — ${Math.max(0, Math.ceil(state.missionTimer))} dtk`;
    state.marker = { x: s.x, y: s.y };
    if (Math.hypot(ref.x - s.x, ref.y - s.y) < 34) { advance(state); return; }
    if (state.missionTimer <= 0) {
      state.missionTimer = s.seconds;
      pushNotice(state, 'Waktu habis — coba lagi!');
    }
    return;
  }
  if (s.t === 'race') {
    state.missionTimer -= dt;
    const pt = s.pts[m.raceIdx];
    state.objective = `${m.def.title}: ${s.label} (${m.raceIdx + 1}/${s.pts.length})`;
    state.marker = { x: pt[0], y: pt[1] };
    if (Math.hypot(ref.x - pt[0], ref.y - pt[1]) < 40) {
      m.raceIdx += 1;
      sfx(state, 'pickup');
      if (m.raceIdx >= s.pts.length) advance(state);
    } else if (state.missionTimer <= 0) {
      state.missionTimer = 150; m.raceIdx = 0;
      pushNotice(state, 'Balapan diulang — gas lagi!');
    }
    return;
  }
  if (s.t === 'escape') {
    state.objective = `${m.def.title}: ${s.label}`;
    state.marker = null;
    if (state.wanted.level === 0 && state.wanted.heat < 40) advance(state);
    return;
  }
  if (s.t === 'escort') {
    const dodi = state.escort;
    state.objective = `${m.def.title}: ${s.label}`;
    state.marker = { x: s.x, y: s.y };
    if (dodi) {
      const p = state.player;
      const d = Math.hypot(p.x - dodi.x, p.y - dodi.y);
      if (d > 34) {
        resolveMove(state, dodi, ((p.x - dodi.x) / (d || 1)) * 152 * dt, ((p.y - dodi.y) / (d || 1)) * 152 * dt, dodi.r);
      }
      if (Math.hypot(ref.x - s.x, ref.y - s.y) < 32) {
        if (Math.hypot(dodi.x - s.x, dodi.y - s.y) < 170) advance(state);
        else state.objective = `${m.def.title}: Tunggu Dodi mendekat!`;
      }
    } else advance(state);
    return;
  }
  advance(state);
}
