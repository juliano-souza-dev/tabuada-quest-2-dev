export class SceneResolver {
  constructor(catalog = {}) {
    this.catalog = {
      schema: catalog.schema || "tq.scene-catalog",
      version: Number(catalog.version || 1),
      activeEventId: catalog.activeEventId || null,
      screens: Array.isArray(catalog.screens) ? catalog.screens : [],
      events: Array.isArray(catalog.events) ? catalog.events : [],
      scenes: Array.isArray(catalog.scenes) ? catalog.scenes : []
    };
  }

  static async load(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Scene catalog load failed: ${response.status}`);
    return new SceneResolver(await response.json());
  }

  screen(screenId) {
    return this.catalog.screens.find(screen => screen.id === screenId) || null;
  }

  event(eventId) {
    return this.catalog.events.find(event => event.id === eventId) || null;
  }

  scenesForScreen(screenId) {
    return this.catalog.scenes.filter(scene => scene.screenId === screenId);
  }

  findExact(screenId, context = "default", eventId = null) {
    return this.catalog.scenes.find(scene =>
      scene.screenId === screenId &&
      scene.context === context &&
      (context !== "event" || scene.eventId === eventId)
    ) || null;
  }

  resolve(screenId, eventId = this.catalog.activeEventId) {
    if (eventId) {
      const eventScene = this.findExact(screenId, "event", eventId);
      if (eventScene) return { scene: eventScene, requestedEventId: eventId, fallback: false };
    }

    const fallback = this.findExact(screenId, "default", null);
    if (!fallback) {
      throw new Error(`No DEFAULT scene registered for screen "${screenId}"`);
    }

    return {
      scene: fallback,
      requestedEventId: eventId || null,
      fallback: Boolean(eventId)
    };
  }
}
