export const PIRATE_NPC_SHIP = Object.freeze({
  id: 'ship-npc-pirate-01',
  name: 'Navio Pirata NPC',
  movement: Object.freeze({
    maxSpeed: 250,
    acceleration: 180,
    deceleration: 240,
    turnRate: 125,
    stopRadius: 38
  }),
  health: Object.freeze({
    max: 250
  }),
  visual: Object.freeze({
    assetRef: 'ship.npc.pirate.16dir',
    scale: 0.52,
    effects: Object.freeze({
      halloween: false,
      ghostParticles: false
    })
  })
});
