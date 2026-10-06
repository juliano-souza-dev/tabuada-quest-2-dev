import { EntityRegistry } from './EntityRegistry.js';
import { EventQueue } from '../events/EventQueue.js';

export class WorldState {
  constructor({ worldId }) {
    if (!worldId) throw new Error('World id is required.');
    this.worldId = worldId;
    this.time = 0;
    this.entities = new EntityRegistry();
    this.events = new EventQueue();
  }

  advance(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('deltaSeconds must be a non-negative number.');
    this.time += deltaSeconds;
  }

  reset() {
    this.time = 0;
    this.entities.clear();
    this.events.clear();
  }
}
