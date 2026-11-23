// hud.js — canvas HUD (health, money, stars, clock, objective, notices,
// live minimap) + dialog sync to the #dialog DOM element.
import { ROAD_X, ROAD_Y, TILE } from './config.js';

const PHASE_LABEL = { day: 'SIANG', dusk: 'SENJA', night: 'MALAM', dawn: 'PAGI' };

function panel(c, x, y, w, h, alpha = 0.55) {
  c.fillStyle = `rgba(10,16,20,${alpha})`;
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, 8); c.fill(); }
  else c.fillRect(x, y, w, h);
}

function clockText(dayTime) {
  const h = Math.floor(dayTime) % 24;
  const m = Math.floor((dayTime - Math.floor(dayTime)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawMinimap(c, state) {
  const W = 176, H = 124, x0 = c.canvas.width - W - 10, y0 = c.canvas.height - H - 10;
  const sx = W / state.world.width, sy = H / state.world.height;
  panel(c, x0 - 4, y0 - 4, W + 8, H + 8, 0.62);
  c.fillStyle = '#1d6b83';
  c.fillRect(x0 + state.world.seaX * sx, y0, (state.world.width - state.world.seaX) * sx, H);
  c.strokeStyle = 'rgba(220,225,220,.35)'; c.lineWidth = 1;
  for (const col of ROAD_X) { c.beginPath(); c.moveTo(x0 + (col * TILE + 17) * sx, y0); c.lineTo(x0 + (col * TILE + 17) * sx, y0 + H); c.stroke(); }
  for (const row of ROAD_Y) { c.beginPath(); c.moveTo(x0, y0 + (row * TILE + 17) * sy); c.lineTo(x0 + state.world.seaX * sx, y0 + (row * TILE + 17) * sy); c.stroke(); }
  const dot = (x, y, color, r = 2.4) => { c.fillStyle = color; c.beginPath(); c.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); c.fill(); };
  for (const s of state.world.stores) dot(s.x, s.y, s.type === 'gun' ? '#ef765b' : s.type === 'spray' ? '#ffcc58' : s.type === 'clinic' ? '#76d6c1' : '#ffffff', 2);
  for (const v of state.vehicles) if (v.police) dot(v.x, v.y, Math.sin(state.time * 6) > 0 ? '#318df0' : '#e94651', 2.2);
  for (const o of state.officers) if (!o.dead) dot(o.x, o.y, '#e94651', 2);
  for (const e of state.enemies) if (!e.dead) dot(e.x, e.y, '#b03040', 1.8);
  if (state.marker) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.1;
    dot(state.marker.x, state.marker.y, '#ffd94d', pulse);
  }
  const p = state.player;
  dot(p.x, p.y, '#ffffff', 3);
  c.strokeStyle = '#ffffff';
  c.beginPath();
  c.moveTo(x0 + p.x * sx, y0 + p.y * sy);
  c.lineTo(x0 + (p.x + Math.cos(p.face) * 26) * sx, y0 + (p.y + Math.sin(p.face) * 26) * sy);
  c.stroke();
}

export function drawHUD(c, state) {
  const p = state.player;
  if (!p) return;
  const W = c.canvas.width;
  // Top-left: identity, health, money, weapon.
  panel(c, 12, 12, 208, 74);
  c.fillStyle = '#f2e9d8'; c.font = 'bold 13px sans-serif';
  c.fillText('RAKA', 22, 31);
  c.fillStyle = '#3a454b'; c.fillRect(22, 38, 150, 11);
  c.fillStyle = p.hp > 30 ? '#69c24a' : '#e94651';
  c.fillRect(22, 38, 150 * Math.max(0, p.hp / p.maxHp), 11);
  c.fillStyle = '#ffd94d'; c.font = 'bold 15px sans-serif';
  c.fillText(`$${p.money}`, 22, 68);
  c.fillStyle = '#dfe7ea'; c.font = '11px sans-serif';
  const weapon = p.vehicle ? 'MENYETIR' : p.hasGun ? `PISTOL ${p.mag}/${p.ammo}${p.reloading > 0 ? ' — RELOAD' : ''}` : 'TANGAN KOSONG';
  c.fillText(weapon, 92, 68);
  // Top-right: stars + clock.
  const lvl = state.wanted ? state.wanted.level : 0;
  c.font = '19px sans-serif';
  for (let i = 0; i < 5; i++) {
    c.fillStyle = i < lvl ? '#ffd94d' : 'rgba(200,205,210,.35)';
    c.fillText('★', W - 132 + i * 24, 34);
  }
  c.fillStyle = '#f2e9d8'; c.font = 'bold 14px sans-serif';
  c.textAlign = 'right';
  c.fillText(`${clockText(state.dayTime)} ${PHASE_LABEL[state.dayPhase] || ''}`, W - 16, 58);
  c.textAlign = 'left';
  // Top-center: objective.
  if (state.objective && state.mode === 'play') {
    c.font = 'bold 13px sans-serif';
    const tw = Math.min(W - 480, c.measureText(state.objective).width + 28);
    panel(c, (W - tw) / 2, 12, tw, 30, 0.6);
    c.fillStyle = '#ffe9a8';
    c.textAlign = 'center';
    c.fillText(state.objective, W / 2, 32, tw - 16);
    c.textAlign = 'left';
  }
  // Speed.
  if (p.vehicle) {
    c.fillStyle = '#f2e9d8'; c.font = 'bold 17px sans-serif';
    c.fillText(`${p.speedKmh} km/h`, 22, c.canvas.height - 18);
  }
  // Bust meter.
  if (state.wanted && state.wanted.bust > 0.03) {
    panel(c, W / 2 - 90, 120, 180, 22, 0.65);
    c.fillStyle = '#e94651'; c.fillRect(W / 2 - 84, 126, 168 * Math.min(1, state.wanted.bust), 10);
    c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
    c.fillText('DITANGKAP…', W / 2, 118);
    c.textAlign = 'left';
  }
  // Notices.
  c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
  (state.notices || []).forEach((n, i) => {
    const a = n.t > n.life - 0.7 ? Math.max(0, (n.life - n.t) / 0.7) : 1;
    c.fillStyle = `rgba(255,233,168,${a})`;
    c.fillText(n.text, W / 2, c.canvas.height - 168 - i * 19);
  });
  c.textAlign = 'left';
  drawMinimap(c, state);
  // WASTED / pause overlays.
  if (p.dead) {
    c.fillStyle = 'rgba(20,4,6,.45)'; c.fillRect(0, 0, W, c.canvas.height);
    c.fillStyle = '#e94651'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center';
    c.fillText('WASTED', W / 2, c.canvas.height / 2);
    c.textAlign = 'left';
  } else if (state.mode === 'pause') {
    c.fillStyle = 'rgba(6,10,14,.5)'; c.fillRect(0, 0, W, c.canvas.height);
    c.fillStyle = '#f2e9d8'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center';
    c.fillText('JEDA', W / 2, c.canvas.height / 2);
    c.textAlign = 'left';
  }
}

let lastDialogKey = '__none__';
export function syncDialog(state) {
  const el = document.getElementById('dialog');
  if (!el) return;
  const d = state.dialog;
  const key = d ? `${d.name}|${d.text}` : '';
  if (key === lastDialogKey) return;
  lastDialogKey = key;
  if (!d) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'block';
  el.innerHTML = '';
  const name = document.createElement('div');
  name.className = 'dialog-name';
  name.textContent = d.name;
  const text = document.createElement('div');
  text.textContent = d.text;
  const hint = document.createElement('div');
  hint.className = 'dialog-hint';
  hint.textContent = 'Tekan E untuk lanjut';
  el.append(name, text, hint);
}
