// player.js — Raka: on-foot movement, driving, interactions, damage.
import { reportCrime } from './police.js';
import { damagePed } from './traffic.js';
import { sfx } from './audio.js';

export function pushNotice(state, text) {
  if (!state.notices) state.notices = [];
  state.notices.push({ text, t: 0, life: 3.4 });
  if (state.notices.length > 5) state.notices.shift();
}

export function circleRectHit(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function hitsSolid(state, x, y, r) {
  const w = state.world;
  for (const b of w.buildings) if (circleRectHit(x, y, r, b)) return true;
  for (const b of w.containers) if (circleRectHit(x, y, r, b)) return true;
  return false;
}

// Axis-separated move with building/container collision; returns impact speed.
export function resolveMove(state, o, dx, dy, r) {
  let impact = 0;
  if (dx !== 0) {
    const nx = o.x + dx;
    if (!hitsSolid(state, nx, o.y, r)) o.x = nx; else impact = Math.max(impact, Math.abs(dx));
  }
  if (dy !== 0) {
    const ny = o.y + dy;
    if (!hitsSolid(state, o.x, ny, r)) o.y = ny; else impact = Math.max(impact, Math.abs(dy));
  }
  o.x = Math.max(r, Math.min(state.world.width - r, o.x));
  o.y = Math.max(r, Math.min(state.world.height - r, o.y));
  return impact;
}

export function createPlayer(state) {
  const s = state.world.spawn;
  state.player = {
    x: s.x, y: s.y, vx: 0, vy: 0, r: 8, face: 0,
    hp: 100, maxHp: 100, money: 120,
    vehicle: null, dead: false, deadTimer: 0,
    hasGun: false, ammo: 0, mag: 12, reloading: 0, fireCd: 0, punchCd: 0,
    speedKmh: 0, sprayTimer: 0, healCd: 0,
  };
  return state.player;
}

export function damagePlayer(state, dmg) {
  const p = state.player;
  if (!p || p.dead || state.mode !== 'play') return;
  p.hp -= dmg;
  sfx(state, 'hit');
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; p.deadTimer = 0;
    pushNotice(state, 'WASTED');
  }
}

function respawn(state) {
  const p = state.player;
  const clinic = state.world.stores.find(s => s.type === 'clinic');
  if (p.vehicle) { p.vehicle.driver = null; p.vehicle = null; }
  p.x = clinic.x; p.y = clinic.y + 26;
  p.vx = 0; p.vy = 0; p.hp = p.maxHp; p.dead = false;
  p.money = Math.max(0, p.money - 150);
  if (state.wanted) { state.wanted.heat = 0; state.wanted.level = 0; state.wanted.bust = 0; }
  pushNotice(state, 'Klinik Karang Bay — biaya $150');
}

function nearestStore(state, type, maxD) {
  const p = state.player;
  const s = state.world.stores.find(v => v.type === type);
  if (!s) return null;
  const d = Math.hypot(p.x - s.x, p.y - s.y);
  return d <= maxD ? s : null;
}

function enterVehicle(state, veh) {
  const p = state.player;
  if (veh.driver && veh.driver !== 'player') {
    // Eject the driver: they become a fleeing ped, then the theft is witnessed.
    const d = veh.driver;
    d.x = veh.x + 22; d.y = veh.y + 10; d.hp = Math.max(d.hp, 20);
    d.fleeT = 2.4; d.dead = false;
    if (!state.peds.includes(d)) state.peds.push(d);
    veh.driver = null;
    p.vehicle = veh; veh.driver = 'player';
    p.x = veh.x; p.y = veh.y;
    reportCrime(state, 'theft', veh.x, veh.y);
    pushNotice(state, 'Mobil curian!');
    return;
  }
  p.vehicle = veh; veh.driver = 'player';
  p.x = veh.x; p.y = veh.y;
}

function exitVehicle(state) {
  const p = state.player;
  const veh = p.vehicle;
  veh.driver = null;
  p.vehicle = null;
  p.x = veh.x + Math.cos(veh.angle + Math.PI / 2) * 18;
  p.y = veh.y + Math.sin(veh.angle + Math.PI / 2) * 18;
  if (hitsSolid(state, p.x, p.y, p.r)) { p.x = veh.x; p.y = veh.y + 20; }
  p.speedKmh = 0;
}

function interact(state) {
  const p = state.player;
  if (p.vehicle) { exitVehicle(state); return; }
  let best = null, bestD = 34;
  for (const v of state.vehicles) {
    if (v.wrecked) continue;
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  if (best) { enterVehicle(state, best); return; }
  const gun = nearestStore(state, 'gun', 36);
  if (gun) {
    if (!p.hasGun) {
      if (p.money >= 250) { p.money -= 250; p.hasGun = true; p.ammo = 36; p.mag = 12; pushNotice(state, 'Pistol dibeli — klik untuk menembak, R reload'); sfx(state, 'cash'); }
      else pushNotice(state, 'Pistol $250 — uang kurang');
    } else if (p.money >= 40) { p.money -= 40; p.ammo += 24; pushNotice(state, 'Amunisi +24'); sfx(state, 'cash'); }
    else pushNotice(state, 'Amunisi $40 — uang kurang');
    return;
  }
  const clinic = nearestStore(state, 'clinic', 36);
  if (clinic) {
    if (p.hp >= p.maxHp) pushNotice(state, 'Klinik — kamu sehat');
    else if (p.money >= 30) { p.money -= 30; p.hp = p.maxHp; pushNotice(state, 'Klinik — sembuh total'); sfx(state, 'cash'); }
    else pushNotice(state, 'Klinik $30 — uang kurang');
    return;
  }
  const safe = nearestStore(state, 'safehouse', 36);
  if (safe && state.wanted && state.wanted.heat > 0) {
    state.wanted.heat = 0; state.wanted.level = 0; state.wanted.contact = false;
    pushNotice(state, 'Safehouse — jejakmu hilang');
  }
}

function updateOnFoot(state, dt) {
  const p = state.player;
  const inp = state.input;
  const speed = inp.run ? 208 : 124;
  const tx = inp.moveX * speed, ty = inp.moveY * speed;
  const k = Math.min(1, dt * 12);
  p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
  if (inp.attackHeld || (p.hasGun && inp.mouse.down)) p.face = Math.atan2(inp.mouse.wy - p.y, inp.mouse.wx - p.x);
  else if (Math.abs(p.vx) + Math.abs(p.vy) > 12) p.face = Math.atan2(p.vy, p.vx);
  resolveMove(state, p, p.vx * dt, 0, p.r);
  resolveMove(state, p, 0, p.vy * dt, p.r);
  // Cars are solid on foot.
  for (const v of state.vehicles) {
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d > 0.01 && d < 24) {
      p.x = v.x + (p.x - v.x) / d * 24;
      p.y = v.y + (p.y - v.y) / d * 24;
    }
  }
  if (p.x > state.world.seaX - 6) p.x = state.world.seaX - 6;
  p.speedKmh = Math.round(Math.hypot(p.vx, p.vy) * 0.32);
  if (inp.interactPressed) interact(state);
}

function updateDriving(state, dt) {
  const p = state.player;
  const veh = p.vehicle;
  const inp = state.input;
  if (typeof veh.speed !== 'number') veh.speed = 0;
  if (typeof veh.vx !== 'number') { veh.vx = 0; veh.vy = 0; }
  if (!veh.wrecked) {
    if (inp.forward) veh.speed += 165 * dt;
    else if (inp.back) veh.speed -= (veh.speed > 4 ? 260 : 95) * dt;
    else veh.speed -= veh.speed * 0.55 * dt;
    if (inp.handbrake) veh.speed -= veh.speed * 1.15 * dt;
    veh.speed = Math.max(-82, Math.min(232, veh.speed));
    const steer = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
    if (steer && Math.abs(veh.speed) > 4) {
      const sf = Math.min(1, Math.abs(veh.speed) / 90);
      veh.angle += steer * 2.35 * sf * dt * Math.sign(veh.speed);
    }
  } else veh.speed = 0;
  const hx = Math.cos(veh.angle), hy = Math.sin(veh.angle);
  const grip = inp.handbrake ? 1.7 : 9;
  veh.vx += (hx * veh.speed - veh.vx) * Math.min(1, grip * dt);
  veh.vy += (hy * veh.speed - veh.vy) * Math.min(1, grip * dt);
  const ox = veh.x, oy = veh.y;
  const impact = resolveMove(state, veh, veh.vx * dt, veh.vy * dt, 15);
  if (impact > 1.2) {
    const dmg = impact * 26;
    veh.hp = (veh.hp ?? 120) - dmg;
    damagePlayer(state, Math.min(16, dmg * 0.32));
    veh.speed *= -0.22; veh.vx *= -0.25; veh.vy *= -0.25;
    if (veh.hp <= 0 && !veh.wrecked) { veh.wrecked = true; pushNotice(state, 'Mobil rusak!'); }
  }
  // Sea wall: docks let you roll a little past the shoreline, open water never.
  const w = state.world;
  const onDock = w.docks.some(d => veh.x > d.x - 4 && veh.x < d.x + d.w && veh.y > d.y - 8 && veh.y < d.y + d.h + 8);
  const maxX = onDock ? w.seaX + 150 : w.seaX - 12;
  if (veh.x > maxX) { veh.x = maxX; veh.vx = Math.min(veh.vx, 0); veh.speed = Math.min(veh.speed, 0); }
  // Car vs car.
  for (const o of state.vehicles) {
    if (o === veh) continue;
    const d = Math.hypot(veh.x - o.x, veh.y - o.y);
    if (d > 0.01 && d < 30) {
      const push = (30 - d) / 2;
      const nx = (veh.x - o.x) / d, ny = (veh.y - o.y) / d;
      veh.x += nx * push; veh.y += ny * push; o.x -= nx * push; o.y -= ny * push;
      const rel = Math.abs(veh.speed);
      if (rel > 55) {
        o.hp = (o.hp ?? 120) - rel * 0.22;
        veh.hp = (veh.hp ?? 120) - rel * 0.12;
        if (o.police) reportCrime(state, 'hitPolice', veh.x, veh.y);
        if (o.hp <= 0) o.wrecked = true;
      }
    }
  }
  // Running down peds.
  if (Math.abs(veh.speed) > 42) {
    for (const ped of [...state.peds, ...state.officers, ...state.enemies]) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - veh.x, ped.y - veh.y) < 16) {
        damagePed(state, ped, 55, { byPlayer: true, vehicle: true, angle: veh.angle });
      }
    }
  }
  // Skid marks + damage smoke.
  const lateral = Math.abs(veh.vx * -hy + veh.vy * hx);
  if ((inp.handbrake && Math.abs(veh.speed) > 55) || lateral > 62) {
    state.skidMarks.push({ x: veh.x - hx * 10, y: veh.y - hy * 10, angle: veh.angle });
    if (state.skidMarks.length > 520) state.skidMarks.splice(0, state.skidMarks.length - 520);
  }
  if (veh.hp < 45 && Math.random() < dt * 7) {
    state.effects.smoke.push({ x: veh.x + hx * 14, y: veh.y + hy * 14, vx: (Math.random() - 0.5) * 12, vy: -22 - Math.random() * 16, t: 0, life: 0.9, r: 4 + Math.random() * 4 });
  }
  p.x = veh.x; p.y = veh.y; p.face = veh.angle;
  p.speedKmh = Math.round(Math.abs(veh.speed) * 0.32);
  if (inp.interactPressed) exitVehicle(state);
}

export function updatePlayer(state, dt) {
  const p = state.player;
  if (!p) return;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = 12 - p.mag;
      const take = Math.min(need, p.ammo);
      p.mag += take; p.ammo -= take;
    }
  }
  if (p.dead) {
    p.deadTimer += dt;
    if (p.deadTimer > 2.2) respawn(state);
    return;
  }
  if (state.dialog) return; // frozen while a dialog panel is up
  if (p.vehicle) updateDriving(state, dt);
  else updateOnFoot(state, dt);
}
