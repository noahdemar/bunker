import { ITEM_DEFS } from './items.js';

// Slot-based inventory. Each slot is null or { item, count }.
// First slots typically hold tools; everything else stacks blocks up to ITEM_DEFS[item].stack.
export class Inventory {
  constructor(slotCount = 9) {
    this.slots = new Array(slotCount).fill(null);
    this.active = 0;
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }
  _notify() { for (const fn of this.listeners) fn(this); }

  setActive(idx) {
    if (idx < 0 || idx >= this.slots.length) return;
    this.active = idx;
    this._notify();
  }

  getActive() { return this.slots[this.active]; }

  activeTool() {
    const s = this.getActive();
    if (!s) return null;
    return ITEM_DEFS[s.item]?.tool ?? null;
  }

  activeBlockItem() {
    const s = this.getActive();
    if (!s) return null;
    const def = ITEM_DEFS[s.item];
    if (def?.blockId === undefined) return null;
    return s;
  }

  // Returns count actually added.
  add(itemId, count = 1) {
    const def = ITEM_DEFS[itemId];
    if (!def) return 0;
    const stack = def.stack;
    let remaining = count;
    // top up existing partial stacks
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.item === itemId && s.count < stack) {
        const take = Math.min(remaining, stack - s.count);
        s.count += take;
        remaining -= take;
      }
    }
    // fill empty slots
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(remaining, stack);
        this.slots[i] = { item: itemId, count: take };
        remaining -= take;
      }
    }
    if (remaining < count) this._notify();
    return count - remaining;
  }

  // True if `count` of `itemId` can fit somewhere right now.
  canAdd(itemId, count = 1) {
    const def = ITEM_DEFS[itemId];
    if (!def) return false;
    const stack = def.stack;
    let remaining = count;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (!s) remaining -= stack;
      else if (s.item === itemId && s.count < stack) remaining -= (stack - s.count);
    }
    return remaining <= 0;
  }

  // Decrement active slot's stack by 1. Returns the item id removed, or null.
  consumeActive() {
    const s = this.getActive();
    if (!s) return null;
    const id = s.item;
    s.count -= 1;
    if (s.count <= 0) this.slots[this.active] = null;
    this._notify();
    return id;
  }
}
