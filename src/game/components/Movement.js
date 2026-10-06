export const createMovement = ({
  velocityX = 0,
  velocityY = 0,
  speed = 0,
  maxSpeed = 0,
  acceleration = 0,
  deceleration = 0,
  turnRate = 0
} = {}) => ({
  velocityX,
  velocityY,
  speed,
  maxSpeed,
  acceleration,
  deceleration,
  turnRate
});
