import { Container, Graphics } from 'pixi.js';

export class TreasureRenderer {
  constructor() {
    this.view = new Container();
    this.nodes = new Map();
    this.elapsed = 0;
    this.view.eventMode = 'none';
  }

  sync(entities) {
    const activeIds = new Set();

    for (const entity of entities) {
      const transform = entity.get('transform');
      if (!transform) continue;

      activeIds.add(entity.id);

      let node = this.nodes.get(entity.id);
      if (!node) {
        node = new Graphics()
          .roundRect(-18, -13, 36, 26, 6)
          .fill(0x7a3d12)
          .stroke({ color: 0xffc33d, width: 3 })
          .rect(-11, -4, 22, 8)
          .fill(0xd79b2b);

        node.eventMode = 'none';
        this.nodes.set(entity.id, node);
        this.view.addChild(node);
      }

      node.position.set(transform.x, transform.y);
    }

    for (const [id, node] of this.nodes) {
      if (activeIds.has(id)) continue;
      node.destroy();
      this.nodes.delete(id);
    }
  }

  update(dt) {
    this.elapsed += Math.max(0, Number(dt) || 0);

    for (const node of this.nodes.values()) {
      node.y += Math.sin(this.elapsed * 2.4 + node.x * 0.01) * 0.08;
      node.rotation = Math.sin(this.elapsed * 1.3 + node.x * 0.003) * 0.02;
    }
  }
}
