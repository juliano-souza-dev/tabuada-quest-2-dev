import { Container } from 'pixi.js';
import { WorldState } from '../../game/world/WorldState.js';
import { WorldCamera } from '../../engine/camera/WorldCamera.js';
import { createStarterShip } from '../../game/ships/createStarterShip.js';
import { ShipNavigationSystem } from '../../game/systems/ShipNavigationSystem.js';
import { OceanRenderer } from '../world/OceanRenderer.js';
import { ShipRenderer } from '../ships/ShipRenderer.js';

const normalizeDegrees = (value) => ((value % 360) + 360) % 360;
const CAMERA_FOLLOW_SHARPNESS = 6;

const lerpAngle = (from, to, alpha) => {
  const a = normalizeDegrees(from);
  const b = normalizeDegrees(to);
  let delta = b - a;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  return normalizeDegrees(a + delta * alpha);
};

export class WorldScene {
  constructor({ renderer, assets, input, worldId = 'ocean' }) {
    this.renderer = renderer;
    this.assets = assets;
    this.input = input;

    this.view = new Container();
    this.world = new WorldState({ worldId });
    this.camera = new WorldCamera();

    this.ocean = new OceanRenderer();
    this.shipNavigation = new ShipNavigationSystem();
    this.playerShip = createStarterShip({ x: 0, y: 0 });
    this.shipRenderer = new ShipRenderer();

    this.previousPose = { x: 0, y: 0, rotation: 0 };
    this.currentPose = { x: 0, y: 0, rotation: 0 };
    this.previousCamera = { x: 0, y: 0 };
    this.currentCamera = { x: 0, y: 0 };

    this.world.entities.add(this.playerShip);

    this.camera.view.addChild(this.ocean.view);
    this.camera.view.addChild(this.shipRenderer.view);
    this.view.addChild(this.camera.view);
  }

  async enter() {
    await Promise.all([
      this.ocean.init(this.assets),
      this.shipRenderer.init(this.assets)
    ]);

    this.resize();

    const transform = this.playerShip.get('transform');
    this.previousPose = { ...transform };
    this.currentPose = { ...transform };
    this.previousCamera = { x: transform.x, y: transform.y };
    this.currentCamera = { x: transform.x, y: transform.y };

    this.camera.setPosition(transform.x, transform.y);
    this.ocean.setCameraPosition(transform.x, transform.y);
    this.shipRenderer.render(transform);
  }

  update(dt) {
    this.world.advance(dt);
    this.resize();

    const pointerPress = this.input?.consumePointerPress?.();
    if (pointerPress) {
      const target = this.camera.screenToWorld(pointerPress.x, pointerPress.y);
      this.shipNavigation.setTarget(target.x, target.y);
    }

    const before = this.playerShip.get('transform');
    this.previousPose = {
      x: before.x,
      y: before.y,
      rotation: before.rotation
    };

    this.shipNavigation.update(this.playerShip, dt, this.input?.analog);

    const after = this.playerShip.get('transform');
    this.currentPose = {
      x: after.x,
      y: after.y,
      rotation: after.rotation
    };

    this.previousCamera = { ...this.currentCamera };

    const follow = 1 - Math.exp(-CAMERA_FOLLOW_SHARPNESS * dt);
    this.currentCamera = {
      x: this.currentCamera.x + (after.x - this.currentCamera.x) * follow,
      y: this.currentCamera.y + (after.y - this.currentCamera.y) * follow
    };

    this.shipRenderer.advance(dt);
    this.ocean.update(dt);
  }

  render(alpha = 1) {
    const pose = {
      x: this.previousPose.x + (this.currentPose.x - this.previousPose.x) * alpha,
      y: this.previousPose.y + (this.currentPose.y - this.previousPose.y) * alpha,
      rotation: lerpAngle(
        this.previousPose.rotation,
        this.currentPose.rotation,
        alpha
      )
    };

    this.shipRenderer.render(pose);

    const cameraPose = {
      x: this.previousCamera.x +
        (this.currentCamera.x - this.previousCamera.x) * alpha,
      y: this.previousCamera.y +
        (this.currentCamera.y - this.previousCamera.y) * alpha
    };

    // A câmera segue suavemente, então o navio pode avançar alguns pixels
    // na tela antes dela acompanhar.
    this.camera.setPosition(cameraPose.x, cameraPose.y);

    // O oceano acompanha a janela da câmera, mas sua animação não acelera.
    this.ocean.setCameraPosition(cameraPose.x, cameraPose.y);
    this.ocean.update(0);
  }

  resize() {
    const { width, height } = this.renderer.screen;
    this.camera.resize(width, height);
    this.ocean.resize(
      width / this.camera.zoom + 160,
      height / this.camera.zoom + 160
    );
  }
}
