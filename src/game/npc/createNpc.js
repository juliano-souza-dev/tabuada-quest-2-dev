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
        targetId: null,
        attackedById: null,
        retaliationUntil: 0,
        fleeUntil: 0,
        detectionRadius: 900,
        retaliationDuration: 12,
        fleeDuration: 9,
        fleeSpeedMultiplier: 1.85,
        baseMaxSpeed: shipDefinition.movement.maxSpeed
      }
    }
  });
}
