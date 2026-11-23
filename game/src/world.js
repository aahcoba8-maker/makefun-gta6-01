import { DISTRICTS, PALETTE, ROAD_X, ROAD_Y, SEA_X, STORES, TILE, WORLD } from './config.js';
import { hash2, rng } from './random.js';

const colors = ['#db6651', '#e5ad55', '#76a69a', '#d6c6a0', '#a27868', '#8da6b7'];

function districtAt(x, y) {
  return DISTRICTS.find(d => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) || DISTRICTS[0];
}

export function createWorld(seed = 1) {
  const random = rng(seed);
  const roads = [];
  const buildings = [];
  const parks = [];
  const lamps = [];
  for (const col of ROAD_X) roads.push({ x: col * TILE, y: 0, w: TILE * 0.72, h: WORLD.height, axis: 'v' });
  for (const row of ROAD_Y) roads.push({ x: 0, y: row * TILE, w: SEA_X, h: TILE * 0.72, axis: 'h' });

  for (let gy = 0; gy < WORLD.rows; gy += 1) {
    for (let gx = 0; gx < 35; gx += 1) {
      const centerX = gx * TILE + TILE / 2;
      const centerY = gy * TILE + TILE / 2;
      if (ROAD_X.some(c => Math.abs(gx - c) < 1) || ROAD_Y.some(r => Math.abs(gy - r) < 1)) continue;
      if (centerX > SEA_X - TILE * 2.3) continue;
      const d = districtAt(gx, gy);
      const chance = d.id === 'bukit' ? 0.55 : 0.82;
      if (random.next() > chance) {
        parks.push({ x: gx * TILE + 5, y: gy * TILE + 5, w: TILE - 10, h: TILE - 10, shade: random.int(0, 2) });
        continue;
      }
      const inset = random.int(4, 9);
      const w = TILE - inset - random.int(3, 8);
      const h = TILE - inset - random.int(3, 8);
      const height = random.int(1, 5) * (d.id === 'kotatua' ? 1.3 : 1);
      buildings.push({
        x: gx * TILE + inset, y: gy * TILE + inset, w, h, height,
        wall: random.pick(colors), roof: d.roof, accent: d.wall,
        floors: random.int(1, 4), kind: random.pick(['flat', 'gable', 'courtyard', 'shop']),
        awning: d.id === 'pasar' && random.next() > 0.38,
        sign: d.id === 'pasar' && random.next() > 0.62 ? random.pick(['KOPI', 'ROTI', 'IKAN']) : '',
        district: d.id,
      });
      if (hash2(gx, gy, seed) > 0.78) lamps.push({ x: (gx + 1) * TILE - 5, y: (gy + 1) * TILE - 5 });
    }
  }

  const containers = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      containers.push({ x: SEA_X - 195 + col * 43, y: 105 + row * 83, w: 37, h: 62, color: colors[(row * 3 + col) % colors.length], tier: (row + col) % 4 === 0 ? 1 : 0 });
    }
  }
  const cranes = [
    { x: SEA_X - 35, y: 90, h: 190, reach: 115 },
    { x: SEA_X - 75, y: 455, h: 175, reach: 130 },
  ];
  const docks = [{ x: SEA_X - 7, y: 175, w: 212, h: 47 }, { x: SEA_X - 7, y: 510, w: 185, h: 42 }];
  const ships = [
    { x: SEA_X + 76, y: 148, w: 220, h: 67, name: 'KARANG EXPRESS', color: '#d9e0d9' },
    { x: SEA_X + 68, y: 484, w: 185, h: 58, name: 'TELUK 08', color: '#e6ad54' },
  ];
  return {
    width: WORLD.width, height: WORLD.height, seaX: SEA_X,
    roads, buildings, parks, lamps, containers, cranes, docks, ships,
    stores: STORES.map(s => ({ ...s })),
    beach: { x: SEA_X - 2 * TILE, y: 0, w: 2 * TILE, h: WORLD.height },
    sea: { x: SEA_X, y: 0, w: WORLD.width - SEA_X, h: WORLD.height },
    districts: DISTRICTS,
    seed,
    spawn: { x: 6 * TILE, y: 8 * TILE },
    palette: PALETTE,
  };
}
