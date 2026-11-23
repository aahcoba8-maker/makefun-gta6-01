// Canvas HUD for Karang Bay: health, money, wanted stars, clock, speed,
// objective line, notices, a LIVE minimap, and the #dialog DOM element
// (only touched when the dialog content actually changes).
import { ROAD_X, ROAD_Y, TILE, WORLD } from './config.js';

let lastDialogKey = '__none__';

function syncDialog(state) {
  const el = document.getElementById('dialog');
  if (!el) return;
  const d = state.dialog;
  const key = d ? `${d.who}|${d.text}` : '';
  if (key === lastDialogKey) return;
  lastDialogKey = key;
  if (!d) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.style.display = 'block';
  el.textContent = '';
  const who = document.createElement('b');
  who.textContent = `${d.who}: `;
  el.appendChild(who);
  el.appendChild(document.createTextNode(d.text));
}

function phaseLabel(phase) {
  if (phase === 'day') return 'Siang';
  if (phase === 'dusk') return 'Senja';
  if (phase === 'dawn') return 'Fajar';
  return 'Malam';
}

function drawMinimap(ctx, state) {
  const W = 190;
  const H = 122;
  const x0 = 16;
  const y0 = ctx.canvas.height - H - 16;
  const sx = W / state.world.width;
  const sy = H / state.world.height;
  ctx.fillStyle = 'rgba(10,16,20,.78)';
  ctx.fillRect(x0, y0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.strokeRect(x0, y0, W, H);
  ctx.fillStyle = '#1d6b83';
  ctx.fillRect(x0 + state.world.seaX * sx, y0, (state.world.width - state.world.seaX) * sx, H);
  ctx.strokeStyle = 'rgba(229,198,109,.5)';
  ctx.lineWidth = 1;
  for (const cx of ROAD_X) {
    ctx.beginPath();
    ctx.moveTo(x0 + (cx * TILE + 17) * sx, y0);
    ctx.lineTo(x0 + (cx * TILE + 17) * sx, y0 + H);
    ctx.stroke();
  }
  for (const cy of ROAD_Y) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + (cy * TILE + 17) * sy);
    ctx.lineTo(x0 + W, y0 + (cy * TILE + 17) * sy);
    ctx.stroke();
  }
  const storeColors = { gun: '#ef765b', spray: '#ffcc58', clinic: '#76d6c1', safehouse: '#eeeeee' };
  for (const s of state.world.stores) {
    ctx.fillStyle = storeColors[s.type] || '#fff';
    ctx.fillRect(x0 + s.x * sx - 2, y0 + s.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#318df0';
  for (const c of state.cars) {
    if (c.police) ctx.fillRect(x0 + c.x * sx - 1.5, y0 + c.y * sy - 1.5, 3, 3);
  }
  ctx.fillStyle = '#9ec4ff';
  for (const o of state.officers) {
    if (!o.dead) ctx.fillRect(x0 + o.x * sx - 1.5, y0 + o.y * sy - 1.5, 3, 3);
  }
  if (state.marker) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.2;
    ctx.fillStyle = '#ffd83d';
    ctx.beginPath();
    ctx.arc(x0 + state.marker.x * sx, y0 + state.marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player.vehicle || state.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.stroke();
}

export function drawHUD(ctx, state) {
  syncDialog(state);
  if (state.mode === 'title') return;
  const p = state.player;
  const W = ctx.canvas.width;
  // health
  ctx.fillStyle = 'rgba(10,16,20,.6)';
  ctx.fillRect(14, 12, 188, 18);
  ctx.fillStyle = p.hp > 30 ? '#69c24a' : '#e94651';
  ctx.fillRect(16, 14, 184 * Math.max(0, p.hp / p.maxHp), 14);
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.strokeRect(14, 12, 188, 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 20, 25);
  // money + ammo
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = '#ffd83d';
  ctx.fillText(`$ ${p.money.toLocaleString('id-ID')}`, 16, 52);
  if (p.hasPistol) {
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Pistol  ${p.mag} / ${p.ammo}${p.reloadT > 0 ? '  (reload…)' : ''}`, 16, 72);
  }
  // stars + clock
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted.level ? '#ffd83d' : 'rgba(255,255,255,.25)';
    ctx.fillText('★', W - 16 - (4 - i) * 22, 32);
  }
  const hh = Math.floor(state.timeOfDay) % 24;
  const mm = Math.floor((state.timeOfDay % 1) * 60);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${phaseLabel(state.dayPhase)}`, W - 16, 56);
  ctx.textAlign = 'left';
  // bust meter
  if (state.wanted.bust > 0.05) {
    ctx.fillStyle = 'rgba(10,16,20,.6)';
    ctx.fillRect(W - 166, 66, 150, 10);
    ctx.fillStyle = '#e94651';
    ctx.fillRect(W - 164, 68, 146 * Math.min(1, state.wanted.bust / 1.6), 6);
  }
  // objective
  if (state.objective) {
    ctx.font = 'bold 14px sans-serif';
    const tw = ctx.measureText(state.objective).width;
    const ox = (W - tw) / 2 - 12;
    ctx.fillStyle = 'rgba(10,16,20,.62)';
    ctx.fillRect(ox, 10, tw + 24, 26);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(state.objective, ox + 12, 28);
  }
  // mission timer
  if (state.missionTimer !== null && state.missionTimer !== undefined) {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = state.missionTimer < 15 ? '#ff6b5e' : '#fff';
    const t = `Sisa waktu: ${Math.ceil(state.missionTimer)} dtk`;
    const tw = ctx.measureText(t).width;
    ctx.fillText(t, (W - tw) / 2, 58);
  }
  // speed
  if (p.vehicle) {
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.vehicle.speed) * 0.36)} km/jam`, W - 16, ctx.canvas.height - 18);
    ctx.textAlign = 'left';
  }
  // notices
  ctx.font = 'bold 13px sans-serif';
  let ny = 96;
  for (const n of state.notices) {
    const age = state.time - n.t;
    ctx.globalAlpha = Math.max(0, 1 - age / 4.5);
    ctx.fillStyle = '#fff';
    ctx.fillText(n.text, 16, ny);
    ny += 18;
  }
  ctx.globalAlpha = 1;
  drawMinimap(ctx, state);
}
