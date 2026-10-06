export class Entity {
  constructor({ id, type, components = {} }) {
    if (!id) throw new Error('Entity id is required.');
    if (!type) throw new Error('Entity type is required.');
    this.id = id;
    this.type = type;
    this.components = new Map(Object.entries(components));
  }

  has(component) { return this.components.has(component); }
  get(component) { return this.components.get(component); }
  set(component, data) { this.components.set(component, data); return this; }
  remove(component) { return this.components.delete(component); }

  toJSON() {
    return { id: this.id, type: this.type, components: Object.fromEntries(this.components) };
  }
}
