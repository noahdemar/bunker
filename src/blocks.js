// Block type IDs. 0 = air. Order matters for hotbar (1..N).
export const BLOCKS = {
  AIR:         0,
  GRASS:       1,
  DIRT:        2,
  STONE:       3,
  SAND:        4,
  WOOD:        5,
  LEAVES:      6,
  CONCRETE:    7,
  TORCH:       8,
  WATER_TANK:  9,
  FOOD_LOCKER: 10,
  GENERATOR:   11,
  BED:         12,
};

export const BLOCK_NAMES = [
  'air', 'grass', 'dirt', 'stone', 'sand', 'wood', 'leaves', 'concrete',
  'torch', 'water_tank', 'food_locker', 'generator', 'bed',
];

// Set of device blocks (placeable survival equipment).
export const DEVICE_BLOCKS = new Set([
  BLOCKS.WATER_TANK,
  BLOCKS.FOOD_LOCKER,
  BLOCKS.GENERATOR,
  BLOCKS.BED,
]);

// Hotbar order shown in HUD.
export const HOTBAR = [
  BLOCKS.CONCRETE,
  BLOCKS.STONE,
  BLOCKS.WOOD,
  BLOCKS.DIRT,
  BLOCKS.GRASS,
  BLOCKS.SAND,
  BLOCKS.LEAVES,
];

// Whether a block resists the bomb. Used by the destruction pass.
export function isBombResistant(id) {
  return id === BLOCKS.CONCRETE || id === BLOCKS.STONE;
}
