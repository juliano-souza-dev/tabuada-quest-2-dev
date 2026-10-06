import { ShipNavigationSystem } from './ShipNavigationSystem.js';
import { NpcDisposition } from '../npc/NpcDisposition.js';

const distanceBetween = (a, b) =>
  Math.hypot(
    (a?.x || 0) - (b?.x || 0),
    (a?.y || 0) - (b?.y || 0)
  );

const hash = (text) => {
  let value = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
};

const unit = (seed) =>
  hash(seed) / 4294967295;

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
      npc.state = 'combat';
      npc.retaliationUntil =
        nowSeconds + npc.retaliationDuration;
    }

    if (npc.disposition === NpcDisposition.PEACEFUL) {
      npc.state = 'flee';
      npc.fleeUntil =
        nowSeconds + npc.fleeDuration;
    }

    if (npc.disposition === NpcDisposition.HOSTILE) {
      npc.state = 'combat';
    }
  }

  chooseRoamTarget(entity, npc, now, nav) {
    npc.roamDecisionIndex += 1;

    const seed =
      `${entity.id}:${npc.roamDecisionIndex}`;

    const angle =
      unit(`${seed}:angle`) *
      Math.PI *
      2;

    const radius =
      npc.roamRadius *
      (0.35 + unit(`${seed}:radius`) * 0.65);

    npc.roamTargetX =
      npc.homeX + Math.cos(angle) * radius;

    npc.roamTargetY =
      npc.homeY + Math.sin(angle) * radius;

    npc.nextRoamDecisionAt =
      now + 4 + unit(`${seed}:time`) * 7;

    npc.pauseUntil = 0;

    nav.setTarget(
      npc.roamTargetX,
      npc.roamTargetY
    );
  }

  updateRoam(entity, npc, transform, movement, now, nav) {
    npc.state = 'roam';
    npc.targetId = null;
    movement.maxSpeed =
      npc.baseMaxSpeed *
      (0.48 + unit(`${entity.id}:cruise`) * 0.18);

    const distanceToRoamTarget =
      Math.hypot(
        npc.roamTargetX - transform.x,
        npc.roamTargetY - transform.y
      );

    if (npc.pauseUntil > now) {
      nav.clearTarget();
      return;
    }

    if (
      now >= npc.nextRoamDecisionAt ||
      distanceToRoamTarget < 90
    ) {
      const pauseSeed =
        `${entity.id}:pause:${npc.roamDecisionIndex}`;

      if (
        distanceToRoamTarget < 90 &&
        unit(pauseSeed) < 0.34
      ) {
        npc.pauseUntil =
          now + 1.2 + unit(`${pauseSeed}:len`) * 2.8;
        npc.nextRoamDecisionAt = npc.pauseUntil;
        nav.clearTarget();
        return;
      }

      this.chooseRoamTarget(
        entity,
        npc,
        now,
        nav
      );
    }
  }

  updateCombat(npc, npcTransform, playerEntity, playerTransform, playerDistance, now, nav) {
    npc.state = 'combat';
    npc.targetId = playerEntity.id;

    if (playerDistance <= npc.engageDistance) {
      nav.clearTarget();
      return;
    }

    const dx =
      playerTransform.x - npcTransform.x;

    const dy =
      playerTransform.y - npcTransform.y;

    const length =
      Math.max(1, Math.hypot(dx, dy));

    nav.setTarget(
      playerTransform.x -
        (dx / length) * npc.engageDistance,
      playerTransform.y -
        (dy / length) * npc.engageDistance
    );

    if (
      npc.disposition === NpcDisposition.RETALIATORY &&
      now >= npc.retaliationUntil
    ) {
      npc.state = 'roam';
      npc.targetId = null;
      npc.attackedById = null;
    }
  }

  updateFlee(npc, npcTransform, playerTransform, now, nav, movement) {
    npc.state = 'flee';
    npc.targetId = null;

    movement.maxSpeed =
      npc.baseMaxSpeed *
      npc.fleeSpeedMultiplier;

    if (now >= npc.fleeUntil) {
      npc.state = 'roam';
      npc.attackedById = null;
      nav.clearTarget();
      return;
    }

    const dx =
      npcTransform.x - playerTransform.x;

    const dy =
      npcTransform.y - playerTransform.y;

    const length =
      Math.max(1, Math.hypot(dx, dy));

    nav.setTarget(
      npcTransform.x + (dx / length) * 1000,
      npcTransform.y + (dy / length) * 1000
    );
  }

  updateNpc(world, npcEntity, playerEntity, dt) {
    const npc = npcEntity.get('npc');
    const npcTransform = npcEntity.get('transform');
    const movement = npcEntity.get('movement');
    const playerTransform =
      playerEntity?.get?.('transform');

    if (!npc || !npcTransform || !movement || !playerTransform) {
      return;
    }

    const now = world.time;
    const nav = this.navigatorFor(npcEntity);

    const playerDistance =
      distanceBetween(
        npcTransform,
        playerTransform
      );

    movement.maxSpeed = npc.baseMaxSpeed;

    if (
      npc.disposition === NpcDisposition.PEACEFUL &&
      npc.state === 'flee'
    ) {
      this.updateFlee(
        npc,
        npcTransform,
        playerTransform,
        now,
        nav,
        movement
      );
    } else if (
      npc.disposition === NpcDisposition.RETALIATORY &&
      npc.state === 'combat' &&
      npc.attackedById === playerEntity.id &&
      now < npc.retaliationUntil
    ) {
      this.updateCombat(
        npc,
        npcTransform,
        playerEntity,
        playerTransform,
        playerDistance,
        now,
        nav
      );
    } else if (
      npc.disposition === NpcDisposition.HOSTILE &&
      (
        npc.state === 'combat' ||
        playerDistance <= npc.detectionRadius
      ) &&
      playerDistance <= npc.disengageRadius
    ) {
      this.updateCombat(
        npc,
        npcTransform,
        playerEntity,
        playerTransform,
        playerDistance,
        now,
        nav
      );
    } else {
      if (
        npc.disposition === NpcDisposition.HOSTILE &&
        playerDistance > npc.disengageRadius
      ) {
        npc.state = 'roam';
        npc.targetId = null;
      }

      this.updateRoam(
        npcEntity,
        npc,
        npcTransform,
        movement,
        now,
        nav
      );
    }

    nav.update(
      npcEntity,
      dt,
      null
    );
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
