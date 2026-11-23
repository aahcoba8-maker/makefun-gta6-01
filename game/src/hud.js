// hud.js — everything drawn over the world: health and cash, wanted
// stars, the day/night clock, speed, the current objective with its
// off-screen arrow, notices, and the live minimap (roads, player,
// mission marker, police, stores). The dialog panel is a DOM element
// in index.html; drawDialog keeps it in sync with state.dialog.
import { ROAD_X, ROAD_Y, TILE } from './config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function fmtClock(dayTime) {
  const h = Math.floor(dayTime) % 24;
  const min = Math.floor((dayTime - Math.floor(dayTime)) * 60);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function phaseLabel(dayTime) {
  if (dayTime >= 6 && dayTime < 17) return 'SIANG';
  if (dayTime >= 17 && dayTime < 19.5) return 'SENJA';
  if (dayTime >= 19.5 || dayTime < 5) return 'MALAM';
  return 'FAJAR';
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,16,20,.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawVitals(ctx, state) {
  const p = state.player;
  if (!p) return;
  panel(ctx, 16, 16, 232, 64);
  ctx.fillStyle = '#0d1417';
  ctx.fillRect(28, 30, 180, 13);
  const frac = clamp(p.health / p.maxHealth, 0, 1);
  ctx.fillStyle = frac > 0.5 ? '#57c256' : frac > 0.25 ? '#e0a83c' : '#d94f3d';
  ctx.fillRect(28, 30, 180 * frac, 13);
  ctx.fillStyle = '#f3ead2';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('RAKA', 28, 26);
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = '#ffd976';
  ctx.fillText(`$${p.money}`, 28, 66);
  ctx.fillStyle = '#f3ead2';
  ctx.font = '12px sans-serif';
  if (p.hasPistol) {
    ctx.fillText(p.reloading > 0 ? 'RELOADING…' : `PISTOL ${p.ammoInMag} / ${p.reserveAmmo}`, 118, 66);
  } else {
    ctx.fillText('TANGAN KOSONG', 118, 66);
  }
  if (state.mode === 'play' && p.vehicle) {
    const spd = Math.round(Math.hypot(p.vehicle.vx || 0, p.vehicle.vy || 0) * 0.42);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#cfe8ef';
    ctx.fillText(`${spd} km/h`, 28, 100);
  }
}

function drawStarsClock(ctx, state) {
  const w = ctx.canvas.width;
  const level = state.wanted ? state.wanted.level : 0;
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < level ? '#ffc93c' : 'rgba(255,255,255,.28)';
    ctx.fillText('★', w - 20 - (4 - i) * 26, 42);
  }
  ctx.fillStyle = '#f3ead2';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${fmtClock(state.dayTime ?? 9.5)} ${phaseLabel(state.dayTime ?? 9.5)}`, w - 20, 68);
  ctx.textAlign = 'left';
}

function drawObjective(ctx, state) {
  if (!state.objective) return;
  const w = ctx.canvas.width;
  ctx.font = 'bold 14px sans-serif';
  const tw = Math.min(ctx.measureText(state.objective).width + 28, w - 560);
  panel(ctx, (w - tw) / 2, 14, tw, state.missionTimer != null ? 52 : 34);
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.fillText(state.objective, w / 2, 36, w - 580);
  if (state.missionTimer != null) {
    ctx.fillStyle = state.missionTimer < 15 ? '#ff7a5c' : '#f3ead2';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Sisa waktu ${Math.ceil(state.missionTimer)} detik`, w / 2, 56);
  }
  ctx.textAlign = 'left';
}

function drawNotices(ctx, state) {
  const notices = state.notices || [];
  let y = ctx.canvas.height - 190;
  ctx.font = 'bold 14px sans-serif';
  for (const n of notices) {
    ctx.globalAlpha = clamp(n.t, 0, 1);
    ctx.fillStyle = 'rgba(10,16,20,.55)';
    const tw = ctx.measureText(n.text).width + 20;
    ctx.fillRect(16, y - 15, tw, 22);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(n.text, 26, y + 1);
    y -= 27;
  }
  ctx.globalAlpha = 1;
}

const STORE_COLORS = { gun: '#ef765b', spray: '#ffcc58', clinic: '#76d6c1', safehouse: '#9ec4ff' };

function drawMinimap(ctx, state) {
  const world = state.world;
  const mw = 216, mh = 148;
  const x0 = ctx.canvas.width - mw - 16, y0 = ctx.canvas.height - mh - 16;
  const sx = mw / world.width, sy = mh / world.height;
  panel(ctx, x0 - 6, y0 - 6, mw + 12, mh + 12);
  ctx.fillStyle = '#20303a';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#1d6b83';
  ctx.fillRect(x0 + world.sea.x * sx, y0, world.sea.w * sx, mh);
  ctx.fillStyle = '#d9ba78';
  ctx.fillRect(x0 + world.beach.x * sx, y0, world.beach.w * sx, mh);
  ctx.strokeStyle = 'rgba(220,228,230,.4)';
  ctx.lineWidth = 1;
  for (const gx of ROAD_X) {
    ctx.beginPath(); ctx.moveTo(x0 + gx * TILE * sx, y0); ctx.lineTo(x0 + gx * TILE * sx, y0 + mh); ctx.stroke();
  }
  for (const gy of ROAD_Y) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + gy * TILE * sy); ctx.lineTo(x0 + world.sea.x * sx, y0 + gy * TILE * sy); ctx.stroke();
  }
  for (const s of world.stores) {
    ctx.fillStyle = STORE_COLORS[s.type] || '#ffffff';
    ctx.fillRect(x0 + s.x * sx - 2.5, y0 + s.y * sy - 2.5, 5, 5);
  }
  const dot = (e, color, size) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + e.x * sx, y0 + e.y * sy, size, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const v of state.vehicles || []) if (v.police) dot(v, '#7db4ff', 2.4);
  for (const o of state.officers || []) if (o.state !== 'down' && o.state !== 'gone') dot(o, '#7db4ff', 2.2);
  for (const e of state.enemies || []) if (e.state !== 'down') dot(e, '#ff6a5c', 2.2);
  if (state.escort) dot(state.escort, '#f2c56b', 2.6);
  if (state.marker) {
    const pulse = 3.4 + Math.sin((state.time || 0) * 5) * 1.1;
    dot(state.marker, '#ffd93c', pulse);
  }
  const p = state.player;
  if (p) {
    dot(p, '#ffffff', 3.2);
    const a = p.vehicle ? p.vehicle.angle : p.angle;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x0 + p.x * sx, y0 + p.y * sy);
    ctx.lineTo(x0 + (p.x + Math.cos(a) * 90) * sx, y0 + (p.y + Math.sin(a) * 90) * sy);
    ctx.stroke();
  }
}

function drawMarkerArrow(ctx, state) {
  const mk = state.marker;
  if (!mk || !state.camera) return;
  const cam = state.camera;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  if (mk.x > cam.x + 30 && mk.x < cam.x + w - 30 && mk.y > cam.y + 30 && mk.y < cam.y + h - 30) return;
  const cx = w / 2, cy = h / 2;
  const ang = Math.atan2(mk.y - (cam.y + h / 2), mk.x - (cam.x + w / 2));
  const ex = cx + Math.cos(ang) * (w / 2 - 46);
  const ey = cy + Math.sin(ang) * (h / 2 - 46);
  const dist = Math.round(Math.hypot(mk.x - state.player.x, mk.y - state.player.y) / 10);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd93c';
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd93c';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${dist} m`, ex, ey + 24);
  ctx.textAlign = 'left';
}

export function drawHud(ctx, state) {
  if (!state.player) return;
  drawVitals(ctx, state);
  drawStarsClock(ctx, state);
  drawObjective(ctx, state);
  drawNotices(ctx, state);
  drawMinimap(ctx, state);
  drawMarkerArrow(ctx, state);
  const p = state.player;
  if ((state.time || 0) - (p.hurtAt || -9) < 0.28) {
    ctx.fillStyle = 'rgba(217,79,61,.16)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  if (state.wanted && state.wanted.hidden && state.wanted.level > 0) {
    ctx.fillStyle = 'rgba(255,233,168,.85)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('SEMBUNYI — jangan terlihat polisi', 28, 122);
  }
}

let lastDialogKey = '';
export function drawDialog(state) {
  const el = document.getElementById('dialog');
  if (!el) return;
  const d = state.dialog;
  const key = d ? `${d.who}|${d.text}` : '';
  if (key === lastDialogKey) return;
  lastDialogKey = key;
  if (!d) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = '';
  const who = document.createElement('div');
  who.className = 'dlg-who';
  who.textContent = d.who;
  const text = document.createElement('div');
  text.className = 'dlg-text';
  text.textContent = d.text;
  const hint = document.createElement('div');
  hint.className = 'dlg-hint';
  hint.textContent = 'E ▸ lanjut';
  el.append(who, text, hint);
}
