import { Entity } from '../world/Entity.js';
import { createTransform } from '../components/Transform.js';

export function createTreasure({
  id,
  x = 0,
  y = 0,
  kind = 'halloween',
  slot = 0,
  generation = 0,
  collectRadius = 84,
  clickRadius = 110,
  rewardRef
} = {}) {
  if (!id) throw new Error('Treasure id is required.');
  if (!rewardRef) throw new Error('Treasure rewardRef is required.');

  return new Entity({
    id,
    type: 'treasure',
    components: {
      transform: createTransform({ x, y, rotation: 0 }),
      treasure: {
        kind,
        slot,
        generation,
        collectRadius,
        clickRadius,
        rewardRef,
        claimToken: `${id}:g${generation}`
      }
    }
  });
}
