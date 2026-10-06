export class Identity {
  constructor({ id = 'local-player', name = 'Pirata', avatarId = null, createdAt = Date.now() } = {}) {
    this.id = id; this.name = name; this.avatarId = avatarId; this.createdAt = createdAt;
  }
  toJSON() { return { id: this.id, name: this.name, avatarId: this.avatarId, createdAt: this.createdAt }; }
}
