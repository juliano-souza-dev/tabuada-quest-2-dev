import { Container } from 'pixi.js';
import { WorldState } from '../../game/world/WorldState.js';
import { WorldCamera } from '../../engine/camera/WorldCamera.js';
import { createStarterShip } from '../../game/ships/createStarterShip.js';
import { ShipNavigationSystem } from '../../game/systems/ShipNavigationSystem.js';
import { OceanRenderer } from '../world/OceanRenderer.js';
import { ShipRenderer } from '../ships/ShipRenderer.js';

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
    this.camera.setPosition(transform.x, transform.y);
    this.ocean.setCameraPosition(transform.x, transform.y);
    this.shipRenderer.update(transform, 0);
  }

  update(dt) {
    this.world.advance(dt);
    this.resize();

    const pointerPress = this.input?.consumePointerPress?.();
    if (pointerPress) {
      const target = this.camera.screenToWorld(pointerPress.x, pointerPress.y);
      this.shipNavigation.setTarget(target.x, target.y);
    }

    this.shipNavigation.update(this.playerShip, dt);

    const transform = this.playerShip.get('transform');
    this.shipRenderer.update(transform, dt);

    this.camera.setPosition(transform.x, transform.y);
    this.ocean.setCameraPosition(transform.x, transform.y);
    this.ocean.update(dt);
  }

  render() {}

  resize() {
    const { width, height } = this.renderer.screen;
    this.camera.resize(width, height);
    this.ocean.resize(
      width / this.camera.zoom + 160,
      height / this.camera.zoom + 160
    );
  }
}
