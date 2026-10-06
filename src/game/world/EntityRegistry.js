export class EntityRegistry {
  constructor() { this.entities = new Map(); }

  add(entity) {
    if (this.entities.has(entity.id)) throw new Error(`Entity already exists: ${entity.id}`);
    this.entities.set(entity.id, entity);
    return entity;
  }

  get(id) { return this.entities.get(id) ?? null; }
  has(id) { return this.entities.has(id); }
  remove(id) { const entity = this.get(id); this.entities.delete(id); return entity; }
  all() { return [...this.entities.values()]; }

  withComponents(...components) {
    return this.all().filter((entity) => components.every((component) => entity.has(component)));
  }

  clear() { this.entities.clear(); }
}
