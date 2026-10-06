import {
  Container,
  Sprite
} from 'pixi.js';

const HALLOWEEN_TREASURE_URL = new URL(
  '../../../assets/treasures/events/halloween/abobora_magica_halloween_brilhante_50kb.webp',
  import.meta.url
).href;

export class TreasureRenderer {
  constructor() {
    this.view = new Container();
    this.nodes = new Map();
    this.elapsed = 0;
    this.texture = null;
    this.view.eventMode = 'none';
  }

  async init(assets) {
    if (!assets || this.texture) return;
    this.texture = await assets.load(HALLOWEEN_TREASURE_URL);
  }

  sync(entities) {
    const activeIds = new Set();

    for (const entity of entities) {
      const transform = entity.get('transform');
      if (!transform || !this.texture) continue;

      activeIds.add(entity.id);

      let node = this.nodes.get(entity.id);

      if (!node) {
        const sprite = new Sprite(this.texture);
        sprite.anchor.set(0.5);

        const maxSide = Math.max(
          1,
          this.texture.width,
          this.texture.height
        );

        const scale = 92 / maxSide;
        sprite.scale.set(scale);
        sprite.eventMode = 'none';

        node = {
          sprite,
          baseX: transform.x,
          baseY: transform.y,
          phase: this.nodes.size * 0.91
        };

        this.nodes.set(entity.id, node);
        this.view.addChild(sprite);
      }

      node.baseX = transform.x;
      node.baseY = transform.y;
    }

    for (const [id, node] of this.nodes) {
      if (activeIds.has(id)) continue;
      node.sprite.destroy();
      this.nodes.delete(id);
    }
  }

  update(dt) {
    this.elapsed += Math.max(0, Number(dt) || 0);

    for (const node of this.nodes.values()) {
      node.sprite.x = node.baseX;
      node.sprite.y =
        node.baseY +
        Math.sin(
          this.elapsed * 2.1 + node.phase
        ) * 4;

      node.sprite.rotation =
        Math.sin(
          this.elapsed * 1.25 + node.phase
        ) * 0.025;
    }
  }

  destroy() {
    for (const node of this.nodes.values()) {
      node.sprite.destroy();
    }

    this.nodes.clear();
    this.view.destroy();
  }
}
