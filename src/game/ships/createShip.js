import { Entity } from '../world/Entity.js';
import { createTransform } from '../components/Transform.js';
import { createMovement } from '../components/Movement.js';

export function createShip({
  id,
  definition,
  x = 0,
  y = 0,
  rotation = 0,
  type = 'ship',
  extraComponents = {}
} = {}) {
  if (!id) throw new Error('Ship id is required.');
  if (!definition?.id) throw new Error('Ship definition is required.');

  const movement = definition.movement || {};
  const health = definition.health || {};

  return new Entity({
    id,
    type,
    components: {
      transform: createTransform({ x, y, rotation }),
      movement: createMovement({
        speed: 0,
        maxSpeed: Number(movement.maxSpeed) || 0,
        acceleration: Number(movement.acceleration) || 0,
        deceleration: Number(movement.deceleration) || 0,
        turnRate: Number(movement.turnRate) || 0
      }),
      ship: {
        definitionId: definition.id,
        stopRadius: Number(movement.stopRadius) || 24
      },
      health: {
        current: Number(health.max) || 100,
        max: Number(health.max) || 100
      },
      visual: {
        scale: Number(definition.visual?.scale) || 0.5,
        assetRef: definition.visual?.assetRef || null,
        effects: {
          halloween: definition.visual?.effects?.halloween === true,
          ghostParticles: definition.visual?.effects?.ghostParticles === true
        }
      },
      ...extraComponents
    }
  });
}
