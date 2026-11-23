// police.js — the Karang Bay PD: wanted heat (0–5 stars) with decay
// while Raka stays unseen, foot officers and patrol cars in pursuit,
// the GARUDA-1 helicopter with its searchlight from 3 stars, and the
// two ways to cool off — Dodi's Pay-n-Spray and the safehouse.
// Inspector Sinta personally joins the chase from 2 stars.
// Every other system reports crimes through reportCrime; heat only
// sticks when someone (ped, officer, patrol, heli) witnesses it.
import { ROAD_X, ROAD_Y, SEA_X, TILE, WORLD } from './config.js';
import { rng } from './random.js';
import { damagePlayer, pushNotice } from './player.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CRIME_HEAT = { theft: 50, assault: 40, shooting: 35, hitPed: 60, murder: 110, hitPolice: 80, explosion: 120, vandalism: 20, reckless: 15 };
const LOUD_RADIUS = { shooting: 430, explosion: 540, hitPed: 210 };
const LEVEL_AT = [40, 110, 190, 290, 420];
const decisionRng = rng(5177);

export function wantedLevel(heat) {
  let level = 0;
  for (const t of LEVEL_AT) if (heat >= t) level += 1;
  return level;
}

export function createPolice(state) {
  state.wanted = { heat: 0, level: 0, lastCrimeAt: -99, hidden: false, bust: 0, contact: false };
  if (!state.officers) state.officers = [];
  if (!state.alerts) state.alerts = [];
  if (!state.notices) state.notices = [];
  state.heli = null;
  state.sprayTimer = 0;
  state.sprayCooldown = 0;
  state.safehouseCooldown = 0;
  return state;
}

function isWitnessed(state, x, y, radius) {
  const near = (e) => e && Math.hypot(e.x - x, e.y - y) < radius;
  for (const ped of state.peds || []) if (ped.state !== 'down' && near(ped)) return true;
  for (const o of state.officers || []) if (o.state !== 'down' && o.state !== 'gone' && near(o)) return true;
  for (const v of state.vehicles || []) if (v.police && near(v)) return true;
  if (state.heli && near(state.heli)) return true;
  return false;
}

export function reportCrime(state, kind, x, y) {
  if (!state.wanted) createPolice(state);
  if (!state.alerts) state.alerts = [];
  const now = state.time || 0;
  state.alerts.push({ x, y, t: now, kind });
  const radius = LOUD_RADIUS[kind] || 280;
  const witnessed = isWitnessed(state, x, y, radius);
  if (witnessed) {
    state.wanted.heat += CRIME_HEAT[kind] || 20;
    state.wanted.lastCrimeAt = now;
    state.wanted.level = wantedLevel(state.wanted.heat);
  }
  return witnessed;
}

function roadPointNear(state, minD, maxD) {
  const p = state.player;
  for (let tries = 0; tries < 8; tries += 1) {
    const i = decisionRng.int(0, ROAD_X.length - 1);
    const j = decisionRng.int(0, ROAD_Y.length - 1);
    const x = ROAD_X[i] * TILE + TILE * 0.36 + (decisionRng.next() - 0.5) * 60;
    const y = ROAD_Y[j] * TILE + TILE * 0.36 + (decisionRng.next() - 0.5) * 60;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d >= minD && d <= maxD && x < SEA_X - 30) return { x, y };
  }
  return { x: Math.max(40, p.x - minD), y: Math.max(40, p.y - minD * 0.4) };
}

function spawnOfficer(state, sinta = false) {
  const pos = roadPointNear(state, 400, 560);
  state.officers.push({
    x: pos.x, y: pos.y, r: sinta ? 7.5 : 7,
    color: sinta ? '#1d3f77' : '#2b4d9b',
    name: sinta ? 'Inspector Sinta' : 'Officer',
    hp: sinta ? 170 : 80, maxHp: sinta ? 170 : 80,
    speed: sinta ? 124 : 104 + decisionRng.next() * 14,
    state: 'chase', hitCd: 0, shotCd: 1 + decisionRng.next(),
    vx: 0, vy: 0, sinta,
  });
}

function spawnPatrol(state) {
  const pos = roadPointNear(state, 430, 580);
  state.vehicles.push({
    x: pos.x, y: pos.y, angle: decisionRng.next() * Math.PI * 2,
    w: 34, h: 19, color: '#e8e6df', police: true,
    speed: 0, vx: 0, vy: 0, hp: 160, ai: 'patrol', driver: true, occupied: false, ramCd: 0,
  });
}

function turnToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return angle + clamp(d, -maxStep, maxStep);
}

function resolveCircle(x, y, r, rects) {
  let hit = null;
  for (const b of rects) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 < 0.0001) {
      const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
      const m = Math.min(left, right, top, bot);
      if (m === left) { x = b.x - r; hit = { nx: -1, ny: 0 }; }
      else if (m === right) { x = b.x + b.w + r; hit = { nx: 1, ny: 0 }; }
      else if (m === top) { y = b.y - r; hit = { nx: 0, ny: -1 }; }
      else { y = b.y + b.h + r; hit = { nx: 0, ny: 1 }; }
    } else {
      const d = Math.sqrt(d2);
      x += (dx / d) * (r - d);
      y += (dy / d) * (r - d);
      hit = { nx: dx / d, ny: dy / d };
    }
  }
  return { x, y, hit };
}

export function updatePolice(state, dt) {
  dt = Math.min(dt, 0.05);
  if (!state.wanted) createPolice(state);
  const w = state.wanted, p = state.player, now = state.time || 0;
  if (state.alerts) state.alerts = state.alerts.filter((a) => now - a.t < 8);
  if (state.notices) {
    for (const n of state.notices) n.t -= dt;
    state.notices = state.notices.filter((n) => n.t > 0);
  }
  w.level = wantedLevel(w.heat);
  updateHeli(state, dt);
  const seen = isPlayerSeen(state);
  if (seen) w.contact = true;
  if (w.heat <= 0) w.contact = false;
  w.hidden = w.level > 0 && !seen;
  // Heat only bleeds off after Raka has been spotted and then broken
  // away; while units are still converging on a fresh crime it holds.
  if (now - w.lastCrimeAt > 4) {
    if (w.hidden && w.contact) w.heat = Math.max(0, w.heat - 9 * dt);
    else if (w.level === 0) w.heat = Math.max(0, w.heat - 16 * dt);
  }
  w.level = wantedLevel(w.heat);
  state.sprayCooldown = Math.max(0, (state.sprayCooldown || 0) - dt);
  state.safehouseCooldown = Math.max(0, (state.safehouseCooldown || 0) - dt);
  maintainUnits(state, dt);
  for (const o of state.officers) updateOfficer(state, o, dt);
  state.officers = state.officers.filter((o) => o.state !== 'gone');
  const anyBusting = p && p.vehicle && state.officers.some((o) => o.state === 'chase' && Math.hypot(o.x - p.vehicle.x, o.y - p.vehicle.y) < 40);
  if (!anyBusting) w.bust = Math.max(0, w.bust - dt * 0.3);
  for (const v of state.vehicles || []) if (v.ai === 'patrol') updatePatrol(state, v, dt);
  updateCoolOffs(state, dt);
}

function isPlayerSeen(state) {
  const p = state.player;
  if (!p) return false;
  for (const o of state.officers || []) {
    if (o.state !== 'down' && o.state !== 'gone' && Math.hypot(o.x - p.x, o.y - p.y) < 300) return true;
  }
  for (const v of state.vehicles || []) {
    if (v.police && v.ai === 'patrol' && Math.hypot(v.x - p.x, v.y - p.y) < 320) return true;
  }
  if (state.heli && state.heli.lightOn) return true;
  return false;
}

function maintainUnits(state, dt) {
  const w = state.wanted, p = state.player;
  const alive = state.officers.filter((o) => o.state !== 'down' && o.state !== 'gone');
  const wantOfficers = w.level === 0 ? 0 : Math.min(6, w.level + 1);
  if (w.level >= 2 && !alive.some((o) => o.sinta)) spawnOfficer(state, true);
  if (alive.length < wantOfficers) {
    state._spawnCd = (state._spawnCd || 0) - dt;
    if (state._spawnCd <= 0) { state._spawnCd = 1.4; spawnOfficer(state, false); }
  }
  if (w.level === 0) {
    for (const o of state.officers) {
      if (o.state !== 'down' && o.state !== 'gone' && Math.hypot(o.x - p.x, o.y - p.y) > 520) o.state = 'gone';
    }
  }
  const patrols = (state.vehicles || []).filter((v) => v.ai === 'patrol');
  const wantPatrols = w.level < 2 ? 0 : Math.min(4, w.level - 1);
  if (patrols.length < wantPatrols) {
    state._patrolCd = (state._patrolCd || 0) - dt;
    if (state._patrolCd <= 0) { state._patrolCd = 2.2; spawnPatrol(state); }
  } else if (patrols.length > wantPatrols) {
    let far = null, farD = 0;
    for (const v of patrols) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d > farD) { farD = d; far = v; }
    }
    if (far && farD > 700) state.vehicles.splice(state.vehicles.indexOf(far), 1);
  }
}

function fireAt(state, from, target, kind, dmg) {
  if (!state.bullets) state.bullets = [];
  const ang = Math.atan2(target.y - from.y, target.x - from.x) + (decisionRng.next() - 0.5) * 0.09;
  state.bullets.push({
    x: from.x + Math.cos(ang) * 10, y: from.y + Math.sin(ang) * 10,
    vx: Math.cos(ang) * 700, vy: Math.sin(ang) * 700,
    life: 0.85, from: kind, dmg, r: 3,
  });
}

function doBust(state) {
  const p = state.player, w = state.wanted;
  if (p.vehicle) {
    p.vehicle.occupied = false;
    const side = p.vehicle.angle + Math.PI / 2;
    p.x = p.vehicle.x + Math.cos(side) * 22;
    p.y = p.vehicle.y + Math.sin(side) * 22;
    p.vehicle = null;
  }
  p.money = Math.max(0, p.money - 250);
  w.heat = 0;
  w.bust = 0;
  pushNotice(state, 'BUSTED — the fine is $250');
}

function updateOfficer(state, o, dt) {
  const p = state.player, w = state.wanted;
  if (o.state === 'down') {
    o._goneCd = (o._goneCd ?? 6) - dt;
    if (o._goneCd <= 0) o.state = 'gone';
    return;
  }
  if (o.hp <= 0) { o.state = 'down'; o.color = '#3c4654'; return; }
  o.x += (o.vx || 0) * dt;
  o.y += (o.vy || 0) * dt;
  o.vx = (o.vx || 0) * Math.exp(-6 * dt);
  o.vy = (o.vy || 0) * Math.exp(-6 * dt);
  if (!p || p.dead || w.level === 0) return;
  const target = p.vehicle || p;
  const dx = target.x - o.x, dy = target.y - o.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = o.speed + w.level * 5;
  if (d > 20) {
    o.x += (dx / d) * speed * dt;
    o.y += (dy / d) * speed * dt;
  }
  const res = resolveCircle(o.x, o.y, o.r, state.world.buildings);
  o.x = res.x;
  o.y = res.y;
  o.x = clamp(o.x, 8, SEA_X - 4);
  o.y = clamp(o.y, 8, WORLD.height - 8);
  o.hitCd = Math.max(0, (o.hitCd || 0) - dt);
  o.shotCd = Math.max(0, (o.shotCd || 0) - dt);
  if (p.vehicle) {
    const carSpeed = Math.hypot(p.vehicle.vx || 0, p.vehicle.vy || 0);
    if (d < 36 && carSpeed < 45) {
      w.bust += dt / 2.4;
      if (w.bust >= 1) doBust(state);
    }
  } else if (d < 23 && o.hitCd <= 0) {
    o.hitCd = 0.7;
    damagePlayer(state, o.sinta ? 9 : 6, Math.atan2(dy, dx));
  }
  if (!p.vehicle && w.level >= 3 && d > 90 && d < 280 && o.shotCd <= 0) {
    o.shotCd = 1.5;
    fireAt(state, o, p, 'police', 8);
  }
  if (p.vehicle && w.level >= 4 && d > 110 && d < 300 && o.shotCd <= 0) {
    o.shotCd = 1.9;
    fireAt(state, o, p.vehicle, 'police', 6);
  }
}

function updatePatrol(state, v, dt) {
  const p = state.player, w = state.wanted;
  v.ramCd = Math.max(0, (v.ramCd || 0) - dt);
  if (v.hp <= 0) {
    v.speed = Math.max(0, (v.speed || 0) - 200 * dt);
    v.x += Math.cos(v.angle) * v.speed * dt;
    v.y += Math.sin(v.angle) * v.speed * dt;
    v.vx = Math.cos(v.angle) * v.speed;
    v.vy = Math.sin(v.angle) * v.speed;
    return;
  }
  if (!p || p.dead || w.level === 0) {
    v.speed = Math.max(0, (v.speed || 0) - 160 * dt);
    v.x += Math.cos(v.angle) * v.speed * dt;
    v.y += Math.sin(v.angle) * v.speed * dt;
    v.vx = Math.cos(v.angle) * v.speed;
    v.vy = Math.sin(v.angle) * v.speed;
    return;
  }
  const target = p.vehicle || p;
  const dx = target.x - v.x, dy = target.y - v.y;
  const d = Math.hypot(dx, dy) || 1;
  v.angle = turnToward(v.angle, Math.atan2(dy, dx), 2.1 * dt);
  let targetSpeed = 302;
  if (!p.vehicle && d < 60) targetSpeed = 0;
  else if (d < 90) targetSpeed = 150;
  const accel = targetSpeed > (v.speed || 0) ? 210 : 330;
  v.speed = (v.speed || 0) + clamp(targetSpeed - (v.speed || 0), -accel * dt, accel * dt);
  v.x += Math.cos(v.angle) * v.speed * dt;
  v.y += Math.sin(v.angle) * v.speed * dt;
  v.vx = Math.cos(v.angle) * v.speed;
  v.vy = Math.sin(v.angle) * v.speed;
  const res = resolveCircle(v.x, v.y, 15, state.world.buildings);
  if (res.hit) { v.x = res.x; v.y = res.y; v.speed *= 0.55; }
  v.x = clamp(v.x, 16, SEA_X - 10);
  v.y = clamp(v.y, 16, WORLD.height - 16);
  if (p.vehicle && d < 34 && v.ramCd <= 0) {
    v.ramCd = 0.8;
    p.vehicle.hp = Math.max(0, (p.vehicle.hp ?? 100) - 7);
    state.shake = Math.max(state.shake || 0, 3);
  }
}

function updateHeli(state, dt) {
  const w = state.wanted, p = state.player;
  if (w.level >= 3 && p && !p.dead) {
    if (!state.heli) state.heli = { x: p.x - 520, y: p.y - 420, angle: 0, lightOn: false };
    const h = state.heli;
    const t = state.time || 0;
    const tx = p.x - 44 + Math.sin(t * 0.7) * 22;
    const ty = p.y - 108 + Math.cos(t * 0.9) * 14;
    const k = 1 - Math.exp(-1.6 * dt);
    h.x += (tx - h.x) * k;
    h.y += (ty - h.y) * k;
    h.angle = Math.atan2(p.y - h.y, p.x - h.x);
    h.lightOn = Math.hypot(p.x - (h.x + 44), p.y - (h.y + 108)) < 95;
  } else if (state.heli) {
    const h = state.heli;
    h.x -= 300 * dt;
    h.y -= 210 * dt;
    h.lightOn = false;
    if (!p || Math.hypot(h.x - p.x, h.y - p.y) > 900) state.heli = null;
  }
}

function updateCoolOffs(state, dt) {
  const p = state.player, w = state.wanted;
  if (!p || p.dead) return;
  const spray = state.world.stores.find((s) => s.type === 'spray');
  if (spray && p.vehicle && state.sprayCooldown <= 0) {
    if (Math.hypot(p.x - spray.x, p.y - spray.y) < 36) {
      state.sprayTimer = (state.sprayTimer || 0) + dt;
      if (state.sprayTimer > 1.1) {
        state.sprayTimer = 0;
        state.sprayCooldown = 6;
        const car = p.vehicle;
        car.hp = 100;
        car.color = decisionRng.pick(['#7a4fa3', '#2f6f8f', '#a33b3b', '#3f7d4e', '#c7c9cc', '#37474f']);
        if (p.money >= 100) {
          p.money -= 100;
          w.heat = 0;
          pushNotice(state, "Dodi's Pay-n-Spray: fresh paint, heat gone — $100");
        } else {
          w.heat = Math.max(0, w.heat - 130);
          pushNotice(state, "Dodi's quick job: some heat scrubbed, car fixed");
        }
      }
    } else state.sprayTimer = 0;
  }
  const safe = state.world.stores.find((s) => s.type === 'safehouse');
  if (safe && !p.vehicle && state.safehouseCooldown <= 0 && state.input && state.input.interactPressed) {
    if (Math.hypot(p.x - safe.x, p.y - safe.y) < 32 && w.heat > 0) {
      w.heat = 0;
      state.safehouseCooldown = 8;
      pushNotice(state, 'You lay low at the safehouse — heat gone');
    }
  }
}
