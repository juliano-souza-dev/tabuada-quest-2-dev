import { Container, Graphics, TilingSprite } from 'pixi.js';

const OCEAN_TILE_URL = new URL('../../../assets/oceans/ocean-tile.webp', import.meta.url).href;

// Mesmo comportamento-base do oceano antigo (R1).
const OCEAN_CONFIG = Object.freeze({
  speed: 58,
  directionX: 1,
  directionY: 0.68,
  swell: 55,
  layers: Object.freeze({
    deep: Object.freeze({ driftX: 7, driftY: 4, tileScale: 1.18, opacity: 1 }),
    wave: Object.freeze({ driftX: 18, driftY: 11, tileScale: 0.72, opacity: 0.34 }),
    foam: Object.freeze({ driftX: 36, driftY: 24, tileScale: 0.48, opacity: 0.20 })
  })
});

export class OceanRenderer {
  constructor() {
    this.view = new Container();
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.layers = [];

    this.fallback = new Graphics()
      .rect(-1024, -1024, 2048, 2048)
      .fill('#0b4263');

    this.view.addChild(this.fallback);
  }

  async init(assets) {
    if (!assets || this.layers.length) return;

    try {
      const texture = await assets.load(OCEAN_TILE_URL);

      this.layers = Object.values(OCEAN_CONFIG.layers).map((config) => {
        const layer = new TilingSprite({
          texture,
          width: 1,
          height: 1
        });

        layer.alpha = config.opacity;
        layer.tileScale.set(config.tileScale);
        layer.eventMode = 'none';
        layer._oceanConfig = config;
        return layer;
      });

      for (let i = this.layers.length - 1; i >= 0; i -= 1) {
        this.view.addChildAt(this.layers[i], 0);
      }

      this.fallback.visible = false;
    } catch (error) {
      console.error('[OceanRenderer] Failed to load ocean tile:', error);
      this.fallback.visible = true;
    }
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;

    for (const layer of this.layers) {
      layer.position.set(-width, -height);
      layer.width = width * 2;
      layer.height = height * 2;
    }

    this.fallback
      .clear()
      .rect(-width, -height, width * 2, height * 2)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.layers.length) return;

    this.time += dt;

    const basePxPerSecond = OCEAN_CONFIG.speed * 0.42;
    const swellAmount = (OCEAN_CONFIG.swell / 100) * 0.016;
    const swellPhase = this.time * (0.42 + OCEAN_CONFIG.speed / 180);
    const swellScale = 1 + swellAmount * (0.5 + 0.5 * Math.sin(swellPhase));

    for (const layer of this.layers) {
      const config = layer._oceanConfig;
      const vx = config.driftX + basePxPerSecond * OCEAN_CONFIG.directionX;
      const vy = config.driftY + basePxPerSecond * OCEAN_CONFIG.directionY;

      layer.tilePosition.x = this.time * vx;
      layer.tilePosition.y = this.time * vy;

      const scale = config.tileScale * swellScale;
      layer.tileScale.set(scale);
    }
  }
}
