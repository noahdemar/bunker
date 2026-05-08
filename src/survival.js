import { BLOCKS } from './blocks.js';

// Player survival state machine. Pre-bomb: meters are full and don't drain — focus
// is on building. Post-bomb: meters drain; nearby devices replenish them by transferring
// charge 1:1. Health drains when water or food hit zero. Bed within range provides
// a "shelter" multiplier that slows all drain.

const POST_DRAIN = {
  water: 0.10,
  food:  0.08,
  power: 0.04,
};
const HEALTH_DRAIN = {
  water: 0.30, // applied while water == 0
  food:  0.20, // applied while food == 0
};
const REFILL_RATE = 4.0;       // units/sec, transferred 1:1 from device
const DEVICE_RANGE = 6;
const SHELTER_RANGE = 8;
const SHELTER_DRAIN_MULT = 0.7;

const METER_TO_DEVICE = {
  water: BLOCKS.WATER_TANK,
  food:  BLOCKS.FOOD_LOCKER,
  power: BLOCKS.GENERATOR,
};

export class Survival {
  constructor() {
    this.water = 100;
    this.food = 100;
    this.power = 100;
    this.health = 100;
    this.shelter = false;
    this.dead = false;
    this.deathCause = null;
    this.armed = false;       // true once the bomb has dropped — drains begin
    this.survivalTime = 0;    // seconds since arming
  }

  arm() { this.armed = true; }

  // Returns true on the frame the player dies.
  update(dt, devices, playerPos) {
    if (this.dead || !this.armed) return false;
    this.survivalTime += dt;

    this.shelter = devices.hasNearby(BLOCKS.BED, playerPos.x, playerPos.y, playerPos.z, SHELTER_RANGE);
    const drainMult = this.shelter ? SHELTER_DRAIN_MULT : 1.0;

    this.water -= POST_DRAIN.water * drainMult * dt;
    this.food  -= POST_DRAIN.food  * drainMult * dt;
    this.power -= POST_DRAIN.power * drainMult * dt;

    for (const meter of ['water', 'food', 'power']) {
      this._replenish(meter, devices, playerPos, dt);
    }

    this.water = clamp(this.water, 0, 100);
    this.food  = clamp(this.food,  0, 100);
    this.power = clamp(this.power, 0, 100);

    if (this.water <= 0) this.health -= HEALTH_DRAIN.water * dt;
    if (this.food  <= 0) this.health -= HEALTH_DRAIN.food  * dt;
    this.health = clamp(this.health, 0, 100);

    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.deathCause = this.water <= 0 ? 'thirst' : (this.food <= 0 ? 'starvation' : 'unknown');
      return true;
    }
    return false;
  }

  _replenish(meter, devices, pos, dt) {
    const type = METER_TO_DEVICE[meter];
    const d = devices.nearest(type, pos.x, pos.y, pos.z, DEVICE_RANGE);
    if (!d || d.charge <= 0) return;
    const space = 100 - this[meter];
    if (space <= 0) return;
    const inc = Math.min(REFILL_RATE * dt, space, d.charge);
    this[meter] += inc;
    d.charge -= inc;
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
