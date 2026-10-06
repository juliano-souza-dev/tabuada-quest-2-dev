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
    this.elapsed = 0;

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

      this.base = new TilingSprite({
        texture,
        width: 1,
        height: 1
      });

      this.highlights = new TilingSprite({
        texture,
        width: 1,
        height: 1
      });
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

      this.water.addChild(this.base, this.highlights);
      this.water.filters = [this.displacementFilter];

      // O mapa participa do filtro, mas não precisa ser visível.
      this.view.addChild(this.displacementMap);
      this.fallback.visible = false;
    } catch (error) {
      console.error('[OceanRenderer] Ocean GPU effect failed:', error);
      this.fallback.visible = true;
    }
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;

    const margin = 96;
    const left = -width - margin;
    const top = -height - margin;
    const renderWidth = width * 2 + margin * 2;
    const renderHeight = height * 2 + margin * 2;

    for (const layer of [this.base, this.highlights]) {
      if (!layer) continue;
      layer.position.set(left, top);
      layer.width = renderWidth;
      layer.height = renderHeight;
    }

    if (this.displacementMap) {
      this.displacementMap.position.set(0, 0);
      this.displacementMap.width = renderWidth * 1.2;
      this.displacementMap.height = renderHeight * 1.2;
    }

    this.fallback
      .clear()
      .rect(-width, -height, width * 2, height * 2)
      .fill('#0b4263');
  }

  update(dt) {
    if (!this.base || !this.displacementMap) return;

    this.elapsed += dt;

    // O desenho da água permanece praticamente ancorado no mundo.
    // O movimento vem da deformação dos pixels, não de uma textura deslizando.
    const slowWave = this.elapsed * 0.42;
    const crossWave = this.elapsed * 0.31;

    this.displacementMap.x = Math.sin(slowWave) * 22;
    this.displacementMap.y = Math.cos(crossWave) * 16;
    this.displacementMap.rotation = Math.sin(this.elapsed * 0.17) * 0.012;

    // Segunda leitura de onda para quebrar a repetição do tile.
    this.highlights.tilePosition.x = Math.sin(this.elapsed * 0.23) * 12;
    this.highlights.tilePosition.y = Math.cos(this.elapsed * 0.19) * 9;

    const breathing = 0.82 + Math.sin(this.elapsed * 0.38) * 0.006;
    this.highlights.tileScale.set(breathing);
  }
}
