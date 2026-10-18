import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { store } from './store.js';
import { $, appEl, headerEl, brl, escapeHtml, toast, formatDate } from './utils.js';

// Tenta importar o resto, mas não deixa a tela quebrar se falhar
let renderAdmin, renderSupport, renderProductForm;
let getProductReviews, addReview, getMyOrders, createOrder, getMyProfile, saveMyProfile;

try {
  const admin = await import('./admin.js'); renderAdmin = admin.renderAdmin;
  const support = await import('./support.js'); renderSupport = support.renderSupport;
  const prodForm = await import('./productForm.js'); renderProductForm = prodForm.renderProductForm;
  const rev = await import('./reviews.js'); getProductReviews = rev.getProductReviews; addReview = rev.addReview;
  const ord = await import('./orders.js'); getMyOrders = ord.getMyOrders; createOrder = ord.createOrder;
  const cust = await import('./customers.js'); getMyProfile = cust.getMyProfile; saveMyProfile = cust.saveMyProfile;
} catch (e) {
  console.error("Erro ao importar módulos:", e);
  document.body.innerHTML = `<div style="color:red; padding:20px;"><h1>Erro de Importação</h1><p>${e.message}</p></div>`;
}

const ADMINS = ["gabrielcordeirosilva2010@gmail.com", "10pedrin0@gmail.com", "lucaslyra875@gmail.com", "gbzinstudio@gmail.com", "Voabernas@gmail.com"];
const state = { route: 'home', params: {}, user: null, isAdmin: false, products: [], cart: {}, favorites: {}, settings: { storeName: 'Gbzin Shop' }, maintenance: false, profileTab: 'data' };

function renderHeader() {
  if (state.maintenance && !state.isAdmin) return;
  let account = state.user ? `<button class="btn btn-outline" onclick="window.navigate('account')">👤 Conta</button> <button class="btn btn-outline" id="logoutBtn">🚪 Sair</button>` : `<button class="btn btn-outline" onclick="window.navigate('login')">👤 Entrar</button>`;
  if (state.user && state.isAdmin) account = `<button class="btn btn-outline" onclick="window.navigate('admin')">🛠️ Painel</button> ` + account;
  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);
  headerEl().innerHTML = `<div class="header-inner"><div class="logo" onclick="window.navigate('home')">${escapeHtml(state.settings.storeName)}</div><div class="header-actions"><button class="btn btn-icon btn-outline" onclick="window.navigate('cart')">🛒${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>${account}</div></div>`;
  $('#logoutBtn')?.addEventListener('click', async () => { await signOut(auth); toast('Sessão encerrada.', 'success'); });
}

function navigate(route, params = {}) {
  state.route = route; state.params = { ...state.params, ...params };
  if (state.maintenance && !state.isAdmin && route !== 'login' && route !== 'maintenance') return renderMaintenance();
  renderHeader();
  try {
    switch (route) {
      case 'home': return renderHome();
      case 'login': return renderLogin();
      case 'register': return renderRegister();
      case 'account': return renderAccount();
      case 'admin': return renderAdmin ? renderAdmin(state, params.tab || 'dashboard') : toast('Admin em erro', 'error');
      case 'product-form': return renderProductForm ? renderProductForm(state, params.id) : toast('Form em erro', 'error');
      case 'cart': return renderCart();
      case 'checkout': return renderCheckout();
      case 'product-details': return renderProductDetails(params.id);
      default: return renderHome();
    }
  } catch (e) {
    appEl().innerHTML = `<div style="color:red; padding:20px; background:#fff;"><h1>Erro na tela ${route}</h1><p>${e.message}</p></div>`;
  }
}
window.navigate = navigate;

function renderMaintenance() { headerEl().innerHTML = ''; appEl().innerHTML = `<div style="text-align:center; padding:100px;"><h1>🚧 Manutenção</h1></div>`; }

function renderHome() {
  const list = state.products.filter(p => p.active !== false);
  appEl().innerHTML = `<h2 class="section-title">✨ Novidades</h2><div class="product-grid">${list.map(p => `
    <div class="product-card">
      <div class="thumb" onclick="window.navigate('product-details', {id: '${p.id}'})">${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}</div>
      <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="price">${brl(p.promoPrice || p.price)}</div></div>
      <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${p.id}')">Comprar</button></div>
    </div>`).join('')}</div>`;
}

window.addCart = async (pid) => { if (!state.user) return navigate('login'); const r = state.cart[pid]; await store.updateCart(state.user.uid, { ...state.cart, [pid]: { qty: (r?.qty || 0) + 1 } }); toast('Adicionado!', 'success'); };
window.toggleFav = async (pid, isFav) => { if (!state.user) return toast('Faça login.', 'error'); await store.toggleFavorite(state.user.uid, pid, isFav); };

async function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return navigate('home');
  appEl().innerHTML = `<div class="card wide"><h2>${escapeHtml(p.name)}</h2><div style="font-size:2rem; color:var(--primary);">${brl(p.promoPrice || p.price)}</div><p>${escapeHtml(p.description)}</p><button class="btn btn-primary" onclick="window.addCart('${p.id}')">Adicionar</button></div><div id="reviews-container" class="card wide mt-4"><p>Avaliações...</p></div>`;
  if (getProductReviews) {
    const reviews = await getProductReviews(p.id);
    document.getElementById('reviews-container').innerHTML = `<h3>Avaliações</h3>` + (reviews.length ? reviews.map(r => `<p>⭐ ${r.rating} - ${escapeHtml(r.comment)}</p>`).join('') : '<p>Nenhuma.</p>');
  }
}

async function renderAccount() {
  if (!state.user) return navigate('login');
  appEl().innerHTML = `<div class="card wide"><h2>Minha Conta</h2><p>Logado como: ${state.user.email}</p></div>`;
}

function renderLogin() {
  appEl().innerHTML = `<div class="card"><h2>Entrar</h2><form id="f"><input type="email" id="e" required class="mt-2"><input type="password" id="p" required class="mt-2"><button class="btn btn-primary mt-4" style="width:100%">Entrar</button></form></div>`;
  $('#f').onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, $('#e').value, $('#p').value); } catch (err) { toast(err.message, 'error'); } };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card"><h2>Criar conta</h2><form id="f"><input type="text" id="n" required class="mt-2"><input type="email" id="e" required class="mt-2"><input type="password" id="p" required class="mt-2"><button class="btn btn-primary mt-4" style="width:100%">Cadastrar</button></form></div>`;
  $('#f').onsubmit = async (e) => { e.preventDefault(); try { const c = await createUserWithEmailAndPassword(auth, $('#e').value, $('#p').value); if(saveMyProfile) await saveMyProfile({ name: $('#n').value }); toast('Sucesso!', 'success'); navigate('home'); } catch (err) { toast(err.message, 'error'); } };
}

function renderCart() {
  if (!state.user) return navigate('login');
  const items = Object.entries(state.cart);
  if (!items.length) return appEl().innerHTML = `<div class="empty-state"><h3>Carrinho vazio</h3></div>`;
  let total = 0;
  const html = items.map(([pid, i]) => { const p = state.products.find(x => x.id === pid); if (!p) return ''; total += (p.promoPrice || p.price) * i.qty; return `<div class="cart-item"><div class="info"><div class="name">${p.name}</div></div><div>${i.qty}x</div></div>`; }).join('');
  appEl().innerHTML = `<div class="card wide"><h2>Carrinho</h2><div class="cart-list">${html}</div><h3>Total: ${brl(total)}</h3><button class="btn btn-primary mt-4" onclick="window.navigate('checkout')">Checkout</button></div>`;
}

async function renderCheckout() {
  if (!state.user) return navigate('login');
  appEl().innerHTML = `<div class="card wide"><h2>Checkout</h2><button class="btn btn-primary mt-4" id="btnFinish">Já Paguei</button></div>`;
  $('#btnFinish').onclick = async () => {
    $('#btnFinish').disabled = true;
    try { 
      if (createOrder) {
        const items = Object.entries(state.cart).map(([pid, i]) => { const p = state.products.find(x => x.id === pid); return { productId: pid, name: p.name, price: p.promoPrice || p.price, qty: i.qty }; });
        const total = items.reduce((a, c) => a + c.price * c.qty, 0);
        await createOrder({ items, total, paymentMethod: 'PIX' }); 
        await store.updateCart(state.user.uid, {}); 
        toast('Pedido feito!', 'success'); navigate('account'); 
      }
    } catch (e) { toast('Erro.', 'error'); $('#btnFinish').disabled = false; }
  };
}

store.listenSettings(s => { if (s.storeName) state.settings = s; renderHeader(); });
store.listenMaintenance(m => { state.maintenance = m; if (m && !state.isAdmin) renderMaintenance(); });

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.isAdmin = ADMINS.includes(user.email);
    store.listenCart(user.uid, c => { state.cart = c; renderHeader(); });
    store.listenFavorites(user.uid, f => { state.favorites = f; });
    if(saveMyProfile) await saveMyProfile({ name: user.displayName || 'Cliente', email: user.email });
  } else {
    state.isAdmin = false; state.cart = {}; state.favorites = {};
    renderHeader();
  }
  renderHome();
});

store.listenProducts(list => { state.products = list; if (state.route === 'home') renderHome(); });
document.getElementById('year').textContent = new Date().getFullYear();
renderHome();
