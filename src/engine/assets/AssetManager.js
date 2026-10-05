import { Assets } from 'pixi.js';
export class AssetManager {
  load(source) { return Assets.load(source); }
  unload(source) { return Assets.unload(source); }
}
