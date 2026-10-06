import { Container, Sprite } from 'pixi.js';

const SHIP_ASSET_URL = new URL(
  '../../../assets/ships/player/starter/galeao_halloween_400x400.webp',
  import.meta.url
).href;

export class ShipRenderer {
  constructor() {
    this.view = new Container();
    this.sprite = null;
    this.elapsed = 0;
    this.view.eventMode = 'none';
  }

  async init(assets) {
    if (!assets || this.sprite) return;

    const texture = await assets.load(SHIP_ASSET_URL);
    const sprite = new Sprite(texture);

    sprite.anchor.set(0.5);
    sprite.width = 190;
    sprite.height = 190;
    sprite.eventMode = 'none';

    this.sprite = sprite;
    this.view.addChild(sprite);
  }

  update(transform, dt) {
    this.elapsed += dt;
    this.view.position.set(transform.x, transform.y);

    if (!this.sprite) return;

    this.sprite.y = Math.sin(this.elapsed * 1.8) * 2.5;
    this.sprite.rotation = Math.sin(this.elapsed * 1.1) * 0.008;
  }
}
