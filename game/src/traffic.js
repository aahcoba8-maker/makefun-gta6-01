// traffic.js — AI traffic on the road grid and pedestrians on the
// sidewalks of Karang Bay. Cars drive right-hand lanes between the
// ROAD_X / ROAD_Y intersections, stop at red lights and behind other
// vehicles, and brake for pedestrians. Pedestrians stroll the sidewalks
// and flee from fresh crime alerts (state.alerts, fed by police.js).
import { ROAD_X, ROAD_Y, SEA_X, TILE, WORLD } from './config.js';
import { rng } from './random.js';
import { reportCrime } from './police.js';

const ROAD_W = TILE * 0.72;
const CENTER = ROAD_W / 2;
const LANE = 8.6;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CAR_COLORS = ['#b85145', '#4f7fa8', '#c9a227', '#5d8a66', '#8d6ba8', '#c7c9cc', '#37474f', '#d97b3f'];
const PED_COLORS = ['#d96f4e', '#4e79d9', '#53a06a', '#c9b458', '#9a6fc0', '#d98cb3', '#5fb3b0', '#e0e4e8'];
const decisionRng = rng(90210);

const roadCenterX = (i) => ROAD_X[i] * TILE + CENTER;
const roadCenterY = (j) => ROAD_Y[j] * TILE + CENTER;
// Right-hand lane centres: dir +1 heads south on vertical roads, east
// on horizontal ones.
const laneX = (i, dir) => roadCenterX(i) + (dir > 0 ? -LANE : LANE);
const laneY = (j, dir) => roadCenterY(j) + (dir > 0 ? LANE : -LANE);

export function lightGreen(axis, i, j, time) {
  const phase = Math.floor(time / 6 + i * 3 + j * 7) % 2;
  return axis === 'v' ? phase === 0 : phase === 1;
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

export function createTraffic(state, opts = {}) {
  const random = rng((state.world ? state.world.seed : 1) + 4242);
  if (!state.vehicles) state.vehicles = [];
  if (!state.peds) state.peds = [];
  const carCount = opts.cars ?? 14;
  const pedCount = opts.peds ?? 24;
  for (let n = 0; n < carCount; n += 1) state.vehicles.push(spawnCar(random));
  for (let n = 0; n < pedCount; n += 1) state.peds.push(spawnPed(random));
  return state;
}

function spawnCar(random) {
  const axis = random.next() < 0.5 ? 'v' : 'h';
  const roadIdx = axis === 'v' ? random.int(0, ROAD_X.length - 1) : random.int(0, ROAD_Y.length - 1);
  const dir = random.next() < 0.5 ? 1 : -1;
  const car = {
    x: 0, y: 0, angle: 0, w: 34, h: 19,
    color: random.pick(CAR_COLORS),
    speed: 0, vx: 0, vy: 0, cruise: 82 + random.next() * 52,
    hp: 100, ai: 'traffic', driver: true, occupied: false,
    axis, roadIdx, dir, crossIdx: 0, wp: [],
  };
  if (axis === 'v') {
    const lo = roadCenterY(0), hi = roadCenterY(ROAD_Y.length - 1);
    car.x = laneX(roadIdx, dir);
    car.y = lo + random.next() * (hi - lo);
    car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const lo = roadCenterX(0), hi = roadCenterX(ROAD_X.length - 1);
    car.y = laneY(roadIdx, dir);
    car.x = lo + random.next() * (hi - lo);
    car.angle = dir > 0 ? 0 : Math.PI;
  }
  planLeg(car, false);
  return car;
}

function nextCrossIndex(car) {
  const arr = car.axis === 'v' ? ROAD_Y : ROAD_X;
  const pos = car.axis === 'v' ? car.y : car.x;
  for (let i = 0; i < arr.length; i += 1) {
    if ((arr[i] * TILE + CENTER - pos) * car.dir > 16) return i;
  }
  return -1;
}

// Append the far waypoint of the current leg; flip direction at the
// end of a road so the car U-turns onto the opposite lane.
function planLeg(car, keepWp) {
  if (!keepWp) car.wp.length = 0;
  let cross = nextCrossIndex(car);
  if (cross === -1) {
    car.dir *= -1;
    cross = nextCrossIndex(car);
    if (cross === -1) cross = car.axis === 'v' ? (car.dir > 0 ? ROAD_Y.length - 1 : 0) : (car.dir > 0 ? ROAD_X.length - 1 : 0);
  }
  car.crossIdx = cross;
  if (car.axis === 'v') car.wp.push({ x: laneX(car.roadIdx, car.dir), y: roadCenterY(cross) });
  else car.wp.push({ x: roadCenterX(cross), y: laneY(car.roadIdx, car.dir) });
}

function decideNext(car) {
  const atCol = car.axis === 'v' ? car.roadIdx : car.crossIdx;
  const atRow = car.axis === 'v' ? car.crossIdx : car.roadIdx;
  const straightIdx = (car.axis === 'v' ? atRow : atCol) + car.dir;
  const straightMax = car.axis === 'v' ? ROAD_Y.length - 1 : ROAD_X.length - 1;
  const options = [];
  if (straightIdx >= 0 && straightIdx <= straightMax) options.push({ kind: 'straight', w: 5 });
  options.push({ kind: 'turn', dir: 1, w: 2.5 }, { kind: 'turn', dir: -1, w: 2.5 });
  if (!options.length) options.push({ kind: 'uturn', w: 1 });
  let total = 0;
  for (const o of options) total += o.w;
  let roll = decisionRng.next() * total;
  let choice = options[options.length - 1];
  for (const o of options) { roll -= o.w; if (roll <= 0) { choice = o; break; } }
  if (choice.kind === 'straight') { planLeg(car, false); return; }
  if (choice.kind === 'uturn') { car.dir *= -1; planLeg(car, false); return; }
  const cx = roadCenterX(atCol), cy = roadCenterY(atRow);
  if (car.axis === 'v') {
    car.axis = 'h';
    car.roadIdx = atRow;
    car.dir = choice.dir;
    car.wp.push({ x: cx, y: cy });
    car.wp.push({ x: cx + choice.dir * 30, y: laneY(atRow, choice.dir) });
  } else {
    car.axis = 'v';
    car.roadIdx = atCol;
    car.dir = choice.dir;
    car.wp.push({ x: cx, y: cy });
    car.wp.push({ x: laneX(atCol, choice.dir), y: cy + choice.dir * 30 });
  }
  planLeg(car, true);
}

function updateCar(state, car, dt) {
  if (car.hp <= 0) {
    car.speed = Math.max(0, car.speed - 200 * dt);
    car.vx = Math.cos(car.angle) * car.speed;
    car.vy = Math.sin(car.angle) * car.speed;
    if (car.driver && !car.driverFled) {
      car.driverFled = true;
      car.driver = false;
      const ped = spawnPed(decisionRng, car.x + 22, car.y + 8);
      ped.state = 'flee';
      ped.fleeT = 2.2;
      ped.fleeFrom = { x: car.x, y: car.y };
      state.peds.push(ped);
    }
    return;
  }
  if (!car.wp.length) decideNext(car);
  const wp = car.wp[0];
  const dx = wp.x - car.x, dy = wp.y - car.y;
  if (Math.hypot(dx, dy) < 13) { car.wp.shift(); return; }
  car.angle = turnToward(car.angle, Math.atan2(dy, dx), 2.5 * dt);
  let target = car.cruise;
  const crossPos = car.axis === 'v' ? roadCenterY(car.crossIdx) : roadCenterX(car.crossIdx);
  const along = car.axis === 'v' ? (crossPos - car.y) * car.dir : (crossPos - car.x) * car.dir;
  const iIdx = car.axis === 'v' ? car.roadIdx : car.crossIdx;
  const jIdx = car.axis === 'v' ? car.crossIdx : car.roadIdx;
  if (along > 24 && along < 74 && !lightGreen(car.axis, iIdx, jIdx, state.time || 0)) target = 0;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const other of state.vehicles) {
    if (other === car) continue;
    const ox = other.x - car.x, oy = other.y - car.y;
    const ahead = ox * fx + oy * fy;
    const side = Math.abs(ox * -fy + oy * fx);
    if (ahead > 0 && ahead < 50 && side < 15) target = Math.min(target, ahead < 27 ? 0 : car.cruise * 0.4);
  }
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const ox = ped.x - car.x, oy = ped.y - car.y;
    const ahead = ox * fx + oy * fy;
    const side = Math.abs(ox * -fy + oy * fx);
    if (ahead > 0 && ahead < 30 && side < 13) { target = 0; break; }
  }
  const accel = target > car.speed ? 120 : 320;
  car.speed += clamp(target - car.speed, -accel * dt, accel * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  const res = resolveCircle(car.x, car.y, 13, state.world.buildings);
  car.x = res.x;
  car.y = res.y;
}

function sidewalkSpot(random) {
  if (random.next() < 0.5) {
    const i = random.int(0, ROAD_X.length - 1);
    const side = random.next() < 0.5 ? -12 : ROAD_W + 12;
    return { x: ROAD_X[i] * TILE + side, y: 60 + random.next() * (WORLD.height - 120) };
  }
  const j = random.int(0, ROAD_Y.length - 1);
  const side = random.next() < 0.5 ? -12 : ROAD_W + 12;
  return { x: 60 + random.next() * (SEA_X - 160), y: ROAD_Y[j] * TILE + side };
}

function sidewalkDest(random, ped) {
  if (random.next() < 0.7) {
    const i = random.int(0, ROAD_X.length - 1);
    const j = random.int(0, ROAD_Y.length - 1);
    const sx = ROAD_X[i] * TILE + (random.next() < 0.5 ? -12 : ROAD_W + 12);
    const sy = ROAD_Y[j] * TILE + (random.next() < 0.5 ? -12 : ROAD_W + 12);
    if (random.next() < 0.5) return { x: sx, y: clamp(ped.y + (random.next() - 0.5) * 500, 30, WORLD.height - 30) };
    return { x: clamp(ped.x + (random.next() - 0.5) * 500, 30, SEA_X - 40), y: sy };
  }
  return sidewalkSpot(random);
}

export function spawnPed(random, x, y) {
  const ped = {
    x: 0, y: 0, r: 6, color: random.pick(PED_COLORS),
    angle: random.next() * Math.PI * 2, speed: 40 + random.next() * 22,
    hp: 30, state: 'walk', fleeT: 0, fleeFrom: null, wp: null, vx: 0, vy: 0,
  };
  if (x !== undefined) { ped.x = x; ped.y = y; }
  else {
    const spot = sidewalkSpot(random);
    ped.x = spot.x;
    ped.y = spot.y;
  }
  ped.wp = sidewalkDest(random, ped);
  return ped;
}

function updatePed(state, ped, dt) {
  if (ped.state === 'down') return;
  ped.x += (ped.vx || 0) * dt;
  ped.y += (ped.vy || 0) * dt;
  ped.vx = (ped.vx || 0) * Math.exp(-6 * dt);
  ped.vy = (ped.vy || 0) * Math.exp(-6 * dt);
  if (ped.fleeT > 0) ped.fleeT -= dt;
  else if (ped.state !== 'flee') {
    for (const a of state.alerts || []) {
      if ((state.time || 0) - a.t < 4 && Math.hypot(a.x - ped.x, a.y - ped.y) < 150) {
        ped.state = 'flee';
        ped.fleeT = 2.4;
        ped.fleeFrom = { x: a.x, y: a.y };
        break;
      }
    }
    if (ped.state !== 'flee') {
      for (const car of state.vehicles || []) {
        const s = Math.hypot(car.vx || 0, car.vy || 0);
        if (s > 70 && Math.hypot(car.x - ped.x, car.y - ped.y) < 36) {
          ped.state = 'flee';
          ped.fleeT = 0.9;
          ped.fleeFrom = { x: car.x, y: car.y };
          break;
        }
      }
    }
  }
  let dest, speed;
  if (ped.state === 'flee' && ped.fleeFrom) {
    const dx = ped.x - ped.fleeFrom.x, dy = ped.y - ped.fleeFrom.y;
    const d = Math.hypot(dx, dy) || 1;
    dest = { x: ped.x + (dx / d) * 130, y: ped.y + (dy / d) * 130 };
    speed = 138;
    if (ped.fleeT <= 0) {
      ped.state = 'walk';
      ped.wp = sidewalkDest(decisionRng, ped);
    }
  } else {
    if (!ped.wp || Math.hypot(ped.wp.x - ped.x, ped.wp.y - ped.y) < 8) ped.wp = sidewalkDest(decisionRng, ped);
    dest = ped.wp;
    speed = ped.speed;
  }
  const dx = dest.x - ped.x, dy = dest.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 2) {
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
  }
  const res = resolveCircle(ped.x, ped.y, ped.r, state.world.buildings);
  ped.x = res.x;
  ped.y = res.y;
  ped.x = clamp(ped.x, 8, SEA_X - 4);
  ped.y = clamp(ped.y, 8, WORLD.height - 8);
}

export function updateTraffic(state, dt) {
  dt = Math.min(dt, 0.05);
  if (!state.vehicles) state.vehicles = [];
  if (!state.peds) state.peds = [];
  const playerCar = state.player ? state.player.vehicle : null;
  for (const car of state.vehicles) {
    if (car === playerCar || car.ai !== 'traffic') continue;
    updateCar(state, car, dt);
  }
  for (const ped of state.peds) updatePed(state, ped, dt);
}

// Shared pedestrian damage: player.js (cars), combat.js (bullets,
// explosions, fists) all land here so the crime reporting stays in
// one place. opts: { byPlayer, vehicle, angle }.
export function damagePed(state, ped, dmg, opts = {}) {
  if (!ped || ped.state === 'down') return;
  ped.hp -= dmg;
  ped.flash = 0.15;
  if (opts.angle !== undefined) {
    ped.vx = (ped.vx || 0) + Math.cos(opts.angle) * 130;
    ped.vy = (ped.vy || 0) + Math.sin(opts.angle) * 130;
  }
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.color = '#57463c';
    ped.hp = 0;
    if (opts.byPlayer) reportCrime(state, opts.vehicle ? 'hitPed' : 'murder', ped.x, ped.y);
    return;
  }
  ped.state = 'flee';
  ped.fleeT = 1.6;
  ped.fleeFrom = { x: ped.x - (ped.vx || 1), y: ped.y - (ped.vy || 0) };
  if (opts.byPlayer) {
    const now = state.time || 0;
    if (!ped._crimeCd || now - ped._crimeCd > 1.5) {
      ped._crimeCd = now;
      reportCrime(state, opts.vehicle ? 'hitPed' : 'assault', ped.x, ped.y);
    }
  }
}
