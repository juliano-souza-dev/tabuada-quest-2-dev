import { Container, Graphics, TilingSprite } from 'pixi.js';

const OCEAN_TILE_URL = new URL('../../../assets/oceans/ocean-tile.webp', import.meta.url).href;

export class OceanRenderer {
  constructor() {
    this.view = new Container();
    this.width = 0;
    this.height = 0;
    this.tile = null;

    this.fallback = new Graphics()
      .rect(-1024, -1024, 2048, 2048)
      .fill('#0b4263');

    this.view.addChild(this.fallback);
  }

  async init(assets) {
    if (!assets || this.tile) return;

    try {
      const texture = await assets.load(OCEAN_TILE_URL);
      this.tile = new TilingSprite({
        texture,
        width: 1,
        height: 1
      });

      this.view.addChildAt(this.tile, 0);
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

    if (this.tile) {
      this.tile.position.set(-width, -height);
      this.tile.width = width * 2;
      this.tile.height = height * 2;
    }

    this.fallback
      .clear()
      .rect(-width, -height, width * 2, height * 2)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.tile) return;

    this.tile.tilePosition.x += dt * 6;
    this.tile.tilePosition.y += dt * 2;
  }
}
