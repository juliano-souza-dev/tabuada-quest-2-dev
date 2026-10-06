import { Container } from 'pixi.js';
import { WorldState } from '../../game/world/WorldState.js';
import { WorldCamera } from '../../engine/camera/WorldCamera.js';
import { createStarterShip } from '../../game/ships/createStarterShip.js';
import { ShipNavigationSystem } from '../../game/systems/ShipNavigationSystem.js';
import { OceanRenderer } from '../world/OceanRenderer.js';
import { ShipRenderer } from '../ships/ShipRenderer.js';
import { ShipWakeRenderer } from '../ships/ShipWakeRenderer.js';
import { STARTER_REGION, clampPointToRegion } from '../../game/world/RegionDefinition.js';

const normalizeDegrees = (value) => ((value % 360) + 360) % 360;
const CAMERA_FOLLOW_SHARPNESS = 4.5;

const cameraBoundaryPadding = (renderer, camera) => {
  const halfViewWidth =
    renderer.screen.width / (2 * camera.zoom);

  const halfViewHeight =
    renderer.screen.height / (2 * camera.zoom);

  return Math.max(56, halfViewWidth, halfViewHeight);
};

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

    this.region = STARTER_REGION;

    this.ocean = new OceanRenderer({ renderer: this.renderer });
    this.shipNavigation = new ShipNavigationSystem({
      region: this.region,
      boundaryPadding: 56
    });
    this.playerShip = createStarterShip({ x: 0, y: 0 });
    this.shipRenderer = new ShipRenderer();
    this.shipWakeRenderer = new ShipWakeRenderer({ shipHeight: 116 });

    this.previousPose = { x: 0, y: 0, rotation: 0 };
    this.currentPose = { x: 0, y: 0, rotation: 0 };
    this.previousCamera = { x: 0, y: 0 };
    this.currentCamera = { x: 0, y: 0 };

    this.world.entities.add(this.playerShip);

    this.view.addChild(this.ocean.view);
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
    this.ocean.setZoom(this.camera.zoom);
    this.shipRenderer.render(
      transform,
      this.playerShip.get('visual')
    );
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

    const sharedBoundaryPadding =
      cameraBoundaryPadding(this.renderer, this.camera);

    // Navio e câmera usam exatamente a mesma área navegável.
    this.shipNavigation.boundaryPadding =
      sharedBoundaryPadding;

    this.shipNavigation.update(
      this.playerShip,
      dt,
      this.input?.analog
    );

    const after = this.playerShip.get('transform');
    this.currentPose = {
      x: after.x,
      y: after.y,
      rotation: after.rotation
    };

    this.previousCamera = { ...this.currentCamera };

    const follow = 1 - Math.exp(-CAMERA_FOLLOW_SHARPNESS * dt);

    const desiredCamera = {
      x: this.currentCamera.x + (after.x - this.currentCamera.x) * follow,
      y: this.currentCamera.y + (after.y - this.currentCamera.y) * follow
    };

    const clampedCamera = clampPointToRegion(
      desiredCamera.x,
      desiredCamera.y,
      this.region,
      sharedBoundaryPadding
    );

    this.currentCamera = clampedCamera;

    this.shipWakeRenderer.update(
      after,
      this.playerShip.get('movement'),
      dt
    );

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

    this.shipRenderer.render(
      pose,
      this.playerShip.get('visual')
    );

    const cameraPose = {
      x: this.previousCamera.x +
        (this.currentCamera.x - this.previousCamera.x) * alpha,
      y: this.previousCamera.y +
        (this.currentCamera.y - this.previousCamera.y) * alpha
    };

    // O wake é desenhado pelo mesmo passe WebGL da versão antiga.
    this.ocean.setWake({
      active: true,
      samples: this.shipWakeRenderer.samples,
      width: 66,
      opacity: 0.78,
      lifetime: 2588
    });

    // A câmera segue suavemente, então o navio pode avançar alguns pixels
    // na tela antes dela acompanhar.
    this.camera.setPosition(cameraPose.x, cameraPose.y);

    // O oceano acompanha a janela da câmera, mas sua animação não acelera.
    this.ocean.setCameraPosition(cameraPose.x, cameraPose.y);
    this.ocean.setZoom(this.camera.zoom);
    this.ocean.update(0);
  }

  resize() {
    const { width, height } = this.renderer.screen;
    this.camera.resize(width, height);
    this.ocean.resize(width, height);
  }
}
