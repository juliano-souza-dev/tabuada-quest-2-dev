import { Rectangle, Sprite, Texture } from 'pixi.js';

const DIRECTION_COUNT = 16;
const STEP_DEGREES = 360 / DIRECTION_COUNT;

const normalizeDegrees = (value) => ((value % 360) + 360) % 360;

export class DirectionalSprite {
  constructor(sheetTexture, { columns = 4, rows = 4, displaySize = 190 } = {}) {
    this.sheetTexture = sheetTexture;
    this.frames = [];
    this.currentIndex = -1;

    const sheetWidth = sheetTexture.width;
    const sheetHeight = sheetTexture.height;
    const frameWidth = sheetWidth / columns;
    const frameHeight = sheetHeight / rows;

    for (let index = 0; index < DIRECTION_COUNT; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);

      this.frames.push(new Texture({
        source: sheetTexture.source,
        frame: new Rectangle(
          column * frameWidth,
          row * frameHeight,
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
    const normalized = normalizeDegrees(degrees);
    const index = Math.round(normalized / STEP_DEGREES) % DIRECTION_COUNT;

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
