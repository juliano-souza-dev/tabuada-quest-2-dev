export class Wallet {
  constructor({ gold = 0, rubies = 0 } = {}) { this.gold = gold; this.rubies = rubies; }
  toJSON() { return { gold: this.gold, rubies: this.rubies }; }
}
