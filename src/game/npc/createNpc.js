import { createShip } from '../ships/createShip.js';
import { PIRATE_NPC_SHIP } from '../ships/NpcShipDefinition.js';
import { NpcDisposition } from './NpcDisposition.js';

export function createNpc({
  id,
  x = 0,
  y = 0,
  rotation = 0,
  disposition = NpcDisposition.RETALIATORY,
  shipDefinition = PIRATE_NPC_SHIP
} = {}) {
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
        state: 'roam',
        targetId: null,
        attackedById: null,

        homeX: x,
        homeY: y,
        roamRadius: 1100,
        roamTargetX: x,
        roamTargetY: y,
        roamDecisionIndex: 0,
        nextRoamDecisionAt: 0,
        pauseUntil: 0,

        detectionRadius: 620,
        disengageRadius: 980,
        engageDistance: 280,

        retaliationUntil: 0,
        retaliationDuration: 12,

        fleeUntil: 0,
        fleeDuration: 9,
        fleeSpeedMultiplier: 1.85,

        baseMaxSpeed: shipDefinition.movement.maxSpeed
      }
    }
  });
}
