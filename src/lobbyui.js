import { LOBBY_CATALOG, PLAYER_BUDGET, catalogItem, cartCost } from './lobby.js';
import { ITEM_DEFS } from './items.js';

// Builds and updates the pre-game lobby overlay.
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
        <div class="subtitle">Buy your own supplies. Everyone has their own $${PLAYER_BUDGET}. Press ready to start immediately.</div>
        <div class="budget">
          <span>SPENT</span>
          <span class="spent">0</span>
          <span>/ ${PLAYER_BUDGET}</span>
          <span class="remaining">— remaining</span>
        </div>
        <div class="grid">
          <div>
            <div class="panel-title">CATALOG</div>
            <div class="catalog-grid"></div>
          </div>
          <div>
            <div class="panel-title">YOUR LOADOUT</div>
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
    this.readyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.info('[lobby] READY button clicked');
      this.onAction('lobby:ready');
    });
    // Stop lobby clicks from bubbling up to the document — netplayjs's
    // pointerLock=true installs a mousedown listener that would otherwise grab
    // the pointer and hide the cursor. Bubble phase only, so inner buttons
    // still receive their click first.
    root.addEventListener('mousedown', (e) => e.stopPropagation(), false);
    root.addEventListener('click',     (e) => e.stopPropagation(), false);
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
      row.querySelector('[data-action="buy"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAction(`lobby:buy:${item.id}`);
      });
      row.querySelector('[data-action="unbuy"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAction(`lobby:unbuy:${item.id}`);
      });
      this.catalogEl.appendChild(row);
      this.catalogRows.set(item.id, row);
    }
  }

  show() { this.root.classList.add('open'); }
  hide() { this.root.classList.remove('open'); }

  // state: { carts: {pid: {cid: count}}, ready: {pid: bool}, players: [{id, label}], starting?: number }
  update(state) {
    const localCart = state.carts[this.localPlayerID] || {};
    const localSpent = cartCost(localCart);
    const remaining = PLAYER_BUDGET - localSpent;
    this.spentEl.textContent = String(localSpent);
    this.remainingEl.textContent = `${remaining} remaining`;
    this.budgetEl.classList.toggle('over', localSpent > PLAYER_BUDGET);

    // Catalog +/- gates against the local player's own budget.
    for (const [id, row] of this.catalogRows) {
      const localCount = localCart[id] || 0;
      const item = catalogItem(id);
      const wouldOverspend = (localSpent + item.price) > PLAYER_BUDGET;
      row.querySelector('.count').textContent = String(localCount);
      row.querySelector('[data-action="buy"]').disabled = wouldOverspend;
      row.querySelector('[data-action="unbuy"]').disabled = localCount <= 0;
    }

    // Show only the local player's cart so the depot stays local and simple.
    this.cartsEl.replaceChildren();
    const localPlayer = state.players.find(p => p.id === this.localPlayerID);
    const localReady = !!state.ready[this.localPlayerID];
    const lines = Object.entries(localCart);
    const linesHtml = lines.length
      ? lines.map(([cid, n]) => {
          const item = catalogItem(cid);
          return `<div class="line"><span>${item.name} ×${n}</span><span>$${item.price * n}</span></div>`;
        }).join('')
      : '<div class="line empty">(starter kit only)</div>';
    const cartEl = document.createElement('div');
    cartEl.className = 'cart local';
    cartEl.innerHTML = `
      <div class="who">
        <span>${localPlayer?.label ?? 'You'} (you) &middot; <span style="color:#aaa;">$${localSpent}/${PLAYER_BUDGET}</span></span>
        <span class="ready-pill${localReady ? ' on' : ''}">${localReady ? 'READY' : 'choosing…'}</span>
      </div>
      <div class="lines">${linesHtml}</div>
    `;
    this.cartsEl.appendChild(cartEl);

    this.readyBtn.classList.toggle('on', localReady);
    this.readyBtn.textContent = localReady ? 'STARTING' : 'READY';
    if (typeof state.starting === 'number' && state.starting > 0) {
      this.statusEl.textContent = `Starting in ${state.starting.toFixed(1)}s`;
      this.statusEl.style.color = '#ffd9a3';
    } else {
      this.statusEl.textContent = 'Ready starts your game immediately';
      this.statusEl.style.color = '';
    }
  }
}
