export class GameSession {
  constructor() { this.reset(); }

  reset() {
    this.id = null;
    this.mode = 'offline';
    this.startedAt = null;
    this.playerProfile = null;
  }

  start(playerProfile) {
    this.id = crypto.randomUUID();
    this.startedAt = Date.now();
    this.playerProfile = playerProfile;
  }

  end() { this.reset(); }
}
