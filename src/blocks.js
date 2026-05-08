// Block type IDs. 0 = air. Order matters for hotbar (1..N).
export const BLOCKS = {
  AIR:      0,
  GRASS:    1,
  DIRT:     2,
  STONE:    3,
  SAND:     4,
  WOOD:     5,
  LEAVES:   6,
  CONCRETE: 7,
  TORCH:    8,
};

export const BLOCK_NAMES = ['air', 'grass', 'dirt', 'stone', 'sand', 'wood', 'leaves', 'concrete', 'torch'];

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
