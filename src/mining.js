import { miningTime } from './items.js';

// Tracks an in-progress mining action against a single block. While the player holds
// left-click and looks at a target, elapsed time accumulates against the effective
// hardness for that (block, tool) pair. A retarget (different cell or different tool)
// resets progress.
export class Mining {
  constructor() {
    this.target = null;       // { x, y, z, blockId, tool }
    this.elapsed = 0;
    this.required = 0;
  }

  start(x, y, z, blockId, tool) {
    this.target = { x, y, z, blockId, tool };
    this.elapsed = 0;
    this.required = miningTime(blockId, tool);
  }

  cancel() {
    this.target = null;
    this.elapsed = 0;
    this.required = 0;
  }

  // Returns true if currently mining the same cell with the same tool.
  matches(x, y, z, blockId, tool) {
    const t = this.target;
    return t && t.x === x && t.y === y && t.z === z && t.blockId === blockId && t.tool === tool;
  }

  // Advance time. Returns true on the frame where mining completes.
  tick(dt) {
    if (!this.target) return false;
    this.elapsed += dt;
    return this.elapsed >= this.required;
  }

  progress() {
    if (!this.target || this.required <= 0) return 0;
    return Math.min(1, this.elapsed / this.required);
  }

  isActive() { return this.target !== null; }
}
