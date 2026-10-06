import { Rectangle, Sprite, Texture } from 'pixi.js';

const FRAME_SIZE = 400;
const STEP_DEGREES = 22.5;
const FRAME_COUNT = 16;

// Sheet validada:
// 00 W    01 WNW  02 NW   03 NNW
// 04 N    05 NNE  06 NE   07 ENE
// 08 E    09 ESE  10 SE   11 SSE
// 12 S    13 SSW  14 SW   15 WSW
//
// O frame 0 começa em 270° (Oeste) e cada frame seguinte
// avança 22,5° no sentido horário.
const FRAME_DIRECTIONS = Object.freeze([
  'w', 'wnw', 'nw', 'nnw',
  'n', 'nne', 'ne', 'ene',
  'e', 'ese', 'se', 'sse',
  's', 'ssw', 'sw', 'wsw'
]);

const normalizeDegrees = (value) =>
  ((value % 360) + 360) % 360;

const frameIndexForHeading = (degrees) => {
  const worldIndex =
    Math.round(
      normalizeDegrees(degrees) / STEP_DEGREES
    ) % FRAME_COUNT;

  // heading 0° (N) = frame 4.
  return (worldIndex + 4) % FRAME_COUNT;
};

export class DirectionalSprite {
  constructor(
    sheetTexture,
    { displayScale = 0.5 } = {}
  ) {
    this.frames = FRAME_DIRECTIONS.map(
      (_, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);

        return new Texture({
          source: sheetTexture.source,
          frame: new Rectangle(
            col * FRAME_SIZE,
            row * FRAME_SIZE,
            FRAME_SIZE,
            FRAME_SIZE
          )
        });
      }
    );

    this.currentIndex = frameIndexForHeading(0);

    this.sprite = new Sprite(
      this.frames[this.currentIndex]
    );

    // O pivô fica sempre no centro da célula 400x400.
    // Isso elimina saltos entre direções.
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(displayScale);
    this.sprite.eventMode = 'none';
  }

  setDirection(degrees) {
    const index = frameIndexForHeading(degrees);

    if (index === this.currentIndex) return;

    this.currentIndex = index;
    this.sprite.texture = this.frames[index];
  }

  getDirection() {
    return FRAME_DIRECTIONS[this.currentIndex];
  }

  destroy() {
    for (const texture of this.frames) {
      texture.destroy(false);
    }

    this.frames = [];
    this.sprite.destroy();
  }
}
