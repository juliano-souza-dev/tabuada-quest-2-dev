export class Loadout {
  constructor({ shipId = null, cannonIds = [], ammoId = null } = {}) { this.shipId = shipId; this.cannonIds = [...cannonIds]; this.ammoId = ammoId; }
  toJSON() { return { shipId: this.shipId, cannonIds: [...this.cannonIds], ammoId: this.ammoId }; }
}
