import { Container } from 'pixi.js';
import { ShipRenderer } from '../ships/ShipRenderer.js';

const PIRATE_NPC_ASSET_URL = new URL(
  '../../../assets/ships/npc/pirate_ship_16dir_1600x1600_4x4.webp',
  import.meta.url
).href;

export class NpcFleetRenderer {
  constructor() {
    this.view = new Container();
    this.renderers = new Map();
    this.assets = null;
    this.pending = new Map();
    this.view.eventMode = 'none';
  }

  async init(assets) {
    this.assets = assets;
    await assets.load(PIRATE_NPC_ASSET_URL);
  }

  async ensureRenderer(entity) {
    if (this.renderers.has(entity.id)) {
      return this.renderers.get(entity.id);
    }

    if (this.pending.has(entity.id)) {
      return this.pending.get(entity.id);
    }

    const promise = (async () => {
      const renderer = new ShipRenderer({
        assetUrl: PIRATE_NPC_ASSET_URL,
        useHalloweenEffects: false
      });

      await renderer.init(this.assets);
      this.renderers.set(entity.id, renderer);
      this.view.addChild(renderer.view);
      this.pending.delete(entity.id);

      return renderer;
    })();

    this.pending.set(entity.id, promise);
    return promise;
  }

  sync(entities) {
    const activeIds = new Set();

    for (const entity of entities) {
      activeIds.add(entity.id);

      let renderer =
        this.renderers.get(entity.id);

      if (!renderer) {
        this.ensureRenderer(entity);
        continue;
      }

      renderer.render(
        entity.get('transform'),
        entity.get('visual')
      );
    }

    for (const [id, renderer] of this.renderers) {
      if (activeIds.has(id)) continue;
      renderer.destroy();
      this.renderers.delete(id);
    }
  }

  advance(dt) {
    for (const renderer of this.renderers.values()) {
      renderer.advance(dt);
    }
  }

  destroy() {
    for (const renderer of this.renderers.values()) {
      renderer.destroy();
    }

    this.renderers.clear();
    this.pending.clear();
    this.view.destroy();
  }
}
