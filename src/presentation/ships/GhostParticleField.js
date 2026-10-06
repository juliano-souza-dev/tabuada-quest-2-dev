import { Container, Graphics } from 'pixi.js';

const PARTICLE_COUNT = 18;
const TAU = Math.PI * 2;

const pseudo = (i, salt = 0) => {
  const x = Math.sin((i + 1) * (12.9898 + salt * 7.233)) * 43758.5453;
  return x - Math.floor(x);
};

export class GhostParticleField {
  constructor() {
    this.view = new Container();
    this.view.eventMode = 'none';
    this.elapsed = 0;
    this.scale = 1;

    this.particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const ember = i % 5 === 0;
      const g = new Graphics()
        .circle(0, 0, ember ? 2.0 : 2.8)
        .fill(ember ? 0xff7a18 : 0x73f7dc);

      g.alpha = 0;
      g.blendMode = 'add';
      g.eventMode = 'none';
      this.view.addChild(g);

      return {
        g,
        seed: pseudo(i, 1),
        seed2: pseudo(i, 2),
        phase: pseudo(i, 3) * TAU,
        lifeOffset: pseudo(i, 4),
        ember
      };
    });
  }

  setScale(scale) {
    this.scale = Math.max(0.1, Number(scale) || 1);
  }

  update(dt) {
    this.elapsed += Math.max(0, Number(dt) || 0);

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];

      const cycle = (this.elapsed * (0.18 + p.seed * 0.12) + p.lifeOffset) % 1;
      const fadeIn = Math.min(1, cycle * 6);
      const fadeOut = Math.min(1, (1 - cycle) * 4);
      const fade = Math.max(0, Math.min(fadeIn, fadeOut));

      const side = (p.seed - 0.5) * 150;
      const rise = 70 + cycle * (110 + p.seed2 * 90);
      const sway = Math.sin(this.elapsed * (0.8 + p.seed) + p.phase) * (10 + p.seed2 * 14);

      p.g.x = (side + sway) * this.scale;
      p.g.y = (-40 - rise) * this.scale;
      p.g.alpha = fade * (p.ember ? 0.42 : 0.24);

      const pulse = 0.75 + 0.35 * Math.sin(this.elapsed * 2.2 + p.phase);
      const localScale = (p.ember ? 0.8 : 1.25) * pulse * this.scale;
      p.g.scale.set(localScale);
    }
  }

  destroy() {
    for (const p of this.particles) p.g.destroy();
    this.particles = [];
    this.view.destroy();
  }
}
