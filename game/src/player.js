// player.js — Raka: on-foot movement, car entry/theft, arcade driving,
// collisions, skid marks + tire smoke, damage, death and clinic respawn.
// Other systems hurt Raka through damagePlayer and talk to the HUD
// through pushNotice; crimes are reported into police.js.
import { SEA_X } from './config.js';
import { reportCrime } from './police.js';
import { damagePed } from './traffic.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createPlayer(world) {
  return {
    name: 'Raka',
    x: world.spawn.x, y: world.spawn.y, angle: 0,
    vx: 0, vy: 0, r: 8,
    health: 100, maxHealth: 100,
    money: 120, dead: false, deathTimer: 0, hurtAt: -9, hurtAngle: 0,
    hasPistol: false, ammoInMag: 0, reserveAmmo: 0,
    reloading: 0, attackCd: 0,
    vehicle: null,
  };
}

function obstacles(world) {
  return world.buildings.concat(world.containers);
}

// Push a circle out of every rect it overlaps; reports the last contact.
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

export function pushNotice(state, text, ttl = 3.5) {
  if (!state.notices) state.notices = [];
  state.notices.push({ text, t: ttl });
}

export function damagePlayer(state, amount, angle = 0) {
  const p = state.player;
  if (!p || p.dead || amount <= 0) return;
  p.health -= amount;
  p.hurtAt = state.time || 0;
  p.hurtAngle = angle;
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    p.deathTimer = 2.6;
    if (p.vehicle) p.vehicle.occupied = false;
    pushNotice(state, 'WASTED');
  }
}

function spawnFleeingDriver(state, car) {
  if (!state.peds) state.peds = [];
  state.peds.push({
    x: car.x + 20, y: car.y + 10, r: 6, color: '#c9a27a',
    angle: 0, speed: 52, hp: 30, state: 'flee', fleeT: 2.4,
    fleeFrom: { x: car.x, y: car.y }, wp: null, vx: 0, vy: 0,
  });
}

export function enterVehicle(state, car) {
  const p = state.player;
  if (car.driver) {
    // Occupied car: the driver is thrown out first, so the theft that
    // follows is always witnessed by its victim.
    car.driver = false;
    spawnFleeingDriver(state, car);
    reportCrime(state, 'theft', car.x, car.y);
  } else if (car.police) {
    reportCrime(state, 'theft', car.x, car.y);
  }
  if (car.ai === 'traffic') car.ai = null;
  car.occupied = true;
  car.vx = car.vx || 0;
  car.vy = car.vy || 0;
  p.vehicle = car;
  p.x = car.x;
  p.y = car.y;
}

export function exitVehicle(state) {
  const p = state.player;
  const car = p.vehicle;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 20;
  p.y = car.y + Math.sin(side) * 20;
  const res = resolveCircle(p.x, p.y, p.r, obstacles(state.world));
  p.x = res.x;
  p.y = res.y;
  car.occupied = false;
  p.vehicle = null;
}

function storeNear(world, player, type, range) {
  const s = world.stores.find((s2) => s2.type === type);
  return s && Math.hypot(player.x - s.x, player.y - s.y) < range ? s : null;
}

function tryInteract(state) {
  const p = state.player;
  let best = null, bestD = 46;
  for (const car of state.vehicles || []) {
    if (car === p.vehicle) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best) { enterVehicle(state, best); return; }
  if (storeNear(state.world, p, 'gun', 36)) {
    if (!p.hasPistol) {
      if (p.money >= 250) {
        p.money -= 250;
        p.hasPistol = true;
        p.ammoInMag = 12;
        p.reserveAmmo = 24;
        pushNotice(state, 'Pistol bought — click to shoot, R reloads');
      } else pushNotice(state, 'Gun shop: a pistol costs $250');
    } else if (p.money >= 40) {
      p.money -= 40;
      p.reserveAmmo += 24;
      pushNotice(state, '+24 pistol rounds');
    } else pushNotice(state, 'Gun shop: ammo costs $40');
    return;
  }
  if (storeNear(state.world, p, 'clinic', 36) && p.health < p.maxHealth) {
    const cost = Math.min(30, p.money);
    p.money -= cost;
    p.health = p.maxHealth;
    pushNotice(state, cost > 0 ? `Klinik patched you up for $${cost}` : 'Klinik treated you on credit');
  }
}

export function updatePlayer(state, dt) {
  dt = Math.min(dt, 0.05);
  const p = state.player;
  updateEffects(state, dt);
  if (p.dead) {
    p.deathTimer -= dt;
    if (p.deathTimer <= 0) respawn(state);
    return;
  }
  p.attackCd = Math.max(0, p.attackCd - dt);
  if (p.vehicle) updateDriving(state, dt);
  else updateOnFoot(state, dt);
}

function respawn(state) {
  const p = state.player;
  const clinic = state.world.stores.find((s) => s.type === 'clinic');
  p.x = clinic.x + 34;
  p.y = clinic.y + 30;
  p.vx = 0;
  p.vy = 0;
  p.vehicle = null;
  p.health = p.maxHealth;
  p.dead = false;
  p.money = Math.max(0, p.money - 150);
  if (state.wanted) { state.wanted.heat = 0; state.wanted.bust = 0; }
  pushNotice(state, 'Klinik discharged you — $150 bill');
}

function updateOnFoot(state, dt) {
  const p = state.player, input = state.input, world = state.world;
  const speed = input && input.run ? 208 : 124;
  let mx = input ? input.moveX : 0, my = input ? input.moveY : 0;
  const len = Math.hypot(mx, my) || 1;
  if (mx || my) { mx /= len; my /= len; p.angle = Math.atan2(my, mx); }
  const blend = 1 - Math.exp(-14 * dt);
  p.vx += (mx * speed - p.vx) * blend;
  p.vy += (my * speed - p.vy) * blend;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const res = resolveCircle(p.x, p.y, p.r, obstacles(world));
  p.x = res.x;
  p.y = res.y;
  for (const car of state.vehicles || []) {
    const dx = p.x - car.x, dy = p.y - car.y, d = Math.hypot(dx, dy);
    if (d > 0.01 && d < p.r + 16) {
      p.x = car.x + (dx / d) * (p.r + 16);
      p.y = car.y + (dy / d) * (p.r + 16);
    }
  }
  p.x = clamp(p.x, 10, SEA_X - 6);
  p.y = clamp(p.y, 10, world.height - 10);
  if (input && input.mouse && (input.attackHeld || p.hasPistol)) {
    p.angle = Math.atan2(input.mouse.wy - p.y, input.mouse.wx - p.x);
  }
  if (input && input.interactPressed) tryInteract(state);
}

function updateDriving(state, dt) {
  const p = state.player, input = state.input, world = state.world;
  const car = p.vehicle;
  if (input && input.interactPressed) {
    const spd = Math.hypot(car.vx || 0, car.vy || 0);
    exitVehicle(state);
    if (spd > 150) damagePlayer(state, 8, car.angle);
    return;
  }
  let fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let vf = (car.vx || 0) * fx + (car.vy || 0) * fy;
  let vr = (car.vx || 0) * -fy + (car.vy || 0) * fx;
  const wrecked = car.hp !== undefined && car.hp <= 0;
  const topSpeed = wrecked ? 80 : (car.topSpeed || 305);
  if (input && input.forward) vf += 250 * dt;
  if (input && input.back) vf += vf > 12 ? -400 * dt : -170 * dt;
  vf -= vf * (input && input.handbrake ? 1.1 : 0.32) * dt;
  const steer = input ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  const turnRate = input && input.handbrake ? 2.6 : 1.85;
  if (steer && Math.abs(vf) > 4) {
    car.angle += steer * turnRate * Math.min(1, Math.abs(vf) / 110) * (vf < 0 ? -1 : 1) * dt;
  }
  const grip = input && input.handbrake ? 1.7 : 9;
  vr -= vr * Math.min(1, grip * dt);
  vf = clamp(vf, -115, topSpeed);
  fx = Math.cos(car.angle);
  fy = Math.sin(car.angle);
  car.vx = fx * vf + -fy * vr;
  car.vy = fy * vf + fx * vr;
  car.speed = vf;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const rects = obstacles(world);
  for (const s of [-11, 11]) {
    const px = car.x + fx * s, py = car.y + fy * s;
    const res = resolveCircle(px, py, 13, rects);
    if (res.hit) {
      car.x += res.x - px;
      car.y += res.y - py;
      const into = -(car.vx * res.hit.nx + car.vy * res.hit.ny);
      if (into > 0) {
        car.vx += res.hit.nx * into * 1.25;
        car.vy += res.hit.ny * into * 1.25;
        if (into > 165) {
          car.hp = Math.max(0, (car.hp ?? 100) - (into - 165) / 7);
          damagePlayer(state, Math.min(16, (into - 165) / 9), car.angle);
          addSmoke(state, car.x, car.y, 3);
          state.shake = Math.max(state.shake || 0, 5);
        }
      }
    }
  }
  for (const other of state.vehicles || []) {
    if (other === car) continue;
    const dx = car.x - other.x, dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 31) {
      const push = (31 - d) / 2;
      car.x += (dx / d) * push;
      car.y += (dy / d) * push;
      other.x -= (dx / d) * push;
      other.y -= (dy / d) * push;
      const closing = -(((car.vx - (other.vx || 0)) * dx) + ((car.vy - (other.vy || 0)) * dy)) / d;
      if (closing > 130) {
        const dmg = (closing - 130) / 6;
        car.hp = Math.max(0, (car.hp ?? 100) - dmg);
        other.hp = Math.max(0, (other.hp ?? 100) - dmg);
        if (other.police) reportCrime(state, 'hitPolice', car.x, car.y);
        state.shake = Math.max(state.shake || 0, 4);
      }
      car.vx *= 0.82;
      car.vy *= 0.82;
    }
  }
  const spd = Math.hypot(car.vx, car.vy);
  if (spd > 26) {
    for (const ped of state.peds || []) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 17) {
        damagePed(state, ped, spd > 170 ? 100 : 55, { byPlayer: true, vehicle: true });
        car.vx *= 0.93;
        car.vy *= 0.93;
      }
    }
  }
  const onDock = world.docks.some((d) => car.x > d.x - 8 && car.x < d.x + d.w + 8 && car.y > d.y - 8 && car.y < d.y + d.h + 8);
  if (!onDock && car.x > SEA_X + 2) { car.x = SEA_X + 2; car.vx = Math.min(car.vx, 0); }
  car.x = clamp(car.x, 16, world.width - 16);
  car.y = clamp(car.y, 16, world.height - 16);
  updateTireEffects(state, car, vf, vr, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function updateTireEffects(state, car, vf, vr, dt) {
  if (!state.skidMarks) state.skidMarks = [];
  const input = state.input;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const sliding = Math.abs(vr) > 52 || (input && input.handbrake && Math.abs(vf) > 85);
  for (const s of [-1, 1]) {
    const wx = car.x - fx * 11 + -fy * 8 * s;
    const wy = car.y - fy * 11 + fx * 8 * s;
    const key = s < 0 ? '_skidL' : '_skidR';
    if (sliding && car[key]) {
      state.skidMarks.push({ x1: car[key].x, y1: car[key].y, x2: wx, y2: wy, a: 0.5 });
      if (state.skidMarks.length > 520) state.skidMarks.splice(0, state.skidMarks.length - 520);
    }
    car[key] = { x: wx, y: wy };
  }
  const burningOut = input && input.handbrake && input.forward && Math.abs(vf) < 60;
  if (sliding || burningOut || (car.hp !== undefined && car.hp > 0 && car.hp < 32)) {
    car._smokeCd = (car._smokeCd || 0) - dt;
    if (car._smokeCd <= 0) {
      car._smokeCd = 0.05;
      addSmoke(state, car.x - fx * 13, car.y - fy * 13, 1);
    }
  }
}

export function addSmoke(state, x, y, n) {
  if (!state.effects) state.effects = { smoke: [], flashes: [] };
  if (!state.effects.smoke) state.effects.smoke = [];
  for (let i = 0; i < n; i += 1) {
    state.effects.smoke.push({
      x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 14, vy: -14 - Math.random() * 16,
      t: 0, life: 0.6 + Math.random() * 0.7, size: 3 + Math.random() * 4,
    });
  }
}

function updateEffects(state, dt) {
  if (!state.effects) return;
  const smoke = state.effects.smoke || [];
  for (let i = smoke.length - 1; i >= 0; i -= 1) {
    const s = smoke[i];
    s.t += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.size += 5 * dt;
    if (s.t >= s.life) smoke.splice(i, 1);
  }
  const flashes = state.effects.flashes || [];
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    flashes[i].t += dt;
    if (flashes[i].t >= flashes[i].life) flashes.splice(i, 1);
  }
  if (state.shake) state.shake = Math.max(0, state.shake - 26 * dt);
}
