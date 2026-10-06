import {
  Container,
  Graphics,
  BlurFilter
} from 'pixi.js';

const PARTICLE_COUNT = 20;
const TAU = Math.PI * 2;

const pseudo = (i, salt = 0) => {
  const n = Math.sin(
    (i + 1) * (12.9898 + salt * 7.233)
  ) * 43758.5453;

  return n - Math.floor(n);
};

function flameGraphic(seed) {
  const outer = seed > 0.55
    ? 0xff4b0a
    : 0xff7a0b;

  const g = new Graphics();

  g
    .moveTo(0, -10)
    .bezierCurveTo(5, -5, 4, 3, 0, 8)
    .bezierCurveTo(-4, 3, -5, -5, 0, -10)
    .fill({
      color: outer,
      alpha: 0.88
    });

  g
    .moveTo(0, -5)
    .bezierCurveTo(2.5, -1, 2, 2, 0, 5)
    .bezierCurveTo(-2, 2, -2.5, -1, 0, -5)
    .fill({
      color: 0xffd45a,
      alpha: 0.94
    });

  g.eventMode = 'none';
  g.blendMode = 'normal';

  return g;
}

export class GhostParticleField {
  constructor() {
    this.view = new Container();
    this.view.eventMode = 'none';

    this.elapsed = 0;
    this.scale = 1;

    this.fireGlow = new Graphics()
      .ellipse(0, 10, 86, 56)
      .fill({
        color: 0xff4a00,
        alpha: 0.085
      });

    this.fireGlow.filters = [
      new BlurFilter({
        strength: 16,
        quality: 2
      })
    ];

    this.fireGlow.blendMode = 'normal';
    this.view.addChild(this.fireGlow);

    this.particles = Array.from(
      { length: PARTICLE_COUNT },
      (_, i) => {
        const seed = pseudo(i, 1);
        const g = flameGraphic(seed);

        this.view.addChild(g);

        return {
          g,
          seed,
          seed2: pseudo(i, 2),
          seed3: pseudo(i, 3),
          phase: pseudo(i, 4) * TAU,
          ember: i % 3 === 0
        };
      }
    );
  }

  setScale(scale) {
    this.scale = Math.max(
      0.1,
      Number(scale) || 1
    );
  }

  update(dt) {
    this.elapsed += Math.max(
      0,
      Number(dt) || 0
    );

    const glowPulse =
      0.90 +
      Math.sin(this.elapsed * 3.2) * 0.10;

    this.fireGlow.scale.set(
      this.scale * glowPulse
    );

    for (
      let i = 0;
      i < this.particles.length;
      i += 1
    ) {
      const p = this.particles[i];

      const cycle =
        (
          this.elapsed *
            (0.42 + p.seed * 0.32) +
          p.seed3
        ) % 1;

      const side =
        p.seed < 0.5 ? -1 : 1;

      // Fica preso perto do casco/mastros.
      const lane =
        28 +
        p.seed2 * 62;

      const baseY =
        -84 +
        p.seed * 164;

      const sway =
        Math.sin(
          this.elapsed *
            (1.8 + p.seed2 * 1.6) +
          p.phase
        ) *
        (3 + p.seed2 * 5);

      const rise =
        cycle *
        (18 + p.seed2 * 30);

      const fadeIn =
        Math.min(1, cycle * 7);

      const fadeOut =
        Math.min(1, (1 - cycle) * 5);

      const fade =
        Math.max(
          0,
          Math.min(fadeIn, fadeOut)
        );

      p.g.x =
        (side * lane + sway) *
        this.scale;

      p.g.y =
        (baseY - rise) *
        this.scale;

      p.g.alpha =
        fade *
        (p.ember ? 0.50 : 0.66);

      const pulse =
        0.82 +
        Math.sin(
          this.elapsed * 5.0 +
          p.phase
        ) * 0.14;

      const s =
        this.scale *
        pulse *
        (p.ember ? 0.52 : 0.82);

      p.g.scale.set(
        s * (0.76 + p.seed2 * 0.25),
        s * (1.05 + cycle * 0.62)
      );

      p.g.rotation =
        Math.sin(
          this.elapsed * 2.1 +
          p.phase
        ) * 0.14;
    }
  }

  destroy() {
    for (const p of this.particles) {
      p.g.destroy();
    }

    this.particles = [];
    this.fireGlow.destroy();
    this.view.destroy();
  }
}
