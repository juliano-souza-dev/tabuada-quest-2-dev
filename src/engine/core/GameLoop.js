export class GameLoop {
  constructor({ update, render, tickRate = 60 }) {
    this.update = update;
    this.render = render;
    this.step = 1000 / tickRate;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.frame = (time) => this.runFrame(time);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() { this.running = false; }

  runFrame(time) {
    if (!this.running) return;
    const elapsed = Math.min(time - this.lastTime, 250);
    this.lastTime = time;
    this.accumulator += elapsed;
    while (this.accumulator >= this.step) {
      this.update(this.step / 1000);
      this.accumulator -= this.step;
    }
    this.render(this.accumulator / this.step);
    requestAnimationFrame(this.frame);
  }
}
