// Keyboard + mouse input for Karang Bay.
// updateInput(state) runs FIRST each frame; endFrameInput(input) runs LAST
// and clears the one-frame edge flags.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    moveX: 0, moveY: 0,
    forward: false, back: false, left: false, right: false,
    run: false, handbrake: false,
    interactPressed: false, attackPressed: false, pausePressed: false,
    mutePressed: false, reloadPressed: false,
    paused: false, muted: false,
    mouse: { x: 640, y: 360, wx: 0, wy: 0, down: false },
    _e: {},
  };
  const gameKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyR', 'KeyM', 'KeyP',
    'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', (ev) => {
    if (gameKeys.includes(ev.code)) ev.preventDefault();
    if (!ev.repeat) {
      if (ev.code === 'KeyE') input._e.interact = true;
      if (ev.code === 'KeyR') input._e.reload = true;
      if (ev.code === 'KeyM') input._e.mute = true;
      if (ev.code === 'KeyP' || ev.code === 'Escape') input._e.pause = true;
    }
    input.keys.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => input.keys.delete(ev.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.down = false; });
  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (ev.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (ev.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) { input.mouse.down = true; input._e.attack = true; }
  });
  window.addEventListener('mouseup', (ev) => { if (ev.button === 0) input.mouse.down = false; });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  return input;
}

export function updateInput(state) {
  const input = state.input;
  const k = input.keys;
  input.forward = k.has('KeyW') || k.has('ArrowUp');
  input.back = k.has('KeyS') || k.has('ArrowDown');
  input.left = k.has('KeyA') || k.has('ArrowLeft');
  input.right = k.has('KeyD') || k.has('ArrowRight');
  input.moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  input.moveY = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
  input.run = k.has('ShiftLeft') || k.has('ShiftRight');
  input.handbrake = k.has('Space');
  input.interactPressed = !!input._e.interact;
  input.attackPressed = !!input._e.attack;
  input.reloadPressed = !!input._e.reload;
  input.pausePressed = !!input._e.pause;
  input.mutePressed = !!input._e.mute;
  if (input.pausePressed) input.paused = !input.paused;
  if (input.mutePressed) input.muted = !input.muted;
  input.mouse.wx = input.mouse.x + state.camera.x;
  input.mouse.wy = input.mouse.y + state.camera.y;
}

export function endFrameInput(input) {
  input._e = {};
  input.interactPressed = false;
  input.attackPressed = false;
  input.reloadPressed = false;
  input.pausePressed = false;
  input.mutePressed = false;
}
