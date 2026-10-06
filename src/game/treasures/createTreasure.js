import { Entity } from '../world/Entity.js';
import { createTransform } from '../components/Transform.js';

export function createTreasure({
  id,
  x = 0,
  y = 0,
  kind = 'basic',
  collectRadius = 72,
  reward = { gold: 100 }
} = {}) {
  if (!id) throw new Error('Treasure id is required.');

  return new Entity({
    id,
    type: 'treasure',
    components: {
      transform: createTransform({ x, y, rotation: 0 }),
      treasure: {
        kind,
        collectRadius,
        reward: { ...reward },
        collected: false
      }
    }
  });
}
