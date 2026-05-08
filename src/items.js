import { BLOCKS } from './blocks.js';

// Item IDs are short strings. Tools are 1-stack; blocks stack to 64.
// Each item def has: name (display), stack (max), blockId (if placeable), tool (tool tier),
// label (3-char hotbar text), color (CSS for swatch).
export const ITEM_DEFS = {
  pickaxe: { name: 'Pickaxe', stack: 1, tool: 'pick',   label: 'PCK' },
  shovel:  { name: 'Shovel',  stack: 1, tool: 'shovel', label: 'SHV' },
  axe:     { name: 'Axe',     stack: 1, tool: 'axe',    label: 'AXE' },

  concrete: { name: 'Concrete', stack: 80, blockId: BLOCKS.CONCRETE, label: 'CON', color: '#7a766f' },
  stone:    { name: 'Stone',    stack: 80, blockId: BLOCKS.STONE,    label: 'STN', color: '#808082' },
  wood:     { name: 'Wood',     stack: 80, blockId: BLOCKS.WOOD,     label: 'WD',  color: '#624628' },
  dirt:     { name: 'Dirt',     stack: 80, blockId: BLOCKS.DIRT,     label: 'DRT', color: '#735237' },
  grass:    { name: 'Grass',    stack: 80, blockId: BLOCKS.GRASS,    label: 'GRS', color: '#5a8240' },
  sand:     { name: 'Sand',     stack: 80, blockId: BLOCKS.SAND,     label: 'SND', color: '#dcc896' },
  leaves:   { name: 'Leaves',   stack: 80, blockId: BLOCKS.LEAVES,   label: 'LF',  color: '#466632' },
  torch:    { name: 'Light',    stack: 80, blockId: BLOCKS.TORCH,    label: 'LMP', color: '#ffe080' },
  buttress: { name: 'Buttress', stack: 80, blockId: BLOCKS.BUTTRESS, label: 'BUT', color: '#62421e' },
  wire:     { name: 'Wire',     stack: 80, blockId: BLOCKS.WIRE,     label: 'WIR', color: '#c08040' },

  water_tank:  { name: 'Water Tank',  stack: 4, blockId: BLOCKS.WATER_TANK,  label: 'TNK', color: '#3070a0' },
  food_locker: { name: 'Food Locker', stack: 4, blockId: BLOCKS.FOOD_LOCKER, label: 'FOD', color: '#604032' },
  generator:   { name: 'Generator',   stack: 4, blockId: BLOCKS.GENERATOR,   label: 'GEN', color: '#404045' },
  bed:         { name: 'Bed',         stack: 4, blockId: BLOCKS.BED,         label: 'BED', color: '#a04030' },
};

// Reverse: blockId -> itemId.
export const BLOCK_TO_ITEM = {};
for (const [id, def] of Object.entries(ITEM_DEFS)) {
  if (def.blockId !== undefined) BLOCK_TO_ITEM[def.blockId] = id;
}

// Base hardness in seconds (with the right tool, expect ~40% of this).
export const BLOCK_HARDNESS = {
  [BLOCKS.GRASS]:    0.5,
  [BLOCKS.DIRT]:     0.5,
  [BLOCKS.SAND]:     0.5,
  [BLOCKS.LEAVES]:   0.3,
  [BLOCKS.WOOD]:     2.0,
  [BLOCKS.STONE]:    4.5,
  [BLOCKS.CONCRETE]: 6.0,
  [BLOCKS.TORCH]:    0.15,

  [BLOCKS.WATER_TANK]:  3.0,
  [BLOCKS.FOOD_LOCKER]: 3.0,
  [BLOCKS.GENERATOR]:   4.0,
  [BLOCKS.BED]:         1.5,
  [BLOCKS.BUTTRESS]:    1.5,
  [BLOCKS.WIRE]:        0.3,
};

// Which tool is "right" for each block.
export const BLOCK_PREFERRED_TOOL = {
  [BLOCKS.GRASS]:    'shovel',
  [BLOCKS.DIRT]:     'shovel',
  [BLOCKS.SAND]:     'shovel',
  [BLOCKS.LEAVES]:   'axe',
  [BLOCKS.WOOD]:     'axe',
  [BLOCKS.STONE]:    'pick',
  [BLOCKS.CONCRETE]: 'pick',
  [BLOCKS.TORCH]:    null, // any tool / hands fine

  [BLOCKS.WATER_TANK]:  'pick',
  [BLOCKS.FOOD_LOCKER]: 'pick',
  [BLOCKS.GENERATOR]:   'pick',
  [BLOCKS.BED]:         'axe',
  [BLOCKS.BUTTRESS]:    'axe',
  [BLOCKS.WIRE]:        null,
};

// Right-tool multipliers — pickaxe is 3x faster than the other tools' right-tool bonus.
const RIGHT_TOOL_MULT = { pick: 0.4 / 3, shovel: 0.4, axe: 0.4 };

// Effective time for (block, tool). Tool is one of 'pick'|'shovel'|'axe'|null (hands).
export function miningTime(blockId, tool) {
  const base = BLOCK_HARDNESS[blockId] ?? 1.0;
  if (!tool)                                    return base * 4.0;   // hands
  if (tool === BLOCK_PREFERRED_TOOL[blockId])   return base * (RIGHT_TOOL_MULT[tool] ?? 0.4);
  return base * 1.5;                                                 // wrong tool
}

// Whether this block, when broken, yields an item (some — e.g. leaves — could yield nothing).
export function dropFor(blockId) {
  // Default: drop the block itself as an item.
  return BLOCK_TO_ITEM[blockId] ?? null;
}
