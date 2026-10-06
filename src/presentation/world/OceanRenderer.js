import { Container, Graphics, TilingSprite } from 'pixi.js';
import { OceanSurfaceFilter } from './filters/OceanSurfaceFilter.js';

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
    this.glints = null;
    this.surfaceFilter = null;

    this.fallback = new Graphics()
      .rect(-1024, -1024, 2048, 2048)
      .fill('#0b4263');

    this.view.addChild(this.fallback, this.water);
  }

  async init(assets) {
    if (!assets || this.base) return;

    try {
      const texture = await assets.load(OCEAN_TEXTURE_URL);

      this.depth = new TilingSprite({ texture, width: 1, height: 1 });
      this.depth.alpha = 0.24;
      this.depth.tint = 0x0a6683;
      this.depth.tileScale.set(1.22);
      this.depth.eventMode = 'none';

      this.base = new TilingSprite({ texture, width: 1, height: 1 });
      this.base.eventMode = 'none';

      this.glints = new TilingSprite({ texture, width: 1, height: 1 });
      this.glints.alpha = 0.10;
      this.glints.tileScale.set(0.88);
      this.glints.eventMode = 'none';

      this.surfaceFilter = new OceanSurfaceFilter();

      this.water.addChild(this.depth, this.base, this.glints);
      this.water.filters = [this.surfaceFilter];

      this.fallback.visible = false;
      this.layout();
    } catch (error) {
      console.error('[OceanRenderer] Ocean surface shader failed:', error);
      this.water.filters = null;
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
    const width = Math.max(1, this.width);
    const height = Math.max(1, this.height);
    const margin = 96;

    const left = this.cameraX - width / 2 - margin;
    const top = this.cameraY - height / 2 - margin;
    const renderWidth = width + margin * 2;
    const renderHeight = height + margin * 2;

    for (const layer of [this.depth, this.base, this.glints]) {
      if (!layer) continue;
      layer.position.set(left, top);
      layer.width = renderWidth;
      layer.height = renderHeight;
    }

    this.fallback
      .clear()
      .rect(left, top, renderWidth, renderHeight)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.base || !this.depth || !this.glints) return;

    this.elapsed += dt;
    this.surfaceFilter?.update(this.elapsed);

    // Mantém o padrão preso ao mundo enquanto a câmera navega.
    this.base.tilePosition.set(-this.cameraX, -this.cameraY);

    // Profundidade quase estática, em escala diferente.
    this.depth.tilePosition.x =
      -this.cameraX * 0.76 + Math.sin(this.elapsed * 0.08) * 5;
    this.depth.tilePosition.y =
      -this.cameraY * 0.76 + Math.cos(this.elapsed * 0.07) * 4;

    // Reflexos têm deriva independente e muito curta.
    this.glints.tilePosition.x =
      -this.cameraX * 1.06 + Math.sin(this.elapsed * 0.17) * 7;
    this.glints.tilePosition.y =
      -this.cameraY * 1.06 + Math.cos(this.elapsed * 0.14) * 5;
  }
}
