import { Application, Container, Graphics } from 'pixi.js';
import { GameLoop } from './core/GameLoop.js';
import { InputManager } from './input/InputManager.js';

export class Game {
  constructor({ mount }) {
    if (!mount) throw new Error('Game mount element is required.');
    this.mount = mount;
    this.app = new Application();
    this.world = new Container();
    this.input = new InputManager();
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (alpha) => this.render(alpha) });
  }

  async start() {
    await this.app.init({ resizeTo: window, antialias: true, background: '#071522', resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true });
    this.mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.app.ticker.stop();
    this.input.attach(this.app.canvas);
    this.createFoundationView();
    this.loop.start();
  }

  createFoundationView() {
    const ocean = new Graphics().rect(0, 0, 100, 100).fill('#0b3552');
    ocean.label = 'foundation-ocean';
    this.world.addChild(ocean);
  }

  update(dt) {
    this.input.update(dt);
  }

  render() {
    const ocean = this.world.getChildByLabel('foundation-ocean');
    if (ocean) { ocean.width = this.app.screen.width; ocean.height = this.app.screen.height; }
    this.app.renderer.render(this.app.stage);
  }
}
