// Lobby supply catalog + cart helpers.
//
// Each player gets their own per-player budget — they spend only from their own
// pool, no contention with teammates. When everyone marks ready the carts are
// converted into per-player inventories and the game starts.
//
// Tools (pickaxe / shovel / axe) are not in the catalog: they're given to every
// player automatically so nobody can lock themselves out of mining.

export const PLAYER_BUDGET = 100;

// `give` is itemId → count. price is in budget units.
export const LOBBY_CATALOG = [
  { id: 'concrete16',  name: '16× Concrete',  price: 8,  give: { concrete: 16 } },
  { id: 'concrete32',  name: '32× Concrete',  price: 14, give: { concrete: 32 } },
  { id: 'wood16',      name: '16× Wood',      price: 5,  give: { wood: 16 } },
  { id: 'buttress8',   name: '8× Buttress',   price: 6,  give: { buttress: 8 } },
  { id: 'wire16',      name: '16× Wire',      price: 4,  give: { wire: 16 } },
  { id: 'light8',      name: '8× Light',      price: 6,  give: { torch: 8 } },
  { id: 'door',        name: 'Door',          price: 6,  give: { door: 1 } },
  { id: 'vault_door',  name: 'Vault Door',    price: 30, give: { vault_door: 1 } },
  { id: 'water_tank',  name: 'Water Tank',    price: 25, give: { water_tank: 1 } },
  { id: 'food_locker', name: 'Food Locker',   price: 25, give: { food_locker: 1 } },
  { id: 'generator',   name: 'Generator',     price: 40, give: { generator: 1 } },
  { id: 'bed',         name: 'Bed',           price: 15, give: { bed: 1 } },
];

const ITEM_BY_ID = Object.fromEntries(LOBBY_CATALOG.map(c => [c.id, c]));

export function catalogItem(id) { return ITEM_BY_ID[id]; }

// Sum of one player's cart.
export function cartCost(cart) {
  let total = 0;
  for (const [id, count] of Object.entries(cart || {})) {
    const item = ITEM_BY_ID[id];
    if (item) total += item.price * count;
  }
  return total;
}

// Returns true if every player whose ID appears in `playerIDs` has ready=true and
// at least one player exists.
export function allReady(playerIDs, ready) {
  if (playerIDs.length === 0) return false;
  return playerIDs.every(id => ready[id]);
}

// Apply a player's cart to their inventory, preceded by the auto-given tool kit.
export function applyCartToInventory(inventory, cart) {
  inventory.add('pickaxe', 1);
  inventory.add('shovel', 1);
  inventory.add('axe', 1);
  for (const [catalogId, count] of Object.entries(cart || {})) {
    const item = ITEM_BY_ID[catalogId];
    if (!item) continue;
    for (let i = 0; i < count; i++) {
      for (const [itemId, n] of Object.entries(item.give)) {
        inventory.add(itemId, n);
      }
    }
  }
}
