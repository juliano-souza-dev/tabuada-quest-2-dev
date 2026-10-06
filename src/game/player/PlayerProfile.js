import { Identity } from './profile/Identity.js';
import { Progression } from './profile/Progression.js';
import { Wallet } from './profile/Wallet.js';
import { Inventory } from './profile/Inventory.js';
import { Loadout } from './profile/Loadout.js';
import { PlayerProgress } from './profile/PlayerProgress.js';
import { PlayerSettings } from './profile/PlayerSettings.js';

export class PlayerProfile {
  static VERSION = 2;

  constructor({
    identity = {},
    progression = {},
    wallet = {},
    inventory = {},
    loadout = {},
    progress = {},
    settings = {}
  } = {}) {
    this.version = PlayerProfile.VERSION;
    this.identity = new Identity(identity);
    this.progression = new Progression(progression);
    this.wallet = new Wallet(wallet);
    this.inventory = new Inventory(inventory);
    this.loadout = new Loadout(loadout);
    this.progress = new PlayerProgress(progress);
    this.settings = new PlayerSettings(settings);
  }

  toJSON() {
    return {
      version: this.version,
      identity: this.identity.toJSON(),
      progression: this.progression.toJSON(),
      wallet: this.wallet.toJSON(),
      inventory: this.inventory.toJSON(),
      loadout: this.loadout.toJSON(),
      progress: this.progress.toJSON(),
      settings: this.settings.toJSON()
    };
  }

  static from(data) {
    if (!data) return new PlayerProfile();
    if (data.version === 1) {
      return new PlayerProfile({ identity: { id: data.id, name: data.name, createdAt: data.createdAt } });
    }
    if (data.version !== PlayerProfile.VERSION) return new PlayerProfile();
    return new PlayerProfile(data);
  }
}
