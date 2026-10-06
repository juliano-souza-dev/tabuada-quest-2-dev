import { createShip } from '../ships/createShip.js';
import { PIRATE_NPC_SHIP } from '../ships/NpcShipDefinition.js';
import { NpcDisposition } from './NpcDisposition.js';

const hashString = (value) => {
  let hash = 2166136261;

  for (const ch of String(value || '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const seededInitialCourseDelay = (id) =>
  3.5 + (hashString(id + '.init') / 4294967296) * 4.5;

export function createNpc({
  id,
  x = 0,
  y = 0,
  rotation = 0,
  disposition = NpcDisposition.RETALIATORY,
  shipDefinition = PIRATE_NPC_SHIP
} = {}) {
  const speed =
    Math.max(
      0,
      Number(shipDefinition.movement?.maxSpeed) || 0
    );

  const acceleration =
    Math.max(
      0,
      Math.min(
        3000,
        Number(shipDefinition.movement?.acceleration) ||
          speed * 3.1
      )
    );

  return createShip({
    id,
    definition: shipDefinition,
    x,
    y,
    rotation,
    type: 'ship',
    extraComponents: {
      npc: {
        disposition,
        attitude:
          disposition === NpcDisposition.HOSTILE
            ? 'hostile'
            : disposition === NpcDisposition.PEACEFUL
              ? 'passive'
              : 'retaliate',

        attackedById: null,
        retaliationUntil: 0,
        retaliationDuration: 12,
        fleeUntil: 0,
        fleeDuration: 9,
        fleeSpeedMultiplier: 1.85,

        detectionRadius: 620,
        disengageRadius: 980,

        navigation: {
          mode: 'sailing',
          minSpeed: Math.max(0, speed * 0.46),
          speed,
          acceleration,
          braking: 0.12,
          heading: rotation,
          targetHeading: rotation,
          vx: 0,
          vy: 0,
          elapsed: 0,
          courseCycle: 0,
          nextCourseChange:
            seededInitialCourseDelay(id)
        }
      }
    }
  });
}
