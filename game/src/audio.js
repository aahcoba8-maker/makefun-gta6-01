// Procedural WebAudio for Karang Bay: engine hum, police siren, gunshots,
// explosions, pickups and a lazy bass-line music loop. The context is only
// created after a user gesture (state.audio.started) and every path is
// guarded, so headless runs and muted browsers never throw.
export function createAudio() {
  return {
    ctx: null, master: null,
    engine: null, engineGain: null,
    siren: null, sirenGain: null,
    nextNote: 0, noteIdx: 0, started: false,
  };
}

function ensureCtx(state) {
  const a = state.audio;
  if (!a || a.ctx || !a.started) return null;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = state.input && state.input.muted ? 0 : 0.5;
    a.master.connect(a.ctx.destination);
    a.engine = a.ctx.createOscillator();
    a.engine.type = 'sawtooth';
    a.engine.frequency.value = 55;
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    a.engine.connect(lp); lp.connect(a.engineGain); a.engineGain.connect(a.master);
    a.engine.start();
    a.siren = a.ctx.createOscillator();
    a.siren.type = 'triangle';
    a.siren.frequency.value = 700;
    a.sirenGain = a.ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.siren.connect(a.sirenGain); a.sirenGain.connect(a.master);
    a.siren.start();
  } catch { a.ctx = null; }
  return a.ctx;
}

function blip(state, freq, dur, type, vol, slideTo) {
  try {
    const a = state.audio;
    if (!a || !a.ctx) return;
    const t = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio is decoration */ }
}

function noise(state, dur, vol, freq) {
  try {
    const a = state.audio;
    if (!a || !a.ctx) return;
    const n = Math.floor(a.ctx.sampleRate * dur);
    const buf = a.ctx.createBuffer(1, n, a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 900;
    const g = a.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.master);
    src.start();
  } catch { /* audio is decoration */ }
}

export function audioShot(state) { noise(state, 0.09, 0.22, 2400); blip(state, 160, 0.07, 'square', 0.1, 60); }
export function audioBoom(state) { noise(state, 0.5, 0.5, 300); blip(state, 70, 0.45, 'sine', 0.5, 32); }
export function audioPickup(state) { blip(state, 880, 0.09, 'sine', 0.18); blip(state, 1318, 0.14, 'sine', 0.14); }
export function audioHurt(state) { blip(state, 220, 0.15, 'sawtooth', 0.18, 110); }

const BASS = [55, 55, 82.41, 55, 65.41, 55, 98, 82.41];

export function updateAudio(state, dt) {
  const a = state.audio;
  if (!a) return;
  if (!a.ctx) { ensureCtx(state); if (!a.ctx) return; }
  try {
    if (a.master) a.master.gain.value = state.input && state.input.muted ? 0 : 0.5;
    const p = state.player;
    const driving = !!p.vehicle && !p.dead;
    const spd = driving ? Math.abs(p.vehicle.speed) : 0;
    if (a.engine) {
      a.engine.frequency.value = 50 + spd * 0.55;
      a.engineGain.gain.value = driving ? 0.04 + spd * 0.0004 : 0;
    }
    const policeNear = state.wanted.level >= 2 &&
      (state.officers.length > 0 || state.cars.some((c) => c.police));
    if (a.siren) {
      a.siren.frequency.value = 700 + Math.sin(state.time * 6) * 180;
      a.sirenGain.gain.value = policeNear ? 0.03 : 0;
    }
    const now = a.ctx.currentTime;
    if (state.mode === 'play' && now >= a.nextNote) {
      a.nextNote = now + 0.42;
      const f = BASS[a.noteIdx % BASS.length];
      a.noteIdx += 1;
      blip(state, f, 0.3, 'triangle', 0.09);
      if (a.noteIdx % 2 === 0) blip(state, f * 4, 0.12, 'sine', 0.025);
    }
  } catch { /* audio is decoration */ }
}
