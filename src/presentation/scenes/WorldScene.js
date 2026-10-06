import { Container } from 'pixi.js';
import { WorldState } from '../../game/world/WorldState.js';
import { WorldCamera } from '../../engine/camera/WorldCamera.js';
import { OceanRenderer } from '../world/OceanRenderer.js';

export class WorldScene {
  constructor({ renderer, assets, worldId = 'ocean' }) {
    this.renderer = renderer;
    this.assets = assets;
    this.view = new Container();
    this.world = new WorldState({ worldId });
    this.camera = new WorldCamera();
    this.ocean = new OceanRenderer();
    this.camera.view.addChild(this.ocean.view);
    this.view.addChild(this.camera.view);
  }

  async enter() {
    await this.ocean.init(this.assets);
    this.resize();
  }

  update(dt) {
    this.world.advance(dt);
    this.ocean.update(dt);
    this.resize();
  }

  render() {}

  resize() {
    const { width, height } = this.renderer.screen;
    this.camera.resize(width, height);
    this.ocean.resize(width / this.camera.zoom + 160, height / this.camera.zoom + 160);
  }
}
