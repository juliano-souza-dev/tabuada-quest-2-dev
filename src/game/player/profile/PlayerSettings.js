export class PlayerSettings {
  constructor({ audio = {}, controls = {} } = {}) { this.audio = { ...audio }; this.controls = { ...controls }; }
  toJSON() { return { audio: { ...this.audio }, controls: { ...this.controls } }; }
}
