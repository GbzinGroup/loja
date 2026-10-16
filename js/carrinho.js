/* ============================================
   ATLAS MC — Carrinho (localStorage)
   ============================================ */

const CART_KEY = 'atlas_cart_v1';

const Carrinho = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  },

  set(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    this.atualizarContador();
  },

  adicionar(nome, preco) {
    const items = this.get();
    const existing = items.find(i => i.nome === nome);
    if (existing) existing.qtd++;
    else items.push({ nome, preco, qtd: 1 });
    this.set(items);
    return true;
  },

  remover(index) {
    const items = this.get();
    items.splice(index, 1);
    this.set(items);
  },

  limpar() { this.set([]); },

  total() {
    return this.get().reduce((s, i) => s + i.preco * i.qtd, 0);
  },

  contar() {
    return this.get().reduce((s, i) => s + i.qtd, 0);
  },

  atualizarContador() {
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = this.contar();
    });
  }
};

/* ---------- AÇÕES GLOBAIS ---------- */

function addCarrinho(nome, preco) {
  Carrinho.adicionar(nome, preco);
  toast(`"${nome}" adicionado ao carrinho`);
}

function removerItem(index) {
  Carrinho.remover(index);
  renderCarrinho();
}

function renderCarrinho() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!container) return;

  const items = Carrinho.get();

  if (items.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
        </svg>
        <h3>Carrinho vazio</h3>
        <p>Escolhe os teus itens na loja para continuar.</p>
      </div>`;
    if (totalEl) totalEl.textContent = 'R$ 0,00';
    return;
  }

  container.innerHTML = items.map((item, i) => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${item.nome}</div>
        <div class="cart-item-meta">${item.qtd}× R$ ${item.preco.toFixed(2)}</div>
      </div>
      <div class="cart-item-price">R$ ${(item.preco * item.qtd).toFixed(2)}</div>
      <button class="btn-remove" onclick="removerItem(${i})" title="Remover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  if (totalEl) totalEl.textContent = `R$ ${Carrinho.total().toFixed(2)}`;
}

function finalizar() {
  if (Carrinho.get().length === 0) {
    toast('O carrinho está vazio');
    return;
  }
  const nick = prompt('Digita o teu nick no Minecraft:');
  if (!nick || !nick.trim()) {
    toast('Nick obrigatório');
    return;
  }
  toast(`Compra confirmada para ${nick.trim()}!`);
  Carrinho.limpar();
  renderCarrinho();
}

/* ---------- TOAST (feedback não intrusivo) ---------- */

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    Object.assign(el.style, {
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%) translateY(20px)',
      padding: '12px 20px',
      background: '#1a1a22',
      color: '#f5f5f7',
      border: '1px solid rgba(232,176,58,0.4)',
      borderRadius: '10px',
      fontSize: '0.9rem',
      fontWeight: '500',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      opacity: '0', transition: 'all .3s ease',
      zIndex: '999', pointerEvents: 'none'
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2500);
}

document.addEventListener('DOMContentLoaded', () => Carrinho.atualizarContador());
