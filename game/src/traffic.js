// traffic.js — AI cars on the road grid + sidewalk pedestrians.
// damagePed is the single ped-damage / crime-reporting entry point.
import { ROAD_X, ROAD_Y, TILE } from './config.js';
import { rng } from './random.js';
import { reportCrime } from './police.js';

const CAR_COLORS = ['#b85145', '#4a7fa5', '#c9a227', '#5d8a66', '#8a6fae', '#d07b3f', '#7d8a96', '#a34a6e'];
const PED_COLORS = ['#dfbf9b', '#c98d64', '#8a5a3b', '#e8c39a', '#6e4630'];
const cx = (i) => ROAD_X[i] * TILE + 17;
const cy = (j) => ROAD_Y[j] * TILE + 17;

export function lightGreen(axis, i, j, time) {
  const phase = (Math.floor(time / 6) + i + j) % 2 === 0;
  return axis === 'v' ? phase : !phase;
}

export function damagePed(state, ped, dmg, opts = {}) {
  if (!ped || ped.dead) return;
  ped.hp -= dmg;
  if (typeof opts.angle === 'number') {
    ped.x += Math.cos(opts.angle) * 9;
    ped.y += Math.sin(opts.angle) * 9;
  }
  if (ped.hp <= 0) {
    ped.dead = true; ped.corpseT = 6; ped.color = '#5a4a42';
    if (opts.byPlayer) {
      const kind = ped.kind === 'officer' || ped.kind === 'sinta' ? 'hitPolice'
        : opts.vehicle ? 'runover' : 'assault';
      reportCrime(state, kind, ped.x, ped.y);
    }
  } else if (opts.byPlayer) {
    reportCrime(state, ped.kind === 'officer' || ped.kind === 'sinta' ? 'hitPolice' : 'assault', ped.x, ped.y);
    ped.fleeT = Math.max(ped.fleeT || 0, 1.6);
  }
}

function spawnCar(state, r) {
  const ci = r.int(0, ROAD_X.length - 1);
  const cj = r.int(0, ROAD_Y.length - 1);
  const axis = r.next() < 0.5 ? 'v' : 'h';
  const dir = r.next() < 0.5 ? 1 : -1;
  const car = {
    x: cx(ci), y: cy(cj), angle: axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    w: 34, h: 19, color: r.pick(CAR_COLORS), police: false, kind: 'car',
    speed: 0, vx: 0, vy: 0, hp: 140, driver: null, wrecked: false,
    axis, dir, ci, cj, ni: ci, nj: cj, seed: r.int(1, 99999),
  };
  pickNext(car, r);
  // Start partway along the first leg so the grid is not stacked on crossings.
  const t = r.next() * 0.7;
  car.x += (lanePoint(car).x - car.x) * t;
  car.y += (lanePoint(car).y - car.y) * t;
  return car;
}

function lanePoint(car) {
  if (car.ni !== car.ci) { // horizontal travel
    const off = car.ni > car.ci ? 8 : -8;
    return { x: cx(car.ni), y: cy(car.cj) + off };
  }
  const off = car.nj > car.cj ? -8 : 8;
  return { x: cx(car.ci) + off, y: cy(car.nj) };
}

function pickNext(car, r) {
  const opts = [];
  if (car.ci > 0) opts.push({ ni: car.ci - 1, nj: car.cj });
  if (car.ci < ROAD_X.length - 1) opts.push({ ni: car.ci + 1, nj: car.cj });
  if (car.cj > 0) opts.push({ ni: car.ci, nj: car.cj - 1 });
  if (car.cj < ROAD_Y.length - 1) opts.push({ ni: car.ci, nj: car.cj + 1 });
  // Prefer going straight, never U-turn unless it is the only way.
  const back = { ni: car.ci - Math.sign(car.ni - car.ci) || car.ci, nj: car.cj - Math.sign(car.nj - car.cj) || car.cj };
  let pool = opts.filter(o => !(o.ni === back.ni && o.nj === back.nj && (car.ni !== car.ci || car.nj !== car.cj)));
  if (!pool.length) pool = opts;
  const straight = pool.find(o => (o.ni - car.ci) === Math.sign(car.ni - car.ci) && (o.nj - car.cj) === Math.sign(car.nj - car.cj));
  const pick = straight && r.next() < 0.55 ? straight : r.pick(pool);
  car.ni = pick.ni; car.nj = pick.nj;
  car.axis = car.ni !== car.ci ? 'h' : 'v';
  car.dir = car.axis === 'h' ? Math.sign(car.ni - car.ci) : Math.sign(car.nj - car.cj);
}

export function createTraffic(state) {
  const r = rng(state.seed * 7 + 3);
  state.vehicles = state.vehicles || [];
  state.peds = state.peds || [];
  for (let i = 0; i < 14; i++) state.vehicles.push(spawnCar(state, r));
  for (let i = 0; i < 24; i++) {
    const vertical = r.next() < 0.5;
    const ci = r.int(0, ROAD_X.length - 1);
    const cj = r.int(0, ROAD_Y.length - 1);
    const side = r.next() < 0.5 ? -26 : 26;
    const along = r.next();
    const ped = {
      x: 0, y: 0, r: 6, color: r.pick(PED_COLORS), hp: 30, dead: false,
      kind: 'ped', fleeT: 0, corpseT: 0, speed: 40 + r.next() * 14,
      vertical, ci, cj, side, tx: 0, ty: 0, seed: r.int(1, 99999),
    };
    if (vertical) { ped.x = cx(ci) + side; ped.y = cy(0) + along * (cy(ROAD_Y.length - 1) - cy(0)); }
    else { ped.x = cx(0) + along * (cx(ROAD_X.length - 1) - cx(0)); ped.y = cy(cj) + side; }
    newPedTarget(state, ped, r);
    state.peds.push(ped);
  }
  return state;
}

function newPedTarget(state, ped, r) {
  const rr = r || rng(ped.seed + Math.floor(state.time * 10) + 1);
  if (ped.vertical) { ped.tx = ped.x; ped.ty = Math.max(30, Math.min(state.world.height - 30, ped.y + (rr.next() * 560 - 280))); }
  else { ped.ty = ped.y; ped.tx = Math.max(30, Math.min(state.world.seaX - 40, ped.x + (rr.next() * 560 - 280))); }
}

function updateCar(state, car, dt) {
  if (car.driver === 'player' || car.kind === 'patrol') return; // player/police drive these
  if (car.wrecked || car.hp <= 0) {
    car.wrecked = true; car.speed = 0;
    if (car.driver && car.driver !== 'player') {
      const d = car.driver;
      d.x = car.x + 20; d.y = car.y + 12; d.fleeT = 2.4; d.dead = false;
      if (!state.peds.includes(d)) state.peds.push(d);
      car.driver = null;
    }
    return;
  }
  const target = lanePoint(car);
  const dx = target.x - car.x, dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const r = rng(car.seed + Math.floor(state.time));
  if (dist < 9) {
    car.ci = car.ni; car.cj = car.nj;
    pickNext(car, r);
    return;
  }
  const hx = dx / dist, hy = dy / dist;
  let want = 88;
  // Red light at the target crossing.
  if (!lightGreen(car.axis, car.ni, car.nj, state.time) && dist < 52) want = 0;
  // Vehicle ahead in my lane.
  for (const o of state.vehicles) {
    if (o === car) continue;
    const ox = o.x - car.x, oy = o.y - car.y;
    const od = Math.hypot(ox, oy);
    if (od < 52 && od > 0.01 && (ox * hx + oy * hy) / od > 0.72) { want = 0; break; }
  }
  // Pedestrian in the road ahead.
  if (want > 0) {
    for (const p of state.peds) {
      if (p.dead) continue;
      const ox = p.x - car.x, oy = p.y - car.y;
      const od = Math.hypot(ox, oy);
      if (od < 36 && od > 0.01 && (ox * hx + oy * hy) / od > 0.6) { want = 0; break; }
    }
  }
  if (state.player && !state.player.vehicle && state.player.hp > 0) {
    const ox = state.player.x - car.x, oy = state.player.y - car.y;
    const od = Math.hypot(ox, oy);
    if (od < 36 && od > 0.01 && (ox * hx + oy * hy) / od > 0.6) want = 0;
  }
  car.speed += Math.max(-190 * dt, Math.min(120 * dt, want - car.speed));
  if (car.speed < 0.4 && want === 0) car.speed = 0;
  car.x += hx * car.speed * dt;
  car.y += hy * car.speed * dt;
  car.vx = hx * car.speed; car.vy = hy * car.speed;
  if (car.speed > 2) car.angle = Math.atan2(hy, hx);
}

function updatePed(state, ped, dt) {
  if (ped.dead) { ped.corpseT -= dt; return; }
  // Flee fresh alerts nearby.
  let flee = null;
  for (const a of state.alerts) {
    if (state.time - a.t < 4 && Math.hypot(ped.x - a.x, ped.y - a.y) < 150) { flee = a; break; }
  }
  if (flee) ped.fleeT = Math.max(ped.fleeT || 0, 0.4);
  if (ped.fleeT > 0) {
    ped.fleeT -= dt;
    const src = flee || state.lastAlertPos;
    if (src) {
      const dx = ped.x - src.x, dy = ped.y - src.y;
      const d = Math.hypot(dx, dy) || 1;
      ped.x += (dx / d) * 132 * dt;
      ped.y += (dy / d) * 132 * dt;
      ped.x = Math.max(8, Math.min(state.world.seaX - 20, ped.x));
      ped.y = Math.max(8, Math.min(state.world.height - 8, ped.y));
    }
    return;
  }
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 7) { newPedTarget(state, ped); return; }
  ped.x += (dx / d) * ped.speed * dt;
  ped.y += (dy / d) * ped.speed * dt;
}

export function updateTraffic(state, dt) {
  for (const car of state.vehicles) updateCar(state, car, dt);
  for (const ped of state.peds) updatePed(state, ped, dt);
  state.peds = state.peds.filter(p => !(p.dead && p.corpseT <= 0));
}
