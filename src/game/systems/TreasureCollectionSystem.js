export class TreasureCollectionSystem {
  findClickedTreasure(world, point) {
    if (!world || !point) return null;

    let best = null;
    let bestDistance = Infinity;

    for (const entity of world.entities.withComponents('transform', 'treasure')) {
      const transform = entity.get('transform');
      const treasure = entity.get('treasure');

      const distance = Math.hypot(
        transform.x - point.x,
        transform.y - point.y
      );

      const radius = Math.max(
        1,
        Number(treasure?.clickRadius) || 110
      );

      if (distance <= radius && distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }

    return best;
  }

  isCollectorInRange(collector, treasureEntity) {
    const collectorTransform = collector?.get?.('transform');
    const targetTransform = treasureEntity?.get?.('transform');
    const treasure = treasureEntity?.get?.('treasure');

    if (!collectorTransform || !targetTransform || !treasure) {
      return false;
    }

    const distance = Math.hypot(
      targetTransform.x - collectorTransform.x,
      targetTransform.y - collectorTransform.y
    );

    return distance <= Math.max(
      1,
      Number(treasure.collectRadius) || 84
    );
  }
}
