import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { store } from './store.js';
import { $, appEl, headerEl, brl, escapeHtml, toast } from './utils.js';

import { renderAdmin } from './admin.js';
import { renderSupport } from './support.js';
import { renderProductForm } from './productForm.js';
import { renderAccount } from './account.js';

const ADMINS = ["gabrielcordeirosilva2010@gmail.com", "10pedrin0@gmail.com", "lucaslyra875@gmail.com", "gbzinstudio@gmail.com", "Voabernas@gmail.com"];

const state = {
  route: 'home', params: {}, user: null, isAdmin: false, isOwner: false,
  products: [], cart: {}, favorites: {}, settings: { storeName: 'Gbzin Shop' },
  maintenance: false, profileTab: 'data', coupons: {}, 
  unsubCart: null, unsubProducts: null, unsubSettings: null, unsubFavs: null, unsubMaintenance: null
};

function renderHeader() {
  if (state.maintenance && !state.isAdmin) return;
  let account = '';
  if (state.user) {
    if (state.isAdmin) account += `<button class="btn btn-outline" onclick="window.navigate('admin')">🛠️ <span class="label">Painel</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.navigate('account')">👤 <span class="label">Conta</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.signOutUser()">🚪 <span class="label">Sair</span></button>`;
  } else {
    account = `<button class="btn btn-outline" onclick="window.navigate('login')">👤 <span class="label">Entrar</span></button>`;
  }
  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);
  headerEl().innerHTML = `
    <div class="header-inner">
      <div class="logo" onclick="window.navigate('home')">${escapeHtml(state.settings.storeName)}</div>
      <div class="header-actions">
        <button class="btn btn-outline btn-icon" onclick="window.navigate('support')" title="Suporte">🎧</button>
        <button class="btn btn-outline btn-icon" onclick="window.navigate('favorites')" title="Favoritos">❤️</button>
        <button class="btn btn-outline btn-icon" onclick="window.navigate('cart')" title="Carrinho">🛒${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>
        ${account}
      </div>
    </div>`;
}

function navigate(route, params = {}) {
  state.route = route; state.params = { ...state.params, ...params };
  if (state.maintenance && !state.isAdmin && route !== 'login' && route !== 'maintenance') return renderMaintenance();
  renderHeader();
  switch (route) {
    case 'home': return renderHome();
    case 'login': return renderLogin();
    case 'register': return renderRegister();
    case 'account': return renderAccount(state);
    case 'favorites': state.profileTab = 'favorites'; return renderAccount(state);
    case 'support': return renderSupport();
    case 'admin': return renderAdmin(state, params.tab || 'dashboard');
    case 'product-form': return renderProductForm(state, params.id);
    case 'cart': return renderCart();
    case 'checkout': return renderCheckout();
    case 'product-details': return renderProductDetails(params.id);
    case 'maintenance': return renderMaintenance();
    default: return renderHome();
  }
}
window.navigate = navigate;

window.signOutUser = async () => { await signOut(auth); toast('Saiu.', 'success'); };
document.addEventListener('setProfileTab', (e) => { state.profileTab = e.detail; renderAccount(state); });
window.toggleFav = async (pid, isFav) => { if (!state.user) return toast('Faça login.', 'error'); await store.toggleFavorite(state.user.uid, pid, isFav); };
window.addCart = async (pid) => { if (!state.user) return navigate('login'); const i = state.cart[pid]; await store.updateCart(state.user.uid, { ...state.cart, [pid]: { qty: (i?.qty || 0) + 1 } }); toast('Adicionado!', 'success'); };
window.updateCartQty = async (pid, qty) => { const c = { ...state.cart }; if (qty <= 0) delete c[pid]; else c[pid] = { qty }; await store.updateCart(state.user.uid, c); };

function renderMaintenance() {
  headerEl().innerHTML = '';
  appEl().innerHTML = `<div class="empty-state" style="height: 70vh;"><h1 style="font-size: 3rem; margin-bottom: 16px;">🚧</h1><h2>Estamos em Manutenção</h2><p>Voltamos em breve.</p><button class="btn btn-primary mt-6" onclick="window.navigate('login')">Fazer Login</button></div>`;
}

function renderHome() {
  const list = state.products.filter(p => p.active !== false);
  const card = (p, isFav) => `
    <div class="product-card">
      <div class="thumb" onclick="window.navigate('product-details', {id: '${p.id}'})">
        ${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}
      </div>
      <button class="fav-btn" onclick="window.toggleFav('${p.id}', ${isFav})">${isFav ? '❤️' : '🤍'}</button>
      <div class="info">
        <div class="category">${escapeHtml(p.category || 'Geral')}</div>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">${p.promoPrice > 0 ? `${brl(p.promoPrice)}` : brl(p.price)}</div>
      </div>
      <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Esgotado' : 'Comprar'}</button></div>
    </div>`;

  const best = [...list].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 4);
  const news = list.slice(0, 4);
  appEl().innerHTML = `<h2 class="section-title">🔥 Mais Vendidas</h2><div class="product-grid">${best.map(p => card(p, state.favorites[p.id])).join('')}</div><h2 class="section-title mt-8">✨ Novidades</h2><div class="product-grid">${news.map(p => card(p, state.favorites[p.id])).join('')}</div>`;
}

function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return navigate('home');
  appEl().innerHTML = `<div class="card flex gap-6 flex-wrap" style="max-width: 900px; margin: 0 auto;"><div style="flex:1;"><img src="${p.image}" style="border-radius: 8px;"></div><div style="flex:1;"><h2>${p.name}</h2><p class="muted mt-2">${p.category}</p><h3 class="mt-4" style="color: var(--primary);">${brl(p.promoPrice || p.price)}</h3><p class="mt-4">${p.description}</p><button class="btn btn-primary mt-6" onclick="window.addCart('${p.id}')" style="width: 100%;">Adicionar ao Carrinho</button></div></div>`;
}

function renderLogin() {
  appEl().innerHTML = `<div class="card card-wide" style="max-width: 400px;"><h2 class="text-center mb-6">Entrar</h2><form id="form"><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required></div><button class="btn btn-primary mt-4" style="width:100%">Entrar</button></form><p class="muted text-center mt-4"><a href="#" onclick="window.navigate('register')">Cadastre-se</a></p></div>`;
  $('#form').onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, $('#email').value, $('#pass').value); } catch (err) { toast(err.message, 'error'); } };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card card-wide" style="max-width: 400px;"><h2 class="text-center mb-6">Criar Conta</h2><form id="form"><div class="form-group"><label>Nome</label><input type="text" id="name" required></div><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required minlength="6"></div><button class="btn btn-primary mt-4" style="width:100%">Cadastrar</button></form></div>`;
  $('#form').onsubmit = async (e) => { e.preventDefault(); try { const c = await createUserWithEmailAndPassword(auth, $('#email').value, $('#pass').value); await store.saveCustomerProfile(c.user, {name: $('#name').value}); toast('Conta criada!', 'success'); navigate('home'); } catch (err) { toast(err.message, 'error'); } };
}

function renderCart() {
  if (!state.user) return navigate('login');
  const items = Object.entries(state.cart);
  if (!items.length) return appEl().innerHTML = `<div class="empty-state"><h3>Carrinho vazio</h3><button class="btn btn-outline mt-4" onclick="window.navigate('home')">Voltar</button></div>`;
  let total = 0;
  const html = items.map(([pid, i]) => { const p = state.products.find(x => x.id === pid); if (!p) return ''; total += (p.promoPrice || p.price) * i.qty; return `<div class="cart-item flex-between"><div><div style="font-weight: 600;">${p.name}</div><div class="muted">${brl(p.promoPrice || p.price)}</div></div><div class="flex items-center gap-2"><button class="btn btn-outline" onclick="window.updateCartQty('${pid}', ${i.qty - 1})">-</button><span>${i.qty}</span><button class="btn btn-outline" onclick="window.updateCartQty('${pid}', ${i.qty + 1})">+</button></div></div>`; }).join('');
  appEl().innerHTML = `<h2 class="section-title">Carrinho</h2>${html}<div class="cart-summary mt-6 flex-between items-center"><h3 style="margin: 0;">Total: ${brl(total)}</h3><button class="btn btn-primary" onclick="window.navigate('checkout')">Continuar</button></div>`;
}

// =====================================================================
// CHECKOUT COM SISTEMA DE CUPOM
// =====================================================================
async function renderCheckout() {
  if (!state.user) return navigate('login');
  
  const items = Object.entries(state.cart).map(([pid, i]) => { 
    const p = state.products.find(x => x.id === pid); 
    return { productId: pid, name: p.name, price: p.promoPrice || p.price, qty: i.qty }; 
  });
  
  const totalOriginal = items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  
  // Variável local no escopo da renderização para guardar o desconto atual
  window.checkoutDiscount = 0;
  window.appliedCoupon = null;

  appEl().innerHTML = `
    <div class="card card-wide">
      <h2 class="mb-4">Finalizar Compra</h2>
      
      <!-- Sistema de Cupom -->
      <div style="background: var(--bg-elev); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <label style="font-weight: 600; margin-bottom: 8px; display: block;">Cupom de Desconto</label>
        <div class="flex gap-2">
          <input type="text" id="couponInput" placeholder="Digite o código" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); text-transform: uppercase;">
          <button class="btn btn-outline" id="btnApplyCoupon">Aplicar</button>
        </div>
        <p id="couponMsg" class="muted mt-2" style="display: none; font-weight: 600;"></p>
      </div>

      <!-- Resumo de Valores -->
      <div class="flex-between mb-2"><span class="muted">Subtotal:</span> <span>${brl(totalOriginal)}</span></div>
      <div class="flex-between mb-2" id="discountRow" style="display: none; color: var(--success);"><span>Desconto:</span> <span id="discountValue">-R$ 0,00</span></div>
      
      <div class="form-group mt-4 pt-4" style="border-top: 1px solid var(--border);">
        <label>Chave PIX</label>
        <input type="text" value="${state.settings.pixKey}" disabled style="font-family: monospace; color: var(--primary);">
      </div>

      <div class="flex-between items-center mt-6">
        <div>
          <div class="muted" style="font-size: 0.85rem;">Total a Pagar</div>
          <h3 style="font-size: 1.8rem; color: var(--primary);" id="finalTotal">${brl(totalOriginal)}</h3>
        </div>
        <button class="btn btn-primary" id="btnFinish" style="padding: 14px 32px;">Confirmar Pedido</button>
      </div>
    </div>`;

  // Ação de Aplicar Cupom
  $('#btnApplyCoupon').onclick = async () => {
    const code = $('#couponInput').value.trim().toUpperCase();
    if (!code) return toast('Digite um cupom.', 'error');
    
    const coupon = await store.validateCoupon(code);
    const msgEl = $('#couponMsg');
    
    if (coupon && coupon.active) {
      // Calcula o desconto
      if (coupon.type === 'percent') {
        window.checkoutDiscount = totalOriginal * (coupon.discount / 100);
      } else {
        window.checkoutDiscount = Math.min(coupon.discount, totalOriginal); // Desconto fixo não pode passar do total
      }
      window.appliedCoupon = coupon.code;

      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--success)';
      msgEl.innerHTML = `✅ Cupom <strong>${coupon.code}</strong> aplicado!`;
      
      $('#discountRow').style.display = 'flex';
      $('#discountValue').innerText = `-${brl(window.checkoutDiscount)}`;
      $('#finalTotal').innerText = brl(totalOriginal - window.checkoutDiscount);
      
    } else {
      window.checkoutDiscount = 0;
      window.appliedCoupon = null;
      
      msgEl.style.display = 'block';
      msgEl.style.color = 'var(--danger)';
      msgEl.innerHTML = `❌ Cupom inválido ou expirado.`;
      
      $('#discountRow').style.display = 'none';
      $('#finalTotal').innerText = brl(totalOriginal);
    }
  };

  // Ação de Finalizar Pedido
  $('#btnFinish').onclick = async () => {
    const finalPrice = totalOriginal - window.checkoutDiscount;
    const btn = $('#btnFinish'); btn.textContent = 'Processando...'; btn.disabled = true;
    
    try {
      await store.createOrder(state.user.uid, 'Cliente', items, finalPrice, 'PIX', '', [], window.appliedCoupon, false, null);
      await store.updateCart(state.user.uid, {});
      toast('Pedido feito com sucesso!', 'success'); 
      navigate('account');
    } catch (err) {
      toast('Erro ao finalizar.', 'error'); 
      btn.textContent = 'Confirmar Pedido'; btn.disabled = false;
    }
  };
}

// =====================================================================
// BOOTSTRAP
// =====================================================================
state.unsubSettings = store.listenSettings((s) => { if (s.storeName) state.settings = s; renderHeader(); });
state.unsubMaintenance = store.listenMaintenance((m) => { state.maintenance = m; if (m && !state.isAdmin) renderMaintenance(); else if (!m && state.route === 'maintenance') navigate('home'); });
store.listenCoupons((c) => { state.coupons = c; });

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    window.currentUserUid = user.uid;
    state.isOwner = ADMINS.includes(user.email);
    state.isAdmin = ADMINS.includes(user.email);
    if (state.unsubCart) state.unsubCart();
    state.unsubCart = store.listenCart(user.uid, (c) => { state.cart = c; renderHeader(); });
    if (state.unsubFavs) state.unsubFavs();
    state.unsubFavs = store.listenFavorites(user.uid, (f) => { state.favorites = f; if (state.route === 'home') renderHome(); });
    await store.saveCustomerProfile(user);
  } else {
    window.currentUserUid = null;
    state.isAdmin = false; state.cart = {}; state.favorites = {};
    if (state.unsubCart) state.unsubCart();
    if (state.unsubFavs) state.unsubFavs();
    renderHeader();
  }
  if (state.maintenance && !state.isAdmin && state.route !== 'login') renderMaintenance();
  else if (state.route === 'home') renderHome(); else navigate(state.route, state.params);
});

if (state.unsubProducts) state.unsubProducts();
state.unsubProducts = store.listenProducts((list) => { state.products = list; if (state.route === 'home') renderHome(); });

document.getElementById('year').textContent = new Date().getFullYear();
navigate('home');
