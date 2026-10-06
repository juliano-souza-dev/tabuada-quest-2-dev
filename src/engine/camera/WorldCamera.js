import { Container } from 'pixi.js';

export class WorldCamera {
  constructor() { this.view = new Container(); this.x = 0; this.y = 0; this.zoom = 1; }
  setPosition(x, y) { this.x = x; this.y = y; this.apply(); }
  setZoom(zoom) { this.zoom = Math.max(0.1, zoom); this.apply(); }
  resize(width, height) { this.width = width; this.height = height; this.apply(); }
  apply() {
    this.view.scale.set(this.zoom);
    this.view.position.set((this.width ?? 0) / 2 - this.x * this.zoom, (this.height ?? 0) / 2 - this.y * this.zoom);
  }
}
