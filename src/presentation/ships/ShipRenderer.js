import { Container, Graphics } from 'pixi.js';

const DEG_TO_RAD = Math.PI / 180;

export class ShipRenderer {
  constructor() {
    this.view = new Container();
    this.body = new Container();
    this.elapsed = 0;

    const shadow = new Graphics()
      .ellipse(0, 18, 29, 44)
      .fill({ color: 0x00121d, alpha: 0.28 });

    const hull = new Graphics()
      .moveTo(0, -52)
      .lineTo(27, -18)
      .lineTo(22, 35)
      .lineTo(0, 54)
      .lineTo(-22, 35)
      .lineTo(-27, -18)
      .closePath()
      .fill(0x6f3c22)
      .stroke({ color: 0x2a160f, width: 4 });

    const deck = new Graphics()
      .moveTo(0, -40)
      .lineTo(18, -14)
      .lineTo(14, 28)
      .lineTo(0, 41)
      .lineTo(-14, 28)
      .lineTo(-18, -14)
      .closePath()
      .fill(0xa76536);

    const mast = new Graphics()
      .rect(-2, -35, 4, 61)
      .fill(0x392219);

    const sail = new Graphics()
      .moveTo(2, -30)
      .lineTo(22, -7)
      .lineTo(2, 14)
      .closePath()
      .fill(0xefe1b8)
      .stroke({ color: 0x7b694f, width: 2 });

    const flag = new Graphics()
      .moveTo(2, -34)
      .lineTo(17, -29)
      .lineTo(2, -23)
      .closePath()
      .fill(0x1b1b1b);

    this.body.addChild(shadow, hull, deck, mast, sail, flag);
    this.view.addChild(this.body);
    this.view.eventMode = 'none';
  }

  update(transform, dt) {
    this.elapsed += dt;

    this.view.position.set(transform.x, transform.y);
    this.view.rotation = transform.rotation * DEG_TO_RAD;

    this.body.y = Math.sin(this.elapsed * 2.1) * 2.2;
    this.body.rotation = Math.sin(this.elapsed * 1.35) * 0.012;
  }
}
