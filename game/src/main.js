// main.js — boot and the frame loop for Karang Bay. Wiring order per
// frame (R2's contract): state.time advances once, updateInput first,
// then player, traffic, police, combat, missions; endFrameInput last.
// Modes: title (start screen over the coast), play, pause (Esc),
// gameover (while Raka is down, until the Klinik respawn lands).
import { WORLD } from './config.js';
import { createWorld } from './world.js';
import { renderWorld } from './render.js';
import { attachInput, updateInput, endFrameInput } from './input.js';
import { createPlayer, updatePlayer, pushNotice } from './player.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, updateCombat } from './combat.js';
import { createMissions, updateMissions, setMissionIndex } from './missions.js';
import { drawHud, drawDialog } from './hud.js';
import { createAudio, startAudio, updateAudio } from './audio.js';
import { saveGame, loadSaveData, applySave, hasSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const world = createWorld(seed);
const state = {
  world, time: 0, dayTime: 9.5, dayPhase: 'day',
  camera: { x: 0, y: 0 }, cameraOverride: null,
  mode: 'title', notices: [], rain: false, shake: 0,
};
state.player = createPlayer(world);
attachInput(state, canvas);
createTraffic(state);
createPolice(state);
createCombat(state);
createMissions(state);
createAudio(state);

if (shotName) {
  applyShot(state, shotName);
  if (shotName !== 'title') state.mode = 'play';
}

// ---- DOM wiring -------------------------------------------------------
const $ = (id) => document.getElementById(id);
const els = {
  title: $('title-screen'), pause: $('pause-screen'), over: $('gameover-screen'),
  start: $('start-btn'), cont: $('continue-btn'), resume: $('resume-btn'), restart: $('restart-btn'),
};
if (els.cont) els.cont.style.display = hasSave() ? '' : 'none';

function enterPlay() {
  state.mode = 'play';
  if (state.input) state.input.paused = false;
  startAudio(state);
}
if (els.start) els.start.addEventListener('click', enterPlay);
if (els.cont) els.cont.addEventListener('click', () => {
  const data = loadSaveData();
  if (data) {
    const idx = applySave(state, data);
    setMissionIndex(state, idx);
    pushNotice(state, 'Save dimuat — selamat datang kembali, Raka', 4);
  }
  enterPlay();
});
if (els.resume) els.resume.addEventListener('click', () => {
  if (state.input) state.input.paused = false;
  state.mode = 'play';
});
if (els.restart) els.restart.addEventListener('click', () => window.location.reload());
window.addEventListener('pointerdown', () => startAudio(state), { once: true });

function syncOverlays() {
  if (els.title) els.title.style.display = state.mode === 'title' ? 'flex' : 'none';
  if (els.pause) els.pause.style.display = state.mode === 'pause' ? 'flex' : 'none';
  if (els.over) els.over.style.display = state.mode === 'gameover' ? 'flex' : 'none';
}

// ---- helpers ----------------------------------------------------------
const DAY_LENGTH = 260; // real seconds per in-game day
function phaseOf(h) {
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'dusk';
  if (h >= 19.5 || h < 5) return 'night';
  return 'dawn';
}

function checkSafehouseSave() {
  const p = state.player;
  const input = state.input;
  if (!p || p.dead || p.vehicle || !input || !input.interactPressed) return;
  const safe = world.stores.find((s) => s.type === 'safehouse');
  if (safe && Math.hypot(p.x - safe.x, p.y - safe.y) < 36) {
    if (saveGame(state)) pushNotice(state, 'Game tersimpan di safehouse', 3);
  }
}

function updateCamera() {
  if (state.cameraOverride) {
    state.camera.x = state.cameraOverride.x;
    state.camera.y = state.cameraOverride.y;
    return;
  }
  const p = state.player;
  const t = (p && p.vehicle) || p || { x: 0, y: 0 };
  const maxX = Math.max(0, world.width - canvas.width);
  const maxY = Math.max(0, world.height - canvas.height);
  state.camera.x = Math.min(maxX, Math.max(0, t.x - canvas.width / 2));
  state.camera.y = Math.min(maxY, Math.max(0, t.y - canvas.height / 2));
}

// ---- render -----------------------------------------------------------
function drawOverlay(cam) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.strokeStyle = '#14181b';
  ctx.lineWidth = 3;
  for (const s of state.skidMarks || []) {
    ctx.globalAlpha = s.a;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const b of state.barrels || []) {
    if (b.exploded) {
      ctx.fillStyle = 'rgba(20,16,14,.5)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#b03a2e';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8e6df';
      ctx.fillRect(b.x - b.r, b.y - 2, b.r * 2, 3);
    }
  }
  for (const pk of state.pickups || []) {
    const bob = Math.sin((state.time || 0) * 4 + pk.x) * 2;
    ctx.fillStyle = pk.type === 'money' ? '#57c256' : pk.type === 'ammo' ? '#e0a83c' : '#ff7a9c';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10181c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.type === 'money' ? '$' : pk.type === 'ammo' ? 'A' : '+', pk.x, pk.y + bob + 3);
    ctx.textAlign = 'left';
  }
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of state.bullets || []) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.stroke();
  }
  const fx = state.effects || { smoke: [], flashes: [] };
  for (const s of fx.smoke || []) {
    ctx.fillStyle = `rgba(200,200,200,${0.32 * (1 - s.t / s.life)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
  }
  for (const f of fx.flashes || []) {
    ctx.fillStyle = `rgba(255,190,80,${0.75 * (1 - f.t / f.life)})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + f.t / f.life), 0, Math.PI * 2); ctx.fill();
  }
  for (const boom of state.booms || []) {
    ctx.strokeStyle = 'rgba(255,140,50,.8)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(boom.x, boom.y, boom.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,40,.25)';
    ctx.beginPath(); ctx.arc(boom.x, boom.y, boom.r * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  if (state.marker) {
    const mk = state.marker;
    const pulse = 15 + Math.sin((state.time || 0) * 5) * 4;
    ctx.strokeStyle = '#ffd93c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,60,.16)';
    ctx.beginPath(); ctx.arc(mk.x, mk.y, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,217,60,.35)';
    ctx.fillRect(mk.x - 2, mk.y - 130, 4, 130 - pulse);
  }
  ctx.restore();
}

function drawRain() {
  ctx.strokeStyle = 'rgba(190,220,240,.4)';
  ctx.lineWidth = 1;
  const t = (state.time || 0) * 640;
  ctx.beginPath();
  for (let i = 0; i < 90; i += 1) {
    const x = ((i * 173.3 + t * 0.6) % (canvas.width + 60)) - 30;
    const y = ((i * 271.7 + t) % (canvas.height + 40)) - 20;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 13);
  }
  ctx.stroke();
}

function render(nowMs) {
  const shake = state.shake || 0;
  const cam = {
    x: state.camera.x + (shake ? (Math.random() - 0.5) * shake * 2 : 0),
    y: state.camera.y + (shake ? (Math.random() - 0.5) * shake * 2 : 0),
  };
  const people = [...(state.peds || []), ...(state.officers || []), ...(state.enemies || [])];
  if (state.escort) people.push(state.escort);
  renderWorld(ctx, world, cam, nowMs, {
    vehicles: state.vehicles || [],
    people,
    player: state.player,
    helicopter: state.heli,
    dayPhase: state.dayPhase,
  });
  drawOverlay(cam);
  if (state.rain) drawRain();
  if (state.mode !== 'title') drawHud(ctx, state);
}

// ---- frame loop ---------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state.mode === 'play' && state.input && state.input.paused) state.mode = 'pause';
  else if (state.mode === 'pause' && state.input && !state.input.paused) state.mode = 'play';

  if (state.mode === 'play') {
    state.time += dt;
    state.dayTime = (state.dayTime + (dt * 24) / DAY_LENGTH) % 24;
    updateInput(state);
    updatePlayer(state, dt);
    updateTraffic(state, dt);
    updatePolice(state, dt);
    updateCombat(state, dt);
    updateMissions(state, dt);
    updateAudio(state);
    checkSafehouseSave();
    if (state.player.dead) state.mode = 'gameover';
  } else if (state.mode === 'gameover') {
    state.time += dt;
    updateInput(state);
    updatePlayer(state, dt); // death timer → Klinik respawn runs here
    updatePolice(state, dt);
    if (!state.player.dead) state.mode = 'play';
  } else if (state.mode === 'title') {
    state.time += dt;
    updateInput(state);
    updateTraffic(state, dt); // the city lives behind the title
  } else if (state.mode === 'pause') {
    updateInput(state);
  }

  state.dayPhase = phaseOf(state.dayTime);
  updateCamera();
  render(now);
  drawDialog(state);
  syncOverlays();
  endFrameInput(state.input);
}
requestAnimationFrame(frame);
