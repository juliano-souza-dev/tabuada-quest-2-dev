import {
  Container,
  DisplacementFilter,
  Graphics,
  Sprite,
  TilingSprite
} from 'pixi.js';

const OCEAN_TEXTURE_URL = new URL('../../../assets/oceans/ocean.png', import.meta.url).href;

export class OceanRenderer {
  constructor() {
    this.view = new Container();
    this.water = new Container();

    this.width = 0;
    this.height = 0;
    this.cameraX = 0;
    this.cameraY = 0;
    this.elapsed = 0;

    this.depth = null;
    this.base = null;
    this.highlights = null;
    this.displacementMap = null;
    this.displacementFilter = null;

    this.fallback = new Graphics()
      .rect(-1024, -1024, 2048, 2048)
      .fill('#0b4263');

    this.view.addChild(this.fallback);
    this.view.addChild(this.water);
  }

  async init(assets) {
    if (!assets || this.base) return;

    try {
      const texture = await assets.load(OCEAN_TEXTURE_URL);

      this.depth = new TilingSprite({ texture, width: 1, height: 1 });
      this.depth.alpha = 0.34;
      this.depth.tint = 0x0b5b78;
      this.depth.tileScale.set(1.32);
      this.depth.eventMode = 'none';

      this.base = new TilingSprite({ texture, width: 1, height: 1 });
      this.base.eventMode = 'none';

      this.highlights = new TilingSprite({ texture, width: 1, height: 1 });
      this.highlights.alpha = 0.16;
      this.highlights.tileScale.set(0.82);
      this.highlights.eventMode = 'none';

      this.displacementMap = new Sprite(texture);
      this.displacementMap.anchor.set(0.5);
      this.displacementMap.alpha = 0;
      this.displacementMap.eventMode = 'none';

      this.displacementFilter = new DisplacementFilter({
        sprite: this.displacementMap,
        scale: 13
      });

      this.water.addChild(this.depth, this.base, this.highlights);
      this.water.filters = [this.displacementFilter];
      this.view.addChild(this.displacementMap);

      this.fallback.visible = false;
      this.layout();
    } catch (error) {
      console.error('[OceanRenderer] Ocean GPU effect failed:', error);
      this.fallback.visible = true;
    }
  }

  setCameraPosition(x, y) {
    this.cameraX = x;
    this.cameraY = y;
    this.layout();
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;
    this.layout();
  }

  layout() {
    const width = this.width || 1;
    const height = this.height || 1;
    const margin = 160;

    const left = this.cameraX - width - margin;
    const top = this.cameraY - height - margin;
    const renderWidth = width * 2 + margin * 2;
    const renderHeight = height * 2 + margin * 2;

    for (const layer of [this.depth, this.base, this.highlights]) {
      if (!layer) continue;
      layer.position.set(left, top);
      layer.width = renderWidth;
      layer.height = renderHeight;
    }

    if (this.displacementMap) {
      this.displacementMap.position.set(this.cameraX, this.cameraY);
      this.displacementMap.width = renderWidth * 1.2;
      this.displacementMap.height = renderHeight * 1.2;
    }

    this.fallback
      .clear()
      .rect(left, top, renderWidth, renderHeight)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.base || !this.depth || !this.displacementMap) return;

    this.elapsed += dt;

    const slowWave = this.elapsed * 0.42;
    const crossWave = this.elapsed * 0.31;

    this.displacementMap.x = this.cameraX + Math.sin(slowWave) * 22;
    this.displacementMap.y = this.cameraY + Math.cos(crossWave) * 16;
    this.displacementMap.rotation = Math.sin(this.elapsed * 0.17) * 0.012;

    this.base.tilePosition.set(-this.cameraX, -this.cameraY);

    this.depth.tilePosition.x = -this.cameraX * 0.72 + Math.sin(this.elapsed * 0.11) * 18;
    this.depth.tilePosition.y = -this.cameraY * 0.72 + Math.cos(this.elapsed * 0.09) * 14;
    const depthBreathing = 1.32 + Math.sin(this.elapsed * 0.16) * 0.008;
    this.depth.tileScale.set(depthBreathing);

    this.highlights.tilePosition.x =
      -this.cameraX * 1.08 + Math.sin(this.elapsed * 0.23) * 12;
    this.highlights.tilePosition.y =
      -this.cameraY * 1.08 + Math.cos(this.elapsed * 0.19) * 9;

    const breathing = 0.82 + Math.sin(this.elapsed * 0.38) * 0.006;
    this.highlights.tileScale.set(breathing);
  }
}
