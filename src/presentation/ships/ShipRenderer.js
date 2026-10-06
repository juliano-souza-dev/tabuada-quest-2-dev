import { Container } from 'pixi.js';
import { DirectionalSprite } from './DirectionalSprite.js';
import { HalloweenShipFilter } from './filters/HalloweenShipFilter.js';
import { GhostParticleField } from './GhostParticleField.js';

const SHIP_ASSET_URL = new URL(
  '../../../assets/ships/player/starter/galeao_halloween_400x400-validated.webp',
  import.meta.url
).href;

export class ShipRenderer {
  constructor() {
    this.view = new Container();
    this.directional = null;
    this.elapsed = 0;
    this.halloweenFilter = new HalloweenShipFilter();
    this.ghostParticles = new GhostParticleField();
    this.visualScale = 0.5;
    this.view.eventMode = 'none';
  }

  async init(assets) {
    if (!assets || this.directional) return;

    const sheetTexture = await assets.load(SHIP_ASSET_URL);
    this.directional = new DirectionalSprite(sheetTexture, { displayScale: 1 });
    this.directional.sprite.filters = [this.halloweenFilter];

    this.view.addChild(
      this.ghostParticles.view,
      this.directional.sprite
    );
  }

  advance(dt) {
    this.elapsed += dt;
    this.halloweenFilter?.update(this.elapsed);
    this.ghostParticles?.update(dt);
  }

  render(transform, visual = null) {
    this.view.position.set(transform.x, transform.y);

    if (!this.directional) return;

    this.directional.setDirection(transform.rotation);

    const requestedScale = Math.max(
      0.1,
      Number(visual?.scale) || 0.5
    );

    if (requestedScale !== this.visualScale) {
      this.visualScale = requestedScale;
      this.directional.sprite.scale.set(requestedScale);
      this.ghostParticles.setScale(requestedScale / 0.5);
    }

    this.ghostParticles.view.visible =
      visual?.effects?.ghostParticles !== false;

    const sprite = this.directional.sprite;

    // O navio deve permanecer estável sobre o oceano.
    // Movimento visual vem da navegação, não de oscilação artificial.
    sprite.y = 0;
    sprite.rotation = 0;
  }
}
