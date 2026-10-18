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
import { renderAdmin } from './admin.js';
import { renderSupport } from './support.js';

// LISTA DE ADMINS (Você e todos os e-mails enviados)
const ADMINS = [
  "gabrielcordeirosilva2010@gmail.com",
  "10pedrin0@gmail.com",
  "lucaslyra875@gmail.com",
  "gbzinstudio@gmail.com",
  "Voabernas@gmail.com"
];

const state = {
  route: 'home', params: {}, user: null, isAdmin: false, isOwner: false,
  products: [], cart: {}, favorites: {}, settings: { storeName: 'Gbzin Shop' },
  maintenance: false, profileTab: 'data', // Aba padrão do perfil
  unsubCart: null, unsubProducts: null, unsubSettings: null, unsubFavs: null, unsubMaintenance: null
};

/* ------------------------------ HEADER -------------------------------- */
function renderHeader() {
  if (state.maintenance && !state.isAdmin) return; // Se estiver em manutenção e não for admin, não mostra header normal

  let account = '';
  if (state.user) {
    if (state.isAdmin) account += `<button class="btn btn-outline" onclick="window.navigate('admin')">🛠️ <span class="label">Painel</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.navigate('account')">👤 <span class="label">Conta</span></button>`;
    account += `<button class="btn btn-outline" id="logoutBtn">🚪 <span class="label">Sair</span></button>`;
  } else {
    account = `<button class="btn btn-outline" onclick="window.navigate('login')">👤 <span class="label">Entrar</span></button>`;
  }

  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);

  headerEl().innerHTML = `
    <div class="header-inner">
      <div class="logo" onclick="window.navigate('home')">${escapeHtml(state.settings.storeName)}</div>
      <div class="header-actions">
        <button class="btn btn-icon btn-outline" onclick="window.navigate('support')" title="Suporte">🎧</button>
        <button class="btn btn-icon btn-outline" onclick="window.navigate('favorites')" title="Favoritos">❤️</button>
        <button class="btn btn-icon btn-outline" onclick="window.navigate('cart')" title="Carrinho">🛒${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>
        ${account}
      </div>
    </div>`;
  
  $('#logoutBtn')?.addEventListener('click', async () => { await signOut(auth); toast('Sessão encerrada.', 'success'); });
}

/* ------------------------------ NAVEGAÇÃO ----------------------------- */
function navigate(route, params = {}) {
  state.route = route; state.params = { ...state.params, ...params };
  
  // Bloqueio de Manutenção
  if (state.maintenance && !state.isAdmin && route !== 'login' && route !== 'maintenance') {
     return renderMaintenance();
  }

  renderHeader();
  switch (route) {
    case 'home': return renderHome();
    case 'login': return renderLogin();
    case 'register': return renderRegister();
    case 'account': return renderAccount();
    case 'favorites': return renderFavorites();
    case 'support': return renderSupport();
    case 'admin': return renderAdmin(state, params.tab || 'dashboard');
    case 'product-form': return renderProductForm(params.id);
    case 'cart': return renderCart();
    case 'checkout': return renderCheckout();
    case 'product-details': return renderProductDetails(params.id);
    case 'maintenance': return renderMaintenance();
    default: return renderHome();
  }
}
window.navigate = navigate;

/* ------------------------------ MANUTENÇÃO --------------------------- */
function renderMaintenance() {
  headerEl().innerHTML = '';
  appEl().innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:70vh; text-align:center;">
      <div style="font-size:4rem; margin-bottom:20px;">🚧</div>
      <h1 style="font-size:2rem; margin-bottom:12px;">Estamos em Manutenção</h1>
      <p class="muted" style="max-width:400px; margin-bottom:24px;">Estamos melhorando a loja para você. Voltamos em breve! Se você é administrador, faça login abaixo.</p>
      <button class="btn btn-primary" onclick="window.navigate('login')">Fazer Login</button>
    </div>
  `;
}

/* ------------------------------ HOME ---------------------------------- */
function renderHome() {
  let list = state.products.filter(p => p.active !== false);
  
  const renderCard = (p, isFav) => `
    <div class="product-card">
      <div class="thumb" onclick="window.navigate('product-details', {id: '${p.id}'})" style="cursor:pointer">
        ${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}
      </div>
      <button class="fav-btn" onclick="window.toggleFav('${p.id}', ${isFav})">${isFav ? '❤️' : '🤍'}</button>
      <div class="info">
        <div class="category">${escapeHtml(p.category || 'Geral')} • ${escapeHtml(p.rarity || 'Comum')}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">${p.promoPrice > 0 ? `<span style="text-decoration:line-through; font-size:0.8rem; color:#888;">${brl(p.price)}</span> ${brl(p.promoPrice)}` : brl(p.price)}</div>
      </div>
      <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Esgotado' : 'Comprar'}</button></div>
    </div>`;

  const bestSellers = [...state.products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 4);
  const news = state.products.slice(0, 4);

  appEl().innerHTML = `
    <h2 class="section-title">🔥 Mais Vendidas</h2>
    <div class="product-grid">${bestSellers.map(p => renderCard(p, state.favorites[p.id])).join('')}</div>
    <h2 class="section-title" style="margin-top:40px">✨ Novidades</h2>
    <div class="product-grid">${news.map(p => renderCard(p, state.favorites[p.id])).join('')}</div>
  `;
}

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

/* -------------------------- PRODUTO DETALHES -------------------------- */
async function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return navigate('home');
  appEl().innerHTML = `
    <div class="card wide" style="max-width:900px; display:flex; gap:32px; flex-wrap:wrap;">
      <div style="flex:1; min-width:300px;"><img src="${p.image}" style="width:100%; border-radius:12px;" /></div>
      <div style="flex:1; min-width:300px;">
        <h2>${escapeHtml(p.name)}</h2>
        <p class="muted mb-4">${escapeHtml(p.category)} • ${escapeHtml(p.rarity)}</p>
        <div style="font-size:2rem; color:var(--primary); font-weight:800; margin-bottom:16px;">${brl(p.promoPrice || p.price)}</div>
        <p class="mb-4">${escapeHtml(p.description)}</p>
        <button class="btn btn-primary" onclick="window.addCart('${p.id}')" style="width:100%; padding:16px;">Adicionar ao Carrinho</button>
      </div>
    </div>
  `;
}

/* ------------------------------ CONTA E PERFIL (ABAS) ----------------- */
async function renderAccount() {
  if (!state.user) return navigate('login'); 
  const p = await store.getCustomerProfile(state.user.uid); 
  const myOrders = await store.getMyOrders(state.user.uid);
  const tab = state.profileTab;

  let content = '';
  if (tab === 'data') {
    content = `
      <div class="form-group"><label>Nome</label><input type="text" value="${p?.name || ''}" disabled /></div>
      <div class="form-group"><label>E-mail</label><input type="text" value="${state.user.email}" disabled /></div>
      <div class="form-group"><label>Perfil</label><input type="text" value="${state.isAdmin ? 'Vendedor' : 'Cliente'}" disabled /></div>
    `;
  } else if (tab === 'orders') {
    content = myOrders.length ? myOrders.map(o => `
      <div style="background:var(--bg-elev); padding:16px; border-radius:8px; margin-bottom:12px;">
        <div class="flex-between mb-2"><strong>#${o.id.slice(0,6)}</strong> <span style="color:var(--primary);">${brl(o.total)}</span></div>
        <p class="muted" style="font-size:0.8rem;">${formatDate(o.createdAt)} | Status: ${o.status}</p>
      </div>
    `).join('') : '<p class="muted">Nenhum pedido.</p>';
  } else if (tab === 'favorites') {
    const favIds = Object.keys(state.favorites);
    const favs = state.products.filter(prod => favIds.includes(prod.id));
    content = favs.length ? `<div class="product-grid">${favs.map(f => `<div class="product-card"><div class="thumb"><img src="${f.image}"></div><div class="info"><div class="name">${f.name}</div></div></div>`).join('')}</div>` : '<p class="muted">Nenhum favorito.</p>';
  } else if (tab === 'library') {
    const bought = myOrders.filter(o => o.status === 'paid').flatMap(o => o.items);
    content = bought.length ? `<div class="product-grid">${bought.map(i => {
      const prod = state.products.find(x => x.id === i.productId);
      return prod ? `<div class="product-card"><div class="thumb"><img src="${prod.image}"></div><div class="info"><div class="name">${prod.name}</div></div></div>` : '';
    }).join('')}</div>` : '<p class="muted">Biblioteca vazia.</p>';
  }

  appEl().innerHTML = `
    <div class="card wide" style="max-width:900px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2>Minha Conta</h2>
        <button class="btn btn-outline" onclick="window.signOutUser()">Sair</button>
      </div>
      <div style="display:flex; gap:12px; border-bottom:1px solid var(--border); margin-bottom:24px; overflow-x:auto;">
        <button class="tab-btn ${tab === 'data' ? 'active' : ''}" onclick="window.setProfileTab('data')">Dados</button>
        <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.setProfileTab('orders')">Pedidos</button>
        <button class="tab-btn ${tab === 'favorites' ? 'active' : ''}" onclick="window.setProfileTab('favorites')">Favoritos</button>
        <button class="tab-btn ${tab === 'library' ? 'active' : ''}" onclick="window.setProfileTab('library')">Biblioteca</button>
      </div>
      <div>${content}</div>
    </div>
  `;
}

window.setProfileTab = (t) => { state.profileTab = t; renderAccount(); };
window.signOutUser = async () => { await signOut(auth); toast('Saiu.', 'success'); };

/* ------------------------------ FAVORITOS (Atalho) -------------------- */
function renderFavorites() {
  if (!state.user) return navigate('login');
  state.profileTab = 'favorites';
  renderAccount();
}

/* ------------------------------ LOGIN / REGISTRO ---------------------- */
function renderLogin() {
  appEl().innerHTML = `<div class="card"><h2>Entrar</h2><form id="form"><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required></div><button class="btn btn-primary" style="width:100%">Entrar</button></form><p class="muted mt-4" style="text-align:center"><a href="#" onclick="window.navigate('register')">Cadastre-se</a></p></div>`;
  $('#form').onsubmit = async (e) => { 
    e.preventDefault(); 
    try { await signInWithEmailAndPassword(auth, $('#email').value, $('#pass').value); } 
    catch (err) { toast(err.message, 'error'); } 
  };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card"><h2>Criar conta</h2><form id="form"><div class="form-group"><label>Nome</label><input type="text" id="name" required></div><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required minlength="6"></div><button class="btn btn-primary" style="width:100%">Cadastrar</button></form></div>`;
  $('#form').onsubmit = async (e) => { 
    e.preventDefault(); 
    try { 
      const c = await createUserWithEmailAndPassword(auth, $('#email').value, $('#pass').value); 
      await store.saveCustomerProfile(c.user, {name: $('#name').value}); 
      toast('Conta criada!', 'success'); navigate('home'); 
    } catch (err) { toast(err.message, 'error'); } 
  };
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
    return `<div class="cart-item"><div class="info"><div class="name">${p.name}</div><div class="price">${brl(p.promoPrice || p.price)}</div></div><div class="qty"><button onclick="window.updateCartQty('${pid}', ${i.qty - 1})">-</button><span>${i.qty}</span><button onclick="window.updateCartQty('${pid}', ${i.qty + 1})">+</button></div></div>`;
  }).join('');
  appEl().innerHTML = `<h2 class="section-title">Carrinho</h2><div class="cart-list">${html}</div><div class="cart-summary mt-4"><div class="total">${brl(total)}</div><button class="btn btn-primary" onclick="window.navigate('checkout')">Checkout</button></div>`;
}

window.updateCartQty = async (pid, qty) => {
  const newCart = { ...state.cart };
  if (qty <= 0) delete newCart[pid]; else newCart[pid] = { qty };
  await store.updateCart(state.user.uid, newCart);
};

async function renderCheckout() {
  if (!state.user) return navigate('login');
  const items = Object.entries(state.cart).map(([pid, i]) => { const p = state.products.find(x => x.id === pid); return { productId: pid, name: p.name, price: p.promoPrice || p.price, qty: i.qty }; });
  const total = items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  appEl().innerHTML = `<div class="card wide"><h2>Finalizar Compra</h2><div class="pix-box mt-4"><span class="label">Chave PIX</span>${escapeHtml(state.settings.pixKey)}</div><div class="cart-summary mt-4"><div class="total">${brl(total)}</div><button class="btn btn-primary" id="btnFinish">Já Paguei</button></div></div>`;
  $('#btnFinish').onclick = async () => {
    await store.createOrder(state.user.uid, 'Cliente', items, total, 'PIX', '', [], null, false, null);
    await store.updateCart(state.user.uid, {});
    toast('Pedido feito!', 'success'); navigate('account');
  };
}

/* ------------------------------ PRODUTO FORM -------------------------- */
function renderProductForm(id) {
  if (!state.isAdmin) return navigate('login');
  const ed = id ? state.products.find((p) => p.id === id) : null;
  appEl().innerHTML = `
    <div class="card wide" style="max-width:650px;">
      <h2>${ed ? 'Editar' : 'Novo'} produto</h2>
      <form id="productForm">
        <div class="form-group"><label>Nome</label><input type="text" id="pName" required value="${ed ? escapeHtml(ed.name) : ''}" /></div>
        <div style="display:flex; gap:16px;">
          <div class="form-group" style="flex:1;"><label>Preço (R$)</label><input type="number" id="pPrice" step="0.01" required value="${ed ? ed.price : ''}" /></div>
          <div class="form-group" style="flex:1;"><label>Estoque</label><input type="number" id="pStock" required value="${ed ? ed.stock : '10'}" /></div>
        </div>
        <div class="form-group"><label>Categoria</label><input type="text" id="pCategory" required value="${ed ? escapeHtml(ed.category) : ''}" /></div>
        <div class="form-group"><label>Imagem (Upload)</label><input type="file" id="pFile" accept="image/*" /></div>
        <div class="form-actions"><button type="submit" class="btn btn-primary">Salvar</button></div>
      </form>
    </div>`;
  
  let base64Image = ed ? ed.image : '';
  $('#pFile').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => base64Image = ev.target.result;
    reader.readAsDataURL(e.target.files[0]);
  });

  $('#productForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = { name: $('#pName').value, price: Number($('#pPrice').value), stock: Number($('#pStock').value), category: $('#pCategory').value, image: base64Image };
    if (ed) await store.updateProduct(ed.id, data); else await store.addProduct(data);
    toast('Salvo!', 'success'); navigate('admin', {tab: 'products'});
  };
}

/* ------------------------------ BOOTSTRAP ----------------------------- */
state.unsubSettings = store.listenSettings((s) => { if (s.storeName) state.settings = s; renderHeader(); });
state.unsubMaintenance = store.listenMaintenance((m) => {
  state.maintenance = m;
  if (m && !state.isAdmin) renderMaintenance();
  else if (!m && state.route === 'maintenance') navigate('home');
});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.isOwner = ADMINS.includes(user.email);
    state.isAdmin = ADMINS.includes(user.email);
    
    if (state.unsubCart) state.unsubCart();
    state.unsubCart = store.listenCart(user.uid, (c) => { state.cart = c; renderHeader(); });

    if (state.unsubFavs) state.unsubFavs();
    state.unsubFavs = store.listenFavorites(user.uid, (f) => { state.favorites = f; if (state.route === 'home') renderHome(); });
    
    await store.saveCustomerProfile(user);
  } else {
    state.isAdmin = false; state.cart = {}; state.favorites = {};
    if (state.unsubCart) state.unsubCart();
    if (state.unsubFavs) state.unsubFavs();
    renderHeader();
  }

  if (state.maintenance && !state.isAdmin && state.route !== 'login') renderMaintenance();
  else if (state.route === 'home') renderHome(); else navigate(state.route, state.params);
});

if (state.unsubProducts) state.unsubProducts();
state.unsubProducts = store.listenProducts((list) => {
  state.products = list;
  if (state.route === 'home') renderHome();
});

document.getElementById('year').textContent = new Date().getFullYear();
navigate('home');
