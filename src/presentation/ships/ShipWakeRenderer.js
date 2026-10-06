import { Container, Graphics } from 'pixi.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const WAKE = Object.freeze({
  opacity: 0.78,
  width: 66,
  length: 240,
  rateMs: 55,
  minSpeed: 35,
  maxSamples: 72
});

export class ShipWakeRenderer {
  constructor({ shipHeight = 116 } = {}) {
    this.view = new Container();
    this.graphics = new Graphics();
    this.view.addChild(this.graphics);

    this.shipHeight = shipHeight;
    this.samples = [];
    this.elapsedMs = 0;
    this.lastSampleMs = -Infinity;

    this.view.eventMode = 'none';
  }

  update(transform, movement, dt) {
    this.elapsedMs += Math.max(0, dt) * 1000;

    const speed = Math.max(0, Number(movement?.speed) || 0);
    const maxSpeed = Math.max(120, Number(movement?.maxSpeed) || 320);
    const lifetime = clamp(
      1100 + WAKE.length * 6.2,
      1600,
      6200
    );

    this.samples = this.samples.filter(
      (sample) => this.elapsedMs - sample.time < lifetime
    );

    if (
      !transform ||
      speed < WAKE.minSpeed ||
      this.elapsedMs - this.lastSampleMs < WAKE.rateMs
    ) {
      return;
    }

    this.lastSampleMs = this.elapsedMs;

    const angle = Number(transform.rotation || 0) * Math.PI / 180;
    const forwardX = Math.sin(angle);
    const forwardY = -Math.cos(angle);
    const sternDistance = this.shipHeight * 0.35 + 8;

    const sample = {
      x: Number(transform.x || 0) - forwardX * sternDistance,
      y: Number(transform.y || 0) - forwardY * sternDistance,
      heading: Number(transform.rotation || 0),
      speedFactor: clamp(speed / maxSpeed, 0.18, 1),
      time: this.elapsedMs
    };

    const previous = this.samples[this.samples.length - 1];
    if (previous && distance(previous, sample) < 4) return;

    this.samples.push(sample);

    let totalDistance = 0;
    let keepFrom = Math.max(0, this.samples.length - 1);
    const maxPath = WAKE.length * (0.95 + sample.speedFactor * 0.38);

    for (let i = this.samples.length - 1; i > 0; i -= 1) {
      totalDistance += distance(this.samples[i], this.samples[i - 1]);
      keepFrom = i - 1;
      if (totalDistance >= maxPath) break;
    }

    if (keepFrom > 0) this.samples.splice(0, keepFrom);

    if (this.samples.length > WAKE.maxSamples) {
      this.samples.splice(0, this.samples.length - WAKE.maxSamples);
    }
  }

  section(sample, index, kind, side, lifetime) {
    const count = Math.max(2, this.samples.length);
    const pathAge = 1 - index / (count - 1);
    const timeAge = clamp(
      (this.elapsedMs - sample.time) / lifetime,
      0,
      1
    );

    const age = clamp(Math.max(pathAge * 0.72, timeAge), 0, 1);
    const life = Math.pow(Math.max(0, 1 - age), 1.08);
    const speedFactor = clamp(sample.speedFactor || 0.4, 0.15, 1);
    const spread = WAKE.width * (0.58 + age * 0.92);

    const rad = Number(sample.heading || 0) * Math.PI / 180;
    const rightX = Math.cos(rad);
    const rightY = Math.sin(rad);

    const railCenter = side * spread * 0.31;
    const halfWidth = kind > 0.5
      ? Math.max(2.6, spread * (0.050 + age * 0.028))
      : Math.max(6, spread * (0.19 + age * 0.13));

    const offset = kind > 0.5 ? railCenter : 0;
    const cx = sample.x + rightX * offset;
    const cy = sample.y + rightY * offset;
    const alpha =
      WAKE.opacity *
      life *
      speedFactor *
      (kind > 0.5 ? 0.98 : 0.34);

    return {
      left: {
        x: cx - rightX * halfWidth,
        y: cy - rightY * halfWidth
      },
      right: {
        x: cx + rightX * halfWidth,
        y: cy + rightY * halfWidth
      },
      alpha
    };
  }

  drawStrip(kind, side, color, lifetime) {
    for (let i = 0; i < this.samples.length - 1; i += 1) {
      const a = this.section(this.samples[i], i, kind, side, lifetime);
      const b = this.section(this.samples[i + 1], i + 1, kind, side, lifetime);
      const alpha = (a.alpha + b.alpha) * 0.5;

      if (alpha <= 0.004) continue;

      this.graphics
        .moveTo(a.left.x, a.left.y)
        .lineTo(a.right.x, a.right.y)
        .lineTo(b.right.x, b.right.y)
        .lineTo(b.left.x, b.left.y)
        .closePath()
        .fill({ color, alpha });
    }
  }

  render() {
    this.graphics.clear();

    if (this.samples.length < 2) return;

    const lifetime = clamp(
      1100 + WAKE.length * 6.2,
      1600,
      6200
    );

    // Corpo central suave + dois trilhos claros, como o passe WebGL antigo.
    this.drawStrip(0, 0, 0x9ed9e9, lifetime);
    this.drawStrip(1, -1, 0xe8fbff, lifetime);
    this.drawStrip(1, 1, 0xe8fbff, lifetime);
  }
}
