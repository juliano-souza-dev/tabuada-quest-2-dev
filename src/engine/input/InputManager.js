export class InputManager {
  constructor() {
    this.canvas = null;
    this.pointer = { x: 0, y: 0, down: false, pressed: false };
    this.analog = { x: 0, y: 0, magnitude: 0, active: false };

    this.onPointer = (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      this.pointer.x = event.clientX - rect.left;
      this.pointer.y = event.clientY - rect.top;
    };

    this.onPointerDown = (event) => {
      this.pointer.down = true;
      this.pointer.pressed = true;
      this.onPointer(event);
    };

    this.onPointerUp = () => {
      this.pointer.down = false;
    };
  }

  attach(canvas) {
    this.detach();
    this.canvas = canvas;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointer);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  setAnalog(x, y, magnitude, active = true) {
    this.analog.x = Number.isFinite(x) ? x : 0;
    this.analog.y = Number.isFinite(y) ? y : 0;
    this.analog.magnitude = Math.max(0, Math.min(1, Number(magnitude) || 0));
    this.analog.active = active === true;
  }

  consumePointerPress() {
    if (!this.pointer.pressed) return null;
    this.pointer.pressed = false;
    return { x: this.pointer.x, y: this.pointer.y };
  }

  detach() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointer);
    }
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas = null;
    this.pointer.down = false;
    this.pointer.pressed = false;
    this.setAnalog(0, 0, 0, false);
  }

  update() {}
}
