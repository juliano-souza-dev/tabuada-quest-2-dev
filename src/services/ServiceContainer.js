export class ServiceContainer {
  constructor() { this.services = new Map(); }
  register(name, service) { if (this.services.has(name)) throw new Error(`Service already registered: ${name}`); this.services.set(name, service); return service; }
  get(name) { const service = this.services.get(name); if (!service) throw new Error(`Service not registered: ${name}`); return service; }
  has(name) { return this.services.has(name); }
}
