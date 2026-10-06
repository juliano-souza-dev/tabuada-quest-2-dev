import { NpcDisposition } from '../npc/NpcDisposition.js';

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

const hashString = (value) => {
  let hash = 2166136261;

  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const createSeededRandom = (seed) => {
  let state =
    (Number(seed) >>> 0) ||
    0x9e3779b9;

  return () => {
    state += 0x6D2B79F5;
    let t = state;

    t = Math.imul(
      t ^ (t >>> 15),
      t | 1
    );

    t ^=
      t +
      Math.imul(
        t ^ (t >>> 7),
        t | 61
      );

    return (
      ((t ^ (t >>> 14)) >>> 0) /
      4294967296
    );
  };
};

const distanceBetween = (a, b) =>
  Math.hypot(
    (a?.x || 0) - (b?.x || 0),
    (a?.y || 0) - (b?.y || 0)
  );

export class NpcBehaviorSystem {
  constructor({
    region,
    boundaryPadding = 56
  } = {}) {
    this.region = region;
    this.boundaryPadding = boundaryPadding;
  }

  notifyAttacked(
    npcEntity,
    attackerId,
    nowSeconds
  ) {
    const npc =
      npcEntity?.get?.('npc');

    if (!npc) return;

    npc.attackedById = attackerId;

    if (
      npc.disposition ===
      NpcDisposition.RETALIATORY
    ) {
      npc.retaliationUntil =
        nowSeconds +
        npc.retaliationDuration;
    }

    if (
      npc.disposition ===
      NpcDisposition.PEACEFUL
    ) {
      npc.fleeUntil =
        nowSeconds +
        npc.fleeDuration;
    }
  }

  applyBehaviorHeading(
    world,
    entity,
    playerEntity
  ) {
    const npc = entity.get('npc');
    const nav = npc?.navigation;
    const transform =
      entity.get('transform');

    const playerTransform =
      playerEntity?.get?.('transform');

    if (
      !npc ||
      !nav ||
      !transform ||
      !playerTransform
    ) {
      return false;
    }

    const now = world.time;

    const playerDistance =
      distanceBetween(
        transform,
        playerTransform
      );

    if (
      npc.disposition ===
        NpcDisposition.HOSTILE &&
      playerDistance <=
        npc.detectionRadius
    ) {
      nav.targetHeading =
        Math.atan2(
          playerTransform.y -
            transform.y,
          playerTransform.x -
            transform.x
        ) *
          180 /
          Math.PI +
        90;

      nav.nextCourseChange =
        Math.max(
          Number(nav.nextCourseChange) || 0,
          nav.elapsed + 0.35
        );

      return true;
    }

    if (
      npc.disposition ===
        NpcDisposition.RETALIATORY &&
      npc.attackedById ===
        playerEntity.id &&
      now <
        npc.retaliationUntil
    ) {
      nav.targetHeading =
        Math.atan2(
          playerTransform.y -
            transform.y,
          playerTransform.x -
            transform.x
        ) *
          180 /
          Math.PI +
        90;

      nav.nextCourseChange =
        Math.max(
          Number(nav.nextCourseChange) || 0,
          nav.elapsed + 0.35
        );

      return true;
    }

    if (
      npc.disposition ===
        NpcDisposition.PEACEFUL &&
      npc.attackedById ===
        playerEntity.id &&
      now <
        npc.fleeUntil
    ) {
      nav.targetHeading =
        Math.atan2(
          transform.y -
            playerTransform.y,
          transform.x -
            playerTransform.x
        ) *
          180 /
          Math.PI +
        90;

      return true;
    }

    if (
      npc.disposition ===
        NpcDisposition.PEACEFUL &&
      now >= npc.fleeUntil
    ) {
      npc.attackedById = null;
    }

    if (
      npc.disposition ===
        NpcDisposition.RETALIATORY &&
      now >= npc.retaliationUntil
    ) {
      npc.attackedById = null;
    }

    return false;
  }

  updateNpcNavigation(
    world,
    entity,
    playerEntity,
    dt
  ) {
    const npc =
      entity.get('npc');

    const nav =
      npc?.navigation;

    const transform =
      entity.get('transform');

    const movement =
      entity.get('movement');

    if (
      !npc ||
      !nav ||
      !transform ||
      !movement
    ) {
      return;
    }

    const baseMaxSpeed =
      Math.max(
        0,
        Number(nav.speed) || 0
      );

    const fleeing =
      npc.disposition ===
        NpcDisposition.PEACEFUL &&
      npc.attackedById ===
        playerEntity?.id &&
      world.time < npc.fleeUntil;

    const maxSpeed =
      fleeing
        ? baseMaxSpeed *
          npc.fleeSpeedMultiplier
        : baseMaxSpeed;

    if (
      nav.mode === 'stationary' ||
      maxSpeed <= 0
    ) {
      nav.vx = 0;
      nav.vy = 0;

      movement.velocityX = 0;
      movement.velocityY = 0;
      movement.speed = 0;
      return;
    }

    // Port direto do antigo WorldRuntime.updateNpcNavigation.
    const safeDt =
      clamp(
        Number(dt) || 1 / 60,
        0.001,
        0.08
      );

    nav.elapsed =
      Math.max(
        0,
        Number(nav.elapsed) || 0
      ) +
      safeDt;

    nav.courseCycle =
      Math.max(
        0,
        Math.floor(
          Number(nav.courseCycle) || 0
        )
      );

    const halfW = 48;
    const halfH = 48;

    const left =
      this.region.minX +
      this.boundaryPadding +
      halfW;

    const right =
      this.region.maxX -
      this.boundaryPadding -
      halfW;

    const top =
      this.region.minY +
      this.boundaryPadding +
      halfH;

    const bottom =
      this.region.maxY -
      this.boundaryPadding -
      halfH;

    const edgeMargin =
      Math.max(
        90,
        Math.min(
          320,
          maxSpeed * 2.1
        )
      );

    const nearEdge =
      transform.x <=
        left + edgeMargin ||
      transform.x >=
        right - edgeMargin ||
      transform.y <=
        top + edgeMargin ||
      transform.y >=
        bottom - edgeMargin;

    const behaviorOverride =
      this.applyBehaviorHeading(
        world,
        entity,
        playerEntity
      );

    if (nearEdge) {
      const centerX =
        (left + right) / 2;

      const centerY =
        (top + bottom) / 2;

      nav.targetHeading =
        Math.atan2(
          centerY - transform.y,
          centerX - transform.x
        ) *
          180 /
          Math.PI +
        90;

      nav.nextCourseChange =
        Math.max(
          Number(nav.nextCourseChange) || 0,
          nav.elapsed + 2.5
        );
    } else if (
      !behaviorOverride &&
      nav.elapsed >=
        (Number(
          nav.nextCourseChange
        ) || 0)
    ) {
      nav.courseCycle += 1;

      const seeded =
        createSeededRandom(
          hashString(
            entity.id +
              '.' +
              nav.courseCycle
          )
        );

      const current =
        Number(
          nav.targetHeading ??
            nav.heading ??
            transform.rotation
        ) || 0;

      nav.targetHeading =
        current +
        (seeded() - 0.5) *
          110;

      nav.nextCourseChange =
        nav.elapsed +
        3.5 +
        seeded() *
          5.5;
    }

    const targetHeading =
      Number(
        nav.targetHeading ??
          nav.heading ??
          transform.rotation
      ) || 0;

    const targetRad =
      targetHeading *
      Math.PI /
      180;

    const desiredX =
      Math.sin(targetRad);

    const desiredY =
      -Math.cos(targetRad);

    const accel =
      Math.max(
        100,
        Number(nav.acceleration) ||
          1100
      );

    const minSpeed =
      clamp(
        Number(nav.minSpeed) || 0,
        0,
        maxSpeed
      );

    const braking =
      clamp(
        Number(nav.braking ?? 0.12),
        0.01,
        0.98
      );

    const drag =
      Math.pow(
        braking,
        safeDt
      );

    nav.vx =
      (
        (Number(nav.vx) || 0) +
        desiredX *
          accel *
          safeDt
      ) *
      drag;

    nav.vy =
      (
        (Number(nav.vy) || 0) +
        desiredY *
          accel *
          safeDt
      ) *
      drag;

    let actualSpeed =
      Math.hypot(
        nav.vx,
        nav.vy
      );

    if (
      actualSpeed > 0 &&
      actualSpeed < minSpeed
    ) {
      const scale =
        minSpeed /
        actualSpeed;

      nav.vx *= scale;
      nav.vy *= scale;
      actualSpeed = minSpeed;
    }

    if (
      actualSpeed >
      maxSpeed
    ) {
      const scale =
        maxSpeed /
        actualSpeed;

      nav.vx *= scale;
      nav.vy *= scale;
      actualSpeed =
        maxSpeed;
    }

    let nextX =
      transform.x +
      nav.vx *
        safeDt;

    let nextY =
      transform.y +
      nav.vy *
        safeDt;

    if (
      nextX < left ||
      nextX > right
    ) {
      nextX =
        clamp(
          nextX,
          left,
          right
        );

      nav.vx *= -0.28;

      nav.targetHeading =
        Math.atan2(
          (top + bottom) / 2 -
            nextY,
          (left + right) / 2 -
            nextX
        ) *
          180 /
          Math.PI +
        90;
    }

    if (
      nextY < top ||
      nextY > bottom
    ) {
      nextY =
        clamp(
          nextY,
          top,
          bottom
        );

      nav.vy *= -0.28;

      nav.targetHeading =
        Math.atan2(
          (top + bottom) / 2 -
            nextY,
          (left + right) / 2 -
            nextX
        ) *
          180 /
          Math.PI +
        90;
    }

    transform.x =
      clamp(
        nextX,
        left,
        right
      );

    transform.y =
      clamp(
        nextY,
        top,
        bottom
      );

    actualSpeed =
      Math.hypot(
        nav.vx,
        nav.vy
      );

    if (
      actualSpeed > 4
    ) {
      transform.rotation =
        Math.atan2(
          nav.vy,
          nav.vx
        ) *
          180 /
          Math.PI +
        90;

      nav.heading =
        transform.rotation;
    }

    movement.velocityX =
      nav.vx;

    movement.velocityY =
      nav.vy;

    movement.speed =
      actualSpeed;

    movement.maxSpeed =
      maxSpeed;
  }

  update(
    world,
    playerEntity,
    dt
  ) {
    for (
      const entity of
      world.entities.withComponents(
        'npc',
        'ship',
        'transform',
        'movement'
      )
    ) {
      this.updateNpcNavigation(
        world,
        entity,
        playerEntity,
        dt
      );
    }
  }

  clear() {}
}
