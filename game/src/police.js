// police.js — wanted heat, witnessed crimes, officers, patrol cars,
// GARUDA-1 helicopter, busts and cool-off spots.
import { ROAD_X, ROAD_Y, TILE } from './config.js';
import { rng } from './random.js';
import { damagePlayer, pushNotice, resolveMove } from './player.js';
import { sfx } from './audio.js';

export const HEAT_LEVELS = [40, 110, 190, 290, 420];
const HEAT_BY_KIND = { assault: 16, theft: 24, runover: 30, shooting: 24, hitPolice: 34, explosion: 38, robbery: 175, spray: 0 };
const PATROL_COLORS = ['#e8e8e8', '#dfe5ea'];

export function levelForHeat(heat) {
  let lvl = 0;
  for (const t of HEAT_LEVELS) if (heat >= t) lvl += 1;
  return lvl;
}

export function createPolice(state) {
  state.wanted = { heat: 0, level: 0, lastCrimeAt: -99, hidden: true, bust: 0, contact: false, lastSeenAt: -99 };
  state.alerts = [];
  state.notices = state.notices || [];
  state.officers = [];
  state.heli = null;
  state.lastAlertPos = null;
  return state.wanted;
}

function witnessed(state, kind, x, y) {
  const radius = kind === 'shooting' ? 430 : kind === 'explosion' ? 540 : 280;
  for (const p of state.peds) if (!p.dead && Math.hypot(p.x - x, p.y - y) < radius) return true;
  for (const o of state.officers) if (!o.dead && Math.hypot(o.x - x, o.y - y) < radius) return true;
  for (const v of state.vehicles) if (v.police && Math.hypot(v.x - x, v.y - y) < radius) return true;
  if (state.heli && Math.hypot(state.player.x - x, state.player.y - y) < 60) {
    const coneX = state.heli.x + 58, coneY = state.heli.y + 88;
    if (Math.hypot(state.player.x - coneX, state.player.y - coneY) < 120) return true;
  }
  return false;
}

export function reportCrime(state, kind, x, y) {
  if (!state.wanted) return;
  state.alerts.push({ x, y, t: state.time });
  state.lastAlertPos = { x, y };
  if (state.alerts.length > 24) state.alerts.splice(0, state.alerts.length - 24);
  if (!witnessed(state, kind, x, y)) return;
  const add = HEAT_BY_KIND[kind] || 12;
  state.wanted.heat += add;
  state.wanted.lastCrimeAt = state.time;
  state.wanted.level = levelForHeat(state.wanted.heat);
}

function roadPointNear(state, dist) {
  const p = state.player;
  const r = rng(Math.floor(state.time * 13) + Math.floor(p.x) + Math.floor(p.y));
  const ang = r.next() * Math.PI * 2;
  const tx = p.x + Math.cos(ang) * dist;
  const ty = p.y + Math.sin(ang) * dist;
  let bx = ROAD_X[0], by = ROAD_Y[0], bd = 1e12;
  for (const c of ROAD_X) for (const rw of ROAD_Y) {
    const px = c * TILE + 17, py = rw * TILE + 17;
    const d = Math.hypot(px - tx, py - ty);
    if (d < bd) { bd = d; bx = px; by = py; }
  }
  return { x: bx, y: by };
}

function spawnOfficer(state, kind) {
  const pos = roadPointNear(state, 430);
  const sinta = kind === 'sinta';
  state.officers.push({
    x: pos.x, y: pos.y, r: 6, hp: sinta ? 170 : 60,
    color: sinta ? '#1d2f52' : '#2c4a7c', kind,
    dead: false, corpseT: 0, fleeT: 0, atkCd: 0, shotCd: 1 + Math.random(),
    speed: sinta ? 138 : 117, seed: Math.floor(state.time * 100) + state.officers.length * 37,
  });
}

function spawnPatrol(state) {
  const pos = roadPointNear(state, 470);
  state.vehicles.push({
    x: pos.x, y: pos.y, angle: 0, w: 34, h: 19, color: PATROL_COLORS[state.vehicles.length % 2],
    police: true, kind: 'patrol', speed: 0, vx: 0, vy: 0, hp: 170, driver: 'officer', wrecked: false,
  });
}

function busted(state) {
  const p = state.player;
  if (p.vehicle) {
    p.vehicle.driver = null;
    p.x = p.vehicle.x + 24; p.y = p.vehicle.y + 14;
    p.vehicle = null;
  }
  p.money = Math.max(0, p.money - 250);
  state.wanted.heat = 0; state.wanted.level = 0; state.wanted.bust = 0; state.wanted.contact = false;
  pushNotice(state, 'BUSTED — denda $250');
  sfx(state, 'busted');
}

function updateOfficer(state, o, dt) {
  if (o.dead) { o.corpseT -= dt; return; }
  const p = state.player;
  const w = state.wanted;
  o.atkCd -= dt; o.shotCd -= dt;
  const d = Math.hypot(p.x - o.x, p.y - o.y);
  if (w.level === 0 || p.dead) return;
  const speed = o.speed * (d > 200 ? 1.12 : 1);
  if (d > 19) {
    const dx = (p.x - o.x) / (d || 1), dy = (p.y - o.y) / (d || 1);
    resolveMove(state, o, dx * speed * dt, dy * speed * dt, o.r);
  }
  if (!p.vehicle && d < 23 && o.atkCd <= 0) {
    o.atkCd = 0.75;
    damagePlayer(state, o.kind === 'sinta' ? 9 : 6);
  }
  if (p.vehicle && d < 32 && Math.abs(p.vehicle.speed || 0) < 26) {
    w.bust += dt / 1.2;
    if (w.bust >= 1) busted(state);
  }
  if (w.level >= 3 && d > 85 && d < 285 && o.shotCd <= 0) {
    o.shotCd = 1.05;
    const r = rng(o.seed + Math.floor(state.time * 7));
    const ang = Math.atan2(p.y - o.y, p.x - o.x) + (r.next() - 0.5) * 0.14;
    state.bullets.push({ x: o.x, y: o.y, vx: Math.cos(ang) * 700, vy: Math.sin(ang) * 700, from: 'police', dmg: 6, life: 0.55 });
    sfx(state, 'shot');
  }
}

function updatePatrol(state, v, dt) {
  if (v.wrecked || v.hp <= 0) { v.wrecked = true; v.speed = 0; return; }
  const p = state.player;
  const w = state.wanted;
  if (w.level === 0 || p.dead) { v.speed *= Math.max(0, 1 - 3 * dt); v.x += v.vx * dt; v.y += v.vy * dt; return; }
  const d = Math.hypot(p.x - v.x, p.y - v.y);
  const want = d > 60 ? 208 : 120;
  v.speed += Math.max(-160 * dt, Math.min(140 * dt, want - v.speed));
  const ang = Math.atan2(p.y - v.y, p.x - v.x);
  let turn = ang - v.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  v.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, turn));
  v.vx = Math.cos(v.angle) * v.speed; v.vy = Math.sin(v.angle) * v.speed;
  resolveMove(state, v, v.vx * dt, v.vy * dt, 15);
  const target = p.vehicle || p;
  if (Math.hypot(target.x - v.x, target.y - v.y) < 30 && Math.abs(v.speed) > 60) {
    if (p.vehicle) { p.vehicle.hp -= 9; damagePlayer(state, 3); }
    v.speed *= 0.4;
  }
}

export function updatePolice(state, dt) {
  const w = state.wanted;
  if (!w) return;
  const p = state.player;
  w.level = levelForHeat(w.heat);
  state.alerts = state.alerts.filter(a => state.time - a.t < 6);
  for (const n of state.notices) n.t += dt;
  state.notices = state.notices.filter(n => n.t < n.life);
  // Contact: any unit close, or the helicopter light on Raka.
  let nearest = 1e9;
  for (const o of state.officers) if (!o.dead) nearest = Math.min(nearest, Math.hypot(p.x - o.x, p.y - o.y));
  for (const v of state.vehicles) if (v.police && !v.wrecked) nearest = Math.min(nearest, Math.hypot(p.x - v.x, p.y - v.y));
  let heliSeen = false;
  if (state.heli) {
    const coneX = state.heli.x + 58, coneY = state.heli.y + 88;
    heliSeen = Math.hypot(p.x - coneX, p.y - coneY) < 95;
  }
  if (nearest < 300 || heliSeen) { w.contact = true; w.lastSeenAt = state.time; }
  w.hidden = !(nearest < 200 || heliSeen);
  // Decay only after contact was made and broken, and 4 quiet seconds.
  if (w.heat > 0 && w.contact && nearest > 340 && !heliSeen && state.time - w.lastCrimeAt > 4) {
    w.heat = Math.max(0, w.heat - 9 * dt);
    if (w.heat === 0) w.contact = false;
  }
  if (!(p.vehicle && Math.abs(p.vehicle.speed || 0) < 26)) w.bust = Math.max(0, w.bust - dt * 0.7);
  // Unit counts by level.
  const wantOfficers = w.level === 0 ? 0 : Math.min(6, w.level + 1);
  const alive = state.officers.filter(o => !o.dead);
  if (w.level >= 2 && !alive.some(o => o.kind === 'sinta')) spawnOfficer(state, 'sinta');
  for (let i = alive.length; i < wantOfficers; i++) spawnOfficer(state, 'officer');
  state.officers = state.officers.filter(o => {
    if (o.dead) return o.corpseT > 0;
    return !(wantOfficers === 0 && Math.hypot(p.x - o.x, p.y - o.y) > 60) || Math.hypot(p.x - o.x, p.y - o.y) < 720;
  });
  const patrols = state.vehicles.filter(v => v.kind === 'patrol');
  const wantPatrols = w.level >= 2 ? Math.min(3, w.level - 1) : 0;
  for (let i = patrols.length; i < wantPatrols; i++) spawnPatrol(state);
  if (wantPatrols === 0) state.vehicles = state.vehicles.filter(v => v.kind !== 'patrol' || Math.hypot(p.x - v.x, p.y - v.y) < 720);
  // GARUDA-1 from 3 stars.
  if (w.level >= 3 && !p.dead) {
    if (!state.heli) state.heli = { x: p.x - 44, y: p.y - 108 };
    state.heli.x = p.x - 44 + Math.sin(state.time * 0.9) * 11;
    state.heli.y = p.y - 108 + Math.cos(state.time * 0.7) * 8;
  } else state.heli = null;
  for (const o of state.officers) updateOfficer(state, o, dt);
  for (const v of state.vehicles) if (v.kind === 'patrol') updatePatrol(state, v, dt);
  // Dodi's Pay-n-Spray cool-off.
  const spray = state.world.stores.find(s => s.type === 'spray');
  if (p.vehicle && spray && Math.hypot(p.x - spray.x, p.y - spray.y) < 36) {
    p.sprayTimer += dt;
    if (p.sprayTimer >= 1.1) {
      p.sprayTimer = -2.5;
      if (p.money >= 100) {
        p.money -= 100;
        w.heat = 0; w.level = 0; w.contact = false;
        p.vehicle.hp = 170; p.vehicle.wrecked = false;
        p.vehicle.color = ['#4a7fa5', '#5d8a66', '#c9a227', '#8a6fae'][Math.floor(state.time) % 4];
        pushNotice(state, 'Pay-n-Spray — bersih, $100');
      } else {
        w.heat = Math.max(0, w.heat - 130);
        pushNotice(state, 'Pay-n-Spray — uang kurang, sebagian jejak hilang');
      }
      sfx(state, 'cash');
    }
  } else if (p.sprayTimer > 0) p.sprayTimer = 0;
}
