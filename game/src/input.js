// input.js — keyboard + mouse state for Karang Bay (Raka's controls).
// WASD/arrows move, Shift runs, E interacts, Space is the handbrake,
// Esc pauses, M mutes, R reloads. The mouse aims; holding the left
// button attacks / shoots toward the cursor.
// The main loop calls updateInput(state) before the other systems each
// frame and endFrameInput(input) afterwards, so the *Pressed flags act
// as clean one-frame edges. World mouse coords need state.camera.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    moveX: 0, moveY: 0,
    forward: false, back: false, left: false, right: false,
    run: false, handbrake: false,
    interactHeld: false, interactPressed: false,
    attackHeld: false, attackPressed: false,
    pausePressed: false, mutePressed: false, reloadPressed: false,
    paused: false, muted: false,
    mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  };
  const target = canvas || window;
  const onKeyDown = (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'KeyE') input.interactPressed = true;
      if (e.code === 'Escape') { input.pausePressed = true; input.paused = !input.paused; }
      if (e.code === 'KeyM') { input.mutePressed = true; input.muted = !input.muted; }
      if (e.code === 'KeyR') input.reloadPressed = true;
    }
    input.keys.add(e.code);
  };
  const onKeyUp = (e) => { input.keys.delete(e.code); };
  const onBlur = () => { input.keys.clear(); input.attackHeld = false; input.mouse.down = false; };
  const onMove = (e) => {
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      input.mouse.x = e.clientX - r.left;
      input.mouse.y = e.clientY - r.top;
    } else {
      input.mouse.x = e.clientX;
      input.mouse.y = e.clientY;
    }
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    input.mouse.down = true;
    if (!input.attackHeld) input.attackPressed = true;
    input.attackHeld = true;
  };
  const onUp = (e) => {
    if (e.button !== 0) return;
    input.mouse.down = false;
    input.attackHeld = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  target.addEventListener('mousemove', onMove);
  target.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  input.destroy = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    target.removeEventListener('mousemove', onMove);
    target.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
  };
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
  input.left = k.has('KeyA') || k.has('ArrowLeft');
  input.right = k.has('KeyD') || k.has('ArrowRight');
  input.forward = k.has('KeyW') || k.has('ArrowUp');
  input.back = k.has('KeyS') || k.has('ArrowDown');
  input.moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  input.moveY = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
  input.run = k.has('ShiftLeft') || k.has('ShiftRight');
  input.handbrake = k.has('Space');
  input.interactHeld = k.has('KeyE');
  const cam = state.camera || { x: 0, y: 0 };
  input.mouse.wx = input.mouse.x + cam.x;
  input.mouse.wy = input.mouse.y + cam.y;
}

export function endFrameInput(input) {
  if (!input) return;
  input.interactPressed = false;
  input.attackPressed = false;
  input.pausePressed = false;
  input.mutePressed = false;
  input.reloadPressed = false;
}
