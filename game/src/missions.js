// The eight Karang Bay story missions. Sequential, with named dialog,
// objective text, a world marker for the HUD, and an autosave after each
// completion. Dialog is skipped entirely while a screenshot is staged.
import { SEA_X, TILE } from './config.js';
import { pushNotice } from './player.js';
import { saveGame } from './save.js';

export function say(state, who, text) {
  if (state.shotMode) return;
  state.dialogQueue.push({ who, text });
  if (!state.dialog) state.dialog = state.dialogQueue.shift();
}

export function skipDialog(state) {
  state.dialog = state.dialogQueue.shift() || null;
}

function playerPos(state) {
  return state.player.vehicle || state.player;
}

function arrive(state, x, y, r) {
  const p = playerPos(state);
  return Math.hypot(p.x - x, p.y - y) < r;
}

function setTarget(state, text, x, y) {
  state.objective = text;
  state.marker = x === null ? null : { x, y };
}

function completeMission(state, reward) {
  const p = state.player;
  p.money += reward;
  pushNotice(state, `Misi selesai! +$${reward}`);
  state.mission.index += 1;
  state.mission.step = 0;
  state.mission.data = {};
  state.missionTimer = null;
  saveGame(state);
  enterMission(state);
}

export function enterMission(state) {
  const m = state.mission;
  m.step = 0;
  m.data = {};
  state.missionTimer = null;
  const i = m.index;
  if (i === 0) {
    setTarget(state, 'M1 PAKET UNTUK MARA: Ambil paket di Pelabuhan', SEA_X - 140, 210);
    say(state, 'Mara', 'Raka, ada paket menunggumu di Pelabuhan. Ambil, lalu antar ke aku di Pasar Lama.');
  } else if (i === 1) {
    setTarget(state, 'M2 TAGIHAN PASAR LAMA: Tagih utang pertama', 744, 192);
    say(state, 'Mara', 'Tiga orang berutang ke pasar. Tagih mereka satu per satu, jangan kasar kalau tidak perlu.');
  } else if (i === 2) {
    state.missionTimer = 75;
    setTarget(state, 'M3 TAKSI GELAP: Antar penumpang ke dermaga selatan', SEA_X + 40, 530);
    say(state, 'Dodi', 'Penumpang ini bayar mahal asal sampai dermaga selatan dalam 75 detik. Gas!');
  } else if (i === 3) {
    setTarget(state, 'M4 SUARA DI PELABUHAN: Periksa derek pertama', SEA_X - 35, 120);
    say(state, 'Mara', 'Ada suara aneh di pelabuhan semalam. Periksa kedua derek dan tumpukan kontainer.');
  } else if (i === 4) {
    setTarget(state, 'M5 BALAPAN KARANG: Ke titik pertama — wajib naik mobil', 12 * TILE + 17, 7 * TILE + 17);
    say(state, 'Dodi', 'Balapan keliling kota, lima titik. Yang tercepat pulang dengan $300.');
  } else if (i === 5) {
    setTarget(state, 'M6 MINIMARKET: Datangi minimarket di Kota Tua', 27 * TILE, 6 * TILE);
    say(state, 'Raka', 'Satu pekerjaan terakhir dari orang pasar. Masuk, ambil, hilang.');
  } else if (i === 6) {
    setTarget(state, 'M7 TEMAN LAMA: Jemput Dodi di Pay-n-Spray', 29 * TILE, 20 * TILE + 22);
    say(state, 'Dodi', 'Raka, perutku kena lagi. Jemput aku di Pay-n-Spray, antar ke klinik ya.');
    const dodi = {
      x: 29 * TILE, y: 20 * TILE + 22, r: 6, color: '#4a7fb5',
      hp: 80, dead: false, deadT: 0, role: 'dodi', name: 'Dodi',
      axis: 'v', dir: 1, speed: 0, fleeT: 0, fleeX: 0, fleeY: 0,
    };
    state.peds.push(dodi);
    m.data.dodi = dodi;
  } else if (i === 7) {
    setTarget(state, 'M8 MALAM DI BUKIT HIJAU: Temui orangmu di Bukit Hijau', 18 * TILE, 22 * TILE);
    say(state, 'Mara', 'Malam ini semuanya selesai, Raka. Temui orangku di Bukit Hijau.');
  } else {
    setTarget(state, 'Semua misi selesai — Karang Bay milikmu. Jelajahi kotanya!', null, null);
  }
}

export function initMissions(state) {
  state.mission = { index: 0, step: 0, data: {} };
  enterMission(state);
}

const M2_POINTS = [[744, 192], [960, 528], [1104, 288]];
const M4_POINTS = [[SEA_X - 35, 120], [SEA_X - 100, 300], [SEA_X - 75, 480]];
const M5_POINTS = [
  [12 * TILE + 17, 7 * TILE + 17], [21 * TILE + 17, 7 * TILE + 17],
  [26 * TILE + 17, 12 * TILE + 17], [16 * TILE + 17, 17 * TILE + 17],
  [7 * TILE + 17, 12 * TILE + 17],
];

function updateMissionsInner(state, dt) {
  const m = state.mission;
  const i = m.index;
  if (i === 0) {
    if (m.step === 0 && arrive(state, SEA_X - 140, 210, 42)) {
      m.step = 1;
      setTarget(state, 'M1 PAKET UNTUK MARA: Antar paket ke Mara di Pasar Lama', 840, 480);
      say(state, 'Mara', 'Itu paketnya. Jangan dibuka, jangan lama-lama. Aku tunggu di Pasar Lama.');
    } else if (m.step === 1 && arrive(state, 840, 480, 40)) {
      say(state, 'Mara', 'Bagus, Raka. Kota ini masih butuh orang sepertimu.');
      completeMission(state, 150);
    }
  } else if (i === 1) {
    const idx = m.data.i || 0;
    const [x, y] = M2_POINTS[idx];
    if (arrive(state, x, y, 36)) {
      say(state, 'Raka', 'Utang ke pasar jatuh tempo hari ini. Mara mengirimku.');
      m.data.i = idx + 1;
      if (m.data.i >= M2_POINTS.length) completeMission(state, 200);
      else setTarget(state, `M2 TAGIHAN PASAR LAMA: Tagih utang ke-${m.data.i + 1}`, M2_POINTS[m.data.i][0], M2_POINTS[m.data.i][1]);
    }
  } else if (i === 2) {
    state.missionTimer -= dt;
    if (state.missionTimer <= 0) {
      state.missionTimer = 75;
      pushNotice(state, 'Terlambat! Penumpang menunggu lagi dari awal.');
    }
    if (arrive(state, SEA_X + 40, 530, 48)) {
      say(state, 'Dodi', 'Tepat waktu! Penumpang senang, dompetku juga.');
      completeMission(state, 260);
    }
  } else if (i === 3) {
    const idx = m.data.i || 0;
    const [x, y] = M4_POINTS[idx];
    if (arrive(state, x, y, 44)) {
      m.data.i = idx + 1;
      if (m.data.i >= M4_POINTS.length) {
        say(state, 'Raka', 'Hanya kontainer kosong dan gema. Pelabuhan aman malam ini.');
        completeMission(state, 220);
      } else {
        setTarget(state, `M4 SUARA DI PELABUHAN: Titik periksa ${m.data.i + 1} dari 3`, M4_POINTS[m.data.i][0], M4_POINTS[m.data.i][1]);
      }
    }
  }
}

function updateMissionsLate(state, dt) {
  const m = state.mission;
  const i = m.index;
  if (i === 4) {
    const idx = m.data.i || 0;
    const [x, y] = M5_POINTS[idx];
    if (Math.hypot(playerPos(state).x - x, playerPos(state).y - y) < 44) {
      if (!state.player.vehicle) {
        if ((m.data.warnT || 0) <= 0) {
          pushNotice(state, 'Balapan ini butuh mobil!');
          m.data.warnT = 3;
        }
      } else {
        m.data.i = idx + 1;
        if (m.data.i >= M5_POINTS.length) {
          say(state, 'Dodi', 'Gila, itu putaran tercepat bulan ini!');
          completeMission(state, 300);
        } else {
          setTarget(state, `M5 BALAPAN KARANG: Titik ${m.data.i + 1} dari 5`, M5_POINTS[m.data.i][0], M5_POINTS[m.data.i][1]);
        }
      }
    }
    m.data.warnT = Math.max(0, (m.data.warnT || 0) - dt);
  } else if (i === 5) {
    if (m.step === 0 && arrive(state, 27 * TILE, 6 * TILE, 40)) {
      m.step = 1;
      m.data.standT = 0;
      setTarget(state, 'M6 MINIMARKET: Ambil uang di dalam (tahan posisi)', 27 * TILE, 6 * TILE);
      say(state, 'Raka', 'Cepat, cepat… kasirnya gemetar, bagus.');
    } else if (m.step === 1) {
      if (arrive(state, 27 * TILE, 6 * TILE, 40)) {
        m.data.standT = (m.data.standT || 0) + dt;
        if (m.data.standT >= 2) {
          m.step = 2;
          state.wanted.heat = Math.max(state.wanted.heat, 215);
          state.wanted.lastCrimeAt = state.time;
          setTarget(state, 'M6 MINIMARKET: Kabur sampai bintang hilang!', null, null);
          say(state, 'Inspektur Sinta', 'Semua unit, perampokan minimarket di Kota Tua. Tangkap dia hidup-hidup!');
        }
      } else m.data.standT = 0;
    } else if (m.step === 2 && state.wanted.level === 0 && state.wanted.heat <= 0) {
      say(state, 'Raka', 'Bersih. Tidak ada yang melihat wajahku.');
      completeMission(state, 350);
    }
  } else if (i === 6) {
    const dodi = m.data.dodi;
    if (m.step === 0 && arrive(state, 29 * TILE, 20 * TILE + 22, 50)) {
      m.step = 1;
      setTarget(state, 'M7 TEMAN LAMA: Antar Dodi ke Klinik', 22 * TILE, 18 * TILE);
      say(state, 'Dodi', 'Pelan-pelan saja ya… ah, perutku.');
    } else if (m.step === 1 && dodi && !dodi.dead) {
      const p = playerPos(state);
      const d = Math.hypot(p.x - dodi.x, p.y - dodi.y);
      if (d > 46) {
        const sp = d > 500 ? 400 : 168;
        const step = Math.min(d - 30, sp * dt);
        dodi.x += ((p.x - dodi.x) / d) * step;
        dodi.y += ((p.y - dodi.y) / d) * step;
      }
      state.marker = { x: 22 * TILE, y: 18 * TILE };
      if (arrive(state, 22 * TILE, 18 * TILE, 46) && d < 170) {
        say(state, 'Dodi', 'Makasih, Raka. Kamu memang teman lama terbaik.');
        completeMission(state, 320);
      } else if (arrive(state, 22 * TILE, 18 * TILE, 46) && d >= 170) {
        if ((m.data.warnT || 0) <= 0) {
          pushNotice(state, 'Dodi tertinggal terlalu jauh!');
          m.data.warnT = 3;
        }
      }
      m.data.warnT = Math.max(0, (m.data.warnT || 0) - dt);
    }
  } else if (i === 7) {
    if (m.step === 0 && arrive(state, 18 * TILE, 22 * TILE, 48)) {
      m.step = 1;
      state.timeOfDay = 20.4;
      state.wanted.heat = Math.max(state.wanted.heat, 300);
      state.wanted.lastCrimeAt = state.time;
      setTarget(state, 'M8 MALAM DI BUKIT HIJAU: Kabur ke Pantai Karang!', 31 * TILE, 24 * TILE);
      say(state, 'Bara', 'Kau pikir bisa pergi begitu saja, Raka?');
      say(state, 'Inspektur Sinta', 'GARUDA-1 sudah di udara. Jangan sampai dia lolos!');
    } else if (m.step === 1 && arrive(state, 31 * TILE, 24 * TILE, 55)) {
      say(state, 'Mara', 'Kau berhasil, Raka. Malam ini Karang Bay bernapas lagi.');
      completeMission(state, 500);
    }
  }
}

export function updateMissions(state, dt) {
  if (state.dialog) {
    state.dialog.t = (state.dialog.t || 0) + dt;
    if (state.dialog.t > 4.5) {
      state.dialog = state.dialogQueue.shift() || null;
      if (state.dialog) state.dialog.t = 0;
    }
  }
  if (state.mission.index <= 3) updateMissionsInner(state, dt);
  else updateMissionsLate(state, dt);
}
