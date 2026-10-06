import { Container } from 'pixi.js';
import { OceanWebGLRenderer } from './legacy/OceanWebGLRenderer.mjs';
import { normalizeOceanConfig } from './legacy/WorldOceanEffect.mjs';

const OCEAN_TEXTURE_URL = new URL(
  '../../../assets/oceans/ocean-tile-tabuada-region01.webp',
  import.meta.url
).href;

// Configuração copiada da R1 antiga.
const LEGACY_OCEAN = normalizeOceanConfig({
  active: true,
  renderer: 'webgl',
  background: OCEAN_TEXTURE_URL,
  preset: 'calm',
  speed: 58,
  directionX: 1,
  directionY: 0.68,
  swell: 55,
  tileSize: 590,
  brightness: 62,
  saturation: 62,
  contrast: 72,
  tintR: 84,
  tintG: 79,
  tintB: 99,
  distortion: 20,
  waveFrequencyA: 24,
  waveFrequencyB: 29,
  waveMix: 56,
  foamMix: 48,
  sparkleIntensity: 18,
  sparkleSharpness: 32
});

export class OceanRenderer {
  constructor({ renderer } = {}) {
    this.view = new Container();
    this.renderer = renderer || null;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tq-legacy-ocean-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');

    const mount = this.renderer?.canvas?.parentElement;
    if (mount) {
      mount.insertBefore(this.canvas, this.renderer.canvas);
    }

    this.legacy = new OceanWebGLRenderer(this.canvas);

    this.width = 1;
    this.height = 1;
    this.cameraX = 0;
    this.cameraY = 0;
    this.zoom = 1;
    this.elapsedMs = 0;
    this.wake = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;
    this.ready = await this.legacy.init(OCEAN_TEXTURE_URL);
    this.renderFrame();
  }

  setCameraPosition(x, y) {
    this.cameraX = Number(x) || 0;
    this.cameraY = Number(y) || 0;
  }

  setZoom(zoom) {
    this.zoom = Math.max(0.1, Number(zoom) || 1);
  }

  setWake(wake) {
    this.wake = wake || null;
  }

  resize(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
  }

  update(dt) {
    this.elapsedMs += Math.max(0, Number(dt) || 0) * 1000;
    this.renderFrame();
  }

  renderFrame() {
    if (!this.ready) return;

    this.legacy.render({
      time: this.elapsedMs,
      camera: {
        x: this.cameraX,
        y: this.cameraY
      },
      zoom: this.zoom,
      ocean: LEGACY_OCEAN,
      width: this.width,
      height: this.height,
      wake: this.wake
    });
  }

  destroy() {
    this.legacy?.destroy?.();
    this.canvas?.remove?.();
    this.ready = false;
  }
}
