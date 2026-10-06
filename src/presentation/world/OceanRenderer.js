import { Container, Graphics, TilingSprite } from 'pixi.js';

const OCEAN_TILE_URL = new URL('../../../assets/oceans/ocean-tile.webp', import.meta.url).href;

const LAYERS = [
  { scale: 1.00, alpha: 1.00, vx: 5.5,  vy: 2.5 },
  { scale: 0.78, alpha: 0.26, vx: 11.0, vy: 4.0 },
  { scale: 1.34, alpha: 0.12, vx: -3.5, vy: 6.5 }
];

export class OceanRenderer {
  constructor() {
    this.view = new Container();
    this.width = 0;
    this.height = 0;
    this.elapsed = 0;
    this.surfaces = [];

    this.fallback = new Graphics()
      .rect(-1024, -1024, 2048, 2048)
      .fill('#0b4263');

    this.view.addChild(this.fallback);
  }

  async init(assets) {
    if (!assets || this.surfaces.length) return;

    try {
      const texture = await assets.load(OCEAN_TILE_URL);

      this.surfaces = LAYERS.map((settings) => {
        const surface = new TilingSprite({
          texture,
          width: 1,
          height: 1
        });

        surface.alpha = settings.alpha;
        surface.tileScale.set(settings.scale);
        surface.eventMode = 'none';
        surface.oceanMotion = settings;

        return surface;
      });

      for (const surface of this.surfaces) {
        this.view.addChild(surface);
      }

      this.fallback.visible = false;
    } catch (error) {
      console.error('[OceanRenderer] Ocean texture load failed:', error);
      this.fallback.visible = true;
    }
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;

    const margin = 96;

    for (const surface of this.surfaces) {
      surface.position.set(-width - margin, -height - margin);
      surface.width = width * 2 + margin * 2;
      surface.height = height * 2 + margin * 2;
    }

    this.fallback
      .clear()
      .rect(-width, -height, width * 2, height * 2)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.surfaces.length) return;

    this.elapsed += dt;

    this.surfaces.forEach((surface, index) => {
      const motion = surface.oceanMotion;
      const phase = this.elapsed * (0.32 + index * 0.09);
      const pulse = 1 + Math.sin(phase) * (0.0025 + index * 0.0008);

      surface.tilePosition.x += motion.vx * dt;
      surface.tilePosition.y += motion.vy * dt;
      surface.tileScale.set(motion.scale * pulse);
    });
  }
}
