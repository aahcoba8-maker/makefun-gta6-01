// Combat for Karang Bay: Raka's pistol and fists, Bara's rival crew,
// explosive barrels with chain reactions, and every bullet in the world.
import { SEA_X, TILE } from './config.js';
import { damagePed } from './traffic.js';
import { reportCrime } from './police.js';
import { collideCircle, damagePlayer, pushNotice, wreckCar } from './player.js';
import { audioBoom, audioShot } from './audio.js';

function makeCrew(x, y, weapon, role) {
  return {
    x, y, r: 6, home: { x, y },
    color: role === 'bara' ? '#2f2a33' : '#7a2e2e',
    hp: role === 'bara' ? 280 : 70,
    dead: false, role, weapon,
    attackT: 0, shootT: 1,
  };
}

export function initCombat(state) {
  state.enemies = [];
  const pasar = [
    [17, 7, 'fist'], [19, 9, 'pistol'], [16, 10, 'fist'],
    [20, 6, 'pistol'], [18, 12, 'fist'],
  ];
  for (const [tx, ty, w] of pasar) {
    state.enemies.push(makeCrew(tx * TILE + 24, ty * TILE + 24, w, 'crew'));
  }
  const port = [
    [SEA_X - 120, 330, 'pistol'], [SEA_X - 170, 430, 'fist'], [SEA_X - 90, 520, 'pistol'],
  ];
  for (const [x, y, w] of port) state.enemies.push(makeCrew(x, y, w, 'crew'));
  state.enemies.push(makeCrew(19 * TILE + 24, 8 * TILE + 24, 'pistol', 'bara'));
  state.barrels = [];
  const barrelSpots = [
    [SEA_X - 150, 150], [SEA_X - 60, 260], [SEA_X - 180, 470], [SEA_X - 40, 560],
    [850, 215], [886, 262],
    [1378, 935], [1410, 985],
    [16 * TILE + 10, 5 * TILE + 10], [22 * TILE + 10, 9 * TILE + 10],
    [SEA_X + 30, 190], [SEA_X + 20, 525],
  ];
  for (const [x, y] of barrelSpots) {
    state.barrels.push({ x, y, r: 9, hp: 20, dead: false });
  }
}

export function damageEnemy(state, e, dmg, opts = {}) {
  if (e.dead) return;
  e.hp -= dmg;
  if (opts.knock) { e.x += opts.knock.x; e.y += opts.knock.y; }
  if (opts.byPlayer) {
    reportCrime(state, e.hp <= 0 ? 'murder' : 'assault', e.x, e.y);
  }
}

function queueBoom(state, x, y, delay) {
  state.pendingBooms.push({ x, y, t: delay, done: false });
}

export function explodeBarrel(state, barrel) {
  if (barrel.dead) return;
  barrel.dead = true;
  queueBoom(state, barrel.x, barrel.y, 0.05);
  audioBoom(state);
  reportCrime(state, 'explosion', barrel.x, barrel.y);
}

function applyExplosion(state, x, y) {
  state.effects.push({ x, y, t: 0, max: 0.45, kind: 'ring' });
  state.effects.push({ x, y, t: 0, max: 0.3, kind: 'flash' });
  const hurt = (ex, ey) => {
    const d = Math.hypot(ex - x, ey - y);
    return d < 96 ? Math.round(90 * (1 - d / 96) + 10) : 0;
  };
  for (const ped of state.peds) {
    const dmg = hurt(ped.x, ped.y);
    if (dmg) damagePed(state, ped, dmg, {});
  }
  for (const e of state.enemies) {
    const dmg = hurt(e.x, e.y);
    if (dmg) damageEnemy(state, e, dmg, {});
  }
  for (const o of state.officers) {
    const dmg = hurt(o.x, o.y);
    if (dmg) { o.hp -= dmg; if (o.hp <= 0) o.dead = true; }
  }
  const p = state.player;
  if (p.vehicle) {
    const dmg = hurt(p.vehicle.x, p.vehicle.y);
    if (dmg) {
      p.vehicle.hp -= dmg;
      if (p.vehicle.hp <= 0) wreckCar(state, p.vehicle);
      damagePlayer(state, Math.round(dmg * 0.4), 'explosion');
    }
  } else {
    const dmg = hurt(p.x, p.y);
    if (dmg) damagePlayer(state, dmg, 'explosion');
  }
  for (const car of state.cars) {
    const dmg = hurt(car.x, car.y);
    if (dmg) {
      car.hp -= dmg;
      if (car.hp <= 0) wreckCar(state, car);
    }
  }
  for (const b of state.barrels) {
    if (b.dead) continue;
    const dmg = hurt(b.x, b.y);
    if (dmg) {
      b.hp -= 70;
      if (b.hp <= 0) { b.dead = true; queueBoom(state, b.x, b.y, 0.14); }
    }
  }
}

function processBooms(state, dt) {
  for (const pb of state.pendingBooms) {
    if (pb.done) continue;
    pb.t -= dt;
    if (pb.t <= 0) {
      pb.done = true;
      applyExplosion(state, pb.x, pb.y);
    }
  }
  if (state.pendingBooms.some((pb) => pb.done)) {
    state.pendingBooms = state.pendingBooms.filter((pb) => !pb.done);
  }
}

function playerAttack(state, dt) {
  const p = state.player;
  const inp = state.input;
  p.fireT -= dt;
  p.punchT -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const take = Math.min(12 - p.mag, p.ammo);
      p.mag += take;
      p.ammo -= take;
    }
  }
  if (inp.reloadPressed && p.hasPistol && p.mag < 12 && p.ammo > 0 && p.reloadT <= 0) {
    p.reloadT = 1.1;
  }
  const want = inp.mouse.down || inp.attackPressed;
  if (!want || p.vehicle || p.dead) return;
  if (p.hasPistol && p.mag > 0 && p.fireT <= 0 && p.reloadT <= 0) {
    p.fireT = 0.22;
    p.mag -= 1;
    const a = p.aim;
    state.bullets.push({
      x: p.x + Math.cos(a) * 11, y: p.y + Math.sin(a) * 11,
      vx: Math.cos(a) * 760, vy: Math.sin(a) * 760,
      from: 'player', dmg: 34, dist: 0,
    });
    audioShot(state);
    reportCrime(state, 'shooting', p.x, p.y);
    if (p.mag === 0 && p.ammo > 0) p.reloadT = 1.1;
    return;
  }
  const unarmed = !p.hasPistol || (p.mag === 0 && p.ammo === 0 && p.reloadT <= 0);
  if (unarmed && p.punchT <= 0) {
    p.punchT = 0.35;
    const reach = (t) => {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > 42) return false;
      let diff = Math.atan2(t.y - p.y, t.x - p.x) - p.aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) < 1.15;
    };
    const knock = { x: Math.cos(p.aim) * 7, y: Math.sin(p.aim) * 7 };
    for (const ped of state.peds) {
      if (!ped.dead && reach(ped)) damagePed(state, ped, 30, { byPlayer: true, knock });
    }
    for (const e of state.enemies) {
      if (!e.dead && reach(e)) damageEnemy(state, e, 30, { byPlayer: true, knock });
    }
    for (const o of state.officers) {
      if (!o.dead && reach(o)) {
        o.hp -= 30;
        o.x += knock.x; o.y += knock.y;
        if (o.hp <= 0) o.dead = true;
        reportCrime(state, 'assault', o.x, o.y);
      }
    }
  }
}

function crewAI(state, dt) {
  const p = state.player;
  const px = p.vehicle ? p.vehicle.x : p.x;
  const py = p.vehicle ? p.vehicle.y : p.y;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const homeD = Math.hypot(px - e.home.x, py - e.home.y);
    const d = Math.hypot(px - e.x, py - e.y);
    const aggro = !p.dead && homeD < 215;
    let tx = e.home.x;
    let ty = e.home.y;
    let speed = 60;
    if (aggro) {
      tx = px; ty = py;
      speed = e.role === 'bara' ? 112 : 98;
      if (e.weapon === 'pistol') {
        if (d < 90) { tx = e.x + (e.x - px); ty = e.y + (e.y - py); }
        else if (d <= 175) { tx = e.x; ty = e.y; }
      }
    }
    const td = Math.hypot(tx - e.x, ty - e.y);
    if (td > 4) {
      const step = Math.min(td, speed * dt);
      const res = collideCircle(state.world, e.x + ((tx - e.x) / td) * step, e.y + ((ty - e.y) / td) * step, e.r);
      e.x = res.x; e.y = res.y;
    }
    if (!aggro || p.dead) continue;
    if (e.weapon === 'fist' && d < 25) {
      e.attackT -= dt;
      if (e.attackT <= 0) {
        e.attackT = 0.9;
        damagePlayer(state, 7, 'crew');
      }
    }
    if (e.weapon === 'pistol' && d < 190 && d > 40) {
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 1.6;
        const ang = Math.atan2(py - e.y, px - e.x) + (state.rand.next() - 0.5) * 0.16;
        state.bullets.push({
          x: e.x + Math.cos(ang) * 9, y: e.y + Math.sin(ang) * 9,
          vx: Math.cos(ang) * 640, vy: Math.sin(ang) * 640,
          from: 'enemy', dmg: 7, dist: 0,
        });
        audioShot(state);
      }
    }
  }
  // deaths become drops exactly once
  for (const e of state.enemies) {
    if (!e.dead && e.hp <= 0) {
      e.dead = true;
      const amount = e.role === 'bara' ? 400 : 20 + state.rand.int(0, 40);
      state.pickups.push({ x: e.x, y: e.y, amount, kind: 'money', taken: false });
      if (e.role === 'bara') {
        pushNotice(state, "Bara tumbang! Mara: 'Kerja bagus, Raka.'");
      }
    }
  }
}

export function updateBullets(state, dt) {
  const solids = state.world.buildings.concat(state.world.containers);
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.dist += Math.hypot(b.vx, b.vy) * dt;
    if (b.dist > 720 || b.x < 0 || b.y < 0 ||
        b.x > state.world.width || b.y > state.world.height) {
      b.dead = true;
      continue;
    }
    for (const s of solids) {
      if (b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h) {
        b.dead = true;
        state.effects.push({ x: b.x, y: b.y, t: 0, max: 0.25, kind: 'spark' });
        break;
      }
    }
    if (b.dead) continue;
    for (const barrel of state.barrels) {
      if (!barrel.dead && Math.hypot(barrel.x - b.x, barrel.y - b.y) < 11) {
        b.dead = true;
        barrel.hp -= b.dmg;
        if (barrel.hp <= 0) explodeBarrel(state, barrel);
        break;
      }
    }
    if (b.dead) continue;
    if (b.from === 'player') {
      let hit = false;
      for (const ped of state.peds) {
        if (!ped.dead && Math.hypot(ped.x - b.x, ped.y - b.y) < ped.r + 2) {
          damagePed(state, ped, b.dmg, {});
          hit = true; break;
        }
      }
      if (!hit) {
        for (const e of state.enemies) {
          if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 2) {
            damageEnemy(state, e, b.dmg, {});
            hit = true; break;
          }
        }
      }
      if (!hit) {
        for (const o of state.officers) {
          if (!o.dead && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 2) {
            o.hp -= b.dmg;
            if (o.hp <= 0) o.dead = true;
            hit = true; break;
          }
        }
      }
      if (!hit) {
        for (const car of state.cars) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < 17) {
            car.hp -= b.dmg;
            if (car.hp <= 0) wreckCar(state, car);
            hit = true; break;
          }
        }
      }
      if (hit) b.dead = true;
    } else if (!p.dead) {
      const tx = p.vehicle ? p.vehicle.x : p.x;
      const ty = p.vehicle ? p.vehicle.y : p.y;
      const rr = p.vehicle ? 17 : p.r + 2;
      if (Math.hypot(tx - b.x, ty - b.y) < rr) {
        b.dead = true;
        if (p.vehicle) {
          p.vehicle.hp -= b.dmg;
          if (p.vehicle.hp <= 0) wreckCar(state, p.vehicle);
          damagePlayer(state, Math.round(b.dmg * 0.4), 'shot');
        } else {
          damagePlayer(state, b.dmg, 'shot');
        }
      }
    }
  }
  if (state.bullets.some((b) => b.dead)) {
    state.bullets = state.bullets.filter((b) => !b.dead);
  }
}

export function updateCombat(state, dt) {
  playerAttack(state, dt);
  crewAI(state, dt);
  processBooms(state, dt);
  updateBullets(state, dt);
}
