import { ITEM_DEFS } from './items.js';

// Renders the hotbar at the bottom of the screen and a transient inventory-full toast.
// Reactive: subscribes to inventory.onChange.
export class HotbarUI {
  constructor(inventory) {
    this.inventory = inventory;
    this.root = document.getElementById('hotbar');
    this.toast = document.getElementById('toast');
    this.slotEls = [];
    for (let i = 0; i < inventory.slots.length; i++) {
      const el = document.createElement('div');
      el.className = 'hotbar-slot';
      el.innerHTML = `
        <div class="num">${i + 1}</div>
        <div class="swatch"></div>
        <div class="label"></div>
        <div class="count"></div>
      `;
      this.root.appendChild(el);
      this.slotEls.push(el);
    }
    inventory.onChange(() => this.render());
    this.render();
  }

  render() {
    for (let i = 0; i < this.inventory.slots.length; i++) {
      const el = this.slotEls[i];
      const slot = this.inventory.slots[i];
      el.classList.toggle('active', i === this.inventory.active);
      const swatch = el.querySelector('.swatch');
      const label = el.querySelector('.label');
      const count = el.querySelector('.count');
      if (!slot) {
        swatch.style.background = 'transparent';
        swatch.style.borderColor = 'transparent';
        label.textContent = '';
        count.textContent = '';
        continue;
      }
      const def = ITEM_DEFS[slot.item];
      if (def.color) {
        swatch.style.background = def.color;
        swatch.style.borderColor = 'rgba(0,0,0,0.4)';
        label.textContent = def.label;
      } else {
        swatch.style.background = 'transparent';
        swatch.style.borderColor = 'transparent';
        label.textContent = def.label;
      }
      count.textContent = slot.count > 1 ? slot.count : '';
    }
  }

  showToast(text, ttl = 1400) {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('visible'), ttl);
  }
}

export function setMiningProgress(value) {
  const el = document.getElementById('mineprogress');
  if (value <= 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.querySelector('.fill').style.width = `${Math.min(100, value * 100)}%`;
}
