// input.js — keyboard + mouse state for Karang Bay.
// updateInput(state) runs first each frame; endFrameInput(input) runs last
// and clears the one-frame edge flags.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
    moveX: 0, moveY: 0,
    forward: false, back: false, left: false, right: false,
    run: false, handbrake: false,
    interactPressed: false, attackPressed: false, attackHeld: false,
    pausePressed: false, mutePressed: false, reloadPressed: false,
    paused: false, muted: false,
  };
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!input.keys.has(k)) {
      if (k === 'e') input.interactPressed = true;
      if (k === 'r') input.reloadPressed = true;
      if (k === ' ') input.attackPressed = true;
      if (k === 'm') { input.mutePressed = true; input.muted = !input.muted; }
      if (k === 'escape' || k === 'p') { input.pausePressed = true; input.paused = !input.paused; }
    }
    input.keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(e.key.toLowerCase()); });
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.down = false; });
  if (canvas) {
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { if (!input.mouse.down) input.attackPressed = true; input.mouse.down = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  return input;
}

export function attachInput(state, canvas) {
  state.input = createInput(canvas);
  return state.input;
}

export function updateInput(state) {
  const input = state.input;
  if (!input) return;
  const k = input.keys;
  input.left = k.has('a') || k.has('arrowleft');
  input.right = k.has('d') || k.has('arrowright');
  input.forward = k.has('w') || k.has('arrowup');
  input.back = k.has('s') || k.has('arrowdown');
  input.moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  input.moveY = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
  input.run = k.has('shift');
  input.handbrake = k.has(' ');
  input.attackHeld = input.mouse.down || k.has(' ');
  input.mouse.wx = input.mouse.x + (state.camera ? state.camera.x : 0);
  input.mouse.wy = input.mouse.y + (state.camera ? state.camera.y : 0);
}

export function endFrameInput(input) {
  if (!input) return;
  input.interactPressed = false;
  input.attackPressed = false;
  input.pausePressed = false;
  input.mutePressed = false;
  input.reloadPressed = false;
}
