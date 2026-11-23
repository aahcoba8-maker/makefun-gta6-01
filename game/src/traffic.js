// Ambient traffic and pedestrians for Karang Bay.
// Cars follow right-hand lanes on the ROAD_X / ROAD_Y grid, honour traffic
// lights (6 s phases) and stop for vehicles and peds ahead. Peds stroll the
// sidewalks and flee fresh alerts. damagePed is the single entry point for
// hurting any pedestrian-shaped body (peds, crew, bystanders).
import { ROAD_X, ROAD_Y, TILE, WORLD } from './config.js';
import { reportCrime } from './police.js';

const CAR_COLORS = ['#b85145', '#4a7fb5', '#c9a227', '#5f9e6e', '#8a6bb8', '#c7c7c7', '#37474f'];
const PED_COLORS = ['#dfbf9b', '#c98d5f', '#8a5a3b', '#e8c39e', '#a06a42'];

export function makeCar(x, y, angle, color, opts = {}) {
  return {
    x, y, angle, w: 34, h: 19, color,
    police: !!opts.police, ai: !!opts.ai,
    speed: 0, hp: opts.hp ?? 100, wrecked: false,
    driver: opts.driver ?? null,
    axis: opts.axis || 'v', dir: opts.dir || 1,
    cruise: opts.cruise ?? 100, turnCd: 0,
  };
}

export function initTraffic(state) {
  const r = state.rand;
  state.cars = [];
  state.peds = [];
  for (let i = 0; i < 14; i++) {
    const vertical = r.next() > 0.45;
    const ci = r.int(0, ROAD_X.length - 1);
    const ri = r.int(0, ROAD_Y.length - 1);
    const dir = r.next() > 0.5 ? 1 : -1;
    let car;
    if (vertical) {
      const x = ROAD_X[ci] * TILE + 17 + (dir > 0 ? 8 : -8);
      const y = ROAD_Y[ri] * TILE + r.int(-30, 30);
      car = makeCar(x, y, dir > 0 ? Math.PI / 2 : -Math.PI / 2, CAR_COLORS[i % CAR_COLORS.length], { ai: true, axis: 'v', dir });
    } else {
      const y = ROAD_Y[ri] * TILE + 17 + (dir > 0 ? -8 : 8);
      const x = ROAD_X[ci] * TILE + r.int(-30, 30);
      car = makeCar(x, y, dir > 0 ? 0 : Math.PI, CAR_COLORS[i % CAR_COLORS.length], { ai: true, axis: 'h', dir });
    }
    car.cruise = 85 + r.next() * 45;
    car.driver = { role: 'driver' };
    state.cars.push(car);
  }
  for (let i = 0; i < 24; i++) {
    const vertical = r.next() > 0.5;
    const ci = r.int(0, ROAD_X.length - 1);
    const ri = r.int(0, ROAD_Y.length - 1);
    const side = r.next() > 0.5 ? -13 : 47;
    const ped = {
      x: 0, y: 0, r: 6, color: PED_COLORS[i % PED_COLORS.length],
      hp: 30, dead: false, deadT: 0, role: 'ped',
      axis: vertical ? 'v' : 'h', dir: r.next() > 0.5 ? 1 : -1,
      speed: 26 + r.next() * 20, fleeT: 0, fleeX: 0, fleeY: 0,
    };
    if (vertical) {
      ped.x = ROAD_X[ci] * TILE + side;
      ped.y = r.int(40, WORLD.height - 40);
    } else {
      ped.y = ROAD_Y[ri] * TILE + side;
      ped.x = r.int(40, state.world.seaX - 60);
    }
    state.peds.push(ped);
  }
}

function lightRed(state, car, aheadX, aheadY) {
  const phase = Math.floor(state.time / 6) % 2; // 0: vertical flows, 1: horizontal
  const mine = car.axis === 'v' ? 0 : 1;
  if (phase === mine) return false;
  for (const cx of ROAD_X) {
    for (const cy of ROAD_Y) {
      if (Math.hypot(cx * TILE + 17 - aheadX, cy * TILE + 17 - aheadY) < 24) return true;
    }
  }
  return false;
}

function maybeTurn(state, car) {
  if (car.turnCd > 0) return;
  for (const cx of ROAD_X) {
    for (const cy of ROAD_Y) {
      const ix = cx * TILE + 17;
      const iy = cy * TILE + 17;
      if (Math.hypot(ix - car.x, iy - car.y) < 9) {
        car.turnCd = 2.5;
        if (state.rand.next() < 0.45) {
          const dir = state.rand.next() > 0.5 ? 1 : -1;
          if (car.axis === 'v') {
            car.axis = 'h'; car.dir = dir;
            car.y = iy + (dir > 0 ? -8 : 8);
            car.angle = dir > 0 ? 0 : Math.PI;
          } else {
            car.axis = 'v'; car.dir = dir;
            car.x = ix + (dir > 0 ? 8 : -8);
            car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        return;
      }
    }
  }
}

function turnAround(state, car) {
  car.dir *= -1;
  if (car.axis === 'v') {
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x += car.dir > 0 ? 0 : 0;
    car.y = Math.max(34, Math.min(state.world.height - 34, car.y));
    car.x = Math.max(24, Math.min(state.world.seaX - 30, car.x));
  } else {
    car.angle = car.dir > 0 ? 0 : Math.PI;
    car.x = Math.max(34, Math.min(state.world.seaX - 40, car.x));
    car.y = Math.max(24, Math.min(state.world.height - 34, car.y));
  }
  car.turnCd = 1.5;
}

export function updateTraffic(state, dt) {
  const time = state.time;
  for (const car of state.cars) {
    if (!car.ai) continue;
    car.turnCd = Math.max(0, car.turnCd - dt);
    if (car.wrecked) { car.speed = 0; continue; }
    const aheadX = car.x + Math.cos(car.angle) * 30;
    const aheadY = car.y + Math.sin(car.angle) * 30;
    let stop = lightRed(state, car, aheadX, aheadY);
    if (!stop) {
      for (const other of state.cars) {
        if (other !== car && Math.hypot(other.x - aheadX, other.y - aheadY) < 24) { stop = true; break; }
      }
    }
    if (!stop && state.player.vehicle &&
        Math.hypot(state.player.vehicle.x - aheadX, state.player.vehicle.y - aheadY) < 26) stop = true;
    if (!stop && !state.player.vehicle &&
        Math.hypot(state.player.x - aheadX, state.player.y - aheadY) < 20) stop = true;
    if (!stop) {
      for (const ped of state.peds) {
        if (!ped.dead && Math.hypot(ped.x - aheadX, ped.y - aheadY) < 20) { stop = true; break; }
      }
    }
    const target = stop ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 3);
    if (Math.abs(car.speed) > 2) {
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      maybeTurn(state, car);
    }
    if (car.x < 26 || car.x > state.world.seaX - 24 || car.y < 26 || car.y > state.world.height - 26) {
      turnAround(state, car);
    }
  }
  for (const ped of state.peds) {
    if (ped.dead || ped.role !== 'ped') continue;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      ped.x += ped.fleeX * 95 * dt;
      ped.y += ped.fleeY * 95 * dt;
    } else {
      for (const a of state.alerts) {
        if (time - a.t < 4 && Math.hypot(a.x - ped.x, a.y - ped.y) < 150) {
          const d = Math.max(1, Math.hypot(ped.x - a.x, ped.y - a.y));
          ped.fleeX = (ped.x - a.x) / d;
          ped.fleeY = (ped.y - a.y) / d;
          ped.fleeT = 2.4;
          break;
        }
      }
      if (ped.fleeT <= 0) {
        if (ped.axis === 'v') {
          ped.y += ped.dir * ped.speed * dt;
          if (ped.y < 30 || ped.y > state.world.height - 30) ped.dir *= -1;
        } else {
          ped.x += ped.dir * ped.speed * dt;
          if (ped.x < 30 || ped.x > state.world.seaX - 46) ped.dir *= -1;
        }
      }
    }
    ped.x = Math.max(8, Math.min(state.world.seaX - 8, ped.x));
    ped.y = Math.max(8, Math.min(state.world.height - 8, ped.y));
  }
}

// The one place pedestrians take damage. opts.byPlayer reports the crime;
// opts.kind overrides the crime kind; opts.knock = {x, y} shove in px.
export function damagePed(state, ped, dmg, opts = {}) {
  if (ped.dead) return;
  ped.hp -= dmg;
  if (opts.knock) { ped.x += opts.knock.x; ped.y += opts.knock.y; }
  if (opts.byPlayer) {
    reportCrime(state, opts.kind || (ped.hp <= 0 ? 'murder' : 'assault'), ped.x, ped.y);
  }
  if (ped.hp <= 0) {
    ped.dead = true;
    ped.deadT = state.time;
    state.alerts.push({ x: ped.x, y: ped.y, t: state.time, kind: 'panic' });
  }
}
