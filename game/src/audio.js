// audio.js — all of Karang Bay's sound is synthesized with WebAudio:
// a saw engine whose pitch follows the car, a two-tone siren while
// the heat is on, gunshot / pickup / explosion one-shots (triggered by
// watching state change in updateAudio, so combat.js stays decoupled),
// and a slow bass-and-hat music loop. M toggles input.muted, which
// zeroes the master gain. The context is created lazily on the first
// user gesture (startAudio) because browsers block it before that.

export function createAudio(state) {
  state.audio = {
    ctx: null, master: null,
    engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    musicGain: null, nextNoteAt: 0, step: 0,
    prevPlayerBullets: 0, prevBooms: 0, prevPickups: 0,
  };
  return state.audio;
}

export function startAudio(state) {
  const a = state.audio;
  if (!a || a.ctx) {
    if (a && a.ctx && a.ctx.state === 'suspended') a.ctx.resume();
    return;
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    a.ctx = ctx;
    a.master = ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(ctx.destination);
    // Engine: a detuned saw pair through a lowpass, gain driven per-frame.
    a.engineOsc = ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    a.engineGain = ctx.createGain();
    a.engineGain.gain.value = 0;
    a.engineOsc.connect(engineFilter).connect(a.engineGain).connect(a.master);
    a.engineOsc.start();
    // Siren: square osc whose frequency an LFO flips between two tones.
    a.sirenOsc = ctx.createOscillator();
    a.sirenOsc.type = 'triangle';
    a.sirenOsc.frequency.value = 720;
    a.sirenLfo = ctx.createOscillator();
    a.sirenLfo.type = 'square';
    a.sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    a.sirenLfo.connect(lfoGain).connect(a.sirenOsc.frequency);
    a.sirenGain = ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain).connect(a.master);
    a.sirenOsc.start();
    a.sirenLfo.start();
    // Music bus.
    a.musicGain = ctx.createGain();
    a.musicGain.gain.value = 0.16;
    a.musicGain.connect(a.master);
    a.nextNoteAt = ctx.currentTime + 0.1;
  } catch (e) {
    a.ctx = null;
  }
}

function noiseBuffer(ctx) {
  if (ctx._kbNoise) return ctx._kbNoise;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  ctx._kbNoise = buf;
  return buf;
}

function playShot(a) {
  const ctx = a.ctx;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.24, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  src.connect(filter).connect(g).connect(a.master);
  src.start(t);
  src.stop(t + 0.12);
}

function playBoom(a) {
  const ctx = a.ctx;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(g).connect(a.master);
  osc.start(t);
  osc.stop(t + 0.6);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.2, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  src.connect(ng).connect(a.master);
  src.start(t);
  src.stop(t + 0.45);
}

function playPickup(a) {
  const ctx = a.ctx;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.setValueAtTime(990, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(g).connect(a.master);
  osc.start(t);
  osc.stop(t + 0.17);
}

const BASSLINE = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 73.42, 0, 61.74, 0]; // A1 C2 B1 D2 E2-ish walk
function scheduleMusic(a, state) {
  const ctx = a.ctx;
  const stepDur = 0.21;
  while (a.nextNoteAt < ctx.currentTime + 0.3) {
    const t = a.nextNoteAt;
    const step = a.step % 16;
    const freq = BASSLINE[step];
    if (freq && state.mode === 'play') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + stepDur * 0.95);
      osc.connect(g).connect(a.musicGain);
      osc.start(t);
      osc.stop(t + stepDur);
    }
    if (step % 2 === 1 && state.mode === 'play') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(hp).connect(g).connect(a.musicGain);
      src.start(t);
      src.stop(t + 0.05);
    }
    a.nextNoteAt += stepDur;
    a.step += 1;
  }
}

export function updateAudio(state) {
  const a = state.audio;
  if (!a || !a.ctx) return;
  const ctx = a.ctx;
  const muted = state.input && state.input.muted;
  a.master.gain.value = muted ? 0 : 0.5;
  const p = state.player;
  // Engine follows the driven car.
  let engineTarget = 0;
  if (p && p.vehicle && !p.dead && state.mode === 'play') {
    const spd = Math.hypot(p.vehicle.vx || 0, p.vehicle.vy || 0);
    a.engineOsc.frequency.value = 52 + spd * 0.55;
    engineTarget = 0.05 + Math.min(0.05, spd * 0.0002);
  }
  a.engineGain.gain.setTargetAtTime(engineTarget, ctx.currentTime, 0.08);
  // Siren while any star is lit.
  const sirenTarget = state.wanted && state.wanted.level > 0 && state.mode === 'play' ? 0.028 : 0;
  a.sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.2);
  // One-shots from state deltas.
  const playerBullets = (state.bullets || []).filter((b) => b.from === 'player').length;
  if (playerBullets > a.prevPlayerBullets) playShot(a);
  a.prevPlayerBullets = playerBullets;
  const booms = (state.booms || []).length;
  if (booms > a.prevBooms) playBoom(a);
  a.prevBooms = booms;
  const pickups = (state.pickups || []).length;
  if (pickups < a.prevPickups && p && !p.dead) playPickup(a);
  a.prevPickups = pickups;
  scheduleMusic(a, state);
}
