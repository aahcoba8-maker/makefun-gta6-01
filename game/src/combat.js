// combat.js — fists and firepower in Karang Bay: Raka's punch and
// pistol (ammo, R reload), Bara's rival crew holding Pasar Lama and
// the port, exploding barrels with chain reactions, dropped pickups,
// and every bullet in flight — including police fire, which police.js
// spawns and this module resolves.
import { SEA_X, TILE } from './config.js';
import { rng } from './random.js';
import { reportCrime } from './police.js';
import { damagePlayer, pushNotice } from './player.js';
import { damagePed } from './traffic.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const decisionRng = rng(31337);
const MAG_SIZE = 12;

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

export function createCombat(state) {
  state.bullets = [];
  state.pickups = [];
  state.booms = [];
  state.pendingBooms = [];
  if (!state.effects) state.effects = { smoke: [], flashes: [] };
  state.barrels = [];
  const barrelSpots = [
    [SEA_X - 168, 150], [SEA_X - 118, 318], [SEA_X - 214, 462], [SEA_X - 96, 560],
    [16 * TILE + 30, 4 * TILE + 8], [19 * TILE + 12, 6 * TILE + 30],
    [28 * TILE + 6, 21 * TILE + 22], [27 * TILE + 26, 24 * TILE + 10],
    [6 * TILE + 14, 19 * TILE + 26], [12 * TILE + 30, 26 * TILE + 6],
    [22 * TILE + 8, 11 * TILE + 30], [31 * TILE + 20, 16 * TILE + 12],
  ];
  for (const [x, y] of barrelSpots) {
    state.barrels.push({ x, y, r: 9, hp: 30, exploded: false, lastHitBy: null });
  }
  state.enemies = [];
  const crews = [
    { x: 19 * TILE, y: 8 * TILE, n: 4 },
    { x: 6 * TILE, y: 20 * TILE, n: 4 },
  ];
  for (const crew of crews) {
    for (let i = 0; i < crew.n; i += 1) {
      state.enemies.push(makeEnemy(
        crew.x + (decisionRng.next() - 0.5) * 130,
        crew.y + (decisionRng.next() - 0.5) * 130,
        crew, i % 2 === 0 ? 'pistol' : 'fists',
      ));
    }
  }
  const bara = makeEnemy(19 * TILE + 40, 8 * TILE - 30, { x: 19 * TILE, y: 8 * TILE }, 'pistol');
  bara.name = 'Bara';
  bara.hp = 280;
  bara.maxHp = 280;
  bara.r = 8;
  bara.color = '#8c2323';
  bara.speed = 106;
  bara.leader = true;
  state.enemies.push(bara);
  return state;
}

function makeEnemy(x, y, home, weapon) {
  return {
    x, y, r: 7, color: '#6e2a35', angle: 0,
    hp: 100, maxHp: 100, weapon, speed: 92 + decisionRng.next() * 10,
    home: { x: home.x, y: home.y }, state: 'idle',
    provoked: false, hitCd: 0, shotCd: 1 + decisionRng.next() * 1.4,
    vx: 0, vy: 0, wanderT: 0, wanderDest: null,
  };
}

export function damageEnemy(state, e, dmg, byPlayer, angle = 0) {
  if (!e || e.state === 'down') return;
  e.hp -= dmg;
  e.provoked = true;
  e.flash = 0.15;
  if (angle) {
    e.vx += Math.cos(angle) * 120;
    e.vy += Math.sin(angle) * 120;
  }
  if (e.hp <= 0) {
    e.state = 'down';
    e.color = '#4c3436';
    e.hp = 0;
    if (byPlayer) reportCrime(state, 'murder', e.x, e.y);
    dropPickup(state, e);
    if (e.leader) pushNotice(state, "Bara is down — Mara's phone is already ringing");
  }
}

function dropPickup(state, e) {
  const roll = decisionRng.next();
  if (e.leader) state.pickups.push({ x: e.x, y: e.y, type: 'money', amount: 400, t: 0 });
  else if (roll < 0.55) state.pickups.push({ x: e.x, y: e.y, type: 'money', amount: decisionRng.int(15, 70), t: 0 });
  else if (roll < 0.8) state.pickups.push({ x: e.x, y: e.y, type: 'ammo', amount: 12, t: 0 });
  else state.pickups.push({ x: e.x, y: e.y, type: 'health', amount: 35, t: 0 });
}

function hitOfficer(state, o, dmg, angle) {
  if (!o || o.state === 'down' || o.state === 'gone') return;
  o.hp -= dmg;
  o.vx = (o.vx || 0) + Math.cos(angle) * 130;
  o.vy = (o.vy || 0) + Math.sin(angle) * 130;
  reportCrime(state, o.hp <= 0 ? 'murder' : 'hitPolice', o.x, o.y);
}

function damageBarrel(state, barrel, dmg, by) {
  if (barrel.exploded) return;
  barrel.hp -= dmg;
  barrel.lastHitBy = by;
  if (barrel.hp <= 0) explodeBarrel(state, barrel, by === 'player');
}

export function explodeBarrel(state, barrel, byPlayer = false) {
  if (barrel.exploded) return;
  barrel.exploded = true;
  const R = 96;
  if (!state.booms) state.booms = [];
  if (!state.pendingBooms) state.pendingBooms = [];
  if (!state.effects) state.effects = { smoke: [], flashes: [] };
  state.booms.push({ x: barrel.x, y: barrel.y, r: 12, t: 0 });
  state.effects.flashes.push({ x: barrel.x, y: barrel.y, t: 0, life: 0.16, r: 30 });
  state.shake = Math.max(state.shake || 0, 9);
  reportCrime(state, 'explosion', barrel.x, barrel.y);
  const fall = (d) => Math.max(0, 1 - d / R);
  const p = state.player;
  if (p && !p.dead) {
    const d = Math.hypot(p.x - barrel.x, p.y - barrel.y);
    if (d < R) {
      if (p.vehicle) p.vehicle.hp = Math.max(0, (p.vehicle.hp ?? 100) - 70 * fall(d));
      else damagePlayer(state, 55 * fall(d), Math.atan2(p.y - barrel.y, p.x - barrel.x));
    }
  }
  for (const e of state.enemies || []) {
    if (e.state === 'down') continue;
    const d = Math.hypot(e.x - barrel.x, e.y - barrel.y);
    if (d < R) damageEnemy(state, e, 95 * fall(d), byPlayer, Math.atan2(e.y - barrel.y, e.x - barrel.x));
  }
  for (const ped of state.peds || []) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - barrel.x, ped.y - barrel.y);
    if (d < R) damagePed(state, ped, 95 * fall(d), { byPlayer, angle: Math.atan2(ped.y - barrel.y, ped.x - barrel.x) });
  }
  for (const o of state.officers || []) {
    if (o.state === 'down') continue;
    const d = Math.hypot(o.x - barrel.x, o.y - barrel.y);
    if (d < R) hitOfficer(state, o, 80 * fall(d), Math.atan2(o.y - barrel.y, o.x - barrel.x));
  }
  for (const v of state.vehicles || []) {
    const d = Math.hypot(v.x - barrel.x, v.y - barrel.y);
    if (d < R + 12) v.hp = Math.max(0, (v.hp ?? 100) - 75 * fall(Math.max(0, d - 12)));
  }
  for (const b2 of state.barrels || []) {
    if (b2 === barrel || b2.exploded) continue;
    if (Math.hypot(b2.x - barrel.x, b2.y - barrel.y) < R) {
      state.pendingBooms.push({ barrel: b2, t: 0.13, byPlayer });
    }
  }
}

export function updateCombat(state, dt) {
  dt = Math.min(dt, 0.05);
  if (!state.bullets) createCombat(state);
  updatePlayerAttack(state, dt);
  updateBullets(state, dt);
  for (const e of state.enemies || []) updateEnemy(state, e, dt);
  updatePickups(state, dt);
  const pending = state.pendingBooms || [];
  for (let i = pending.length - 1; i >= 0; i -= 1) {
    pending[i].t -= dt;
    if (pending[i].t <= 0) {
      const pb = pending[i];
      pending.splice(i, 1);
      explodeBarrel(state, pb.barrel, pb.byPlayer);
    }
  }
  const booms = state.booms || [];
  for (let i = booms.length - 1; i >= 0; i -= 1) {
    booms[i].t += dt;
    booms[i].r = 12 + booms[i].t * 320;
    if (booms[i].t > 0.42) booms.splice(i, 1);
  }
}

function updatePlayerAttack(state, dt) {
  const p = state.player, input = state.input;
  if (!p) return;
  if (p.dead || p.vehicle || !input) {
    p.reloading = Math.max(0, p.reloading - dt);
    return;
  }
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const load = Math.min(MAG_SIZE - p.ammoInMag, p.reserveAmmo);
      p.ammoInMag += load;
      p.reserveAmmo -= load;
    }
    return;
  }
  if (input.reloadPressed && p.hasPistol && p.reserveAmmo > 0 && p.ammoInMag < MAG_SIZE) {
    p.reloading = 1.1;
    return;
  }
  if (!input.attackHeld || p.attackCd > 0) return;
  const aim = Math.atan2(input.mouse.wy - p.y, input.mouse.wx - p.x);
  const aimDist = Math.hypot(input.mouse.wx - p.x, input.mouse.wy - p.y);
  p.angle = aim;
  if (p.hasPistol && p.ammoInMag > 0 && aimDist > 70) {
    p.attackCd = 0.24;
    p.ammoInMag -= 1;
    const spread = (decisionRng.next() - 0.5) * 0.05;
    state.bullets.push({
      x: p.x + Math.cos(aim) * 13, y: p.y + Math.sin(aim) * 13,
      vx: Math.cos(aim + spread) * 760, vy: Math.sin(aim + spread) * 760,
      life: 0.8, from: 'player', dmg: 26, r: 3,
    });
    state.effects.flashes.push({ x: p.x + Math.cos(aim) * 16, y: p.y + Math.sin(aim) * 16, t: 0, life: 0.07, r: 7 });
    reportCrime(state, 'shooting', p.x, p.y);
    if (p.ammoInMag === 0 && p.reserveAmmo > 0) p.reloading = 1.1;
    return;
  }
  // Fists: a swing at everything hostile within reach of the cursor arc.
  p.attackCd = 0.38;
  let hitSomething = false;
  const swing = (target, apply) => {
    if (Math.hypot(target.x - p.x, target.y - p.y) > 42) return;
    let da = Math.atan2(target.y - p.y, target.x - p.x) - aim;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 1.15) { apply(target); hitSomething = true; }
  };
  for (const e of state.enemies || []) if (e.state !== 'down') swing(e, (t) => damageEnemy(state, t, 30, true, aim));
  for (const o of state.officers || []) if (o.state !== 'down') swing(o, (t) => hitOfficer(state, t, 30, aim));
  for (const ped of state.peds || []) if (ped.state !== 'down') swing(ped, (t) => damagePed(state, t, 30, { byPlayer: true, angle: aim }));
  for (const b of state.barrels || []) if (!b.exploded) swing(b, (t) => damageBarrel(state, t, 30, 'player'));
  if (hitSomething) {
    state.effects.flashes.push({ x: p.x + Math.cos(aim) * 20, y: p.y + Math.sin(aim) * 20, t: 0, life: 0.06, r: 6 });
  }
}

function pointInRects(x, y, rects) {
  for (const b of rects) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

function updateBullets(state, dt) {
  const rects = state.world.buildings.concat(state.world.containers);
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > state.world.width || b.y > state.world.height;
    if (!dead && pointInRects(b.x, b.y, rects)) {
      state.effects.flashes.push({ x: b.x, y: b.y, t: 0, life: 0.05, r: 4 });
      dead = true;
    }
    if (!dead) {
      for (const barrel of state.barrels || []) {
        if (!barrel.exploded && Math.hypot(barrel.x - b.x, barrel.y - b.y) < barrel.r + b.r) {
          damageBarrel(state, barrel, b.dmg, b.from);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') dead = bulletHitsTargets(state, b);
    else if (!dead) dead = bulletHitsPlayer(state, b, p);
    if (dead) state.bullets.splice(i, 1);
  }
}

function bulletHitsTargets(state, b) {
  const ang = Math.atan2(b.vy, b.vx);
  for (const e of state.enemies || []) {
    if (e.state !== 'down' && Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
      damageEnemy(state, e, b.dmg, true, ang);
      return true;
    }
  }
  for (const o of state.officers || []) {
    if (o.state !== 'down' && o.state !== 'gone' && Math.hypot(o.x - b.x, o.y - b.y) < o.r + b.r) {
      hitOfficer(state, o, b.dmg, ang);
      return true;
    }
  }
  for (const ped of state.peds || []) {
    if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < ped.r + b.r) {
      damagePed(state, ped, b.dmg, { byPlayer: true, angle: ang });
      return true;
    }
  }
  for (const v of state.vehicles || []) {
    if (Math.hypot(v.x - b.x, v.y - b.y) < 18) {
      v.hp = Math.max(0, (v.hp ?? 100) - b.dmg * 0.5);
      if (v.police) reportCrime(state, 'hitPolice', v.x, v.y);
      return true;
    }
  }
  return false;
}

function bulletHitsPlayer(state, b, p) {
  if (!p || p.dead) return false;
  if (p.vehicle) {
    if (Math.hypot(p.vehicle.x - b.x, p.vehicle.y - b.y) < 18) {
      p.vehicle.hp = Math.max(0, (p.vehicle.hp ?? 100) - b.dmg * 0.7);
      if (decisionRng.next() < 0.3) damagePlayer(state, b.dmg * 0.4, Math.atan2(b.vy, b.vx));
      return true;
    }
    return false;
  }
  if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
    damagePlayer(state, b.dmg, Math.atan2(b.vy, b.vx));
    return true;
  }
  return false;
}

function moveToward(state, e, dest, speed, dt) {
  const dx = dest.x - e.x, dy = dest.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return;
  e.angle = Math.atan2(dy, dx);
  e.x += (dx / d) * speed * dt;
  e.y += (dy / d) * speed * dt;
  const res = resolveCircle(e.x, e.y, e.r, state.world.buildings);
  e.x = res.x;
  e.y = res.y;
  e.x = clamp(e.x, 8, SEA_X - 4);
  e.y = clamp(e.y, 8, state.world.height - 8);
}

function updateEnemy(state, e, dt) {
  if (e.state === 'down') return;
  const p = state.player;
  e.x += (e.vx || 0) * dt;
  e.y += (e.vy || 0) * dt;
  e.vx = (e.vx || 0) * Math.exp(-6 * dt);
  e.vy = (e.vy || 0) * Math.exp(-6 * dt);
  e.hitCd = Math.max(0, e.hitCd - dt);
  e.shotCd = Math.max(0, e.shotCd - dt);
  if (!p || p.dead) { e.state = 'idle'; return; }
  const target = p.vehicle || p;
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  const turf = Math.hypot(e.home.x - p.x, e.home.y - p.y) < 215;
  if (d < 130 && turf) e.provoked = true;
  if (!e.provoked) {
    e.state = 'idle';
    e.wanderT -= dt;
    if (!e.wanderDest || e.wanderT <= 0 || Math.hypot(e.wanderDest.x - e.x, e.wanderDest.y - e.y) < 8) {
      e.wanderT = 3 + decisionRng.next() * 3;
      e.wanderDest = { x: e.home.x + (decisionRng.next() - 0.5) * 120, y: e.home.y + (decisionRng.next() - 0.5) * 120 };
    }
    moveToward(state, e, e.wanderDest, 34, dt);
    return;
  }
  e.state = 'chase';
  e.angle = Math.atan2(target.y - e.y, target.x - e.x);
  const range = e.weapon === 'pistol' ? 150 : 26;
  if (d > range) moveToward(state, e, target, e.speed, dt);
  if (p.vehicle) {
    if (d < 30 && e.hitCd <= 0) {
      e.hitCd = 0.8;
      p.vehicle.hp = Math.max(0, (p.vehicle.hp ?? 100) - 6);
    }
  } else if (e.weapon === 'fists') {
    if (d < 30 && e.hitCd <= 0) {
      e.hitCd = 0.8;
      damagePlayer(state, e.leader ? 13 : 9, e.angle);
    }
  } else if (d < 250 && e.shotCd <= 0) {
    e.shotCd = 1.35;
    const ang = e.angle + (decisionRng.next() - 0.5) * 0.11;
    state.bullets.push({
      x: e.x + Math.cos(ang) * 11, y: e.y + Math.sin(ang) * 11,
      vx: Math.cos(ang) * 700, vy: Math.sin(ang) * 700,
      life: 0.8, from: 'enemy', dmg: 8, r: 3,
    });
  }
  for (const other of state.enemies || []) {
    if (other === e || other.state === 'down') continue;
    const od = Math.hypot(other.x - e.x, other.y - e.y);
    if (od > 0.01 && od < 15) {
      e.x -= ((other.x - e.x) / od) * (15 - od) * 0.5;
      e.y -= ((other.y - e.y) / od) * (15 - od) * 0.5;
    }
  }
}

function updatePickups(state, dt) {
  const p = state.player;
  if (!p) return;
  const pickups = state.pickups || [];
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pk = pickups[i];
    pk.t += dt;
    const reach = p.vehicle ? 27 : 19;
    if (!p.dead && Math.hypot(pk.x - p.x, pk.y - p.y) < reach) {
      if (pk.type === 'money') { p.money += pk.amount; pushNotice(state, `+$${pk.amount}`); }
      else if (pk.type === 'ammo') { p.reserveAmmo += pk.amount; pushNotice(state, `+${pk.amount} rounds`); }
      else if (pk.type === 'health') { p.health = Math.min(p.maxHealth, p.health + pk.amount); pushNotice(state, `+${pk.amount} health`); }
      pickups.splice(i, 1);
    }
  }
}
