export class Progression {
  constructor({ rank = null, pedagogy = {} } = {}) { this.rank = rank; this.pedagogy = { ...pedagogy }; }
  toJSON() { return { rank: this.rank, pedagogy: { ...this.pedagogy } }; }
}
