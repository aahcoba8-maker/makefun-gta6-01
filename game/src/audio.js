// audio.js — procedural WebAudio for Karang Bay: engine, siren, gunshot,
// explosion, pickup and a small music loop. Starts only after a user
// gesture; every path is guarded so headless / no-audio never throws.
export function createAudio(state) {
  const a = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, musicTimer: 0, musicStep: 0, started: false,
  };
  state.audio = a;
  const unlock = () => { ensureCtx(state); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return a;
}

function ensureCtx(state) {
  const a = state.audio;
  if (!a || a.ctx) { if (a && a.ctx && a.ctx.state === 'suspended') a.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    a.ctx = new AC();
    a.master = a.ctx.createGain();
    a.master.gain.value = state.input && state.input.muted ? 0 : 0.5;
    a.master.connect(a.ctx.destination);
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    a.engineOsc.connect(lp); lp.connect(a.engineGain); a.engineGain.connect(a.master);
    a.engineOsc.start();
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'triangle'; a.sirenOsc.frequency.value = 700;
    a.sirenGain = a.ctx.createGain(); a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain); a.sirenGain.connect(a.master);
    a.sirenOsc.start();
    a.started = true;
  } catch (e) { /* no audio available */ }
}

function blip(a, freq, dur, type, vol, slideTo) {
  if (!a.ctx) return;
  try {
    const t = a.ctx.currentTime;
    const o = a.ctx.createOscillator(); const g = a.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.master); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* ignore */ }
}

function noise(a, dur, vol, freq) {
  if (!a.ctx) return;
  try {
    const t = a.ctx.currentTime;
    const len = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.ctx.createBufferSource(); src.buffer = buf;
    const f = a.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = a.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.master); src.start(t);
  } catch (e) { /* ignore */ }
}

export function sfx(state, kind) {
  const a = state.audio;
  if (!a || !a.ctx) return;
  if (kind === 'shot') noise(a, 0.12, 0.25, 1800);
  else if (kind === 'boom') { noise(a, 0.7, 0.6, 220); blip(a, 90, 0.6, 'sine', 0.5, 34); }
  else if (kind === 'pickup') { blip(a, 660, 0.09, 'sine', 0.22); blip(a, 990, 0.14, 'sine', 0.18); }
  else if (kind === 'cash') blip(a, 1180, 0.1, 'square', 0.12, 1560);
  else if (kind === 'hit') noise(a, 0.06, 0.15, 900);
  else if (kind === 'busted') { blip(a, 392, 0.16, 'square', 0.2); blip(a, 311, 0.22, 'square', 0.2); }
}

const BASS = [55, 55, 65.4, 55, 49, 49, 58.3, 73.4];
export function updateAudio(state, dt) {
  const a = state.audio;
  if (!a || !a.ctx) return;
  try {
    if (a.master) a.master.gain.value = state.input && state.input.muted ? 0 : 0.5;
    const p = state.player;
    const driving = p && p.vehicle && state.mode === 'play';
    if (a.engineGain) {
      const target = driving ? 0.05 + Math.min(0.05, Math.abs(p.vehicle.speed || 0) / 4000) : 0;
      a.engineGain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.08);
      if (a.engineOsc) a.engineOsc.frequency.setTargetAtTime(55 + Math.abs(p.vehicle ? p.vehicle.speed || 0 : 0) * 0.55, a.ctx.currentTime, 0.08);
    }
    const sirenOn = state.wanted && state.wanted.level >= 2 && state.mode === 'play';
    if (a.sirenGain) {
      a.sirenGain.gain.setTargetAtTime(sirenOn ? 0.028 : 0, a.ctx.currentTime, 0.2);
      if (a.sirenOsc && sirenOn) a.sirenOsc.frequency.value = 700 + Math.sin(state.time * 5.2) * 160;
    }
    if (state.mode === 'play' || state.mode === 'title') {
      a.musicTimer -= dt;
      if (a.musicTimer <= 0) {
        a.musicTimer = 0.42;
        const f = BASS[a.musicStep % BASS.length];
        a.musicStep += 1;
        blip(a, f, 0.4, 'triangle', 0.16);
        if (a.musicStep % 2 === 0) blip(a, f * 4, 0.18, 'sine', 0.05);
      }
    }
  } catch (e) { /* audio must never break the loop */ }
}
