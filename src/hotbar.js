import { ITEM_DEFS } from './items.js';

let inventoryStylesReady = false;

function ensureInventoryStyles() {
  if (inventoryStylesReady) return;
  inventoryStylesReady = true;
  const style = document.createElement('style');
  style.textContent = `
    #inventorypanel {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, rgba(40,30,25,0.45), rgba(0,0,0,0.82));
      z-index: 45;
    }
    #inventorypanel.open { display: flex; }
    #inventorypanel .inventory-window {
      width: min(760px, 92vw);
      padding: 20px 22px;
      border: 1px solid #44382c;
      border-radius: 10px;
      background: rgba(20,16,12,0.9);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      color: #eee;
      pointer-events: auto;
    }
    #inventorypanel .inventory-title {
      font-size: 20px;
      letter-spacing: 0.16em;
      color: #ffd9a3;
      margin-bottom: 6px;
    }
    #inventorypanel .inventory-hint {
      font-size: 12px;
      color: #aaa;
      margin-bottom: 14px;
    }
    #inventorypanel .inventory-section {
      font-size: 11px;
      letter-spacing: 0.12em;
      color: #9ad0ff;
      margin: 10px 0 8px;
    }
    #inventorypanel .inventory-row {
      display: grid;
      grid-template-columns: repeat(9, 52px);
      gap: 6px;
      justify-content: center;
    }
    #inventorypanel .inventory-row + .inventory-row {
      margin-top: 6px;
    }
    #inventorypanel .inventory-slot {
      width: 52px;
      height: 52px;
      padding: 0;
      background: rgba(0,0,0,0.45);
      border: 2px solid #2c2620;
      border-radius: 4px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: inherit;
      font: inherit;
      cursor: pointer;
      user-select: none;
      appearance: none;
      -webkit-appearance: none;
    }
    #inventorypanel .inventory-slot.active {
      border-color: #ffd9a3;
      background: rgba(50,40,28,0.65);
      box-shadow: 0 0 6px rgba(255,217,163,0.35);
    }
    #inventorypanel .inventory-slot.selected {
      border-color: #9ad0ff;
      box-shadow: 0 0 0 2px rgba(154,208,255,0.28);
    }
    #inventorypanel .inventory-slot .num {
      position: absolute;
      top: 2px;
      left: 4px;
      font-size: 10px;
      color: #aaa;
      opacity: 0.85;
    }
    #inventorypanel .inventory-slot .swatch {
      width: 30px;
      height: 30px;
      border: 1px solid rgba(0,0,0,0.4);
      border-radius: 2px;
    }
    #inventorypanel .inventory-slot .label {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 14px;
      text-align: center;
      font-size: 9px;
      letter-spacing: 0.06em;
      color: #fff;
      text-shadow: 1px 1px 0 #000;
    }
    #inventorypanel .inventory-slot .count {
      position: absolute;
      bottom: 2px;
      right: 4px;
      font-size: 12px;
      font-weight: bold;
      color: #ffeec0;
      text-shadow: 1px 1px 0 #000;
    }
  `;
  document.head.appendChild(style);
}

function renderSlotContents(el, slot, number) {
  el.querySelector('.num').textContent = String(number);
  const swatch = el.querySelector('.swatch');
  const label = el.querySelector('.label');
  const count = el.querySelector('.count');
  if (!slot) {
    swatch.style.background = 'transparent';
    swatch.style.borderColor = 'transparent';
    label.textContent = '';
    count.textContent = '';
    return;
  }
  const def = ITEM_DEFS[slot.item];
  if (def?.color) {
    swatch.style.background = def.color;
    swatch.style.borderColor = 'rgba(0,0,0,0.4)';
  } else {
    swatch.style.background = 'transparent';
    swatch.style.borderColor = 'transparent';
  }
  label.textContent = def?.label ?? '';
  count.textContent = slot.count > 1 ? slot.count : '';
}

// Renders the hotbar at the bottom of the screen and a transient inventory-full toast.
// Reactive: subscribes to inventory.onChange.
export class HotbarUI {
  constructor(inventory, options = {}) {
    ensureInventoryStyles();
    this.inventory = inventory;
    this.options = options;
    this.root = document.getElementById('hotbar');
    this.toast = document.getElementById('toast');
    this.selectedSlot = null;
    this.slotEls = [];
    this.panelSlotEls = [];
    this.root.replaceChildren();
    this._mountInventoryPanel();
    for (let i = 0; i < inventory.hotbarSize; i++) {
      const el = this._createSlotEl('div', 'hotbar-slot', i + 1);
      this.root.appendChild(el);
      this.slotEls.push(el);
    }
    for (let i = 0; i < inventory.slots.length; i++) {
      const el = this._createSlotEl('button', 'inventory-slot', i + 1);
      el.addEventListener('click', () => this._handlePanelSlotClick(i));
      this.panelSlotEls.push(el);
      if (i < inventory.hotbarSize) this.panelHotbarRow.appendChild(el);
      else this.panelPackRow.appendChild(el);
    }
    inventory.onChange(() => this.render());
    this.render();
  }

  _mountInventoryPanel() {
    let panel = document.getElementById('inventorypanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'inventorypanel';
      panel.innerHTML = `
        <div class="inventory-window">
          <div class="inventory-title">INVENTORY</div>
          <div class="inventory-hint"></div>
          <div class="inventory-section">HOTBAR</div>
          <div class="inventory-row" data-row="hotbar"></div>
          <div class="inventory-section">PACK</div>
          <div class="inventory-row" data-row="pack"></div>
        </div>
      `;
      document.body.appendChild(panel);
    }
    this.panel = panel;
    this.hintEl = panel.querySelector('.inventory-hint');
    this.panelHotbarRow = panel.querySelector('[data-row="hotbar"]');
    this.panelPackRow = panel.querySelector('[data-row="pack"]');
    this.panelHotbarRow.replaceChildren();
    this.panelPackRow.replaceChildren();
  }

  _createSlotEl(tagName, className, number) {
    const el = document.createElement(tagName);
    el.className = className;
    if (tagName === 'button') el.type = 'button';
    el.innerHTML = `
      <div class="num">${number}</div>
      <div class="swatch"></div>
      <div class="label"></div>
      <div class="count"></div>
    `;
    return el;
  }

  _handlePanelSlotClick(slotIndex) {
    if (this.selectedSlot === null) {
      this.selectedSlot = slotIndex;
      this.render();
      return;
    }
    if (this.selectedSlot === slotIndex) {
      this.selectedSlot = null;
      this.render();
      return;
    }
    if (this.options.onSwap) {
      this.options.onSwap(this.selectedSlot, slotIndex);
    } else {
      this.inventory.swapSlots(this.selectedSlot, slotIndex);
    }
    this.selectedSlot = null;
    this.render();
  }

  isInventoryOpen() {
    return this.panel.classList.contains('open');
  }

  openInventory() {
    this.selectedSlot = null;
    this.panel.classList.add('open');
    this.render();
    return true;
  }

  closeInventory() {
    this.selectedSlot = null;
    this.panel.classList.remove('open');
    this.render();
    return false;
  }

  toggleInventory(force) {
    const next = force ?? !this.isInventoryOpen();
    return next ? this.openInventory() : this.closeInventory();
  }

  render() {
    for (let i = 0; i < this.inventory.hotbarSize; i++) {
      const el = this.slotEls[i];
      const slot = this.inventory.slots[i];
      el.classList.toggle('active', i === this.inventory.active);
      renderSlotContents(el, slot, i + 1);
    }
    for (let i = 0; i < this.inventory.slots.length; i++) {
      const el = this.panelSlotEls[i];
      const slot = this.inventory.slots[i];
      el.classList.toggle('active', i === this.inventory.active && i < this.inventory.hotbarSize);
      el.classList.toggle('selected', i === this.selectedSlot);
      renderSlotContents(el, slot, i + 1);
    }
    this.hintEl.textContent = this.selectedSlot === null
      ? 'Press E to close. Click one slot, then another, to swap items. Slots 1-9 are your hotbar.'
      : `Selected slot ${this.selectedSlot + 1}. Click another slot to swap.`;
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
