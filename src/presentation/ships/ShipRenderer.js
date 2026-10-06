import { Container } from 'pixi.js';
import { DirectionalSprite } from './DirectionalSprite.js';
import { HalloweenShipFilter } from './filters/HalloweenShipFilter.js';
import { GhostParticleField } from './GhostParticleField.js';

const DEFAULT_SHIP_ASSET_URL = new URL(
  '../../../assets/ships/player/starter/galeao_halloween_400x400-validated.webp',
  import.meta.url
).href;

export class ShipRenderer {
  constructor({
    assetUrl = DEFAULT_SHIP_ASSET_URL,
    useHalloweenEffects = true,
    frameZeroHeading = 270
  } = {}) {
    this.assetUrl = assetUrl;
    this.useHalloweenEffects = useHalloweenEffects;
    this.frameZeroHeading = frameZeroHeading;
    this.view = new Container();
    this.directional = null;
    this.elapsed = 0;
    this.halloweenFilter =
      useHalloweenEffects
        ? new HalloweenShipFilter()
        : null;

    this.ghostParticles =
      useHalloweenEffects
        ? new GhostParticleField()
        : null;

    this.visualScale = 0.5;
    this.view.eventMode = 'none';
  }

  async init(assets) {
    if (!assets || this.directional) return;

    const sheetTexture =
      await assets.load(this.assetUrl);

    this.directional =
      new DirectionalSprite(
        sheetTexture,
        {
          displayScale: 1,
          frameZeroHeading:
            this.frameZeroHeading
        }
      );

    if (this.halloweenFilter) {
      this.directional.sprite.filters = [
        this.halloweenFilter
      ];
    }

    if (this.ghostParticles) {
      this.view.addChild(
        this.ghostParticles.view
      );
    }

    this.view.addChild(
      this.directional.sprite
    );
  }

  advance(dt) {
    this.elapsed += dt;
    this.halloweenFilter?.update(this.elapsed);
    this.ghostParticles?.update(dt);
  }

  render(transform, visual = null) {
    this.view.position.set(
      transform.x,
      transform.y
    );

    if (!this.directional) return;

    this.directional.setDirection(
      transform.rotation
    );

    const requestedScale = Math.max(
      0.1,
      Number(visual?.scale) || 0.5
    );

    if (
      requestedScale !==
      this.visualScale
    ) {
      this.visualScale =
        requestedScale;

      this.directional.sprite.scale.set(
        requestedScale
      );

      this.ghostParticles?.setScale(
        requestedScale / 0.5
      );
    }

    if (this.ghostParticles) {
      this.ghostParticles.view.visible =
        visual?.effects?.ghostParticles !== false;
    }

    const sprite =
      this.directional.sprite;

    sprite.y = 0;
    sprite.rotation = 0;
  }

  destroy() {
    this.directional?.destroy();
    this.directional = null;
    this.ghostParticles?.view?.destroy?.();
    this.view.destroy();
  }
}
