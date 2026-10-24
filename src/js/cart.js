import { appEl, brl, escapeHtml } from './utils.js';

export function renderCart(state) {
  if (!state.user) return window.navigate('login');
  const entries = Object.entries(state.cart || {}).map(([id, item]) => {
    const product = state.products.find(p => p.id === id);
    const qty = Math.max(0, Math.floor(Number(item?.qty) || 0));
    if (!product || product.active === false || qty < 1) return null;
    const regular = Number(product.price) || 0;
    const promo = Number(product.promoPrice) || 0;
    const unit = promo > 0 && promo < regular ? promo : regular;
    const stock = Number.isFinite(Number(product.stock)) ? Math.max(0, Math.floor(Number(product.stock))) : 0;
    return { id, product, qty, unit, line: unit * qty, stock };
  }).filter(Boolean);

  // Keep stale/deleted products visible as an actionable issue instead of silently hiding them.
  const stale = Object.entries(state.cart || {}).filter(([id, item]) => {
    const p = state.products.find(x => x.id === id);
    return !p || p.active === false || !(Number(item?.qty) > 0);
  });
  if (!entries.length && !stale.length) {
    appEl().innerHTML = `<section class="cart-page"><div class="cart-heading"><div><span class="eyebrow">SUA COMPRA</span><h1 class="section-title">Carrinho</h1><p class="muted">Seus produtos escolhidos aparecem aqui.</p></div></div><div class="empty-state cart-empty"><div class="cart-empty-icon">🛒</div><h3>Seu carrinho está vazio</h3><p class="muted">Explore a loja e adicione os produtos que deseja comprar.</p><button class="btn btn-primary mt-4" onclick="window.navigate('home')">Explorar produtos</button></div></section>`;
    return;
  }
  const subtotal = entries.reduce((sum, item) => sum + item.line, 0);
  const totalQty = entries.reduce((sum, item) => sum + item.qty, 0);
  const rows = entries.map(({id, product:p, qty, unit, line, stock}) => `
    <article class="cart-item cart-item-enhanced">
      <div class="cart-product-main">
        ${p.image ? `<img class="cart-product-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'">` : `<div class="cart-product-placeholder">G</div>`}
        <div class="cart-product-copy"><a href="#" class="cart-product-name" onclick="event.preventDefault();window.navigate('product-details',{id:'${id}'})">${escapeHtml(p.name || 'Produto')}</a><div class="muted">${escapeHtml(p.category || 'Produto digital')}</div><div class="cart-unit-price">${brl(unit)} <span class="muted">/ unidade</span></div>${qty > stock ? `<p class="cart-stock-warning">Estoque atual: ${stock}. Ajuste a quantidade para continuar.</p>` : ''}</div>
      </div>
      <div class="cart-product-actions">
        <div class="cart-qty-control" aria-label="Quantidade de ${escapeHtml(p.name)}">
          <button class="btn btn-outline" type="button" aria-label="Diminuir quantidade" onclick="window.updateCartQty('${id}',${qty-1})">−</button>
          <output aria-live="polite">${qty}</output>
          <button class="btn btn-outline" type="button" aria-label="Aumentar quantidade" ${qty >= stock ? 'disabled title="Limite de estoque atingido"' : ''} onclick="window.updateCartQty('${id}',${qty+1})">+</button>
        </div>
        <div class="cart-line-total">${brl(line)}</div>
        <button class="cart-remove" type="button" onclick="window.updateCartQty('${id}',0)" aria-label="Remover ${escapeHtml(p.name)}">Remover</button>
      </div>
    </article>`).join('');
  const staleRows = stale.map(([id]) => `<article class="cart-item cart-stale-item"><div><strong>Produto indisponível</strong><p class="muted">Este item foi removido ou não está mais disponível.</p></div><button class="btn btn-danger" onclick="window.updateCartQty('${id}',0)">Remover item</button></article>`).join('');
  appEl().innerHTML = `<section class="cart-page">
    <div class="cart-heading"><div><span class="eyebrow">SUA COMPRA</span><h1 class="section-title">Carrinho</h1><p class="muted">Confira quantidades e valores antes de continuar.</p></div><span class="cart-items-count">${totalQty} ${totalQty===1?'item':'itens'}</span></div>
    <div class="cart-layout"><div class="cart-list">${rows}${staleRows}<button class="btn btn-outline cart-continue-shopping" onclick="window.navigate('home')">← Continuar comprando</button></div>
    <aside class="cart-checkout-card"><span class="eyebrow">RESUMO DO PEDIDO</span><div class="cart-summary-row"><span>Produtos (${totalQty})</span><strong>${brl(subtotal)}</strong></div><div class="cart-summary-row"><span>Descontos</span><strong>A calcular no checkout</strong></div><div class="cart-summary-total"><span>Subtotal</span><strong>${brl(subtotal)}</strong></div><p class="muted cart-summary-note">Cupons e eventuais descontos serão validados na próxima etapa.</p><button class="btn btn-primary cart-checkout-button" ${!entries.length || entries.some(i=>i.qty>i.stock) ? 'disabled' : ''} onclick="window.navigate('checkout')">Continuar para pagamento <span aria-hidden="true">→</span></button><div class="cart-trust-note">🔒 <span>Confira o valor final antes de concluir. O pagamento só é confirmado após validação.</span></div></aside></div>
  </section>`;
}
