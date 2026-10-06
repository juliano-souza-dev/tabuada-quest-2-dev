import { Container, Graphics } from 'pixi.js';

export class OceanRenderer {
  constructor() {
    this.view = new Container();
    this.time = 0;
    this.width = 0;
    this.height = 0;
    this.base = new Graphics();
    this.waves = new Graphics();
    this.view.addChild(this.base, this.waves);
  }

  resize(width, height) {
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    this.base.clear().rect(-width, -height, width * 2, height * 2).fill('#0b4263');
  }

  update(dt) { this.time += dt; }

  render() {
    const g = this.waves;
    g.clear();
    const spacing = 72;
    const amplitude = 7;
    const left = -this.width;
    const right = this.width;
    const top = -this.height;
    const bottom = this.height;
    for (let y = top; y <= bottom; y += spacing) {
      const phase = this.time * 18 + y * 0.07;
      g.moveTo(left, y);
      for (let x = left; x <= right; x += 48) {
        g.lineTo(x, y + Math.sin(x * 0.018 + phase) * amplitude);
      }
      g.stroke({ color: '#4b91a9', alpha: 0.18, width: 2 });
    }
  }
}
