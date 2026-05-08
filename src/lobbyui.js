import { LOBBY_CATALOG, TEAM_BUDGET, catalogItem, totalSpent } from './lobby.js';
import { ITEM_DEFS } from './items.js';

// Builds and updates the pre-game lobby overlay. UI events (catalog +/-, ready)
// flow back to mp.js as virtual keys so netplayjs can sync them lockstep with
// game inputs — the click handlers don't mutate state directly.
//
//   onAction(virtualKey) — caller dispatches the synthetic key (mp.js's existing
//   _dispatchVirtualKey path), so peers see the same action in the next tick.
//
// Virtual keys we emit:
//   'lobby:buy:<catalogId>'      — add 1 of catalogId to local player's cart
//   'lobby:unbuy:<catalogId>'    — remove 1 of catalogId from local player's cart
//   'lobby:ready'                — toggle local player's ready flag
let stylesReady = false;

function ensureStyles() {
  if (stylesReady) return;
  stylesReady = true;
  const s = document.createElement('style');
  s.textContent = `
    #lobby {
      position: fixed; inset: 0; z-index: 60; display: none;
      background: radial-gradient(circle at center, rgba(36,28,22,0.9), rgba(0,0,0,0.95));
      align-items: center; justify-content: center;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #ddd;
    }
    #lobby.open { display: flex; }
    #lobby .window {
      width: min(960px, 94vw); max-height: 92vh; overflow-y: auto;
      padding: 22px 26px; border: 1px solid #44382c; border-radius: 10px;
      background: rgba(20,16,12,0.96); box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    }
    #lobby h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 0.20em; color: #ffd9a3; }
    #lobby .subtitle { font-size: 11px; color: #aaa; margin-bottom: 16px; }
    #lobby .budget {
      display: flex; align-items: baseline; gap: 12px;
      font-size: 14px; letter-spacing: 0.10em;
      padding: 8px 12px; background: rgba(0,0,0,0.45);
      border: 1px solid #2c2620; border-radius: 4px; margin-bottom: 16px;
    }
    #lobby .budget .spent { color: #ffd9a3; font-weight: bold; }
    #lobby .budget .remaining { margin-left: auto; color: #9ad0ff; }
    #lobby .budget.over .spent { color: #ff5040; }
    #lobby .grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 18px;
    }
    #lobby .panel-title {
      font-size: 11px; letter-spacing: 0.16em; color: #9ad0ff; margin-bottom: 8px;
    }
    #lobby .catalog-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
    }
    #lobby .catalog-row {
      display: grid; grid-template-columns: 16px 1fr auto auto auto auto;
      gap: 6px; align-items: center;
      padding: 6px 8px; background: rgba(0,0,0,0.35);
      border: 1px solid #2c2620; border-radius: 3px; font-size: 12px;
    }
    #lobby .catalog-row .swatch { width: 12px; height: 12px; border: 1px solid rgba(0,0,0,0.4); border-radius: 1px; }
    #lobby .catalog-row .name { color: #ddd; }
    #lobby .catalog-row .price { color: #ffd9a3; min-width: 28px; text-align: right; }
    #lobby .catalog-row .count { color: #9ad0ff; min-width: 22px; text-align: right; }
    #lobby .catalog-row button {
      width: 22px; height: 22px; padding: 0;
      background: rgba(40,30,22,0.8); border: 1px solid #44382c;
      color: #eee; cursor: pointer; border-radius: 2px;
      font: inherit; font-weight: bold;
    }
    #lobby .catalog-row button:hover:not(:disabled) {
      background: rgba(90,70,40,0.85); border-color: #ffd9a3;
    }
    #lobby .catalog-row button:disabled { opacity: 0.35; cursor: default; }
    #lobby .carts {
      max-height: 480px; overflow-y: auto;
    }
    #lobby .cart {
      padding: 10px 12px; margin-bottom: 8px;
      border: 1px solid #2c2620; border-radius: 4px;
      background: rgba(0,0,0,0.35);
    }
    #lobby .cart.local { border-color: #9ad0ff; background: rgba(20,40,60,0.35); }
    #lobby .cart .who {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 12px; letter-spacing: 0.10em; color: #ddd; margin-bottom: 4px;
    }
    #lobby .cart .who .ready-pill {
      font-size: 10px; padding: 2px 8px; border-radius: 99px;
      background: rgba(0,0,0,0.4); border: 1px solid #2c2620; color: #888;
    }
    #lobby .cart .who .ready-pill.on {
      background: rgba(40,80,40,0.45); border-color: #4a8a4a; color: #aaffaa;
    }
    #lobby .cart .lines { font-size: 11px; color: #aaa; }
    #lobby .cart .lines .line { display: flex; justify-content: space-between; padding: 1px 0; }
    #lobby .cart .lines .line span:last-child { color: #ddd; }
    #lobby .cart .lines .line.empty { font-style: italic; opacity: 0.6; }
    #lobby .footer {
      margin-top: 18px; display: flex; align-items: center; gap: 12px;
    }
    #lobby .footer .ready-btn {
      padding: 10px 22px; font-size: 13px; letter-spacing: 0.16em;
      background: rgba(40,80,40,0.45); border: 1px solid #4a8a4a;
      color: #aaffaa; cursor: pointer; border-radius: 4px;
      font: inherit;
    }
    #lobby .footer .ready-btn:hover { background: rgba(60,120,60,0.55); }
    #lobby .footer .ready-btn.on { background: rgba(80,160,80,0.7); color: #fff; }
    #lobby .footer .status { color: #aaa; font-size: 12px; }
  `;
  document.head.appendChild(s);
}

export class LobbyUI {
  constructor(localPlayerID, onAction) {
    ensureStyles();
    this.localPlayerID = localPlayerID;
    this.onAction = onAction;
    this._mount();
  }

  _mount() {
    let root = document.getElementById('lobby');
    if (!root) {
      root = document.createElement('div');
      root.id = 'lobby';
      document.body.appendChild(root);
    }
    root.innerHTML = `
      <div class="window">
        <h1>SUPPLY DEPOT</h1>
        <div class="subtitle">Pick equipment from the shared budget. The bomb drops when everyone is ready.</div>
        <div class="budget">
          <span>SPENT</span>
          <span class="spent">0</span>
          <span>/ ${TEAM_BUDGET}</span>
          <span class="remaining">— remaining</span>
        </div>
        <div class="grid">
          <div>
            <div class="panel-title">CATALOG</div>
            <div class="catalog-grid"></div>
          </div>
          <div>
            <div class="panel-title">LOADOUTS</div>
            <div class="carts"></div>
          </div>
        </div>
        <div class="footer">
          <button class="ready-btn" data-action="ready">READY</button>
          <span class="status"></span>
        </div>
      </div>
    `;
    this.root = root;
    this.spentEl = root.querySelector('.spent');
    this.remainingEl = root.querySelector('.remaining');
    this.budgetEl = root.querySelector('.budget');
    this.catalogEl = root.querySelector('.catalog-grid');
    this.cartsEl = root.querySelector('.carts');
    this.statusEl = root.querySelector('.status');
    this.readyBtn = root.querySelector('.ready-btn');
    this.readyBtn.addEventListener('click', () => this.onAction('lobby:ready'));
    this._buildCatalog();
  }

  _buildCatalog() {
    this.catalogEl.replaceChildren();
    this.catalogRows = new Map();
    for (const item of LOBBY_CATALOG) {
      const give = Object.entries(item.give)[0];
      const def = give ? ITEM_DEFS[give[0]] : null;
      const swatchColor = def?.color ?? '#888';
      const row = document.createElement('div');
      row.className = 'catalog-row';
      row.innerHTML = `
        <div class="swatch" style="background:${swatchColor};"></div>
        <div class="name">${item.name}</div>
        <div class="price">$${item.price}</div>
        <button data-action="unbuy" data-id="${item.id}">−</button>
        <div class="count">0</div>
        <button data-action="buy" data-id="${item.id}">+</button>
      `;
      row.querySelector('[data-action="buy"]').addEventListener('click', () => {
        this.onAction(`lobby:buy:${item.id}`);
      });
      row.querySelector('[data-action="unbuy"]').addEventListener('click', () => {
        this.onAction(`lobby:unbuy:${item.id}`);
      });
      this.catalogEl.appendChild(row);
      this.catalogRows.set(item.id, row);
    }
  }

  show() { this.root.classList.add('open'); }
  hide() { this.root.classList.remove('open'); }

  // state: { carts: {pid: {cid: count}}, ready: {pid: bool}, players: [{id, label}] }
  update(state) {
    const spent = totalSpent(state.carts);
    const remaining = TEAM_BUDGET - spent;
    this.spentEl.textContent = String(spent);
    this.remainingEl.textContent = `${remaining} remaining`;
    this.budgetEl.classList.toggle('over', spent > TEAM_BUDGET);

    // Local player's cart determines which "+" buttons stay enabled.
    const localCart = state.carts[this.localPlayerID] || {};
    for (const [id, row] of this.catalogRows) {
      const localCount = localCart[id] || 0;
      const item = catalogItem(id);
      const wouldOverspend = (spent + item.price) > TEAM_BUDGET;
      row.querySelector('.count').textContent = String(localCount);
      row.querySelector('[data-action="buy"]').disabled = wouldOverspend;
      row.querySelector('[data-action="unbuy"]').disabled = localCount <= 0;
    }

    // Per-player carts — local player highlighted, ready pills shown.
    this.cartsEl.replaceChildren();
    for (const p of state.players) {
      const cart = state.carts[p.id] || {};
      const isLocal = p.id === this.localPlayerID;
      const isReady = !!state.ready[p.id];
      const cartEl = document.createElement('div');
      cartEl.className = `cart${isLocal ? ' local' : ''}`;
      const lines = Object.entries(cart);
      const linesHtml = lines.length
        ? lines.map(([cid, n]) => {
            const item = catalogItem(cid);
            return `<div class="line"><span>${item.name} ×${n}</span><span>$${item.price * n}</span></div>`;
          }).join('')
        : '<div class="line empty">(empty)</div>';
      cartEl.innerHTML = `
        <div class="who">
          <span>${p.label}${isLocal ? ' (you)' : ''}</span>
          <span class="ready-pill${isReady ? ' on' : ''}">${isReady ? 'READY' : 'choosing…'}</span>
        </div>
        <div class="lines">${linesHtml}</div>
      `;
      this.cartsEl.appendChild(cartEl);
    }

    // Ready button + footer status reflect local player's ready state and overall progress.
    const localReady = !!state.ready[this.localPlayerID];
    this.readyBtn.classList.toggle('on', localReady);
    this.readyBtn.textContent = localReady ? 'UN-READY' : 'READY';
    const total = state.players.length;
    const ready = state.players.filter(p => state.ready[p.id]).length;
    this.statusEl.textContent = ready === total
      ? 'All ready — entering bunker site…'
      : `${ready} / ${total} ready`;
  }
}
