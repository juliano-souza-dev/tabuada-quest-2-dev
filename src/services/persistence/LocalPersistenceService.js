import { PersistenceService } from './PersistenceService.js';
import { PlayerProfile } from '../../game/player/PlayerProfile.js';

const PROFILE_KEY = 'tq.player.profile.v1';

export class LocalPersistenceService extends PersistenceService {
  constructor(storage = window.localStorage) { super(); this.storage = storage; }

  async loadPlayerProfile() {
    const raw = this.storage.getItem(PROFILE_KEY);
    if (!raw) return null;
    try { return PlayerProfile.from(JSON.parse(raw)); }
    catch { this.storage.removeItem(PROFILE_KEY); return null; }
  }

  async savePlayerProfile(profile) {
    this.storage.setItem(PROFILE_KEY, JSON.stringify(profile.toJSON()));
  }

  async clearPlayerProfile() { this.storage.removeItem(PROFILE_KEY); }
}
