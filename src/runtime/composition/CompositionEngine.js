export class CompositionEngine {
  constructor(runtime, renderers = {}) {
    this.runtime = runtime;
    this.renderers = new Map(Object.entries(renderers));
    this.instances = new Map();
  }

  register(type, Renderer) {
    if (!type || typeof Renderer !== "function") throw new TypeError("Invalid composition renderer");
    this.renderers.set(type, Renderer);
    return this;
  }

  unregister(type) {
    this.renderers.delete(type);
    for (const [nodeId, entry] of this.instances) {
      if (entry.type === type) this.destroyNode(nodeId);
    }
  }

  syncNode(node) {
    if (!node?.id) return null;
    const type = node.compositionType || null;
    const current = this.instances.get(node.id);

    if (!type || !this.renderers.has(type)) {
      if (current) this.destroyNode(node.id);
      return null;
    }

    if (current && current.type !== type) {
      this.destroyNode(node.id);
      return this.syncNode(node);
    }

    if (current) {
      current.instance.node = node;
      current.instance.sync?.();
      return current.instance;
    }

    const Renderer = this.renderers.get(type);
    const instance = new Renderer(this.runtime, node);
    this.instances.set(node.id, { type, instance });
    return instance;
  }

  get(nodeId) {
    return this.instances.get(nodeId)?.instance || null;
  }

  list(type = null) {
    const entries = [...this.instances.values()];
    return entries
      .filter(entry => !type || entry.type === type)
      .map(entry => entry.instance);
  }

  destroyNode(nodeId) {
    const current = this.instances.get(nodeId);
    if (!current) return false;
    try {
      current.instance.destroy?.();
    } finally {
      this.instances.delete(nodeId);
    }
    return true;
  }

  reset() {
    for (const nodeId of [...this.instances.keys()]) this.destroyNode(nodeId);
  }

  destroy() {
    this.reset();
    this.renderers.clear();
  }
}
