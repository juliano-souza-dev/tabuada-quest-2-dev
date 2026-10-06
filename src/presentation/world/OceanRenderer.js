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

    this.base = null;
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

      this.base = new TilingSprite({ texture, width: 1, height: 1 });
      this.base.eventMode = 'none';

      this.surfaceFilter = new OceanSurfaceFilter();
      this.water.addChild(this.base);
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

    this.surfaceFilter?.setWorldRect(left, top, renderWidth, renderHeight);

    if (this.base) {
      this.base.position.set(left, top);
      this.base.width = renderWidth;
      this.base.height = renderHeight;

      // Compensa a janela reciclada do TilingSprite: o mesmo ponto do mundo
      // sempre mostra o mesmo trecho da textura.
      this.base.tilePosition.set(-left, -top);
    }

    this.fallback
      .clear()
      .rect(left, top, renderWidth, renderHeight)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.base) return;
    this.elapsed += dt;
    this.surfaceFilter?.update(this.elapsed);
  }
}
