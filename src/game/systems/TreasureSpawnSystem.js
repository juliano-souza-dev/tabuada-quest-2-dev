import { createTreasure } from '../treasures/createTreasure.js';
import { RewardRefs } from '../rewards/RewardCatalog.js';

const RESPAWN_MS = 30_000;
const AREA_PER_TREASURE = 12_000_000;
const MIN_COUNT = 6;
const MAX_COUNT = 32;

const hash = (text) => {
  let value = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
};

const unit = (seed, salt) =>
  hash(`${seed}:${salt}`) / 4294967295;

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

export class TreasureSpawnSystem {
  constructor({
    worldId,
    region,
    profile,
    persist = async () => {}
  }) {
    this.worldId = worldId;
    this.region = region;
    this.profile = profile;
    this.persist = persist;
    this.mode = 'offline';
    this.revision = 0;
  }

  get count() {
    const area =
      Math.max(1, this.region.width) *
      Math.max(1, this.region.height);

    return clamp(
      Math.round(area / AREA_PER_TREASURE),
      MIN_COUNT,
      MAX_COUNT
    );
  }

  get stateRoot() {
    const all =
      this.profile.progress.treasures ||
      (this.profile.progress.treasures = {});

    return all[this.worldId] ||
      (all[this.worldId] = {
        revision: 0,
        slots: {}
      });
  }

  slotPosition(slot, generation) {
    const margin = 420;
    const seed =
      `${this.worldId}:${slot}:g${generation}`;

    return {
      x:
        this.region.minX +
        margin +
        unit(seed, 'x') *
          Math.max(
            1,
            this.region.width - margin * 2
          ),
      y:
        this.region.minY +
        margin +
        unit(seed, 'y') *
          Math.max(
            1,
            this.region.height - margin * 2
          )
    };
  }

  ensureState() {
    const root = this.stateRoot;

    for (let slot = 0; slot < this.count; slot += 1) {
      if (root.slots[slot]) continue;

      const generation = 0;
      const position =
        this.slotPosition(slot, generation);

      root.slots[slot] = {
        slot,
        generation,
        active: true,
        respawnAt: 0,
        x: position.x,
        y: position.y
      };
    }

    return root;
  }

  spawnEntity(world, slotState) {
    const id =
      `treasure:${this.worldId}:${slotState.slot}`;

    if (world.entities.has(id)) return;

    world.entities.add(
      createTreasure({
        id,
        x: slotState.x,
        y: slotState.y,
        slot: slotState.slot,
        generation: slotState.generation,
        kind: 'halloween',
        rewardRef: RewardRefs.HALLOWEEN_TREASURE
      })
    );
  }

  async initialize(world) {
    const root = this.ensureState();

    for (const slotState of Object.values(root.slots)) {
      if (slotState.active) {
        this.spawnEntity(world, slotState);
      }
    }

    await this.persist();
  }

  async update(world, now = Date.now()) {
    const root = this.ensureState();
    let changed = false;

    for (const slotState of Object.values(root.slots)) {
      if (
        slotState.active ||
        !slotState.respawnAt ||
        now < slotState.respawnAt
      ) {
        continue;
      }

      slotState.generation += 1;
      slotState.active = true;
      slotState.respawnAt = 0;

      const position =
        this.slotPosition(
          slotState.slot,
          slotState.generation
        );

      slotState.x = position.x;
      slotState.y = position.y;

      this.spawnEntity(world, slotState);
      changed = true;
    }

    if (changed) {
      root.revision =
        Math.max(
          Number(root.revision) || 0,
          this.revision
        ) + 1;

      await this.persist();
    }
  }

  async consume(world, treasureEntity, now = Date.now()) {
    const treasure = treasureEntity?.get?.('treasure');
    if (!treasure) return false;

    const root = this.ensureState();
    const slotState =
      root.slots[treasure.slot];

    if (!slotState) return false;

    // Só consome se o spawn ainda for exatamente o mesmo.
    if (
      slotState.generation !== treasure.generation ||
      slotState.active !== true
    ) {
      world.entities.remove(treasureEntity.id);
      return false;
    }

    slotState.active = false;
    slotState.respawnAt = now + RESPAWN_MS;
    root.revision =
      (Number(root.revision) || 0) + 1;

    world.entities.remove(treasureEntity.id);
    await this.persist();

    return true;
  }

  // Online: snapshot do servidor substitui o estado local.
  // Isso remove tesouros fantasmas ao trocar de modo.
  async applyAuthoritativeSnapshot(world, snapshot) {
    if (!snapshot?.slots) return false;

    this.mode = 'online';
    this.revision = Number(snapshot.revision) || 0;

    const root = this.stateRoot;
    root.revision = this.revision;
    root.slots = structuredClone(snapshot.slots);

    for (const entity of world.entities.all()) {
      if (entity.type === 'treasure') {
        world.entities.remove(entity.id);
      }
    }

    for (const slotState of Object.values(root.slots)) {
      if (slotState.active) {
        this.spawnEntity(world, slotState);
      }
    }

    await this.persist();
    return true;
  }

  async switchOffline(world) {
    // Mantém o último snapshot sincronizado como ponto de continuidade.
    this.mode = 'offline';
    await this.update(world);
  }

  exportSnapshot() {
    const root = this.ensureState();

    return {
      worldId: this.worldId,
      revision: Number(root.revision) || 0,
      slots: structuredClone(root.slots)
    };
  }
}
