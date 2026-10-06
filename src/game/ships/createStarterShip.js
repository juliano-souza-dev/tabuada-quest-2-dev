import { Entity } from '../world/Entity.js';
import { createTransform } from '../components/Transform.js';
import { createMovement } from '../components/Movement.js';
import { STARTER_SHIP } from './ShipDefinition.js';

export function createStarterShip({ id = 'player-ship', x = 0, y = 0 } = {}) {
  return new Entity({
    id,
    type: 'ship',
    components: {
      transform: createTransform({ x, y, rotation: 0 }),
      movement: createMovement({
        speed: 0,
        maxSpeed: STARTER_SHIP.movement.maxSpeed,
        acceleration: STARTER_SHIP.movement.acceleration,
        deceleration: STARTER_SHIP.movement.deceleration,
        turnRate: STARTER_SHIP.movement.turnRate
      }),
      ship: {
        definitionId: STARTER_SHIP.id,
        stopRadius: STARTER_SHIP.movement.stopRadius
      },
      visual: {
        scale: 0.62,
        effects: {
          halloween: true,
          ghostParticles: true
        }
      }
    }
  });
}
