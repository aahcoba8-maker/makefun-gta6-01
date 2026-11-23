// Raka, the player: on-foot movement, store interactions, car entry and
// the arcade driving model. damagePlayer is the single entry point for
// hurting Raka; death means WASTED and a clinic respawn.
import { reportCrime } from './police.js';
import { damagePed } from './traffic.js';
import { audioHurt, audioPickup } from './audio.js';

export function pushNotice(state, text) {
  state.notices.push({ text, t: state.time });
  if (state.notices.length > 5) state.notices.shift();
}

// Push a circle out of every building and container rect in the world.
export function collideCircle(world, x, y, r) {
  let hit = false;
  const solids = world.buildings.concat(world.containers);
  for (const b of solids) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // centre inside the rect: leave through the nearest edge
        const left = x - b.x; const right = b.x + b.w - x;
        const top = y - b.y; const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  return { x, y, hit };
}

export function createPlayer(world) {
  return {
    x: world.spawn.x, y: world.spawn.y, r: 8,
    hp: 100, maxHp: 100, money: 120,
    vehicle: null, aim: 0, dead: false, respawnT: 0,
    hasPistol: false, ammo: 0, mag: 0,
    reloadT: 0, fireT: 0, punchT: 0,
    vx: 0, vy: 0, speedNow: 0, skidT: 0, smokeT: 0,
    color: '#e5ba78',
  };
}

export function damagePlayer(state, dmg, cause = '') {
  const p = state.player;
  if (p.dead || dmg <= 0) return;
  p.hp -= dmg;
  audioHurt(state);
  state.effects.push({ x: p.x, y: p.y - 10, t: 0, max: 0.3, kind: 'flash' });
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    p.respawnT = 3.2;
    if (p.vehicle) {
      p.vehicle.speed = 0;
      state.cars.push(p.vehicle);
      p.vehicle = null;
    }
    state.wanted.bust = 0;
  }
}

function respawn(state) {
  const p = state.player;
  const clinic = state.world.stores.find((s) => s.type === 'clinic');
  p.x = clinic ? clinic.x + 14 : state.world.spawn.x;
  p.y = clinic ? clinic.y + 16 : state.world.spawn.y;
  p.hp = p.maxHp;
  p.dead = false;
  p.money = Math.max(0, p.money - 150);
  state.wanted.heat = 0;
  state.wanted.level = 0;
  state.wanted.bust = 0;
  state.officers = [];
  state.cars = state.cars.filter((c) => !c.police);
  state.heli = null;
  pushNotice(state, 'Kamu sadar di klinik. Biaya $150.');
}

function fleeingDriverPed(state, car, fromX, fromY) {
  const ped = {
    x: car.x + 16, y: car.y + 12, r: 6, color: '#c98d5f',
    hp: 30, dead: false, deadT: 0, role: 'ped',
    axis: 'v', dir: 1, speed: 42, fleeT: 2.4, fleeX: 1, fleeY: 0,
  };
  const d = Math.max(1, Math.hypot(ped.x - fromX, ped.y - fromY));
  ped.fleeX = (ped.x - fromX) / d;
  ped.fleeY = (ped.y - fromY) / d;
  state.peds.push(ped);
}

export function wreckCar(state, car) {
  if (car.wrecked) return;
  car.wrecked = true;
  car.speed = 0;
  if (car.driver) {
    fleeingDriverPed(state, car, car.x - 20, car.y);
    car.driver = null;
  }
  state.effects.push({ x: car.x, y: car.y - 8, t: 0, max: 1, kind: 'smoke' });
}

function enterVehicle(state, car) {
  const p = state.player;
  const idx = state.cars.indexOf(car);
  if (idx >= 0) state.cars.splice(idx, 1);
  if (car.driver) {
    fleeingDriverPed(state, car, p.x, p.y);
    car.driver = null;
    reportCrime(state, 'theft', car.x, car.y);
    pushNotice(state, 'Mobil curian! Pemiliknya kabur.');
  }
  car.ai = false;
  p.vehicle = car;
  p.x = car.x; p.y = car.y;
  p.vx = 0; p.vy = 0;
}

function exitVehicle(state) {
  const p = state.player;
  const car = p.vehicle;
  if (!car) return;
  car.speed = 0;
  state.cars.push(car);
  p.vehicle = null;
  const sx = car.x + Math.cos(car.angle - Math.PI / 2) * 20;
  const sy = car.y + Math.sin(car.angle - Math.PI / 2) * 20;
  const res = collideCircle(state.world, sx, sy, p.r);
  p.x = res.x; p.y = res.y;
}

function buyGun(state) {
  const p = state.player;
  if (!p.hasPistol) {
    if (p.money >= 250) {
      p.money -= 250;
      p.hasPistol = true;
      p.mag = 12;
      p.ammo = 24;
      pushNotice(state, 'Pistol dibeli. Klik mouse untuk menembak.');
    } else pushNotice(state, 'Pistol $250 — uangmu kurang.');
  } else if (p.money >= 40) {
    p.money -= 40;
    p.ammo += 24;
    pushNotice(state, 'Peluru +24.');
  } else pushNotice(state, 'Peluru $40 — uangmu kurang.');
}

function interact(state) {
  const p = state.player;
  let best = null;
  let bd = 42;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) { enterVehicle(state, best); return; }
  for (const s of state.world.stores) {
    if (Math.hypot(s.x - p.x, s.y - p.y) > 48) continue;
    if (s.type === 'gun') { buyGun(state); return; }
    if (s.type === 'clinic') {
      if (p.hp < p.maxHp) {
        if (p.money >= 30) {
          p.money -= 30;
          p.hp = p.maxHp;
          pushNotice(state, 'Luka diobati. Sehat lagi.');
        } else pushNotice(state, 'Klinik butuh $30.');
      } else pushNotice(state, 'Kamu sehat walafiat.');
      return;
    }
    if (s.type === 'safehouse') {
      state.wanted.heat = 0;
      state.wanted.bust = 0;
      state.saveRequested = true;
      pushNotice(state, 'Aman di safehouse. Progres tersimpan.');
      return;
    }
    if (s.type === 'spray') { pushNotice(state, 'Pay-n-Spray hanya melayani mobil.'); return; }
  }
}

function updateOnFoot(state, dt) {
  const p = state.player;
  const inp = state.input;
  const sp = inp.run ? 208 : 124;
  const len = Math.hypot(inp.moveX, inp.moveY) || 1;
  const tx = (inp.moveX / len) * sp;
  const ty = (inp.moveY / len) * sp;
  const k = Math.min(1, dt * 10);
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  const res = collideCircle(state.world, p.x + p.vx * dt, p.y + p.vy * dt, p.r);
  p.x = res.x; p.y = res.y;
  for (const car of state.cars) {
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    const min = p.r + 16;
    if (d > 0 && d < min) {
      p.x = car.x + ((p.x - car.x) / d) * min;
      p.y = car.y + ((p.y - car.y) / d) * min;
    }
  }
  p.x = Math.max(10, Math.min(state.world.seaX - 6, p.x));
  p.y = Math.max(10, Math.min(state.world.height - 10, p.y));
  p.speedNow = Math.hypot(p.vx, p.vy);
  p.aim = Math.atan2(inp.mouse.wy - p.y, inp.mouse.wx - p.x);
  if (inp.interactPressed) interact(state);
}

function updateDriving(state, dt) {
  const p = state.player;
  const car = p.vehicle;
  const inp = state.input;
  if (inp.interactPressed) { exitVehicle(state); return; }
  if (inp.forward) car.speed += 175 * dt;
  else if (inp.back) car.speed -= (car.speed > 5 ? 260 : 120) * dt;
  else car.speed -= car.speed * Math.min(1, dt * 0.7);
  if (inp.handbrake) car.speed -= car.speed * Math.min(1, dt * 2.2);
  car.speed = Math.max(-95, Math.min(265, car.speed));
  const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const grip = Math.max(-1.6, Math.min(1.6, car.speed / 55));
  car.angle += steer * dt * grip * 0.9 * (inp.handbrake ? 1.45 : 1);
  let nx = car.x + Math.cos(car.angle) * car.speed * dt;
  let ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const onDock = state.world.docks.some((d) =>
    nx > d.x - 4 && nx < d.x + d.w && ny > d.y - 4 && ny < d.y + d.h);
  const maxX = onDock ? state.world.seaX + 192 : state.world.seaX - 14;
  nx = Math.max(16, Math.min(maxX, nx));
  ny = Math.max(16, Math.min(state.world.height - 16, ny));
  const res = collideCircle(state.world, nx, ny, 15);
  if (res.hit && Math.abs(car.speed) > 110) {
    car.hp -= (Math.abs(car.speed) - 110) * 0.14;
    state.effects.push({ x: car.x, y: car.y, t: 0, max: 0.4, kind: 'spark' });
    if (car.hp <= 35) reportCrime(state, 'cardamage', car.x, car.y);
  }
  if (res.hit) car.speed *= -0.22;
  car.x = res.x; car.y = res.y;
  for (const other of state.cars) {
    const d = Math.hypot(car.x - other.x, car.y - other.y);
    if (d > 0 && d < 31) {
      const push = (31 - d) / 2;
      const ux = (car.x - other.x) / d;
      const uy = (car.y - other.y) / d;
      car.x += ux * push; car.y += uy * push;
      other.x -= ux * push; other.y -= uy * push;
      const impact = Math.abs(car.speed);
      if (impact > 60) {
        other.hp -= impact * 0.08;
        car.hp -= impact * 0.05;
        if (other.hp <= 0) wreckCar(state, other);
      }
      car.speed *= 0.55;
    }
  }
  if (Math.abs(car.speed) > 25) {
    for (const ped of state.peds) {
      if (!ped.dead && Math.hypot(ped.x - car.x, ped.y - car.y) < 16) {
        damagePed(state, ped, 100, { byPlayer: true, kind: 'hitrun' });
      }
    }
    for (const e of state.enemies) {
      if (!e.dead && Math.hypot(e.x - car.x, e.y - car.y) < 16) {
        e.hp -= 100;
        reportCrime(state, 'hitrun', e.x, e.y);
      }
    }
    for (const o of state.officers) {
      if (!o.dead && Math.hypot(o.x - car.x, o.y - car.y) < 16) {
        o.hp -= 100;
        if (o.hp <= 0) o.dead = true;
        reportCrime(state, 'hitrun', o.x, o.y);
      }
    }
  }
  p.skidT -= dt;
  const drifting = inp.handbrake && Math.abs(car.speed) > 90;
  if ((drifting || (steer !== 0 && Math.abs(car.speed) > 170)) && p.skidT <= 0) {
    p.skidT = 0.03;
    const bx = car.x - Math.cos(car.angle) * 10;
    const by = car.y - Math.sin(car.angle) * 10;
    const ox = Math.cos(car.angle + Math.PI / 2) * 8;
    const oy = Math.sin(car.angle + Math.PI / 2) * 8;
    state.skids.push({ x: bx + ox, y: by + oy, angle: car.angle, t: 0 });
    state.skids.push({ x: bx - ox, y: by - oy, angle: car.angle, t: 0 });
    if (state.skids.length > 520) state.skids.splice(0, state.skids.length - 520);
  }
  p.smokeT -= dt;
  if (car.hp < 45 && p.smokeT <= 0) {
    p.smokeT = 0.12;
    state.effects.push({ x: car.x, y: car.y - 6, t: 0, max: 0.9, kind: 'smoke' });
  }
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true;
    pushNotice(state, 'Mobilmu hancur! Cari kendaraan lain.');
  }
  if (car.wrecked) car.speed = 0;
  p.x = car.x; p.y = car.y;
  p.speedNow = Math.abs(car.speed);
  p.aim = Math.atan2(inp.mouse.wy - p.y, inp.mouse.wx - p.x);
}

export function updatePlayer(state, dt) {
  const p = state.player;
  if (p.dead) {
    p.respawnT -= dt;
    if (p.respawnT <= 0) respawn(state);
    return;
  }
  if (p.vehicle) updateDriving(state, dt);
  else updateOnFoot(state, dt);
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 18) {
      pk.taken = true;
      p.money += pk.amount;
      pushNotice(state, `+$${pk.amount}`);
      audioPickup(state);
    }
  }
  if (state.pickups.some((pk) => pk.taken)) {
    state.pickups = state.pickups.filter((pk) => !pk.taken);
  }
}
