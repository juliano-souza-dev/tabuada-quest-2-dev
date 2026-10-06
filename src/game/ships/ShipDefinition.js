export const STARTER_SHIP = Object.freeze({
  id: 'ship-starter-01',
  name: 'Navio Inicial',
  movement: Object.freeze({
    maxSpeed: 320,
    acceleration: 220,
    deceleration: 300,
    turnRate: 145,
    stopRadius: 24
  }),
  visual: Object.freeze({
    width: 74,
    height: 116
  })
});
