import { Rectangle, Sprite, Texture } from 'pixi.js';

const STEP_DEGREES = 22.5;

// Regiões medidas diretamente no asset 400x400.
// A sheet não usa células quadradas uniformes.
const FRAME_REGIONS = Object.freeze([
  { direction: 's',   x: 13,  y: 50,  width: 58,  height: 77 },
  { direction: 'ssw', x: 94,  y: 49,  width: 92,  height: 78 },
  { direction: 'sw',  x: 200, y: 50,  width: 96,  height: 78 },
  { direction: 'wsw', x: 307, y: 51,  width: 90,  height: 77 },

  { direction: 'w',   x: 0,   y: 126, width: 97,  height: 74 },
  { direction: 'wnw', x: 97,  y: 124, width: 103, height: 76 },
  { direction: 'nw',  x: 204, y: 125, width: 100, height: 75 },
  { direction: 'nnw', x: 307, y: 127, width: 93,  height: 72 },

  { direction: 'n',   x: 5,   y: 197, width: 87,  height: 78 },
  { direction: 'nne', x: 105, y: 197, width: 86,  height: 78 },
  { direction: 'ne',  x: 215, y: 199, width: 77,  height: 77 },
  { direction: 'ene', x: 314, y: 201, width: 82,  height: 75 },

  { direction: 'e',   x: 1,   y: 272, width: 94,  height: 75 },
  { direction: 'ese', x: 101, y: 273, width: 99,  height: 75 },
  { direction: 'se',  x: 208, y: 272, width: 95,  height: 76 },
  { direction: 'sse', x: 309, y: 272, width: 91,  height: 76 }
]);

const normalizeDegrees = (value) => ((value % 360) + 360) % 360;

export class DirectionalSprite {
  constructor(sheetTexture, { displayScale = 1.8 } = {}) {
    this.frames = FRAME_REGIONS.map((region) => new Texture({
      source: sheetTexture.source,
      frame: new Rectangle(region.x, region.y, region.width, region.height)
    }));

    this.currentIndex = 0;
    this.sprite = new Sprite(this.frames[0]);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(displayScale);
    this.sprite.eventMode = 'none';
  }

  setDirection(degrees) {
    const worldIndex = Math.round(normalizeDegrees(degrees) / STEP_DEGREES) % 16;
    const index = (worldIndex + 8) % 16;
    if (index === this.currentIndex) return;

    this.currentIndex = index;
    this.sprite.texture = this.frames[index];
  }

  destroy() {
    for (const texture of this.frames) texture.destroy(false);
    this.frames = [];
    this.sprite.destroy();
  }
}
