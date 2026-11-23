// missions.js — Mara's eight jobs: the story spine of Karang Bay.
// A mission is a list of steps the interpreter below walks through:
//   talk  { who, text }            dialog panel; E or a few seconds pass
//   goto  { x, y, label, r? }      reach the marker
//   timed { x, y, seconds, label } reach it before the clock runs out
//   race  { points, label }        hit every checkpoint in order
//   rob   { x, y, label }          reach it and the heat jumps to 3 stars
//   escape{ label }                done when the wanted level hits 0
//   escort{ x, y, label }          Dodi follows; arrive together
// Completing a mission pays cash, autosaves, and moves the story on.
// The HUD reads state.objective / state.marker / state.missionTimer,
// all maintained here every frame.
import { TILE } from './config.js';
import { pushNotice } from './player.js';
import { saveGame } from './save.js';

const T = TILE;
const MARA_SPOT = { x: 20 * T, y: 10 * T };       // Mara's corner, Pasar Lama
const BARA_TURF = { x: 19 * T, y: 8 * T };        // Bara's crew hangs here
const MINIMARKET = { x: 28 * T, y: 6 * T };       // Kota Tua minimarket
const DOCK_A = { x: 1580, y: 196 };               // port, north dock
const DOCK_B = { x: 1568, y: 528 };               // port, south dock
const CRATES = { x: 1508, y: 330 };               // container rows
const BUKIT_POINT = { x: 20 * T, y: 22 * T };     // Bukit Hijau lookout
const PANTAI_POINT = { x: 30 * T, y: 24 * T };    // Pantai Karang finish

function store(state, type) {
  return state.world.stores.find((s) => s.type === type);
}

export const MISSIONS = [
  {
    title: 'M1 — Paket untuk Mara',
    reward: 150,
    steps: [
      { type: 'talk', who: 'Mara', text: 'Raka. Sepupuku meninggalkan paket di sudut Pasar Lama. Ambil, antar ke safehouse, jangan dibuka.' },
      { type: 'goto', x: MARA_SPOT.x, y: MARA_SPOT.y, label: 'Ambil paket di Pasar Lama' },
      { type: 'talk', who: 'Raka', text: 'Paketnya berat untuk sekadar "dokumen". Sudahlah — dibayar, bukan ditanya.' },
      { type: 'goto', x: 1440, y: 432, label: 'Antar paket ke safehouse' },
      { type: 'talk', who: 'Mara', text: 'Bersih. Begini caranya bertahan di Karang Bay — kerja dulu, tanya belakangan.' },
    ],
  },
  {
    title: 'M2 — Tagihan Pasar Lama',
    reward: 200,
    steps: [
      { type: 'talk', who: 'Mara', text: 'Bara menunggak tiga bulan "uang keamanan" — yang sebenarnya utang padaku. Tagih dia. Sopan dulu.' },
      { type: 'goto', x: BARA_TURF.x, y: BARA_TURF.y, label: 'Temui Bara di Pasar Lama' },
      { type: 'talk', who: 'Bara', text: 'Bilang ke Mara: pasar ini punya aturan baru sekarang. Aturanku.' },
      { type: 'talk', who: 'Raka', text: 'Dia tidak akan suka jawaban itu. Tapi pesan tetap pesan.' },
      { type: 'goto', x: MARA_SPOT.x, y: MARA_SPOT.y, label: 'Lapor kembali ke Mara' },
      { type: 'talk', who: 'Mara', text: 'Berani juga dia. Baik — mulai sekarang kita berhenti bersikap sopan.' },
    ],
  },
  {
    title: 'M3 — Taksi Gelap',
    reward: 260,
    steps: [
      { type: 'talk', who: 'Mara', text: 'Penumpang di depan Klinik, bayar tunai, tidak tahan macet. Jemput dia — dan cari mobil, jalan kaki tidak dihitung.' },
      { type: 'goto', x: 1056, y: 864, label: 'Jemput penumpang di Klinik' },
      { type: 'talk', who: 'Penumpang', text: 'Pelabuhan. Kapal saya berangkat sebentar lagi — gas, saya bayar lebih kalau cepat!' },
      { type: 'timed', x: DOCK_B.x, y: DOCK_B.y, seconds: 75, label: 'Antar ke dermaga selatan sebelum kapalnya pergi' },
      { type: 'talk', who: 'Penumpang', text: 'Pas! Ini ongkosnya — plus tip untuk rem yang hampir jebol itu.' },
    ],
  },
  {
    title: 'M4 — Suara di Pelabuhan',
    reward: 220,
    steps: [
      { type: 'talk', who: 'Dodi', text: 'Raka, penjaga malam dengar suara mesin dari kontainer yang harusnya kosong. Cek dermaga utara, ya?' },
      { type: 'goto', x: DOCK_A.x, y: DOCK_A.y, label: 'Periksa dermaga utara' },
      { type: 'talk', who: 'Raka', text: 'Bekas oli baru dan kabel jumper. Ada yang memanaskan mesin di sini semalam.' },
      { type: 'goto', x: CRATES.x, y: CRATES.y, label: 'Periksa barisan kontainer' },
      { type: 'talk', who: 'Raka', text: 'Satu kontainer tidak terkunci — isinya suku cadang kapal curian. Ini pasti ulah orang Bara.' },
      { type: 'goto', x: DOCK_B.x, y: DOCK_B.y, label: 'Periksa dermaga selatan' },
      { type: 'talk', who: 'Dodi', text: 'Sudah kuduga. Foto-fotonya cukup — sisanya biar saya yang urus ke orang pelabuhan.' },
    ],
  },
  {
    title: 'M5 — Balapan Karang',
    reward: 300,
    steps: [
      { type: 'talk', who: 'Dodi', text: 'Anak-anak pantai taruhan soal siapa paling cepat keliling teluk. Saya pasang uang ke kamu. Checkpoint menyala — ikuti saja.' },
      {
        type: 'race', label: 'Balapan Karang — lewati semua checkpoint',
        points: [
          { x: 26 * T, y: 17 * T }, { x: 31 * T, y: 22 * T }, { x: 31 * T, y: 12 * T },
          { x: 21 * T, y: 17 * T }, { x: 1440, y: 432 },
        ],
      },
      { type: 'talk', who: 'Dodi', text: 'Hah! Wajah mereka waktu kamu masuk tikungan terakhir — tak ternilai. Ini bagianmu.' },
    ],
  },
  {
    title: 'M6 — Minimarket',
    reward: 350,
    steps: [
      { type: 'talk', who: 'Mara', text: 'Minimarket di Kota Tua itu kedok pencucian uang Bara. Kosongkan laci kasirnya. Kamu akan dikejar — jangan pulang sebelum bintangmu padam.' },
      { type: 'rob', x: MINIMARKET.x, y: MINIMARKET.y, label: 'Rampok minimarket di Kota Tua' },
      { type: 'talk', who: 'Raka', text: 'Alarmnya bunyi. Sekarang bagian sulitnya: hilang dari peta.' },
      { type: 'escape', label: 'Kabur sampai bintang wanted padam (Pay-n-Spray / safehouse membantu)' },
      { type: 'talk', who: 'Mara', text: 'Uang kotor untuk orang kotor. Kerja bagus, Raka.' },
    ],
  },
  {
    title: 'M7 — Teman Lama',
    reward: 320,
    steps: [
      { type: 'talk', who: 'Dodi', text: 'Saya habis debat panas soal "suku cadang" itu dan tidak enak badan. Jemput saya di Pay-n-Spray, antar ke Klinik — pelan-pelan saja.' },
      { type: 'goto', x: 1392, y: 960, label: 'Jemput Dodi di Pay-n-Spray' },
      { type: 'talk', who: 'Dodi', text: 'Ayo jalan. Dan Raka… terima kasih. Tidak semua orang mau kembali menjemput.' },
      { type: 'escort', x: 1056, y: 864, label: 'Antar Dodi ke Klinik — jangan tinggalkan dia' },
      { type: 'talk', who: 'Dodi', text: 'Sampai. Utang budi ini saya catat. Sekarang istirahat — besok kita selesaikan urusan Bara.' },
    ],
  },
  {
    title: 'M8 — Malam di Bukit Hijau',
    reward: 500,
    steps: [
      { type: 'talk', who: 'Mara', text: 'Bara jual pelabuhan ini ke orang luar malam ini, di Bukit Hijau. Gagalkan. Inspektur Sinta pasti datang — dia selalu datang.' },
      { type: 'goto', x: BUKIT_POINT.x, y: BUKIT_POINT.y, label: 'Ke titik temu di Bukit Hijau' },
      { type: 'talk', who: 'Bara', text: 'Raka! Kamu merusak segalanya — anak buahku, uangku, pasaranku!' },
      { type: 'talk', who: 'Inspektur Sinta', text: 'GARUDA-1 di udara. Semua unit — kejar mobil itu, hidup atau mati jangan sampai lolos ke pantai.' },
      { type: 'rob', heatAt: 'start', x: PANTAI_POINT.x, y: PANTAI_POINT.y, label: 'Kabur ke Pantai Karang — Sinta dan GARUDA-1 mengejarmu' },
      { type: 'talk', who: 'Mara', text: 'Transaksinya batal, Bara ditahan Sinta, dan kamu masih bernapas. Karang Bay kembali jadi milik kita, Raka.' },
    ],
  },
];

// ---- interpreter ----------------------------------------------------

export function createMissions(state) {
  state.mission = {
    index: 0, step: 0, point: 0, timer: 0, talkT: 0,
    done: false, heatRaised: false,
  };
  state.objective = '';
  state.marker = null;
  state.missionTimer = null;
  state.dialog = null;
  state.escort = null;
  return state.mission;
}

export function setMissionIndex(state, index) {
  if (!state.mission) createMissions(state);
  const m = state.mission;
  m.index = Math.max(0, Math.min(MISSIONS.length, index));
  m.step = 0;
  m.point = 0;
  m.timer = 0;
  m.talkT = 0;
  m.heatRaised = false;
  m.done = m.index >= MISSIONS.length;
  state.dialog = null;
  state.escort = null;
  return m;
}

function currentStep(state) {
  const m = state.mission;
  if (!m || m.done) return null;
  const mission = MISSIONS[m.index];
  return mission ? mission.steps[m.step] || null : null;
}

function raiseHeat(state) {
  if (!state.wanted) return;
  state.wanted.heat = Math.max(state.wanted.heat, 215); // solid 3 stars
  state.wanted.lastCrimeAt = state.time || 0;
  state.alerts.push({ x: state.player.x, y: state.player.y, t: state.time || 0, kind: 'explosion' });
}

function advanceStep(state) {
  const m = state.mission;
  const mission = MISSIONS[m.index];
  m.step += 1;
  m.point = 0;
  m.timer = 0;
  m.talkT = 0;
  m.heatRaised = false;
  state.dialog = null;
  if (m.step >= mission.steps.length) completeMission(state);
}

// Screenshot staging helper: fast-forward past any run of talk steps
// at the current position so the scene opens on live action (an
// objective and a marker) instead of a dialog panel. Only talk steps
// are skipped; the step landed on keeps its normal behaviour.
export function skipTalkSteps(state) {
  if (!state.mission) createMissions(state);
  let guard = 0;
  let step = currentStep(state);
  while (step && step.type === 'talk' && guard < 8) {
    advanceStep(state);
    guard += 1;
    step = currentStep(state);
  }
  state.dialog = null;
}

function completeMission(state) {
  const m = state.mission;
  const mission = MISSIONS[m.index];
  state.player.money += mission.reward;
  pushNotice(state, `${mission.title} selesai — +$${mission.reward}`, 5);
  m.index += 1;
  m.step = 0;
  m.point = 0;
  m.timer = 0;
  m.talkT = 0;
  m.heatRaised = false;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    pushNotice(state, 'Semua misi selesai — Karang Bay milikmu, Raka', 6);
  }
  saveGame(state);
}

function startEscort(state) {
  const spray = store(state, 'spray');
  state.escort = {
    x: spray.x + 26, y: spray.y + 18, r: 7, color: '#f2c56b',
    name: 'Dodi', angle: 0, speed: 148,
  };
}

function updateEscort(state, dt) {
  const e = state.escort;
  if (!e) return;
  const p = state.player;
  const target = p.vehicle || p;
  const dx = target.x - e.x, dy = target.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d > 34) {
    const sp = d > 420 ? 330 : e.speed + Math.min(90, (d - 60) * 0.35);
    e.angle = Math.atan2(dy, dx);
    e.x += (dx / d) * sp * dt;
    e.y += (dy / d) * sp * dt;
  }
}

export function updateMissions(state, dt) {
  if (!state.mission) createMissions(state);
  const m = state.mission;
  const p = state.player;
  state.missionTimer = null;
  if (m.done || !p || p.dead) {
    if (m.done) {
      state.objective = 'Free roam — Karang Bay is yours';
      state.marker = null;
    }
    return;
  }
  const mission = MISSIONS[m.index];
  const step = currentStep(state);
  if (!step) return;
  if (m.index === 7 && m.step === 0 && state.dayTime < 19.5) state.dayTime = 20.4; // M8 falls at night
  const distTo = (x, y) => Math.hypot(p.x - x, p.y - y);

  if (step.type === 'talk') {
    state.objective = mission.title;
    state.marker = null;
    if (!state.dialog || state.dialog.text !== step.text) {
      state.dialog = { who: step.who, text: step.text };
      m.talkT = 0;
    }
    m.talkT += dt;
    if ((state.input && state.input.interactPressed && m.talkT > 0.4) || m.talkT > 6.5) {
      state.dialog = null;
      advanceStep(state);
    }
    return;
  }
  state.dialog = null;

  if (step.type === 'goto' || step.type === 'rob') {
    if (step.type === 'rob' && step.heatAt === 'start' && !m.heatRaised) {
      m.heatRaised = true;
      raiseHeat(state);
    }
    state.objective = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (distTo(step.x, step.y) < (step.r || 62)) {
      if (step.type === 'rob' && step.heatAt !== 'start' && !m.heatRaised) {
        m.heatRaised = true;
        raiseHeat(state);
        pushNotice(state, 'Alarm berbunyi — polisi bergerak!', 4);
      }
      advanceStep(state);
    }
    return;
  }

  if (step.type === 'timed') {
    if (m.timer === 0) m.timer = step.seconds;
    m.timer -= dt;
    state.missionTimer = Math.max(0, m.timer);
    state.objective = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    if (distTo(step.x, step.y) < 66) { advanceStep(state); return; }
    if (m.timer <= 0) {
      m.timer = step.seconds;
      pushNotice(state, 'Terlambat — penumpangnya pergi. Coba lagi.', 4);
    }
    return;
  }

  if (step.type === 'race') {
    const pt = step.points[m.point];
    state.objective = `${mission.title}: ${step.label} (${m.point + 1}/${step.points.length})`;
    state.marker = { x: pt.x, y: pt.y };
    if (distTo(pt.x, pt.y) < 92) {
      m.point += 1;
      if (m.point >= step.points.length) advanceStep(state);
      else pushNotice(state, `Checkpoint ${m.point}/${step.points.length}`, 2);
    }
    return;
  }

  if (step.type === 'escape') {
    state.objective = `${mission.title}: ${step.label}`;
    state.marker = null;
    if (state.wanted && state.wanted.level === 0 && state.wanted.heat <= 0) advanceStep(state);
    return;
  }

  if (step.type === 'escort') {
    if (!state.escort) startEscort(state);
    updateEscort(state, dt);
    state.objective = `${mission.title}: ${step.label}`;
    state.marker = { x: step.x, y: step.y };
    const dodiNear = state.escort && Math.hypot(state.escort.x - p.x, state.escort.y - p.y) < 170;
    if (distTo(step.x, step.y) < 64 && dodiNear) {
      state.escort = null;
      advanceStep(state);
    }
    return;
  }
}
