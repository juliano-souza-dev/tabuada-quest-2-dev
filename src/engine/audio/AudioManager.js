export class AudioManager {
  constructor() { this.musicVolume = 1; this.effectsVolume = 1; this.active = new Set(); }
  track(audio) { this.active.add(audio); return audio; }
  stopAll() { for (const audio of this.active) { audio.pause?.(); audio.currentTime = 0; } this.active.clear(); }
}
