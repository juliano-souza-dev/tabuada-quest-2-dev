import { Container } from 'pixi.js';
import { WorldState } from '../../game/world/WorldState.js';
import { WorldCamera } from '../../engine/camera/WorldCamera.js';
import { createStarterShip } from '../../game/ships/createStarterShip.js';
import { ShipNavigationSystem } from '../../game/systems/ShipNavigationSystem.js';
import { OceanRenderer } from '../world/OceanRenderer.js';
import { ShipRenderer } from '../ships/ShipRenderer.js';

const normalizeDegrees = (value) => ((value % 360) + 360) % 360;

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

    // A câmera usa a posição interpolada, não os saltos de 60 Hz da simulação.
    this.camera.setPosition(pose.x, pose.y);

    // Mantém o oceano contínuo e reaplica o filtro na posição visual da câmera.
    this.ocean.setCameraPosition(pose.x, pose.y);
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
