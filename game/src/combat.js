// combat.js — player attacks, rival crew turf AI, explosive barrels,
// and resolution of every bullet in the world.
import { TILE } from './config.js';
import { rng } from './random.js';
import { reportCrime } from './police.js';
import { damagePed } from './traffic.js';
import { circleRectHit, damagePlayer, pushNotice, resolveMove } from './player.js';
import { sfx } from './audio.js';

const CREW_SPOTS = [
  { x: 16.5 * TILE, y: 9.5 * TILE, gun: false }, { x: 19 * TILE, y: 11 * TILE, gun: true },
  { x: 21 * TILE, y: 8.5 * TILE, gun: false }, { x: 17.5 * TILE, y: 12 * TILE, gun: true },
];
export function createCombat(state) {
  const r = rng(state.seed * 13 + 5);
  state.bullets = state.bullets || [];
  state.pickups = state.pickups || [];
  state.pendingBooms = state.pendingBooms || [];
  state.enemies = [];
  const seaX = state.world.seaX;
  const spots = [...CREW_SPOTS,
    { x: seaX - 210, y: 150, gun: true }, { x: seaX - 150, y: 330, gun: false },
    { x: seaX - 230, y: 480, gun: false }, { x: seaX - 120, y: 560, gun: true }];
  spots.forEach((s, i) => {
    state.enemies.push({
      x: s.x, y: s.y, r: 6, hp: 55, color: '#7a3038', kind: 'enemy',
      weapon: s.gun ? 'gun' : 'fist', home: { x: s.x, y: s.y },
      dead: false, corpseT: 0, fleeT: 0, atkCd: 0, shotCd: 1 + r.next(), dropped: false,
      seed: r.int(1, 99999),
    });
  });
  state.enemies.push({
    x: 19.5 * TILE, y: 9 * TILE, r: 7, hp: 280, color: '#3d1f26', kind: 'bara', name: 'Bara',
    weapon: 'gun', home: { x: 19.5 * TILE, y: 9 * TILE },
    dead: false, corpseT: 0, fleeT: 0, atkCd: 0, shotCd: 0.8, dropped: false, seed: 777,
  });
  state.barrels = [];
  const barrelAt = (x, y) => state.barrels.push({ x, y, hp: 20, dead: false, byPlayer: false });
  barrelAt(seaX - 170, 130); barrelAt(seaX - 128, 214); barrelAt(seaX - 92, 296);
  barrelAt(850, 264); barrelAt(1378, 984); barrelAt(1042, 888);
  barrelAt(800, 502); barrelAt(950, 562); barrelAt(1250, 300);
  barrelAt(1300, 382); barrelAt(900, 1002); barrelAt(1560, 1150);
  return state;
}

function startReload(state) {
  const p = state.player;
  if (p.reloading <= 0 && p.mag < 12 && p.ammo > 0) {
    p.reloading = 1.1;
    pushNotice(state, 'Reload…');
  }
}

function playerAttack(state) {
  const p = state.player;
  const inp = state.input;
  if (p.vehicle || p.dead) return;
  if (inp.reloadPressed) startReload(state);
  if (p.hasGun) {
    if (inp.attackHeld && p.fireCd <= 0 && p.reloading <= 0) {
      if (p.mag <= 0) { startReload(state); p.fireCd = 0.3; return; }
      p.mag -= 1; p.fireCd = 0.22;
      const ang = Math.atan2(inp.mouse.wy - p.y, inp.mouse.wx - p.x);
      p.face = ang;
      state.bullets.push({ x: p.x + Math.cos(ang) * 10, y: p.y + Math.sin(ang) * 10, vx: Math.cos(ang) * 760, vy: Math.sin(ang) * 760, from: 'player', dmg: 34, life: 0.85 });
      state.effects.flashes.push({ x: p.x + Math.cos(ang) * 14, y: p.y + Math.sin(ang) * 14, t: 0, life: 0.06, r: 7 });
      reportCrime(state, 'shooting', p.x, p.y);
      sfx(state, 'shot');
      if (p.mag === 0) startReload(state);
    }
    return;
  }
  if (inp.attackPressed && p.punchCd <= 0) {
    p.punchCd = 0.34;
    const targets = [...state.enemies, ...state.officers, ...state.peds];
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > 42) continue;
      let diff = Math.atan2(t.y - p.y, t.x - p.x) - p.face;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 1.15) damagePed(state, t, 30, { byPlayer: true, angle: p.face });
    }
    for (const b of state.barrels) {
      if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < 42) hurtBarrel(state, b, 30, true);
    }
    sfx(state, 'hit');
  }
}

export function hurtBarrel(state, b, dmg, byPlayer) {
  if (b.dead) return;
  b.hp -= dmg;
  if (byPlayer) b.byPlayer = true;
  if (b.hp <= 0) explodeBarrel(state, b);
}

export function explodeBarrel(state, b) {
  if (b.dead) return;
  b.dead = true;
  sfx(state, 'boom');
  state.effects.flashes.push({ x: b.x, y: b.y, t: 0, life: 0.22, r: 46 });
  for (let i = 0; i < 7; i++) {
    state.effects.smoke.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 40, vy: -18 - Math.random() * 30, t: 0, life: 1.1, r: 6 + Math.random() * 6 });
  }
  const hurt = (t, isPlayer) => {
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d >= 96) return;
    const dmg = Math.round(64 * (1 - d / 96) + 8);
    if (isPlayer) damagePlayer(state, dmg);
    else damagePed(state, t, dmg, { byPlayer: b.byPlayer, angle: Math.atan2(t.y - b.y, t.x - b.x) });
  };
  hurt(state.player, true);
  for (const t of [...state.peds, ...state.officers, ...state.enemies]) if (!t.dead) hurt(t, false);
  for (const v of state.vehicles) {
    const d = Math.hypot(v.x - b.x, v.y - b.y);
    if (d < 96) { v.hp -= Math.round(64 * (1 - d / 96) + 8); if (v.hp <= 0) v.wrecked = true; }
  }
  for (const o of state.barrels) {
    if (o !== b && !o.dead && Math.hypot(o.x - b.x, o.y - b.y) < 96) {
      o.byPlayer = o.byPlayer || b.byPlayer;
      state.pendingBooms.push({ barrel: o, t: 0.13 });
    }
  }
  if (b.byPlayer) reportCrime(state, 'explosion', b.x, b.y);
}

function dropLoot(state, e) {
  const r = rng(e.seed + 31);
  if (e.kind === 'bara') {
    state.pickups.push({ x: e.x, y: e.y, kind: 'money', amount: 400 });
    pushNotice(state, 'Mara: "Bara tumbang? Itu baru namanya Karang Bay, Raka."');
    return;
  }
  state.pickups.push({ x: e.x, y: e.y, kind: 'money', amount: r.int(25, 60) });
  const roll = r.next();
  if (roll < 0.3) state.pickups.push({ x: e.x + 12, y: e.y + 6, kind: 'ammo', amount: 12 });
  else if (roll < 0.5) state.pickups.push({ x: e.x + 12, y: e.y + 6, kind: 'health', amount: 25 });
}

function updateEnemy(state, e, dt) {
  if (e.dead) { e.corpseT -= dt; if (!e.dropped) { e.dropped = true; dropLoot(state, e); } return; }
  const p = state.player;
  e.atkCd -= dt; e.shotCd -= dt;
  const dHome = Math.hypot(p.x - e.home.x, p.y - e.home.y);
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  const aggro = !p.dead && (dHome < 215 || d < 110) && state.mode === 'play';
  if (!aggro) {
    // Drift back home and hold the turf.
    if (Math.hypot(e.x - e.home.x, e.y - e.home.y) > 14) {
      const dx = e.home.x - e.x, dy = e.home.y - e.y, dd = Math.hypot(dx, dy) || 1;
      resolveMove(state, e, (dx / dd) * 60 * dt, (dy / dd) * 60 * dt, e.r);
    }
    return;
  }
  const want = e.weapon === 'gun' ? 150 : 20;
  if (d > want + 8) {
    const dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
    resolveMove(state, e, dx * 128 * dt, dy * 128 * dt, e.r);
  } else if (e.weapon === 'gun' && d < 92) {
    const dx = (e.x - p.x) / (d || 1), dy = (e.y - p.y) / (d || 1);
    resolveMove(state, e, dx * 90 * dt, dy * 90 * dt, e.r);
  }
  if (e.weapon === 'fist' && d < 24 && e.atkCd <= 0) {
    e.atkCd = 0.8;
    damagePlayer(state, 8);
  }
  if (e.weapon === 'gun' && d < 300 && e.shotCd <= 0) {
    e.shotCd = 1.3;
    const r = rng(e.seed + Math.floor(state.time * 5));
    const ang = Math.atan2(p.y - e.y, p.x - e.x) + (r.next() - 0.5) * 0.16;
    state.bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 680, vy: Math.sin(ang) * 680, from: 'enemy', dmg: 6, life: 0.6 });
    sfx(state, 'shot');
  }
  // Enemies smash a driven player car at close range.
  if (p.vehicle && d < 26 && e.atkCd <= 0) { e.atkCd = 0.9; p.vehicle.hp -= 6; }
}

export function updateCombat(state, dt) {
  playerAttack(state);
  for (const e of state.enemies) updateEnemy(state, e, dt);
  state.enemies = state.enemies.filter(e => !(e.dead && e.corpseT <= -4));
  for (const pb of state.pendingBooms) pb.t -= dt;
  const ready = state.pendingBooms.filter(pb => pb.t <= 0);
  state.pendingBooms = state.pendingBooms.filter(pb => pb.t > 0);
  for (const pb of ready) explodeBarrel(state, pb.barrel);
  // Pickups.
  const p = state.player;
  if (!p.dead) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const ref = p.vehicle || p;
      if (Math.hypot(ref.x - pk.x, ref.y - pk.y) < 17) {
        pk.taken = true;
        if (pk.kind === 'money') { p.money += pk.amount; pushNotice(state, `+$${pk.amount}`); sfx(state, 'cash'); }
        else if (pk.kind === 'ammo') { p.ammo += pk.amount; pushNotice(state, `Amunisi +${pk.amount}`); sfx(state, 'pickup'); }
        else if (pk.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + pk.amount); pushNotice(state, `+${pk.amount} HP`); sfx(state, 'pickup'); }
      }
    }
    state.pickups = state.pickups.filter(pk => !pk.taken);
  }
}

export function updateBullets(state, dt) {
  const solids = [...state.world.buildings, ...state.world.containers];
  const keep = [];
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    let dead = false;
    for (const s of solids) if (circleRectHit(b.x, b.y, 2, s)) { dead = true; break; }
    if (dead) continue;
    for (const bar of state.barrels) {
      if (!bar.dead && Math.hypot(bar.x - b.x, bar.y - b.y) < 12) {
        hurtBarrel(state, bar, b.dmg, b.from === 'player');
        dead = true; break;
      }
    }
    if (dead) continue;
    if (b.from === 'player') {
      const targets = [...state.enemies, ...state.officers, ...state.peds];
      for (const t of targets) {
        if (!t.dead && Math.hypot(t.x - b.x, t.y - b.y) < t.r + 3) {
          damagePed(state, t, b.dmg, { byPlayer: true, angle: Math.atan2(b.vy, b.vx) });
          dead = true; break;
        }
      }
      if (dead) continue;
    } else {
      const p = state.player;
      const ref = p.vehicle || p;
      if (!p.dead && Math.hypot(ref.x - b.x, ref.y - b.y) < 13) {
        damagePlayer(state, b.dmg);
        continue;
      }
    }
    keep.push(b);
  }
  state.bullets = keep;
}
