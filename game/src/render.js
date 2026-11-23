import { PALETTE, TILE } from './config.js';

const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };

function drawGround(c, world) {
  rect(c, 0, 0, world.width, world.height, '#58685a');
  rect(c, world.beach.x, 0, world.beach.w, world.height, PALETTE.sand);
  rect(c, world.sea.x, 0, world.sea.w, world.height, PALETTE.sea);
  c.strokeStyle = 'rgba(194,232,224,.24)'; c.lineWidth = 2;
  for (let y = 12; y < world.height; y += 37) {
    const x = world.seaX + 8 + ((y * 17) % 88);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 23, y - 7, x + 48, y); c.stroke();
  }
  for (const d of world.districts) {
    rect(c, d.x * TILE, d.y * TILE, d.w * TILE, d.h * TILE, d.ground);
    c.fillStyle = 'rgba(10,20,24,.38)'; c.font = 'bold 17px sans-serif';
    c.fillText(d.name, d.x * TILE + 14, d.y * TILE + 27);
  }
  rect(c, world.beach.x, 0, 5, world.height, '#efe0b3');
  for (const p of world.parks) {
    rect(c, p.x, p.y, p.w, p.h, ['#4a8054', '#56845b', '#46764e'][p.shade]);
    c.fillStyle = '#295a3e'; c.beginPath(); c.arc(p.x + p.w / 2, p.y + p.h / 2, 7, 0, Math.PI * 2); c.fill();
  }
}

function drawRoads(c, world) {
  for (const r of world.roads) {
    rect(c, r.x - 5, r.y - 5, r.w + 10, r.h + 10, PALETTE.sidewalk);
    rect(c, r.x, r.y, r.w, r.h, PALETTE.asphalt);
    c.strokeStyle = PALETTE.line; c.lineWidth = 2; c.setLineDash([14, 14]);
    c.beginPath();
    if (r.axis === 'v') { c.moveTo(r.x + r.w / 2, 0); c.lineTo(r.x + r.w / 2, world.height); }
    else { c.moveTo(0, r.y + r.h / 2); c.lineTo(r.w, r.y + r.h / 2); }
    c.stroke(); c.setLineDash([]);
  }
}

function drawBuildings(c, world) {
  for (const b of world.buildings) {
    rect(c, b.x + 7, b.y + 9, b.w, b.h, 'rgba(0,0,0,.3)');
    rect(c, b.x, b.y, b.w, b.h, b.wall);
    const roofY = b.y - b.height;
    rect(c, b.x - 2, roofY, b.w + 4, b.h * 0.55, b.roof);
    rect(c, b.x + 5, roofY + 5, Math.max(9, b.w - 14), 4, 'rgba(255,255,255,.24)');
    if (b.kind === 'courtyard') rect(c, b.x + b.w * .35, roofY + b.h * .12, b.w * .3, b.h * .22, '#56685c');
    if (b.kind === 'gable') {
      c.fillStyle = b.accent; c.beginPath(); c.moveTo(b.x - 2, roofY); c.lineTo(b.x + b.w / 2, roofY - 9); c.lineTo(b.x + b.w + 2, roofY); c.fill();
    }
    c.fillStyle = 'rgba(33,45,47,.72)';
    for (let x = b.x + 7; x < b.x + b.w - 4; x += 13) rect(c, x, b.y + b.h - 14, 5, 8, '#303e40');
    if (b.awning) {
      rect(c, b.x + 2, b.y + b.h - 8, b.w - 4, 7, '#f4d16b');
      if (b.sign) { c.fillStyle = '#fff5d5'; c.font = 'bold 6px sans-serif'; c.fillText(b.sign, b.x + 4, b.y + b.h - 10); }
    }
  }
  for (const s of world.stores) {
    rect(c, s.x - 20, s.y - 15, 41, 26, '#242d31');
    c.fillStyle = s.type === 'spray' ? '#ffcc58' : s.type === 'gun' ? '#ef765b' : '#76d6c1';
    c.font = 'bold 7px sans-serif'; c.fillText(s.name, s.x - 17, s.y);
  }
}

function drawPort(c, world) {
  for (const d of world.docks) rect(c, d.x, d.y, d.w, d.h, '#a88f6c');
  for (const box of world.containers) {
    const y = box.y - box.tier * 19;
    rect(c, box.x + 3, y + 4, box.w, box.h, 'rgba(0,0,0,.28)');
    rect(c, box.x, y, box.w, box.h, box.color);
    c.strokeStyle = 'rgba(255,255,255,.24)'; c.lineWidth = 1;
    for (let x = box.x + 5; x < box.x + box.w; x += 8) { c.beginPath(); c.moveTo(x, y + 3); c.lineTo(x, y + box.h - 3); c.stroke(); }
  }
  for (const crane of world.cranes) {
    c.strokeStyle = '#e7ad48'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(crane.x, crane.y + crane.h); c.lineTo(crane.x, crane.y); c.lineTo(crane.x + crane.reach, crane.y); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(crane.x + crane.reach - 15, crane.y); c.lineTo(crane.x + crane.reach - 15, crane.y + 56); c.stroke();
    c.fillStyle = '#222b31'; c.beginPath(); c.arc(crane.x, crane.y + crane.h, 8, 0, Math.PI * 2); c.fill();
  }
  for (const ship of world.ships) {
    c.fillStyle = '#192f3a'; c.beginPath(); c.moveTo(ship.x, ship.y + 12); c.lineTo(ship.x + ship.w, ship.y + 12); c.lineTo(ship.x + ship.w - 20, ship.y + ship.h); c.lineTo(ship.x + 22, ship.y + ship.h); c.closePath(); c.fill();
    rect(c, ship.x + 35, ship.y, ship.w * .45, 15, ship.color);
    rect(c, ship.x + 53, ship.y - 10, 34, 10, '#f4ead0');
    c.fillStyle = '#f6e2ac'; c.font = 'bold 7px sans-serif'; c.fillText(ship.name, ship.x + 45, ship.y + 11);
  }
}

function drawVehicle(c, v, time = 0) {
  c.save(); c.translate(v.x, v.y); c.rotate(v.angle || 0);
  const w = v.w || 34, h = v.h || 19;
  rect(c, -w / 2 + 2, -h / 2 + 3, w, h, 'rgba(0,0,0,.35)');
  rect(c, -w / 2, -h / 2, w, h, v.color || '#b85145');
  rect(c, -w * .14, -h * .38, w * .35, h * .76, '#a9c9c9');
  rect(c, w * .29, -h * .34, w * .12, h * .68, '#263a42');
  rect(c, w / 2 - 4, -h / 2 + 2, 3, 4, '#fff1b1'); rect(c, w / 2 - 4, h / 2 - 6, 3, 4, '#ef544c');
  if (v.police) {
    rect(c, -4, -h / 2 - 2, 10, 3, '#eee8db');
    rect(c, -4, -h / 2 - 2, 5, 3, Math.sin(time / 120) > 0 ? '#318df0' : '#e94651');
  }
  c.restore();
}

function drawHelicopter(c, h, time) {
  if (!h) return;
  c.save(); c.translate(h.x, h.y);
  c.fillStyle = 'rgba(255,239,168,.14)'; c.beginPath(); c.moveTo(-5, 12); c.lineTo(28, 118); c.lineTo(120, 170); c.lineTo(34, 34); c.closePath(); c.fill();
  rect(c, -20, -8, 41, 18, '#394b55'); rect(c, -7, -15, 15, 9, '#9ec4c6');
  rect(c, 20, -2, 22, 4, '#394b55');
  c.strokeStyle = '#17232b'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -17); c.moveTo(-42, -17); c.lineTo(42, -17); c.stroke();
  c.save(); c.rotate(time / 16); c.lineWidth = 2; c.beginPath(); c.moveTo(-54, -17); c.lineTo(54, -17); c.stroke(); c.restore();
  c.fillStyle = '#ffd976'; c.beginPath(); c.arc(0, 12, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#dae3dc'; c.font = 'bold 7px sans-serif'; c.fillText('GARUDA-1', -26, 23); c.restore();
}

function drawLights(c, world, time, night) {
  if (!night) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of world.lamps) {
    const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, 44);
    g.addColorStop(0, 'rgba(255,220,130,.3)'); g.addColorStop(1, 'rgba(255,220,130,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 44, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

export function renderWorld(ctx, world, camera = { x: 0, y: 0 }, time = 0, entities = {}) {
  const { canvas } = ctx;
  const night = entities.dayPhase === 'night' || entities.night === true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, world); drawRoads(ctx, world); drawBuildings(ctx, world); drawPort(ctx, world);
  for (const v of entities.vehicles || []) drawVehicle(ctx, v, time);
  for (const p of entities.people || []) {
    ctx.fillStyle = p.color || '#dfbf9b'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 6, 0, Math.PI * 2); ctx.fill();
  }
  if (entities.player) {
    if (entities.player.vehicle) drawVehicle(ctx, entities.player.vehicle, time);
    else { ctx.fillStyle = '#e5ba78'; ctx.beginPath(); ctx.arc(entities.player.x, entities.player.y, 8, 0, Math.PI * 2); ctx.fill(); rect(ctx, entities.player.x - 4, entities.player.y + 4, 8, 9, '#2a7a83'); }
  }
  drawHelicopter(ctx, entities.helicopter, time);
  drawLights(ctx, world, time, night);
  if (night) rect(ctx, camera.x, camera.y, canvas.width, canvas.height, PALETTE.night);
  ctx.restore();
}
