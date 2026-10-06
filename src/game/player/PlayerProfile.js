export class PlayerProfile {
  static VERSION = 1;

  constructor({ id = 'local-player', name = 'Pirata', createdAt = Date.now() } = {}) {
    this.version = PlayerProfile.VERSION;
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
  }

  toJSON() {
    return { version: this.version, id: this.id, name: this.name, createdAt: this.createdAt };
  }

  static from(data) {
    if (!data || data.version !== PlayerProfile.VERSION) return new PlayerProfile();
    return new PlayerProfile(data);
  }
}
