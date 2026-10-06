export class TreasureCollectionSystem {
  update(world, collector) {
    const collectorTransform = collector?.get?.('transform');
    if (!world || !collectorTransform) return [];

    const collected = [];

    for (const entity of world.entities.withComponents('transform', 'treasure')) {
      const treasure = entity.get('treasure');
      if (!treasure || treasure.collected) continue;

      const transform = entity.get('transform');
      const radius = Math.max(1, Number(treasure.collectRadius) || 72);
      const distance = Math.hypot(
        transform.x - collectorTransform.x,
        transform.y - collectorTransform.y
      );

      if (distance > radius) continue;

      treasure.collected = true;

      const payload = {
        treasureId: entity.id,
        kind: treasure.kind,
        reward: { ...(treasure.reward || {}) },
        x: transform.x,
        y: transform.y
      };

      world.events.emit('treasure:collected', payload);
      collected.push(entity);
    }

    for (const entity of collected) {
      world.entities.remove(entity.id);
    }

    return collected;
  }
}
