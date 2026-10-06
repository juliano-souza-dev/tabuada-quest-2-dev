import { ShipNavigationSystem } from './ShipNavigationSystem.js';
import { NpcDisposition } from '../npc/NpcDisposition.js';

const distanceBetween = (a, b) =>
  Math.hypot(
    (a?.x || 0) - (b?.x || 0),
    (a?.y || 0) - (b?.y || 0)
  );

export class NpcBehaviorSystem {
  constructor({ region, boundaryPadding = 56 } = {}) {
    this.region = region;
    this.boundaryPadding = boundaryPadding;
    this.navigation = new Map();
  }

  navigatorFor(entity) {
    let nav = this.navigation.get(entity.id);

    if (!nav) {
      nav = new ShipNavigationSystem({
        region: this.region,
        boundaryPadding: this.boundaryPadding
      });

      this.navigation.set(entity.id, nav);
    }

    nav.boundaryPadding = this.boundaryPadding;
    return nav;
  }

  notifyAttacked(npcEntity, attackerId, nowSeconds) {
    const npc = npcEntity?.get?.('npc');
    if (!npc) return;

    npc.attackedById = attackerId;

    if (npc.disposition === NpcDisposition.RETALIATORY) {
      npc.retaliationUntil =
        nowSeconds + npc.retaliationDuration;
    }

    if (npc.disposition === NpcDisposition.PEACEFUL) {
      npc.fleeUntil =
        nowSeconds + npc.fleeDuration;
    }
  }

  updateNpc(world, npcEntity, playerEntity, dt) {
    const npc = npcEntity.get('npc');
    const npcTransform = npcEntity.get('transform');
    const movement = npcEntity.get('movement');
    const playerTransform = playerEntity?.get?.('transform');

    if (!npc || !npcTransform || !movement || !playerTransform) {
      return;
    }

    const now = world.time;
    const nav = this.navigatorFor(npcEntity);
    const playerDistance =
      distanceBetween(npcTransform, playerTransform);

    movement.maxSpeed = npc.baseMaxSpeed;

    if (npc.disposition === NpcDisposition.HOSTILE) {
      if (playerDistance <= npc.detectionRadius) {
        npc.targetId = playerEntity.id;
        nav.setTarget(playerTransform.x, playerTransform.y);
      } else {
        npc.targetId = null;
        nav.clearTarget();
      }
    }

    if (npc.disposition === NpcDisposition.RETALIATORY) {
      if (
        npc.attackedById === playerEntity.id &&
        now < npc.retaliationUntil
      ) {
        npc.targetId = playerEntity.id;
        nav.setTarget(playerTransform.x, playerTransform.y);
      } else {
        npc.targetId = null;
        nav.clearTarget();
      }
    }

    if (npc.disposition === NpcDisposition.PEACEFUL) {
      if (
        npc.attackedById === playerEntity.id &&
        now < npc.fleeUntil
      ) {
        movement.maxSpeed =
          npc.baseMaxSpeed * npc.fleeSpeedMultiplier;

        const dx = npcTransform.x - playerTransform.x;
        const dy = npcTransform.y - playerTransform.y;
        const length = Math.max(1, Math.hypot(dx, dy));

        const fleeDistance = 1200;

        nav.setTarget(
          npcTransform.x + (dx / length) * fleeDistance,
          npcTransform.y + (dy / length) * fleeDistance
        );
      } else {
        npc.attackedById = null;
        nav.clearTarget();
      }
    }

    nav.update(npcEntity, dt, null);
  }

  update(world, playerEntity, dt) {
    for (const entity of world.entities.withComponents(
      'npc',
      'ship',
      'transform',
      'movement'
    )) {
      this.updateNpc(
        world,
        entity,
        playerEntity,
        dt
      );
    }
  }

  remove(entityId) {
    this.navigation.delete(entityId);
  }

  clear() {
    this.navigation.clear();
  }
}
