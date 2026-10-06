import {
  Container,
  Graphics,
  BlurFilter
} from 'pixi.js';

const TAU = Math.PI * 2;
const WISP_COUNT = 14;

const pseudo = (i, salt = 0) => {
  const n = Math.sin(
    (i + 1) * (12.9898 + salt * 7.233)
  ) * 43758.5453;

  return n - Math.floor(n);
};

function makeGhostFlame(color) {
  const g = new Graphics();

  g
    .moveTo(0, -13)
    .bezierCurveTo(6, -7, 6, 2, 0, 10)
    .bezierCurveTo(-6, 2, -6, -7, 0, -13)
    .fill(color);

  g
    .moveTo(0, -7)
    .bezierCurveTo(3, -3, 3, 2, 0, 6)
    .bezierCurveTo(-3, 2, -3, -3, 0, -7)
    .fill(0x8fffd9);

  g.blendMode = 'normal';
  g.eventMode = 'none';
  return g;
}

export class GhostParticleField {
  constructor() {
    this.view = new Container();
    this.view.eventMode = 'none';

    this.elapsed = 0;
    this.scale = 1;

    this.aura = new Graphics()
      .ellipse(0, 14, 118, 80)
      .fill({
        color: 0x20c99c,
        alpha: 0.10
      })
      .ellipse(0, 8, 86, 58)
      .fill({
        color: 0x69e6bd,
        alpha: 0.06
      });

    this.aura.blendMode = 'normal';
    this.aura.filters = [
      new BlurFilter({
        strength: 12,
        quality: 2
      })
    ];

    this.view.addChild(this.aura);

    this.wisps = Array.from(
      { length: WISP_COUNT },
      (_, i) => {
        const ember = i % 4 === 0;

        const g = makeGhostFlame(
          ember ? 0xff6b16 : 0x45efcf
        );

        this.view.addChild(g);

        return {
          g,
          ember,
          seed: pseudo(i, 1),
          seed2: pseudo(i, 2),
          seed3: pseudo(i, 3),
          phase: pseudo(i, 4) * TAU
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

    const auraPulse =
      0.92 +
      Math.sin(this.elapsed * 1.7) * 0.08;

    this.aura.scale.set(
      this.scale * auraPulse
    );

    this.aura.alpha =
      0.78 +
      Math.sin(this.elapsed * 1.25) * 0.08;

    for (
      let i = 0;
      i < this.wisps.length;
      i += 1
    ) {
      const p = this.wisps[i];

      const cycle =
        (
          this.elapsed *
            (0.34 + p.seed * 0.18) +
          p.seed3
        ) % 1;

      const side =
        p.seed < 0.5 ? -1 : 1;

      const lane =
        46 +
        p.seed2 * 54;

      const baseY =
        -72 +
        p.seed * 142;

      const drift =
        Math.sin(
          this.elapsed *
            (1.1 + p.seed2) +
          p.phase
        ) *
        8;

      const rise =
        cycle * (22 + p.seed2 * 24);

      const fadeIn =
        Math.min(1, cycle * 5);

      const fadeOut =
        Math.min(1, (1 - cycle) * 4);

      const fade =
        Math.max(
          0,
          Math.min(fadeIn, fadeOut)
        );

      p.g.x =
        (side * lane + drift) *
        this.scale;

      p.g.y =
        (baseY - rise) *
        this.scale;

      p.g.alpha =
        fade *
        (p.ember ? 0.46 : 0.34);

      const pulse =
        0.78 +
        Math.sin(
          this.elapsed * 2.4 +
          p.phase
        ) * 0.18;

      const size =
        this.scale *
        pulse *
        (p.ember ? 0.72 : 1.0);

      p.g.scale.set(
        size * (0.72 + p.seed2 * 0.30),
        size * (0.90 + cycle * 0.45)
      );

      p.g.rotation =
        Math.sin(
          this.elapsed * 1.3 +
          p.phase
        ) * 0.18;
    }
  }

  destroy() {
    for (const p of this.wisps) {
      p.g.destroy();
    }

    this.wisps = [];
    this.aura.destroy();
    this.view.destroy();
  }
}
