// Karang Bay — boot, game loop and world-space overlays.
// Frame order: updateInput → updatePlayer → updateTraffic → updatePolice →
// updateCombat (bullets included) → updateMissions → updateAudio →
// safehouse-save check → render → endFrameInput.
import { WORLD } from './config.js';
import { createWorld } from './world.js';
import { renderWorld } from './render.js';
import { rng } from './random.js';
import { createInput, updateInput, endFrameInput } from './input.js';
import { createPlayer, updatePlayer } from './player.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { initCombat, updateCombat } from './combat.js';
import { enterMission, initMissions, updateMissions } from './missions.js';
import { drawHUD } from './hud.js';
import { createAudio, updateAudio } from './audio.js';
import { applySave, hasSave, loadSaveData, saveGame } from './save.js';
import { parseShotParams, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const titleEl = document.getElementById('title');
const startBtn = document.getElementById('btn-start');
const continueBtn = document.getElementById('btn-continue');

function phaseOf(h) {
  if (h >= 5 && h < 6) return 'dawn';
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'dusk';
  return 'night';
}

function createState(seed) {
  const world = createWorld(seed);
  return {
    world, seed,
    rand: rng(seed * 7919 + 13),
    time: 0, timeOfDay: 9.5, dayPhase: 'day',
    mode: 'title',
    camera: { x: 0, y: 0 }, cameraOverride: null,
    input: createInput(canvas),
    audio: createAudio(),
    player: createPlayer(world),
    cars: [], peds: [], officers: [], enemies: [],
    heli: null,
    wanted: {
      heat: 0, level: 0, lastCrimeAt: -99, hidden: true,
      bust: 0, contact: false, contactT: 0, sprayT: 0,
    },
    alerts: [], bullets: [], effects: [], skids: [],
    pickups: [], barrels: [], pendingBooms: [],
    notices: [], objective: '', marker: null, missionTimer: null,
    mission: { index: 0, step: 0, data: {} },
    dialog: null, dialogQueue: [],
    rain: false, shotMode: false, saveRequested: false,
    stats: { kills: 0 },
  };
}

const shotParams = parseShotParams();
const state = createState(Number.isFinite(shotParams.seed) ? shotParams.seed : 7);
initTraffic(state);
initCombat(state);
initMissions(state);
if (shotParams.shot) stageShot(state, shotParams.shot);

function refreshContinue() {
  if (continueBtn) continueBtn.style.display = hasSave() ? '' : 'none';
}
refreshContinue();

function startGame(fresh) {
  state.audio.started = true;
  if (!fresh) {
    const data = loadSaveData();
    if (data && applySave(state, data)) enterMission(state);
  }
  state.mode = 'play';
  if (titleEl) titleEl.style.display = 'none';
}
if (startBtn) startBtn.addEventListener('click', () => startGame(true));
if (continueBtn) continueBtn.addEventListener('click', () => startGame(false));
canvas.addEventListener('mousedown', () => { state.audio.started = true; });

function updateCamera() {
  if (state.cameraOverride) {
    state.camera.x = state.cameraOverride.x;
    state.camera.y = state.cameraOverride.y;
    return;
  }
  const t = state.player.vehicle || state.player;
  state.camera.x = Math.max(0, Math.min(state.world.width - canvas.width, t.x - canvas.width / 2));
  state.camera.y = Math.max(0, Math.min(state.world.height - canvas.height, t.y - canvas.height / 2));
}

function drawOverlays(now) {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // skid marks
  ctx.fillStyle = 'rgba(12,12,14,.5)';
  for (const s of state.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.restore();
  }
  // barrels
  for (const b of state.barrels) {
    if (b.dead) continue;
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4d16b';
    ctx.fillRect(b.x - b.r, b.y - 2, b.r * 2, 4);
  }
  // pickups
  state.pickups.forEach((pk, i) => {
    const bob = Math.sin(state.time * 4 + i * 1.7) * 2;
    ctx.fillStyle = '#ffd83d';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c4300';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('$', pk.x - 3, pk.y + bob + 3);
  });
  // bullet tracers
  for (const b of state.bullets) {
    ctx.strokeStyle = b.from === 'player' ? 'rgba(255,230,150,.9)' : 'rgba(255,120,110,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // effects
  for (const e of state.effects) {
    const k = e.t / e.max;
    if (e.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,170,60,${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, 12 + k * 84, 0, Math.PI * 2); ctx.stroke();
    } else if (e.kind === 'smoke') {
      ctx.fillStyle = `rgba(90,90,95,${0.4 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y - k * 16, 6 + k * 10, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,130,${1 - k})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'flash') {
      ctx.fillStyle = `rgba(255,80,70,${0.55 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, Math.PI * 2); ctx.fill();
    }
  }
  // mission marker: pulsing ring + light beam
  if (state.marker) {
    const m = state.marker;
    const pulse = 12 + Math.sin(state.time * 5) * 3;
    const grad = ctx.createLinearGradient(0, m.y - 280, 0, m.y);
    grad.addColorStop(0, 'rgba(255,216,61,0)');
    grad.addColorStop(1, 'rgba(255,216,61,.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 6, m.y - 280, 12, 280);
    ctx.strokeStyle = '#ffd83d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // rain, screen space
  if (state.rain) {
    ctx.strokeStyle = 'rgba(180,205,230,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = (i * 173 + state.time * 620) % (canvas.width + 40) - 20;
      const ry = (i * 271 + state.time * 880) % (canvas.height + 30) - 15;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 3, ry + 11);
    }
    ctx.stroke();
  }
}

function drawCenterText(big, small, color) {
  ctx.fillStyle = 'rgba(5,8,12,.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(big, canvas.width / 2, canvas.height / 2 - 8);
  ctx.font = 'bold 17px sans-serif';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(small, canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = 'left';
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const input = state.input;
  updateInput(state);
  let playing = state.mode === 'play' && !input.paused;
  if (state.shotMode && state.mode === 'play') {
    // Staged frames stay composed: simulate a breath, then hold the frame.
    state.shotSimT = (state.shotSimT || 0) + dt;
    if (state.shotSimT > 0.4) playing = false;
  }
  if (playing) {
    state.time += dt;
    state.timeOfDay = (state.timeOfDay + (dt * 24) / 260) % 24;
    updatePlayer(state, dt);
    updateTraffic(state, dt);
    updatePolice(state, dt);
    updateCombat(state, dt);
    updateMissions(state, dt);
    updateAudio(state, dt);
    if (state.saveRequested) {
      state.saveRequested = false;
      saveGame(state);
    }
    for (const e of state.effects) e.t += dt;
    state.effects = state.effects.filter((e) => e.t < e.max);
    for (const s of state.skids) s.t += dt;
    if (state.skids.length) state.skids = state.skids.filter((s) => s.t < 20);
  } else if (state.mode === 'title') {
    updateAudio(state, dt);
  }
  state.dayPhase = phaseOf(state.timeOfDay);
  updateCamera();
  const people = [...state.peds, ...state.officers, ...state.enemies]
    .filter((e) => !e.dead);
  renderWorld(ctx, state.world, state.camera, now, {
    vehicles: state.cars,
    people,
    player: state.player,
    helicopter: state.heli,
    dayPhase: state.dayPhase,
  });
  if (state.mode !== 'title') drawOverlays(now);
  drawHUD(ctx, state);
  if (titleEl) {
    titleEl.style.display = state.mode === 'title' ? 'flex' : 'none';
  }
  if (state.mode === 'play' && input.paused && !state.player.dead) {
    drawCenterText('JEDA', 'Tekan P untuk lanjut', '#ffd83d');
  }
  if (state.player.dead) {
    drawCenterText('WASTED', 'Raka dibawa ke klinik…', '#e94651');
  }
  endFrameInput(input);
}
requestAnimationFrame(frame);
