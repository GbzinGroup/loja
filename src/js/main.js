/* =====================================================================
   main.js — SPA Core Gbzin Shop
   ===================================================================== */
import { auth } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { store } from './store.js';
import { $, appEl, headerEl, brl, escapeHtml, toast, icons, maskCPF, formatDate } from './utils.js';

// LISTA DE ADMINS (Você e todos os e-mails enviados)
const ADMINS = [
  "gabrielcordeirosilva2010@gmail.com",
  "10pedrin0@gmail.com",
  "lucaslyra875@gmail.com",
  "gbzinstudio@gmail.com",
  "Voabernas@gmail.com"
];

const EXTRAS = [
  { id: '1', name: 'Suporte rápido', price: 5.00, desc: 'Atendimento prioritário.' },
  { id: '2', name: 'Instalação assistida', price: 7.00, desc: 'Ajuda na configuração.' },
  { id: '3', name: 'Garantia adicional', price: 5.00, desc: 'Acompanhamento técnico.' },
  { id: '4', name: 'Atendimento fora do horário', price: 8.00, desc: 'Horário especial.' },
  { id: '5', name: 'Pedido prioritário', price: 5.00, desc: 'Frente na fila.' },
  { id: '6', name: 'Verificação de compatibilidade', price: 3.00, desc: 'Checar mod/cliente.' }
];

const state = {
  route: 'home', params: {}, user: null, isAdmin: false, isOwner: false,
  products: [], cart: {}, vendedores: {}, favorites: {}, coupons: {},
  settings: { pixKey: 'a7a8c1e6-5a54-45a1-a186-784fb6aced6c', pixName: 'Gabriel Cordeiro' },
  search: '', filterPrice: '', filterCategory: '', filterRarity: '',
  unsubCart: null, unsubVendedores: null, unsubProducts: null, unsubSettings: null, unsubFavs: null, unsubCoupons: null
};

/* ------------------------------ HEADER -------------------------------- */
function renderHeader() {
  let account = '';
  if (state.user) {
    if (state.isAdmin) account += `<button class="btn btn-outline" data-nav="admin">🛠️ <span class="label">Painel</span></button>`;
    account += `<button class="btn btn-outline" data-nav="account">👤 <span class="label">Conta</span></button>`;
    account += `<button class="btn btn-outline" id="logoutBtn">🚪 <span class="label">Sair</span></button>`;
  } else {
    account = `<button class="btn btn-outline" data-nav="login">👤 <span class="label">Entrar</span></button>`;
  }

  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);

  headerEl().innerHTML = `
    <div class="header-inner">
      <div class="logo" data-nav="home">Gbzin Shop</div>
      <div class="search-bar">
        <span class="icon">🔍</span>
        <input id="searchInput" type="text" placeholder="Buscar capas..." value="${escapeHtml(state.search)}" />
      </div>
      <div class="header-actions">
        <button class="btn btn-icon btn-outline" data-nav="favorites" title="Favoritos">❤️</button>
        <button class="btn btn-icon btn-outline" data-nav="cart" title="Carrinho">🛒${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>
        ${account}
      </div>
    </div>`;

  headerEl().querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.getAttribute('data-nav'))));
  $('#logoutBtn')?.addEventListener('click', async () => { await signOut(auth); toast('Sessão encerrada.', 'success'); });
  $('#searchInput')?.addEventListener('input', (e) => { state.search = e.target.value; if (state.route !== 'home') navigate('home'); else renderHome(); });
}

/* ------------------------------ NAVEGAÇÃO ----------------------------- */
function navigate(route, params = {}) {
  state.route = route; state.params = { ...state.params, ...params };
  renderHeader();
  switch (route) {
    case 'home': return renderHome();
    case 'login': return renderLogin();
    case 'register': return renderRegister();
    case 'account': return renderAccount();
    case 'library': return renderLibrary();
    case 'favorites': return renderFavorites();
    case 'admin': return renderAdmin(params.tab || 'dashboard');
    case 'product-form': return renderProductForm(params.id);
    case 'cart': return renderCart();
    case 'checkout': return renderCheckout();
    case 'product-details': return renderProductDetails(params.id);
    default: return renderHome();
  }
}
window.navigate = navigate;

/* ------------------------------ HOME ---------------------------------- */
function renderHome() {
  let list = state.products.filter(p => p.active !== false);
  
  if (state.search) list = list.filter(p => p.name.toLowerCase().includes(state.search.toLowerCase()));
  if (state.filterCategory) list = list.filter(p => p.category === state.filterCategory);
  if (state.filterRarity) list = list.filter(p => p.rarity === state.filterRarity);
  if (state.filterPrice === 'low') list.sort((a, b) => (a.promoPrice || a.price) - (b.promoPrice || b.price));
  if (state.filterPrice === 'high') list.sort((a, b) => (b.promoPrice || b.price) - (a.promoPrice || a.price));

  const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const rarities = ['Comum', 'Rara', 'Épica', 'Lendária'];

  const isFiltering = state.search || state.filterCategory || state.filterRarity || state.filterPrice;
  
  const renderCard = (p, isFav) => {
    return `
      <div class="product-card">
        <div class="thumb" onclick="window.navigate('product-details', {id: '${p.id}'})" style="cursor:pointer">
          ${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}
        </div>
        <button class="fav-btn" onclick="window.toggleFav('${p.id}', ${isFav})">${isFav ? '❤️' : '🤍'}</button>
        <div class="info">
          <div class="category">${escapeHtml(p.category || 'Geral')} • ${escapeHtml(p.rarity || 'Comum')}</div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="price">
            ${p.promoPrice > 0 ? `<span style="text-decoration:line-through; font-size:0.8rem; color:#888;">${brl(p.price)}</span> ${brl(p.promoPrice)}` : brl(p.price)}
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" onclick="window.addCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Esgotado' : 'Comprar'}</button>
        </div>
      </div>`;
  };

  let html = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px;">
      <select class="filter-select" onchange="window.setFilter('category', this.value)">
        <option value="">Estilo (Todos)</option>
        ${categories.map(c => `<option value="${c}" ${state.filterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="window.setFilter('rarity', this.value)">
        <option value="">Raridade (Todas)</option>
        ${rarities.map(r => `<option value="${r}" ${state.filterRarity === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="window.setFilter('price', this.value)">
        <option value="">Preço</option>
        <option value="low" ${state.filterPrice === 'low' ? 'selected' : ''}>Menor Preço</option>
        <option value="high" ${state.filterPrice === 'high' ? 'selected' : ''}>Maior Preço</option>
      </select>
    </div>
  `;

  if (!isFiltering) {
    const limited = state.products.filter(p => p.isLimited && p.expiresAt > Date.now()).slice(0, 4);
    const bestSellers = [...state.products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 4);
    const news = state.products.slice(0, 4);

    if (limited.length) html += `<h2 class="section-title">⏳ Capas Limitadas</h2><div class="product-grid">${limited.map(p => renderCard(p, state.favorites[p.id])).join('')}</div>`;
    if (bestSellers.length) html += `<h2 class="section-title" style="margin-top:40px">🔥 Mais Vendidas</h2><div class="product-grid">${bestSellers.map(p => renderCard(p, state.favorites[p.id])).join('')}</div>`;
    if (news.length) html += `<h2 class="section-title" style="margin-top:40px">✨ Novidades</h2><div class="product-grid">${news.map(p => renderCard(p, state.favorites[p.id])).join('')}</div>`;
  } else {
    html += `<h2 class="section-title">Resultados</h2>`;
    html += list.length ? `<div class="product-grid">${list.map(p => renderCard(p, state.favorites[p.id])).join('')}</div>` : `<div class="empty-state">Nada encontrado.</div>`;
  }

  appEl().innerHTML = html;
}

window.setFilter = (type, val) => {
  if (type === 'category') state.filterCategory = val;
  if (type === 'rarity') state.filterRarity = val;
  if (type === 'price') state.filterPrice = val;
  renderHome();
};

window.toggleFav = async (pid, isFav) => {
  if (!state.user) return toast('Faça login.', 'error');
  await store.toggleFavorite(state.user.uid, pid, isFav);
};

window.addCart = async (pid) => {
  if (!state.user) return navigate('login');
  const itemRef = state.cart[pid];
  await store.updateCart(state.user.uid, { ...state.cart, [pid]: { qty: (itemRef?.qty || 0) + 1 } });
  toast('Adicionado!', 'success');
};

/* -------------------------- PRODUTO DETALHES E AVALIAÇÕES ------------ */
async function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return navigate('home');
  const reviews = await store.getReviews(id);
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0';

  appEl().innerHTML = `
    <div class="card wide" style="max-width:900px; display:flex; gap:32px; flex-wrap:wrap;">
      <div style="flex:1; min-width:300px;">
        <img src="${p.image}" style="width:100%; border-radius:12px;" />
      </div>
      <div style="flex:1; min-width:300px;">
        <h2>${escapeHtml(p.name)}</h2>
        <p class="muted mb-4">${escapeHtml(p.category)} • ${escapeHtml(p.rarity)}</p>
        <div style="font-size:2rem; color:var(--primary); font-weight:800; margin-bottom:16px;">
          ${p.promoPrice > 0 ? `<span style="text-decoration:line-through; font-size:1rem; color:#888;">${brl(p.price)}</span> ${brl(p.promoPrice)}` : brl(p.price)}
        </div>
        <p class="mb-4">${escapeHtml(p.description)}</p>
        <button class="btn btn-primary" onclick="window.addCart('${p.id}')" style="width:100%; padding:16px; font-size:1.1rem;">Adicionar ao Carrinho</button>
      </div>
    </div>

    <div class="card wide mt-6" style="max-width:900px;">
      <h3>Avaliações (${avg} ★) - ${reviews.length} votos</h3>
      <div class="mt-4">
        ${reviews.map(r => `
          <div style="border-bottom:1px solid var(--border); padding:12px 0;">
            <strong>${escapeHtml(r.userName)}</strong> <span style="color:gold">${'★'.repeat(r.rating)}</span>
            <p class="muted">${escapeHtml(r.comment)}</p>
          </div>
        `).join('') || '<p class="muted">Nenhuma avaliação ainda.</p>'}
      </div>
      
      ${state.user ? `
        <form id="reviewForm" style="margin-top:24px; border-top:1px solid var(--border); padding-top:24px;">
          <h4>Deixe sua avaliação</h4>
          <select id="revRating" class="filter-select" style="margin-bottom:12px; width:100%;">
            <option value="5">5 Estrelas</option><option value="4">4 Estrelas</option><option value="3">3 Estrelas</option>
          </select>
          <textarea id="revComment" placeholder="O que achou?" rows="3" style="width:100%; margin-bottom:12px;" required></textarea>
          <button type="submit" class="btn btn-primary">Enviar Avaliação</button>
        </form>
      ` : ''}
    </div>
  `;

  $('#reviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userName = state.user.displayName || state.user.email.split('@')[0] || 'Cliente';
    await store.addReview(id, state.user.uid, userName, Number($('#revRating').value), $('#revComment').value);
    toast('Avaliação enviada!', 'success');
    renderProductDetails(id);
  });
}

/* ------------------------------ FAVORITOS ----------------------------- */
function renderFavorites() {
  if (!state.user) return navigate('login');
  const favIds = Object.keys(state.favorites);
  const favProducts = state.products.filter(p => favIds.includes(p.id));

  appEl().innerHTML = `<h2 class="section-title">Meus Favoritos</h2>` + 
    (favProducts.length ? `<div class="product-grid">${favProducts.map(p => `
      <div class="product-card">
        <div class="thumb" onclick="window.navigate('product-details', {id: '${p.id}'})" style="cursor:pointer">
          ${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}
        </div>
        <button class="fav-btn" onclick="window.toggleFav('${p.id}', true)">❤️</button>
        <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="price">${brl(p.promoPrice || p.price)}</div></div>
        <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${p.id}')">Comprar</button></div>
      </div>
    `).join('')}</div>` : `<div class="empty-state">Nenhum favorito ainda.</div>`);
}

/* ------------------------------ CARRINHO E CHECKOUT ------------------- */
function renderCart() {
  if (!state.user) return navigate('login');
  const items = Object.entries(state.cart);
  if (!items.length) return appEl().innerHTML = `<div class="empty-state"><h3>Carrinho vazio</h3></div>`;

  let total = 0;
  const html = items.map(([pid, i]) => {
    const p = state.products.find(x => x.id === pid);
    if (!p) return '';
    total += (p.promoPrice || p.price) * i.qty;
    return `
      <div class="cart-item">
        <div class="info"><div class="name">${p.name}</div><div class="price">${brl(p.promoPrice || p.price)}</div></div>
        <div class="qty"><button onclick="window.updateCartQty('${pid}', ${i.qty - 1})">-</button><span>${i.qty}</span><button onclick="window.updateCartQty('${pid}', ${i.qty + 1})">+</button></div>
      </div>`;
  }).join('');

  appEl().innerHTML = `<h2 class="section-title">Carrinho</h2><div class="cart-list">${html}</div>
    <div class="cart-summary mt-4"><div class="total">${brl(total)}</div>
    <button class="btn btn-primary" onclick="window.navigate('checkout')">Ir para o Checkout</button></div>`;
}

window.updateCartQty = async (pid, qty) => {
  const newCart = { ...state.cart };
  if (qty <= 0) delete newCart[pid]; else newCart[pid] = { qty };
  await store.updateCart(state.user.uid, newCart);
};

async function renderCheckout() {
  if (!state.user) return navigate('login');
  
  const items = Object.entries(state.cart).map(([pid, i]) => {
    const p = state.products.find(x => x.id === pid);
    return { productId: pid, name: p.name, price: p.promoPrice || p.price, qty: i.qty };
  });
  
  const totalProducts = items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

  appEl().innerHTML = `
    <div class="card wide" style="max-width:900px;">
      <h2>Finalizar Compra</h2>
      
      <div style="display:flex; gap:32px; flex-wrap:wrap; margin-top:24px;">
        <div style="flex:2; min-width:300px;">
          <h3>Serviços Adicionais</h3>
          <div style="display:grid; gap:12px; margin-top:12px;">
            ${EXTRAS.map(e => `
              <label class="extra-item" style="display:flex; gap:12px; background:var(--bg-elev); padding:12px; border-radius:8px; cursor:pointer;">
                <input type="checkbox" class="extra-check" data-price="${e.price}" value="${e.id}" onchange="window.calcTotal()" />
                <div><strong>${e.name}</strong> (+${brl(e.price)})<br><span class="muted" style="font-size:0.8rem">${e.desc}</span></div>
              </label>
            `).join('')}
          </div>
        </div>
        
        <div style="flex:1; min-width:280px;">
          <h3>Resumo</h3>
          <div style="background:var(--bg-elev-2); padding:20px; border-radius:8px; margin-top:12px;">
            <div class="flex-between mb-4"><span>Subtotal:</span> <strong>${brl(totalProducts)}</strong></div>
            <div class="flex-between mb-4"><span>Serviços:</span> <strong id="extrasTotal">R$ 0,00</strong></div>
            
            <div class="form-group mb-4">
              <label>Cupom de Desconto</label>
              <div class="flex gap-2"><input type="text" id="couponInput" placeholder="Código" /><button class="btn btn-outline" onclick="window.applyCoupon()">Aplicar</button></div>
            </div>
            
            <div class="flex-between mt-4" style="border-top:1px solid var(--border); padding-top:12px; font-size:1.2rem; font-weight:800;">
              <span>Total:</span> <span id="finalTotal" style="color:var(--primary);">${brl(totalProducts)}</span>
            </div>
          </div>
          <button class="btn btn-primary mt-4" style="width:100%; padding:16px;" id="btnFinish">Pagar com PIX</button>
        </div>
      </div>
    </div>`;

  window.calcTotal = () => {
    let extrasTotal = 0;
    document.querySelectorAll('.extra-check:checked').forEach(c => extrasTotal += Number(c.dataset.price));
    $('#extrasTotal').textContent = brl(extrasTotal);
    $('#finalTotal').textContent = brl(totalProducts + extrasTotal - (window.currentDiscount || 0));
  };

  window.applyCoupon = async () => {
    const code = $('#couponInput').value;
    const c = await store.validateCoupon(code);
    if (c && c.active) {
      window.currentDiscount = c.type === 'percent' ? (totalProducts * (c.discount / 100)) : c.discount;
      toast('Cupom aplicado!', 'success');
    } else {
      window.currentDiscount = 0; toast('Cupom inválido.', 'error');
    }
    window.calcTotal();
  };

  $('#btnFinish').onclick = async () => {
    const btn = $('#btnFinish'); btn.textContent = 'Processando...'; btn.disabled = true;
    const extrasSelected = Array.from(document.querySelectorAll('.extra-check:checked')).map(c => EXTRAS.find(e => e.id === c.value));
    const totalExtras = extrasSelected.reduce((a, b) => a + b.price, 0);
    const finalTotal = totalProducts + totalExtras - (window.currentDiscount || 0);
    
    try {
      const customerName = state.user.displayName || state.user.email.split('@')[0] || 'Cliente';
      
      await store.createOrder(state.user.uid, customerName, items, finalTotal, 'PIX', '', extrasSelected, null, false, null);
      await store.updateCart(state.user.uid, {});
      toast('Pedido realizado!', 'success');
      navigate('account');
    } catch (err) {
      toast('Erro ao processar pedido.', 'error');
      console.error(err);
      btn.textContent = 'Pagar com PIX'; btn.disabled = false;
    }
  };
}

/* ------------------------------ BIBLIOTECA E CONTA -------------------- */
async function renderLibrary() {
  if (!state.user) return navigate('login');
  const orders = await store.getMyOrders(state.user.uid);
  const boughtItems = orders.filter(o => o.status === 'paid').flatMap(o => o.items);
  
  appEl().innerHTML = `<h2 class="section-title">Minha Biblioteca</h2>` +
    (boughtItems.length ? `<div class="product-grid">${boughtItems.map(item => {
      const p = state.products.find(x => x.id === item.productId);
      if (!p) return '';
      return `
        <div class="product-card">
          <div class="thumb">${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}</div>
          <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="price" style="color:var(--success);">Adquirido</div></div>
        </div>`;
    }).join('')}</div>` : `<div class="empty-state">Você ainda não comprou nenhuma capa.</div>`);
}

async function renderAccount() {
  if (!state.user) return navigate('login'); 
  const p = await store.getCustomerProfile(state.user.uid); 
  const myOrders = await store.getMyOrders(state.user.uid);
  
  const ordersHtml = myOrders.length ? myOrders.map(o => {
    let statusColor = o.status === 'paid' ? 'var(--success)' : o.status === 'canceled' ? 'var(--danger)' : o.status === 'shipped' ? 'var(--primary)' : 'var(--text-muted)';
    let statusText = o.status === 'paid' ? '✅ Pago' : o.status === 'canceled' ? '❌ Cancelado' : o.status === 'shipped' ? '📦 Enviado' : '⏳ Pendente';
    
    return `
      <div style="background:var(--bg-elev); border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:12px;">
        <div class="flex-between" style="margin-bottom:8px;">
          <strong style="font-family:monospace; font-size:0.85rem;">Pedido #${o.id.slice(0,6).toUpperCase()}</strong>
          <span style="color:${statusColor}; font-weight:600; font-size:0.85rem;">${statusText}</span>
        </div>
        <p class="muted" style="font-size:0.8rem; margin-bottom:12px;">Data: ${formatDate(o.createdAt)} | CPF: ${escapeHtml(o.cpf || 'Não informado')}</p>
        <div style="border-top:1px solid var(--border); padding-top:8px;">
          ${o.items.map(i => `<div class="flex-between" style="font-size:0.85rem; margin-bottom:4px;"><span>${i.qty}x ${escapeHtml(i.name)}</span> <span>${brl(i.price * i.qty)}</span></div>`).join('')}
        </div>
        <div class="flex-between mt-4" style="border-top:1px solid var(--border); padding-top:8px; font-weight:700;">
          <span>Total</span>
          <span style="color:var(--primary);">${brl(o.total)}</span>
        </div>
      </div>
    `;
  }).join('') : `<p class="muted">Você ainda não fez nenhum pedido.</p>`;

  appEl().innerHTML = `
    <div class="card wide" style="max-width:800px;">
      <div style="display:flex; gap:24px; flex-wrap:wrap;">
        <div style="flex:1; min-width:300px;">
          <h2 style="margin-bottom:16px;">Minha Conta</h2>
          <div class="form-group"><label>Nome</label><input type="text" value="${p?.name || state.user.email.split('@')[0]}" disabled /></div>
          <div class="form-group"><label>E-mail</label><input type="text" value="${state.user.email}" disabled /></div>
          <div class="form-group"><label>Tipo</label><input type="text" value="${state.isAdmin ? 'Vendedor' : 'Cliente'}" disabled /></div>
          <button class="btn btn-outline mt-4" style="width:100%" onclick="window.navigate('library')">Ver Minha Biblioteca</button>
        </div>
        <div style="flex:1; min-width:300px;">
          <h2 style="margin-bottom:16px;">Meus Pedidos</h2>
          <div style="max-height:400px; overflow-y:auto; padding-right:8px;">
            ${ordersHtml}
          </div>
        </div>
      </div>
    </div>`; 
}

/* ------------------------------ LOGIN / REGISTRO ---------------------- */
function renderLogin() {
  appEl().innerHTML = `<div class="card"><h2>Entrar</h2><div id="msg"></div><form id="form"><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required></div><button type="submit" class="btn btn-primary">Entrar</button></form><p class="muted mt-4" style="text-align:center"><a href="#" id="goReg">Cadastre-se</a></p></div>`;
  $('#goReg').onclick = (e) => { e.preventDefault(); navigate('register'); };
  $('#form').onsubmit = async (e) => { 
    e.preventDefault(); 
    try { await signInWithEmailAndPassword(auth, $('#email').value, $('#pass').value); } 
    catch (err) { $('#msg').innerHTML = `<div class="alert alert-error">${err.message}</div>`; } 
  };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card"><h2>Criar conta</h2><div id="msg"></div><form id="form"><div class="form-group"><label>Nome</label><input type="text" id="name" required></div><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha (min. 6 chars)</label><input type="password" id="pass" required minlength="6"></div><button type="submit" class="btn btn-primary">Cadastrar</button></form></div>`;
  $('#form').onsubmit = async (e) => { 
    e.preventDefault(); 
    try { 
      const c = await createUserWithEmailAndPassword(auth, $('#email').value, $('#pass').value); 
      await store.saveCustomerProfile(c.user, {name: $('#name').value}); 
      toast('Conta criada!', 'success'); navigate('home'); 
    } catch (err) { $('#msg').innerHTML = `<div class="alert alert-error">${err.message}</div>`; } 
  };
}

/* ------------------------------ PAINEL ADMIN -------------------------- */
async function renderAdmin(tab = 'dashboard') {
  if (!state.isAdmin) return navigate('login');
  
  const qtdProdutos = state.products.length;
  let content = '';

  if (tab === 'dashboard') {
    const orders = await store.getAllOrders();
    const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
    const bestSellers = [...state.products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 5);
    
    content = `
      <div class="dashboard-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:20px; margin-bottom:32px;">
        <div class="card" style="padding:24px; border-left:4px solid var(--success);">
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">Faturamento (Pagos) ${icons.dollar}</div>
          <h2 style="font-size:2rem; margin-top:8px; color:var(--success);">${brl(totalRevenue)}</h2>
        </div>
        <div class="card" style="padding:24px; border-left:4px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">Produtos Ativos ${icons.box}</div>
          <h2 style="font-size:2rem; margin-top:8px;">${qtdProdutos}</h2>
        </div>
      </div>
      <div class="card" style="padding:24px;">
        <h3>Top 5 Capas Mais Vendidas</h3>
        <ul style="list-style:none; padding:0; margin-top:16px;">
          ${bestSellers.map((p, i) => `<li style="padding:12px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;"><span>${i+1}. ${escapeHtml(p.name)}</span> <strong>${p.salesCount || 0} vendas</strong></li>`).join('')}
        </ul>
      </div>
    `;
  } 
  else if (tab === 'products') {
    const rows = state.products.length ? state.products.map((p) => `
      <tr style="${p.active === false ? 'opacity:0.5;' : ''}">
        <td>${p.image ? `<img src="${p.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;" />` : '🛍️'}</td>
        <td><strong>${escapeHtml(p.name)}</strong><br><span class="muted" style="font-size:0.75rem;">Cat: ${escapeHtml(p.category)} | Estoque: ${p.stock}</span></td>
        <td style="color:var(--primary); font-weight:700;">${brl(p.promoPrice || p.price)}</td>
        <td class="text-right">
          <button class="btn btn-outline" style="padding:6px 12px; font-size:.8rem;" data-toggle="${p.id}" data-active="${p.active}">${p.active === false ? 'Ativar' : 'Pausar'}</button>
          <button class="btn btn-outline" style="padding:6px 12px; font-size:.8rem;" data-edit="${p.id}">${icons.edit}</button> 
          <button class="btn btn-danger" style="padding:6px 12px; font-size:.8rem;" data-del="${p.id}">${icons.trash}</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="4" class="muted" style="text-align:center;padding:32px;">Vazio.</td></tr>`;

    content = `
      <div class="flex-between mb-4">
        <h3>Meus Produtos</h3>
        <button class="btn btn-primary" style="display:flex; gap:6px; align-items:center;" data-nav="product-form">${icons.plus} Novo Produto</button>
      </div>
      <div class="table-wrap">
        <table class="data-table"><thead><tr><th style="width:70px;">Foto</th><th>Info</th><th>Preço</th><th class="text-right">Ações</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }
  else if (tab === 'orders') {
    const list = await store.getAllOrders(); 
    const rows = list.length ? list.map(o => {
      let statusColor = o.status === 'paid' ? 'var(--success)' : o.status === 'canceled' ? 'var(--danger)' : o.status === 'shipped' ? 'var(--primary)' : 'var(--warning)';
      return `
      <tr>
        <td><span style="font-family:monospace; font-size:0.8rem; color:var(--text-muted);">#${o.id.slice(0,6).toUpperCase()}</span></td>
        <td>
          <strong>${escapeHtml(o.customerName || 'Cliente')}</strong><br>
          <span class="muted" style="font-size:0.75rem;">${o.items.length} item(s) | CPF: ${escapeHtml(o.cpf || 'N/I')}</span>
        </td>
        <td style="font-weight:700; color:var(--success);">${brl(o.total)}</td>
        <td>
          <select data-order-status="${o.id}" style="padding:6px; border-radius:6px; background:var(--bg-elev); color:${statusColor}; border:1px solid ${statusColor}; font-weight:bold;">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>⏳ Pendente</option>
            <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>✅ Pago</option>
            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>📦 Enviado</option>
            <option value="canceled" ${o.status === 'canceled' ? 'selected' : ''}>❌ Cancelado</option>
          </select>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" class="muted" style="text-align:center;padding:32px;">Nenhum pedido encontrado.</td></tr>`;

    content = `<h3 class="mb-4">Gerenciamento de Pedidos</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Cliente / CPF</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  else if (tab === 'settings' && state.isAdmin) {
    content = `
      <div class="card wide" style="max-width:600px;">
        <h3>Configurações da Loja</h3>
        <p class="muted mb-4">Defina a chave PIX que será exibida para os clientes no Checkout.</p>
        <form id="settingsForm">
          <div class="form-group"><label>Chave PIX</label><input type="text" id="setPixKey" required value="${escapeHtml(state.settings.pixKey || '')}" /></div>
          <div class="form-group"><label>Nome do Beneficiário</label><input type="text" id="setPixName" required value="${escapeHtml(state.settings.pixName || '')}" /></div>
          <div class="form-actions" style="margin-top:24px;"><button type="submit" class="btn btn-primary">Salvar Configurações</button></div>
        </form>
      </div>
    `;
  }
  else if (tab === 'coupons' && state.isAdmin) {
    const coupons = Object.values(state.coupons || {});
    content = `
      <div class="card" style="max-width:600px; margin-bottom:24px; border-color:var(--primary);">
        <h3>Criar Cupom</h3>
        <form id="addCouponForm" style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
          <div class="form-group" style="flex:1; margin:0;"><label>Código</label><input type="text" id="cCode" required /></div>
          <div class="form-group" style="flex:1; margin:0;"><label>Valor</label><input type="number" id="cVal" required /></div>
          <div class="form-group" style="flex:1; margin:0;"><label>Tipo</label><select id="cType" class="filter-select"><option value="fixed">R$</option><option value="percent">%</option></select></div>
          <button type="submit" class="btn btn-primary">Criar</button>
        </form>
      </div>
      <h3>Cupons Ativos</h3>
      <div class="table-wrap mt-4">
        <table class="data-table"><thead><tr><th>Código</th><th>Desconto</th><th>Tipo</th></tr></thead><tbody>
          ${coupons.length ? coupons.map(c => `<tr><td><strong>${c.code}</strong></td><td>${c.type === 'percent' ? c.discount + '%' : brl(c.discount)}</td><td>${c.type === 'percent' ? 'Porcentagem' : 'Fixo'}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Nenhum cupom.</td></tr>'}
        </tbody></table>
      </div>
    `;
  }

  const tabsHtml = `
    <div style="margin-bottom:24px; border-bottom:1px solid var(--border); display:flex; gap:24px; overflow-x:auto;">
      <button class="tab-btn ${tab === 'dashboard' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'dashboard'})">Visão Geral</button>
      <button class="tab-btn ${tab === 'products' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'products'})">Produtos</button>
      <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'orders'})">Pedidos</button>
      <button class="tab-btn ${tab === 'coupons' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'coupons'})">Cupons</button>
      <button class="tab-btn ${tab === 'settings' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'settings'})">Configurações</button>
    </div>
  `;

  appEl().innerHTML = `<div style="max-width:1200px; margin:0 auto; width:100%;">${tabsHtml}${content}</div>`;

  appEl().querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.getAttribute('data-nav'))));
  appEl().querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => navigate('product-form', { id: b.getAttribute('data-edit') })));
  appEl().querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    await store.toggleProductStatus(b.getAttribute('data-toggle'), b.getAttribute('data-active') === 'true');
    toast('Status alterado.', 'success');
  }));
  appEl().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (confirm('Excluir produto?')) { await store.deleteProduct(b.getAttribute('data-del')); toast('Excluído.', 'success'); }
  }));
  appEl().querySelectorAll('[data-order-status]').forEach((sel) => sel.addEventListener('change', async (e) => {
    await store.updateOrderStatus(sel.getAttribute('data-order-status'), e.target.value);
    toast('Status atualizado!', 'success');
  }));

  $('#settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.saveSettings({ pixKey: $('#setPixKey').value.trim(), pixName: $('#setPixName').value.trim() });
    toast('Salvo!', 'success');
  });

  $('#addCouponForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.addCoupon($('#cCode').value.trim(), Number($('#cVal').value), $('#cType').value);
    toast('Cupom criado!', 'success');
    renderAdmin('coupons');
  });
}

/* -------------------------- FORM PRODUTO ------------------------------ */
function renderProductForm(id) {
  if (!state.isAdmin) { toast('Acesso restrito.', 'error'); return navigate('login'); }
  
  const ed = id ? state.products.find((p) => p.id === id) : null;
  const previewHtml = ed?.image ? `<img id="imgPreview" src="${ed.image}" style="display:block; width:100%; height:200px; object-fit:cover; border-radius:8px; margin-top:12px;" />` : `<img id="imgPreview" style="display:none; width:100%; height:200px; object-fit:cover; border-radius:8px; margin-top:12px;" />`;

  appEl().innerHTML = `
    <div class="card wide" style="max-width:650px;">
      <h2>${ed ? 'Editar' : 'Novo'} produto</h2>
      <form id="productForm">
        <div class="form-group"><label>Nome do Produto</label><input type="text" id="pName" required value="${ed ? escapeHtml(ed.name) : ''}" /></div>
        
        <div style="display:flex; gap:16px;">
          <div class="form-group" style="flex:1;"><label>Preço Original (R$)</label><input type="number" id="pPrice" step="0.01" min="0" required value="${ed ? ed.price : ''}" /></div>
          <div class="form-group" style="flex:1;"><label>Preço Promocional</label><input type="number" id="pPromo" step="0.01" min="0" value="${ed ? ed.promoPrice : ''}" /></div>
        </div>

        <div style="display:flex; gap:16px;">
          <div class="form-group" style="flex:1;"><label>Estoque</label><input type="number" id="pStock" min="0" required value="${ed ? ed.stock : '10'}" /></div>
          <div class="form-group" style="flex:1;"><label>Categoria / Estilo</label><input type="text" id="pCategory" required value="${ed ? escapeHtml(ed.category) : ''}" /></div>
          <div class="form-group" style="flex:1;">
            <label>Raridade</label>
            <select id="pRarity" class="filter-select" style="width:100%; height:42px;">
              <option value="Comum" ${ed?.rarity === 'Comum' ? 'selected' : ''}>Comum</option>
              <option value="Rara" ${ed?.rarity === 'Rara' ? 'selected' : ''}>Rara</option>
              <option value="Épica" ${ed?.rarity === 'Épica' ? 'selected' : ''}>Épica</option>
              <option value="Lendária" ${ed?.rarity === 'Lendária' ? 'selected' : ''}>Lendária</option>
            </select>
          </div>
        </div>

        <div class="form-group"><label>Descrição</label><textarea id="pDesc" rows="2">${ed ? escapeHtml(ed.description) : ''}</textarea></div>
        
        <div class="form-group">
          <label>Upload de Imagem</label>
          <div style="border: 2px dashed var(--border-strong); padding: 24px; border-radius: 8px; text-align: center; position: relative;">
             <input type="file" id="pFile" accept="image/*" style="position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%;" />
             <span class="muted" style="font-size:1.1rem;">📸 Clique para escolher</span>
             ${previewHtml}
          </div>
        </div>

        <div style="display:flex; gap:16px; align-items:center; margin-top:12px;">
           <label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="checkbox" id="pLimited" ${ed?.isLimited ? 'checked' : ''} /> Capa Limitada?</label>
           <input type="datetime-local" id="pExpires" value="${ed?.expiresAt ? new Date(ed.expiresAt).toISOString().slice(0,16) : ''}" style="padding:8px; background:var(--bg-elev); border:1px solid var(--border); color:var(--text); border-radius:8px;" />
        </div>

        <div class="form-actions" style="margin-top:24px;">
          <button type="submit" class="btn btn-primary" id="btnSubmit">Salvar Produto</button>
          <button type="button" class="btn btn-outline" onclick="window.navigate('admin', {tab:'products'})">Cancelar</button>
        </div>
      </form>
    </div>`;

  let base64Image = ed ? ed.image : '';
  $('#pFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('Máximo 2MB', 'error');
    const reader = new FileReader();
    reader.onload = (ev) => { base64Image = ev.target.result; $('#imgPreview').src = base64Image; $('#imgPreview').style.display = 'block'; };
    reader.readAsDataURL(file);
  });

  $('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btnSubmit'); btn.textContent = 'Salvando...'; btn.disabled = true;
    
    let expiresVal = 0;
    if ($('#pExpires').value) expiresVal = new Date($('#pExpires').value).getTime();
    
    const data = { 
      name: $('#pName').value.trim(), 
      price: Number($('#pPrice').value), 
      promoPrice: Number($('#pPromo').value) || 0,
      stock: Number($('#pStock').value),
      category: $('#pCategory').value.trim(),
      rarity: $('#pRarity').value,
      isLimited: $('#pLimited').checked,
      expiresAt: expiresVal,
      description: $('#pDesc').value.trim(), 
      image: base64Image 
    };
    
    try {
      if (ed) await store.updateProduct(ed.id, data); 
      else await store.addProduct(data);
      toast('Produto salvo com sucesso!', 'success'); 
      navigate('admin', {tab:'products'});
    } catch (err) { 
      toast('Erro ao salvar. Verifique o console (F12).', 'error'); 
      console.error("Erro no Firebase:", err); 
      btn.disabled = false; 
      btn.textContent = 'Salvar Produto'; 
    }
  });
}

/* ------------------------------ BOOTSTRAP ----------------------------- */
state.unsubSettings = store.listenSettings((s) => {
  if (s.pixKey) state.settings = s;
  if (state.route === 'checkout') renderCheckout();
});
state.unsubCoupons = store.listenCoupons((c) => {
  state.coupons = c;
  if (state.route === 'admin' && state.params.tab === 'coupons') renderAdmin('coupons');
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    // Verifica se o e-mail do usuário está na lista fixa de ADMINS
    state.isOwner = ADMINS.includes(user.email);
    state.isAdmin = ADMINS.includes(user.email); 
    
    // Escuta a lista de vendedores apenas para exibição no painel (não afeta permissões)
    if (state.unsubVendedores) state.unsubVendedores();
    state.unsubVendedores = store.listenVendedores((v) => {
      state.vendedores = v;
      if (state.route === 'admin') renderAdmin(state.params.tab || 'dashboard');
      renderHeader();
    });
    
    if (state.unsubCart) state.unsubCart();
    state.unsubCart = store.listenCart(user.uid, (c) => { state.cart = c; renderHeader(); });

    if (state.unsubFavs) state.unsubFavs();
    state.unsubFavs = store.listenFavorites(user.uid, (f) => { state.favorites = f; if (state.route === 'home') renderHome(); });
    
    await store.saveCustomerProfile(user);
  } else {
    state.isAdmin = false; state.isOwner = false; state.cart = {}; state.vendedores = {}; state.favorites = {};
    if (state.unsubCart) state.unsubCart();
    if (state.unsubVendedores) state.unsubVendedores();
    if (state.unsubFavs) state.unsubFavs();
    renderHeader();
  }
  if (state.route === 'home') renderHome(); else navigate(state.route, state.params);
});

if (state.unsubProducts) state.unsubProducts();
state.unsubProducts = store.listenProducts((list) => {
  state.products = list;
  if (state.route === 'home') renderHome();
  else if (state.route === 'admin' && state.params.tab === 'dashboard') renderAdmin('dashboard');
});

document.getElementById('year').textContent = new Date().getFullYear();
navigate('home');