import { Container } from 'pixi.js';
import { DirectionalSprite } from './DirectionalSprite.js';

const SHIP_ASSET_URL = new URL(
  '../../../assets/ships/player/starter/galeao_halloween_400x400.webp',
  import.meta.url
).href;

export class ShipRenderer {
  constructor() {
    this.view = new Container();
    this.directional = null;
    this.elapsed = 0;
    this.view.eventMode = 'none';
  }

  async init(assets) {
    if (!assets || this.directional) return;

    const sheetTexture = await assets.load(SHIP_ASSET_URL);
    this.directional = new DirectionalSprite(sheetTexture);
    this.view.addChild(this.directional.sprite);
  }

  advance(dt) {
    this.elapsed += dt;
  }

  render(transform) {
    this.view.position.set(transform.x, transform.y);

    if (!this.directional) return;

    this.directional.setDirection(transform.rotation);

    const sprite = this.directional.sprite;
    sprite.y = Math.sin(this.elapsed * 1.8) * 2.5;
    sprite.rotation = Math.sin(this.elapsed * 1.1) * 0.008;
  }
}
