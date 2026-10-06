export class EventQueue {
  constructor() { this.pending = []; }

  emit(type, payload = {}) {
    if (!type) throw new Error('Event type is required.');
    this.pending.push({ type, payload });
  }

  drain() {
    const events = this.pending;
    this.pending = [];
    return events;
  }

  clear() { this.pending = []; }
  get size() { return this.pending.length; }
}
