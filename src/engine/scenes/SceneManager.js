export class SceneManager {
  constructor({ stage }) { this.stage = stage; this.current = null; }
  async change(scene) {
    if (this.current) { await this.current.exit?.(); this.stage.removeChild(this.current.view); }
    this.current = scene;
    if (!scene) return;
    await scene.enter?.();
    this.stage.addChild(scene.view);
  }
  update(dt) { this.current?.update?.(dt); }
  render(alpha) { this.current?.render?.(alpha); }
  clear() { if (this.current?.view) this.stage.removeChild(this.current.view); this.current = null; }
}
