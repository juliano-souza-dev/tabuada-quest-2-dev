import { Application } from 'pixi.js';
import { GameLoop } from '../engine/core/GameLoop.js';
import { SceneManager } from '../engine/scenes/SceneManager.js';
import { AssetManager } from '../engine/assets/AssetManager.js';
import { InputManager } from '../engine/input/InputManager.js';
import { AudioManager } from '../engine/audio/AudioManager.js';
import { GameSession } from './GameSession.js';
import { ServiceContainer } from '../services/ServiceContainer.js';

export class GameApp {
  constructor({ mount }) {
    if (!mount) throw new Error('Game mount element is required.');
    this.mount = mount;
    this.renderer = new Application();
    this.assets = new AssetManager();
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.session = new GameSession();
    this.services = new ServiceContainer();
    this.scenes = new SceneManager({ stage: this.renderer.stage });
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (alpha) => this.render(alpha) });
  }

  async start() {
    await this.renderer.init({ resizeTo: window, antialias: true, background: '#071522', resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true });
    this.mount.appendChild(this.renderer.canvas);
    this.renderer.ticker.stop();
    this.input.attach(this.renderer.canvas);
    this.loop.start();
  }

  update(dt) {
    this.input.update(dt);
    this.scenes.update(dt);
  }

  render(alpha) {
    this.scenes.render(alpha);
    this.renderer.renderer.render(this.renderer.stage);
  }

  stop() {
    this.loop.stop();
    this.scenes.clear();
    this.audio.stopAll();
    this.input.detach();
    this.renderer.destroy(true);
  }
}
