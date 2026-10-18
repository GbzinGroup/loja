import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { store } from './store.js';
import { $, appEl, headerEl, brl, escapeHtml, toast, formatDate } from './utils.js';

import { renderAdmin } from './admin.js';
import { renderSupport } from './support.js';
import { renderProductForm } from './productForm.js';
import { getProductReviews, addReview } from './reviews.js';
import { getMyOrders, createOrder } from './orders.js';
import { getMyProfile, saveMyProfile } from './customers.js';

const ADMINS = ["gabrielcordeirosilva2010@gmail.com", "10pedrin0@gmail.com", "lucaslyra875@gmail.com", "gbzinstudio@gmail.com", "Voabernas@gmail.com"];

const state = {
  route: 'home', params: {}, user: null, isAdmin: false,
  products: [], cart: {}, favorites: {}, settings: { storeName: 'Gbzin Shop' },
  maintenance: false, profileTab: 'data'
};

/* ---------------- HEADER ---------------- */
function renderHeader() {
  if (state.maintenance && !state.isAdmin) return;
  let account = state.user 
    ? `${state.isAdmin ? `<button class="btn btn-outline" onclick="window.navigate('admin')">🛠️ Painel</button>` : ''}
       <button class="btn btn-outline" onclick="window.navigate('account')">👤 Conta</button>
       <button class="btn btn-outline" id="logoutBtn">🚪 Sair</button>`
    : `<button class="btn btn-outline" onclick="window.navigate('login')">👤 Entrar</button>`;
  
  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);
  headerEl().innerHTML = `
    <div class="header-inner">
      <div class="logo" onclick="window.navigate('home')">${escapeHtml(state.settings.storeName)}</div>
      <div class="header-actions">
        <button class="btn btn-icon btn-outline" onclick="window.navigate('cart')" title="Carrinho">🛒${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>
        ${account}
      </div>
    </div>`;
  $('#logoutBtn')?.addEventListener('click', async () => { await signOut(auth); toast('Sessão encerrada.', 'success'); });
}

/* ---------------- NAVEGAÇÃO ---------------- */
function navigate(route, params = {}) {
  state.route = route; state.params = { ...state.params, ...params };
  if (state.maintenance && !state.isAdmin && route !== 'login' && route !== 'maintenance') return renderMaintenance();
  renderHeader();
  switch (route) {
    case 'home': return renderHome();
    case 'login': return renderLogin();
    case 'register': return renderRegister();
    case 'account': return renderAccount();
    case 'admin': return renderAdmin(state, params.tab || 'dashboard');
    case 'product-form': return renderProductForm(state, params.id);
    case 'cart': return renderCart();
    case 'checkout': return renderCheckout();
    case 'product-details': return renderProductDetails(params.id);
    case 'maintenance': return renderMaintenance();
    case 'support': return renderSupport();
    default: return renderHome();
  }
}
window.navigate = navigate;

/* ---------------- TELAS ---------------- */
function renderMaintenance() {
  headerEl().innerHTML = '';
  appEl().innerHTML = `<div style="text-align:center; padding:100px 20px;"><h1>🚧 Manutenção</h1><p>Voltamos em breve.</p><button class="btn btn-primary" onclick="window.navigate('login')">Login Admin</button></div>`;
}

function renderHome() {
  const card = (p, isFav) => `
    <div class="product-card">
      <div class="thumb" onclick="window.navigate('product-details', {id: '${p.id}'})" style="cursor:pointer">
        ${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}
      </div>
      <button class="fav-btn" onclick="window.toggleFav('${p.id}', ${isFav})">${isFav ? '❤️' : '🤍'}</button>
      <div class="info">
        <div class="category">${escapeHtml(p.category || 'Geral')}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">${p.promoPrice > 0 ? `<span style="text-decoration:line-through; font-size:0.8rem;">${brl(p.price)}</span> ${brl(p.promoPrice)}` : brl(p.price)}</div>
      </div>
      <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>Comprar</button></div>
    </div>`;
  
  const list = state.products.filter(p => p.active !== false);
  appEl().innerHTML = `<h2 class="section-title">✨ Novidades</h2><div class="product-grid">${list.map(p => card(p, state.favorites[p.id])).join('')}</div>`;
}

window.toggleFav = async (pid, isFav) => { if (!state.user) return toast('Faça login.', 'error'); await store.toggleFavorite(state.user.uid, pid, isFav); };
window.addCart = async (pid) => { if (!state.user) return navigate('login'); const r = state.cart[pid]; await store.updateCart(state.user.uid, { ...state.cart, [pid]: { qty: (r?.qty || 0) + 1 } }); toast('Adicionado!', 'success'); };

async function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return navigate('home');
  appEl().innerHTML = `<div class="card wide" style="display:flex; gap:32px; flex-wrap:wrap;"><div style="flex:1;"><img src="${p.image}" style="width:100%; border-radius:12px;"></div><div style="flex:1;"><h2>${escapeHtml(p.name)}</h2><div style="font-size:2rem; color:var(--primary);">${brl(p.promoPrice || p.price)}</div><p>${escapeHtml(p.description)}</p><button class="btn btn-primary" onclick="window.addCart('${p.id}')">Adicionar</button></div></div><div id="reviews-container" class="card wide mt-4"></div>`;
  
  try {
    const reviews = await getProductReviews(p.id);
    const list = reviews.length ? reviews.map(r => `<div style="border-bottom:1px solid var(--border); padding:12px 0;"><b>${escapeHtml(r.userName)}</b> - ${r.rating}⭐<p>${escapeHtml(r.comment)}</p></div>`).join('') : '<p>Nenhuma avaliação.</p>';
    const form = state.user ? `<form id="rForm" class="mt-4"><select id="rRating" class="filter-select"><option value="5">5 ⭐</option><option value="4">4 ⭐</option><option value="3">3 ⭐</option><option value="2">2 ⭐</option><option value="1">1 ⭐</option></select><textarea id="rComment" class="mt-2" placeholder="Comentário" required></textarea><button class="btn btn-primary mt-2">Enviar</button></form>` : '<p>Faça login para avaliar.</p>';
    document.getElementById('reviews-container').innerHTML = `<h3>Avaliações</h3>${form}<div class="mt-4">${list}</div>`;
    
    if (state.user) {
      $('#rForm').onsubmit = async (e) => {
        e.preventDefault();
        await addReview(p.id, parseInt($('#rRating').value), $('#rComment').value);
        toast('Avaliado!', 'success'); renderProductDetails(p.id);
      };
    }
  } catch (e) { document.getElementById('reviews-container').innerHTML = `<p>Erro ao carregar.</p>`; }
}

async function renderAccount() {
  if (!state.user) return navigate('login');
  const p = await getMyProfile();
  const orders = await getMyOrders();
  const tab = state.profileTab;

  let content = '';
  if (tab === 'data') content = `<p><b>Nome:</b> ${escapeHtml(p?.name || '')}</p><p><b>E-mail:</b> ${state.user.email}</p>`;
  else if (tab === 'orders') content = orders.length ? orders.map(o => `<div style="border:1px solid #ccc; padding:10px; margin-bottom:8px;"><b>#${o.id.slice(0,6)}</b> - ${brl(o.total)} - ${o.status}</div>`).join('') : '<p>Sem pedidos.</p>';
  else if (tab === 'favorites') content = `<div class="product-grid">${state.products.filter(prod => state.favorites[prod.id]).map(f => `<div class="product-card"><img src="${f.image}"><div class="info"><div class="name">${escapeHtml(f.name)}</div></div></div>`).join('')}</div>`;

  appEl().innerHTML = `<div class="card wide"><h2>Minha Conta</h2><div style="display:flex; gap:10px; margin-bottom:20px;">
    <button class="btn btn-outline" onclick="window.setProfileTab('data')">Dados</button>
    <button class="btn btn-outline" onclick="window.setProfileTab('orders')">Pedidos</button>
    <button class="btn btn-outline" onclick="window.setProfileTab('favorites')">Favoritos</button>
  </div><div>${content}</div></div>`;
}
window.setProfileTab = (t) => { state.profileTab = t; renderAccount(); };

function renderLogin() {
  appEl().innerHTML = `<div class="card"><h2>Entrar</h2><form id="f"><input type="email" id="e" placeholder="E-mail" required class="mt-2"><input type="password" id="p" placeholder="Senha" required class="mt-2"><button class="btn btn-primary mt-4" style="width:100%">Entrar</button></form><p class="mt-4"><a href="#" onclick="window.navigate('register')">Cadastre-se</a></p></div>`;
  $('#f').onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, $('#e').value, $('#p').value); } catch (err) { toast(err.message, 'error'); } };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card"><h2>Criar conta</h2><form id="f"><input type="text" id="n" placeholder="Nome" required class="mt-2"><input type="email" id="e" placeholder="E-mail" required class="mt-2"><input type="password" id="p" placeholder="Senha" required class="mt-2"><button class="btn btn-primary mt-4" style="width:100%">Cadastrar</button></form></div>`;
  $('#f').onsubmit = async (e) => { e.preventDefault(); try { const c = await createUserWithEmailAndPassword(auth, $('#e').value, $('#p').value); await saveMyProfile({ name: $('#n').value }); toast('Sucesso!', 'success'); navigate('home'); } catch (err) { toast(err.message, 'error'); } };
}

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
window.updateCartQty = async (pid, qty) => { const c = { ...state.cart }; if (qty <= 0) delete c[pid]; else c[pid] = { qty }; await store.updateCart(state.user.uid, c); };

async function renderCheckout() {
  if (!state.user) return navigate('login');
  const items = Object.entries(state.cart).map(([pid, i]) => { const p = state.products.find(x => x.id === pid); return { productId: pid, name: p.name, price: p.promoPrice || p.price, qty: i.qty }; });
  const total = items.reduce((a, c) => a + c.price * c.qty, 0);
  appEl().innerHTML = `<div class="card wide"><h2>Checkout</h2><p>Total: <b>${brl(total)}</b></p><button class="btn btn-primary mt-4" id="btnFinish">Já Paguei</button></div>`;
  $('#btnFinish').onclick = async () => {
    $('#btnFinish').disabled = true;
    try { await createOrder({ items, total, paymentMethod: 'PIX' }); await store.updateCart(state.user.uid, {}); toast('Pedido feito!', 'success'); navigate('account'); window.setProfileTab('orders'); }
    catch (e) { toast('Erro ao processar.', 'error'); $('#btnFinish').disabled = false; }
  };
}

/* ---------------- BOOTSTRAP ---------------- */
store.listenSettings(s => { if (s.storeName) state.settings = s; renderHeader(); });
store.listenMaintenance(m => { state.maintenance = m; if (m && !state.isAdmin) renderMaintenance(); else if (!m && state.route === 'maintenance') navigate('home'); });

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.isAdmin = ADMINS.includes(user.email);
    store.listenCart(user.uid, c => { state.cart = c; renderHeader(); });
    store.listenFavorites(user.uid, f => { state.favorites = f; if (state.route === 'home') renderHome(); });
    await saveMyProfile({ name: user.displayName || 'Novo Cliente', email: user.email });
  } else {
    state.isAdmin = false; state.cart = {}; state.favorites = {};
    renderHeader();
  }
  if (state.maintenance && !state.isAdmin && state.route !== 'login') renderMaintenance();
  else if (state.route === 'home') renderHome(); else navigate(state.route, state.params);
});

store.listenProducts(list => { state.products = list; if (state.route === 'home') renderHome(); });
document.getElementById('year').textContent = new Date().getFullYear();
navigate('home');
