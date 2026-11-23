// Wanted system for Karang Bay: witness-gated crime heat, star levels,
// foot officers (Inspector Sinta included), patrol cars, the GARUDA-1
// helicopter, the bust meter and Dodi's Pay-n-Spray.
import { ROAD_X, TILE } from './config.js';
import { collideCircle, damagePlayer, pushNotice } from './player.js';
import { makeCar } from './traffic.js';

export const HEAT_LEVELS = [40, 110, 190, 290, 420];
const CRIME_HEAT = {
  theft: 26, assault: 22, hitrun: 34, shooting: 30,
  murder: 48, explosion: 58, cardamage: 12, robbery: 60,
};
const CRIME_RADIUS = { shooting: 430, explosion: 540 };
const PATROL_COLOR = '#e8e8e8';

export function heatToLevel(heat) {
  let lvl = 0;
  for (const t of HEAT_LEVELS) if (heat >= t) lvl += 1;
  return lvl;
}

export function clearHeat(state) {
  const w = state.wanted;
  w.heat = 0; w.level = 0; w.bust = 0;
}

// Every crime funnels through here. An alert always lands (peds panic),
// but heat only rises when someone saw it: a ped, officer, patrol car or
// the helicopter inside the witness radius (bigger for gunfire/blasts).
export function reportCrime(state, kind, x, y) {
  state.alerts.push({ x, y, t: state.time, kind });
  const radius = CRIME_RADIUS[kind] || 280;
  const near = (e) => e && Math.hypot(e.x - x, e.y - y) <= radius;
  let witnessed = state.peds.some((p) => !p.dead && near(p));
  if (!witnessed) witnessed = state.officers.some((o) => !o.dead && near(o));
  if (!witnessed) witnessed = state.cars.some((c) => c.police && !c.wrecked && near(c));
  if (!witnessed && state.heli) {
    witnessed = Math.hypot(state.heli.x - x, state.heli.y - y) <= 380;
  }
  if (witnessed) {
    const w = state.wanted;
    w.heat += CRIME_HEAT[kind] || 15;
    w.lastCrimeAt = state.time;
    w.hidden = false;
    w.level = heatToLevel(w.heat);
  }
}

function spawnOfficer(state, px, py, sinta) {
  const a = state.rand.next() * Math.PI * 2;
  let x = px + Math.cos(a) * 430;
  let y = py + Math.sin(a) * 430;
  x = Math.max(20, Math.min(state.world.seaX - 30, x));
  y = Math.max(20, Math.min(state.world.height - 20, y));
  const res = collideCircle(state.world, x, y, 7);
  state.officers.push({
    x: res.x, y: res.y, r: 6,
    color: sinta ? '#20344f' : '#3a5a8c',
    hp: sinta ? 170 : 60, dead: false, sinta: !!sinta,
    name: sinta ? 'Inspektur Sinta' : '',
    attackT: 0, shootT: 1 + state.rand.next(),
  });
}

function maintainOfficers(state, dt, px, py) {
  const lvl = state.wanted.level;
  state.officers = state.officers.filter((o) => !o.dead);
  const target = lvl > 0 ? Math.min(6, lvl + 1) : 0;
  if (lvl >= 2 && !state.officers.some((o) => o.sinta)) {
    spawnOfficer(state, px, py, true);
  }
  while (state.officers.length < target) spawnOfficer(state, px, py, false);
  const p = state.player;
  for (const o of state.officers) {
    const d = Math.hypot(px - o.x, py - o.y);
    let mx = 0; let my = 0;
    if (lvl === 0) {
      if (d > 460) { o.dead = true; continue; }
      mx = (o.x - px) / (d || 1); my = (o.y - py) / (d || 1);
    } else if (d > 1) {
      mx = (px - o.x) / d; my = (py - o.y) / d;
    }
    const speed = o.sinta ? 120 : 96;
    if (lvl === 0 || d > 22) {
      const res = collideCircle(state.world, o.x + mx * speed * dt, o.y + my * speed * dt, o.r);
      o.x = res.x; o.y = res.y;
    }
    if (lvl > 0 && d < 27 && !p.dead) {
      o.attackT -= dt;
      if (o.attackT <= 0) {
        o.attackT = 0.8;
        damagePlayer(state, o.sinta ? 9 : 6, 'baton');
      }
    }
    if (lvl >= 3 && d > 60 && d < 300 && !p.dead) {
      o.shootT -= dt;
      if (o.shootT <= 0) {
        o.shootT = 1.4;
        const ang = Math.atan2(py - o.y, px - o.x) + (state.rand.next() - 0.5) * 0.14;
        state.bullets.push({
          x: o.x + Math.cos(ang) * 9, y: o.y + Math.sin(ang) * 9,
          vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620,
          from: 'police', dmg: 7, dist: 0,
        });
      }
    }
  }
  state.officers = state.officers.filter((o) => !o.dead);
}

function maintainPatrols(state, dt, px, py) {
  const lvl = state.wanted.level;
  const target = lvl >= 4 ? 3 : lvl >= 2 ? 2 : 0;
  let patrols = state.cars.filter((c) => c.police);
  if (patrols.length < target) {
    let col = ROAD_X[0];
    let best = Infinity;
    for (const cx of ROAD_X) {
      const d = Math.abs(cx * TILE + 17 - px);
      if (d < best) { best = d; col = cx; }
    }
    const x = col * TILE + 17;
    const y = Math.max(30, Math.min(state.world.height - 30, py + (state.rand.next() > 0.5 ? 460 : -460)));
    const car = makeCar(x, y, 0, PATROL_COLOR, { police: true, hp: 130 });
    car.cruise = 240;
    state.cars.push(car);
    patrols.push(car);
  }
  for (const car of patrols) {
    if (car.wrecked) continue;
    const d = Math.hypot(px - car.x, py - car.y);
    if (lvl === 0) {
      car.speed = Math.max(0, car.speed - 120 * dt);
      if (d > 620) car.dead = true;
      continue;
    }
    const desired = Math.atan2(py - car.y, px - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1.9 * dt, Math.min(1.9 * dt, diff));
    const onFoot = !state.player.vehicle;
    const targetSpeed = onFoot && d < 26 ? 0 : d > 70 ? 238 : 120;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(16, Math.min(state.world.seaX - 16, car.x));
    car.y = Math.max(16, Math.min(state.world.height - 16, car.y));
    const pv = state.player.vehicle;
    if (pv && Math.hypot(pv.x - car.x, pv.y - car.y) < 32) {
      pv.hp -= 16 * dt;
      pv.x += Math.cos(car.angle) * 26 * dt;
      pv.y += Math.sin(car.angle) * 26 * dt;
      car.speed *= 0.92;
    }
  }
  state.cars = state.cars.filter((c) => !c.dead);
}

function updateHeli(state, dt, px, py) {
  const lvl = state.wanted.level;
  if (lvl >= 3) {
    if (!state.heli) state.heli = { x: px - 320, y: py - 280 };
    const tx = px - 110;
    const ty = py - 120;
    const d = Math.hypot(tx - state.heli.x, ty - state.heli.y);
    if (d > 4) {
      const step = Math.min(d, 265 * dt);
      state.heli.x += (tx - state.heli.x) / d * step;
      state.heli.y += (ty - state.heli.y) / d * step;
    }
  } else if (state.heli) {
    state.heli.x -= 190 * dt;
    state.heli.y -= 150 * dt;
    if (Math.hypot(state.heli.x - px, state.heli.y - py) > 720) state.heli = null;
  }
}

function updateBust(state, dt) {
  const w = state.wanted;
  const p = state.player;
  if (!p.vehicle || w.level === 0 || p.dead) {
    w.bust = Math.max(0, w.bust - dt * 1.5);
    return;
  }
  const nearOfficer = state.officers.some((o) => !o.dead &&
    Math.hypot(o.x - p.vehicle.x, o.y - p.vehicle.y) < 36);
  if (nearOfficer && Math.abs(p.vehicle.speed) < 14) {
    w.bust += dt;
    if (w.bust >= 1.6) {
      const car = p.vehicle;
      car.speed = 0;
      state.cars.push(car);
      p.vehicle = null;
      p.x = car.x - 24; p.y = car.y + 14;
      p.money = Math.max(0, p.money - 250);
      clearHeat(state);
      state.officers = [];
      state.cars = state.cars.filter((c) => !c.police);
      state.heli = null;
      pushNotice(state, 'BUSTED! Polisi menyita $250.');
    }
  } else {
    w.bust = Math.max(0, w.bust - dt * 1.5);
  }
}

function updateSpray(state, dt) {
  const w = state.wanted;
  const p = state.player;
  const spray = state.world.stores.find((s) => s.type === 'spray');
  if (!p.vehicle || !spray ||
      Math.hypot(spray.x - p.vehicle.x, spray.y - p.vehicle.y) > 46) {
    w.sprayT = 0;
    return;
  }
  if (w.heat <= 0 && p.vehicle.hp >= 100) { w.sprayT = 0; return; }
  w.sprayT += dt;
  if (w.sprayT >= 1.1) {
    w.sprayT = 0;
    if (p.money >= 100) {
      p.money -= 100;
      p.vehicle.hp = 100;
      p.vehicle.wrecked = false;
      p.vehicle.color = ['#b85145', '#4a7fb5', '#c9a227', '#5f9e6e', '#8a6bb8'][state.rand.int(0, 4)];
      clearHeat(state);
      pushNotice(state, 'Pay-n-Spray: cat baru, polisi kehilangan jejak.');
    } else {
      pushNotice(state, 'Pay-n-Spray butuh $100.');
    }
  }
}

export function updatePolice(state, dt) {
  const w = state.wanted;
  const p = state.player;
  w.level = heatToLevel(w.heat);
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  let contact = false;
  for (const o of state.officers) {
    if (!o.dead && Math.hypot(o.x - px, o.y - py) < 300) contact = true;
  }
  for (const c of state.cars) {
    if (c.police && !c.wrecked && Math.hypot(c.x - px, c.y - py) < 330) contact = true;
  }
  if (state.heli && Math.hypot(state.heli.x - px, state.heli.y - py) < 400) contact = true;
  w.contact = contact;
  w.hidden = !contact;
  if (contact) w.contactT = 0; else w.contactT += dt;
  if (!contact && state.time - w.lastCrimeAt > 4 && w.heat > 0) {
    w.heat = Math.max(0, w.heat - 9 * dt);
    w.level = heatToLevel(w.heat);
  }
  maintainOfficers(state, dt, px, py);
  maintainPatrols(state, dt, px, py);
  updateHeli(state, dt, px, py);
  updateBust(state, dt);
  updateSpray(state, dt);
  state.notices = state.notices.filter((n) => state.time - n.t < 4.5);
  state.alerts = state.alerts.filter((a) => state.time - a.t < 6);
}
