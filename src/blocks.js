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
  BUTTRESS:    13,
  WIRE:        14,
  DOOR_CLOSED:  15,
  DOOR_OPEN:    16,
  VAULT_CLOSED: 17,
  VAULT_OPEN:   18,
};

export const BLOCK_NAMES = [
  'air', 'grass', 'dirt', 'stone', 'sand', 'wood', 'leaves', 'concrete',
  'torch', 'water_tank', 'food_locker', 'generator', 'bed', 'buttress', 'wire',
  'door_closed', 'door_open', 'vault_closed', 'vault_open',
];

// Set of blocks that act as electrical nodes for the power network. Generators are
// sources; lights (BLOCKS.TORCH, semantically electric lamps now) are loads; wires
// are pure conduits. Any pair of electrical blocks within 6 cells of each other are
// auto-connected into the same network.
export const ELECTRICAL_BLOCKS = new Set([
  BLOCKS.GENERATOR,
  BLOCKS.TORCH,
  BLOCKS.WIRE,
]);

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
