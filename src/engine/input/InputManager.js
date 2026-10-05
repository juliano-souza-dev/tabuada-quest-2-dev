export class InputManager {
  constructor() {
    this.pointer = { x: 0, y: 0, down: false };
    this.onPointer = (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      this.pointer.x = event.clientX - rect.left;
      this.pointer.y = event.clientY - rect.top;
    };
  }

  attach(canvas) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (event) => { this.pointer.down = true; this.onPointer(event); });
    canvas.addEventListener('pointermove', this.onPointer);
    window.addEventListener('pointerup', () => { this.pointer.down = false; });
    window.addEventListener('pointercancel', () => { this.pointer.down = false; });
  }

  update() {}
}
