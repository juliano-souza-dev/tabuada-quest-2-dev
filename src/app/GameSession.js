export class GameSession {
  constructor() { this.reset(); }
  reset() { this.userId = null; this.mode = 'offline'; this.connected = false; }
  authenticate(userId) { this.userId = userId; }
  setConnection({ mode, connected }) { this.mode = mode; this.connected = connected; }
}
