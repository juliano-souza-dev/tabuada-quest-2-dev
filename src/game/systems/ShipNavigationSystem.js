const normalizeDegrees = (value) => ((value % 360) + 360) % 360;

const shortestAngle = (from, to) => {
  const delta = normalizeDegrees(to - from);
  return delta > 180 ? delta - 360 : delta;
};

const moveToward = (value, target, amount) => {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return value;
};

export class ShipNavigationSystem {
  constructor() {
    this.target = null;
  }

  setTarget(x, y) {
    this.target = { x, y };
  }

  clearTarget() {
    this.target = null;
  }

  update(entity, dt, steering = null) {
    const transform = entity.get('transform');
    const movement = entity.get('movement');
    const ship = entity.get('ship');

    if (!transform || !movement || !ship) return;

    let desiredSpeed = 0;
    let desiredHeading = null;

    if (steering?.active) {
      this.clearTarget();

      const x = Number(steering.x) || 0;
      const y = Number(steering.y) || 0;
      const magnitude = Math.max(0, Math.min(1, Number(steering.magnitude) || 0));

      if (magnitude > 0.001) {
        desiredHeading = normalizeDegrees(Math.atan2(x, -y) * 180 / Math.PI);
        desiredSpeed = movement.maxSpeed * magnitude;
      }
    } else if (this.target) {
      const dx = this.target.x - transform.x;
      const dy = this.target.y - transform.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= ship.stopRadius) {
        this.clearTarget();
      } else {
        desiredHeading = normalizeDegrees(Math.atan2(dx, -dy) * 180 / Math.PI);

        const brakingDistance =
          (movement.speed * movement.speed) / Math.max(1, 2 * movement.deceleration);

        desiredSpeed = distance <= brakingDistance + ship.stopRadius
          ? Math.max(45, movement.maxSpeed * 0.28)
          : movement.maxSpeed;
      }
    }

    if (desiredHeading !== null) {
      const turn = shortestAngle(transform.rotation, desiredHeading);
      const maxTurn = movement.turnRate * dt;

      transform.rotation = normalizeDegrees(
        transform.rotation + Math.max(-maxTurn, Math.min(maxTurn, turn))
      );
    }

    const rate = desiredSpeed > movement.speed
      ? movement.acceleration
      : movement.deceleration;

    movement.speed = moveToward(movement.speed, desiredSpeed, rate * dt);

    if (movement.speed <= 0.001) {
      movement.speed = 0;
      movement.velocityX = 0;
      movement.velocityY = 0;
      return;
    }

    const radians = transform.rotation * Math.PI / 180;
    movement.velocityX = Math.sin(radians) * movement.speed;
    movement.velocityY = -Math.cos(radians) * movement.speed;

    transform.x += movement.velocityX * dt;
    transform.y += movement.velocityY * dt;
  }
}
