import { Rectangle, Sprite, Texture } from 'pixi.js';

const FRAME_SIZE = 400;
const STEP_DEGREES = 22.5;
const FRAME_COUNT = 16;

const PLAYER_FRAME_DIRECTIONS = Object.freeze([
  'w', 'wnw', 'nw', 'nnw',
  'n', 'nne', 'ne', 'ene',
  'e', 'ese', 'se', 'sse',
  's', 'ssw', 'sw', 'wsw'
]);

const NPC_STANDARD_FRAME_DIRECTIONS = Object.freeze([
  'n', 'nne', 'ne', 'ene',
  'e', 'ese', 'se', 'sse',
  's', 'ssw', 'sw', 'wsw',
  'w', 'wnw', 'nw', 'nnw'
]);

const normalizeDegrees = (value) =>
  ((value % 360) + 360) % 360;

const frameIndexForHeading = (
  degrees,
  frameZeroHeading
) => {
  const worldIndex =
    Math.round(
      normalizeDegrees(degrees) /
      STEP_DEGREES
    ) %
    FRAME_COUNT;

  const zeroOffset =
    Math.round(
      normalizeDegrees(frameZeroHeading) /
      STEP_DEGREES
    ) %
    FRAME_COUNT;

  return (
    worldIndex -
    zeroOffset +
    FRAME_COUNT
  ) % FRAME_COUNT;
};

export class DirectionalSprite {
  constructor(
    sheetTexture,
    {
      displayScale = 0.5,
      frameZeroHeading = 270
    } = {}
  ) {
    this.frameZeroHeading =
      frameZeroHeading;

    this.frameDirections =
      frameZeroHeading === 0
        ? NPC_STANDARD_FRAME_DIRECTIONS
        : PLAYER_FRAME_DIRECTIONS;

    this.frames =
      this.frameDirections.map(
        (_, index) => {
          const col =
            index % 4;

          const row =
            Math.floor(index / 4);

          return new Texture({
            source:
              sheetTexture.source,
            frame:
              new Rectangle(
                col * FRAME_SIZE,
                row * FRAME_SIZE,
                FRAME_SIZE,
                FRAME_SIZE
              )
          });
        }
      );

    this.currentIndex =
      frameIndexForHeading(
        0,
        this.frameZeroHeading
      );

    this.sprite =
      new Sprite(
        this.frames[
          this.currentIndex
        ]
      );

    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(displayScale);
    this.sprite.eventMode = 'none';
  }

  setDirection(degrees) {
    const index =
      frameIndexForHeading(
        degrees,
        this.frameZeroHeading
      );

    if (
      index ===
      this.currentIndex
    ) {
      return;
    }

    this.currentIndex = index;

    this.sprite.texture =
      this.frames[index];
  }

  getDirection() {
    return this.frameDirections[
      this.currentIndex
    ];
  }

  destroy() {
    for (
      const texture of
      this.frames
    ) {
      texture.destroy(false);
    }

    this.frames = [];
    this.sprite.destroy();
  }
}
