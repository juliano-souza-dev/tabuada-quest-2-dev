import { Rectangle, Sprite, Texture } from 'pixi.js';

const STEP_DEGREES = 22.5;

const FRAME_REGIONS = Object.freeze([
  { direction: 'n',   x: 0,    y: 0 },
  { direction: 'nne', x: 400,  y: 0 },
  { direction: 'ne',  x: 800,  y: 0 },
  { direction: 'ene', x: 1200, y: 0 },

  { direction: 'e',   x: 0,    y: 400 },
  { direction: 'ese', x: 400,  y: 400 },
  { direction: 'se',  x: 800,  y: 400 },
  { direction: 'sse', x: 1200, y: 400 },

  { direction: 's',   x: 0,    y: 800 },
  { direction: 'ssw', x: 400,  y: 800 },
  { direction: 'sw',  x: 800,  y: 800 },
  { direction: 'wsw', x: 1200, y: 800 },

  { direction: 'w',   x: 0,    y: 1200 },
  { direction: 'wnw', x: 400,  y: 1200 },
  { direction: 'nw',  x: 800,  y: 1200 },
  { direction: 'nnw', x: 1200, y: 1200 }
]);

const normalizeDegrees = (value) => ((value % 360) + 360) % 360;

export class DirectionalSprite {
  constructor(sheetTexture, {
    frameWidth = 400,
    frameHeight = 400,
    displaySize = 190
  } = {}) {
    this.sheetTexture = sheetTexture;
    this.frames = [];
    this.currentIndex = -1;

    for (const region of FRAME_REGIONS) {
      this.frames.push(new Texture({
        source: sheetTexture.source,
        frame: new Rectangle(
          region.x,
          region.y,
          frameWidth,
          frameHeight
        )
      }));
    }

    this.sprite = new Sprite(this.frames[0]);
    this.sprite.anchor.set(0.5);
    this.sprite.width = displaySize;
    this.sprite.height = displaySize;
    this.sprite.eventMode = 'none';
  }

  setDirection(degrees) {
    const index = Math.round(normalizeDegrees(degrees) / STEP_DEGREES) % 16;

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
