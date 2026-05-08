// Renders the four survival meters and the shelter indicator. Reads state from a
// Survival instance each frame; cheap enough to update unconditionally.
export class MetersHUD {
  constructor(survival) {
    this.survival = survival;
    this.root = document.getElementById('meters');
    this.fills = {
      water:  this.root.querySelector('.meter.water  .fill'),
      food:   this.root.querySelector('.meter.food   .fill'),
      power:  this.root.querySelector('.meter.power  .fill'),
      health: this.root.querySelector('.meter.health .fill'),
    };
    this.values = {
      water:  this.root.querySelector('.meter.water  .val'),
      food:   this.root.querySelector('.meter.food   .val'),
      power:  this.root.querySelector('.meter.power  .val'),
      health: this.root.querySelector('.meter.health .val'),
    };
    this.shelterEl = this.root.querySelector('.shelter');
  }

  update() {
    const s = this.survival;
    for (const k of ['water', 'food', 'power', 'health']) {
      const v = Math.round(s[k]);
      this.fills[k].style.width = v + '%';
      this.values[k].textContent = v;
      this.fills[k].parentElement.classList.toggle('low', v <= 20);
    }
    this.shelterEl.classList.toggle('on', s.shelter);
    this.shelterEl.textContent = 'SHELTER ' + (s.shelter ? 'OK' : '—');
  }
}
