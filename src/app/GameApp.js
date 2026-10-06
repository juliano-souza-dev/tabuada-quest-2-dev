import { Application } from 'pixi.js';
import { GameLoop } from '../engine/core/GameLoop.js';
import { SceneManager } from '../engine/scenes/SceneManager.js';
import { AssetManager } from '../engine/assets/AssetManager.js';
import { InputManager } from '../engine/input/InputManager.js';
import { AudioManager } from '../engine/audio/AudioManager.js';
import { GameSession } from './GameSession.js';
import { ServiceContainer } from '../services/ServiceContainer.js';
import { LocalPersistenceService } from '../services/persistence/LocalPersistenceService.js';
import { PlayerProfile } from '../game/player/PlayerProfile.js';
import { WorldScene } from '../presentation/scenes/WorldScene.js';

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
    this.services.register('persistence', new LocalPersistenceService());
    this.scenes = null;
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: (alpha) => this.render(alpha) });
  }

  async start() {
    const persistence = this.services.get('persistence');
    let profile = await persistence.loadPlayerProfile();
    if (!profile) {
      profile = new PlayerProfile();
      await persistence.savePlayerProfile(profile);
    }
    this.session.start(profile);

    await this.renderer.init({ resizeTo: window, antialias: true, background: '#071522', resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true });
    this.scenes = new SceneManager({ stage: this.renderer.stage });
    this.mount.appendChild(this.renderer.canvas);
    this.input.attach(this.renderer.canvas);
    await this.scenes.change(new WorldScene({ renderer: this.renderer, assets: this.assets }));
    this.loop.start();
  }

  update(dt) { this.input.update(dt); this.scenes?.update(dt); }
  render(alpha) { this.scenes?.render(alpha); }

  stop() {
    this.loop.stop();
    this.scenes?.clear();
    this.audio.stopAll();
    this.input.detach();
    this.session.end();
    this.renderer.destroy(true);
  }
}
