export class Inventory {
  constructor({ ships = [], cannons = [], ammo = [], items = [] } = {}) {
    this.ships = [...ships]; this.cannons = [...cannons]; this.ammo = [...ammo]; this.items = [...items];
  }
  toJSON() { return { ships: [...this.ships], cannons: [...this.cannons], ammo: [...this.ammo], items: [...this.items] }; }
}
