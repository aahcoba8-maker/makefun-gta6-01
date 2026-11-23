// main.js — boot + game loop for Karang Bay.
// Per frame: updateInput -> systems -> endFrameInput, dt in seconds.
import { createWorld } from './world.js';
import { renderWorld } from './render.js';
import { attachInput, updateInput, endFrameInput } from './input.js';
import { createPlayer, updatePlayer, pushNotice } from './player.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, updateCombat, updateBullets } from './combat.js';
import { createMissions, updateMissions, setMissionIndex } from './missions.js';
import { drawHUD, syncDialog } from './hud.js';
import { createAudio, updateAudio } from './audio.js';
import { applySave, hasSave, loadSaveData, saveGame } from './save.js';
import { applyShot, getShotName } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7) || 7;
const world = createWorld(seed);

const state = {
  world, seed, time: 0, dayTime: 10, dayPhase: 'day', rain: false,
  mode: 'title', camera: { x: 0, y: 0 }, cameraOverride: null, shake: 0,
  vehicles: [], peds: [], officers: [], enemies: [],
  bullets: [], barrels: [], pickups: [], pendingBooms: [],
  alerts: [], notices: [], effects: { smoke: [], flashes: [] }, skidMarks: [],
  heli: null, escort: null, objective: '', marker: null, missionTimer: 0,
  missionIndex: 0, mission: null, dialog: null,
  wanted: null, input: null, player: null, audio: null, lastAlertPos: null,
};

createPlayer(state);
attachInput(state, canvas);
createTraffic(state);
createPolice(state);
createCombat(state);
createMissions(state);
createAudio(state);

const shotName = getShotName();
if (shotName) applyShot(state, shotName);

const titleEl = document.getElementById('title');
const continueBtn = document.getElementById('continueBtn');
if (continueBtn && !hasSave()) continueBtn.style.display = 'none';

function startGame() {
  state.mode = 'play';
  if (titleEl) titleEl.style.display = 'none';
}
const startBtn = document.getElementById('startBtn');
if (startBtn) startBtn.addEventListener('click', startGame);
if (continueBtn) continueBtn.addEventListener('click', () => {
  const data = loadSaveData();
  if (data) {
    applySave(state, data);
    setMissionIndex(state, data.missionIndex || 0);
    pushNotice(state, 'Save dimuat');
  }
  startGame();
});
if (!shotName && titleEl) titleEl.style.display = 'flex';
if (shotName === 'title' && titleEl) titleEl.style.display = 'flex';
if (shotName && shotName !== 'title' && titleEl) titleEl.style.display = 'none';

function phaseFor(h) {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'dusk';
  return 'night';
}

function checkSafehouseSave() {
  const p = state.player;
  if (!state.input.interactPressed || p.vehicle || state.dialog) return;
  const safe = world.stores.find(s => s.type === 'safehouse');
  if (safe && Math.hypot(p.x - safe.x, p.y - safe.y) < 36) {
    if (saveGame(state)) pushNotice(state, 'Game tersimpan di safehouse');
  }
}

function updateEffects(dt) {
  const fx = state.effects;
  for (const s of fx.smoke) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
  fx.smoke = fx.smoke.filter(s => s.t < s.life);
  for (const f of fx.flashes) f.t += dt;
  fx.flashes = fx.flashes.filter(f => f.t < f.life);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
}

function updateCamera() {
  if (state.cameraOverride) {
    state.camera.x = state.cameraOverride.x;
    state.camera.y = state.cameraOverride.y;
    return;
  }
  const p = state.player;
  const maxX = Math.max(0, world.width - canvas.width);
  const maxY = Math.max(0, world.height - canvas.height);
  let x = Math.max(0, Math.min(maxX, p.x - canvas.width / 2));
  let y = Math.max(0, Math.min(maxY, p.y - canvas.height / 2));
  if (state.shake > 0) {
    x += (Math.random() - 0.5) * state.shake;
    y += (Math.random() - 0.5) * state.shake;
  }
  state.camera.x = x; state.camera.y = y;
}

function drawOverlays() {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Skid marks.
  ctx.fillStyle = 'rgba(12,12,14,.4)';
  for (const s of state.skidMarks) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.fillRect(-7, -8, 3, 16); ctx.fillRect(4, -8, 3, 16);
    ctx.restore();
  }
  // Barrels.
  for (const b of state.barrels) {
    if (b.dead) continue;
    ctx.fillStyle = '#a33327';
    ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b13c';
    ctx.fillRect(b.x - 6, b.y - 2, 12, 4);
  }
  // Pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(state.time * 4 + pk.x) * 2;
    ctx.fillStyle = pk.kind === 'money' ? '#69c24a' : pk.kind === 'ammo' ? '#e8b13c' : '#e96a8a';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10240f'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'money' ? '$' : pk.kind === 'ammo' ? 'A' : '+', pk.x, pk.y + bob + 3);
    ctx.textAlign = 'left';
  }
  // Bullet tracers.
  ctx.strokeStyle = 'rgba(255,220,120,.85)'; ctx.lineWidth = 2;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Smoke + flashes.
  for (const s of state.effects.smoke) {
    ctx.fillStyle = `rgba(90,90,95,${0.4 * (1 - s.t / s.life)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + s.t * 9, 0, Math.PI * 2); ctx.fill();
  }
  for (const f of state.effects.flashes) {
    ctx.fillStyle = `rgba(255,160,60,${0.75 * (1 - f.t / f.life)})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + f.t * 5), 0, Math.PI * 2); ctx.fill();
  }
  // Mission marker: pulsing ring + light beam.
  if (state.marker && state.mode === 'play') {
    const m = state.marker;
    const pulse = 15 + Math.sin(state.time * 5) * 4;
    ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2); ctx.stroke();
    const grad = ctx.createLinearGradient(0, m.y - 190, 0, m.y);
    grad.addColorStop(0, 'rgba(255,217,77,0)');
    grad.addColorStop(1, 'rgba(255,217,77,.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 5, m.y - 190, 10, 190);
  }
  ctx.restore();
  // Rain streaks in screen space.
  if (state.rain) {
    ctx.strokeStyle = 'rgba(190,215,235,.4)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const rx = ((i * 173 + Math.floor(state.time * 620)) % (canvas.width + 40)) - 20;
      const ry = (i * 97 + Math.floor(state.time * 880)) % (canvas.height + 30);
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 11);
    }
    ctx.stroke();
  }
}

function render() {
  const people = [...state.peds, ...state.officers, ...state.enemies];
  if (state.escort) people.push(state.escort);
  renderWorld(ctx, world, state.camera, state.time * 1000, {
    vehicles: state.vehicles,
    people,
    player: state.player,
    helicopter: state.heli,
    dayPhase: state.dayPhase,
  });
  drawOverlays();
  if (state.mode !== 'title') drawHUD(ctx, state);
}

function step(dtRaw) {
  const dt = Math.min(dtRaw, 0.05);
  updateInput(state);
  if (state.input.pausePressed) {
    if (state.mode === 'play') state.mode = 'pause';
    else if (state.mode === 'pause') state.mode = 'play';
  }
  if (state.mode === 'play') {
    state.time += dt;
    state.dayTime = (state.dayTime + dt * (24 / 260)) % 24;
    const dead = state.player.dead;
    updatePlayer(state, dt);
    updateTraffic(state, dt);
    updatePolice(state, dt);
    if (!dead) {
      updateCombat(state, dt);
      updateBullets(state, dt);
      updateMissions(state, dt);
    }
    updateAudio(state, dt);
    checkSafehouseSave();
    updateEffects(dt);
  } else if (state.mode === 'title') {
    state.time += dt;
    updateAudio(state, dt);
  }
  state.dayPhase = phaseFor(state.dayTime);
  updateCamera();
  render();
  syncDialog(state);
  endFrameInput(state.input);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = (now - last) / 1000;
  last = now;
  step(Math.min(dt, 0.25));
}
requestAnimationFrame(frame);
