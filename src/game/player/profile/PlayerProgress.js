export class PlayerProgress {
  constructor({ missions = {}, claimedRewards = [] } = {}) { this.missions = { ...missions }; this.claimedRewards = [...claimedRewards]; }
  toJSON() { return { missions: { ...this.missions }, claimedRewards: [...this.claimedRewards] }; }
}
