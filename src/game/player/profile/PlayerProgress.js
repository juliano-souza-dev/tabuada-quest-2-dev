export class PlayerProgress {
  constructor({
    missions = {},
    claimedRewards = [],
    treasures = {}
  } = {}) {
    this.missions = { ...missions };
    this.claimedRewards = [...claimedRewards];
    this.treasures = structuredClone(treasures || {});
  }

  toJSON() {
    return {
      missions: { ...this.missions },
      claimedRewards: [...this.claimedRewards],
      treasures: structuredClone(this.treasures)
    };
  }
}
