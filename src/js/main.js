/* =====================================================================
   main.js — SPA Core Gbzin Shop
   ===================================================================== */
import { auth } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { store } from './store.js';
import { $, appEl, headerEl, brl, escapeHtml, toast, formatDate } from './utils.js';

// Importação dos módulos
import { renderAdmin } from './admin.js';
import { renderSupport } from './support.js';
import { renderVip } from './vip.js';
import { renderProductForm } from './productForm.js';
import { renderAccount } from './account.js';
import { renderSystems } from './systems.js';
import { renderCart as renderCartPage } from './cart.js';
import { captureReferralCode } from './affiliates.js';
import { renderTransactionHistory } from './transactions.js';
import { DEFAULT_PIX_PAYLOAD, buildPixPayload } from './pix.js';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firestore } from './firebase-config.js';

// O QR Code é carregado sob demanda para que uma falha no CDN não impeça a loja inteira de iniciar.

// LISTA DE ADMINS
const ADMINS = [
  "gabrielcordeirosilva2010@gmail.com",
  "10pedrin0@gmail.com",
  "lucaslyra875@gmail.com",
  "gbzinstudio@gmail.com",
  "voabernas@gmail.com"
];

captureReferralCode();
let cartWriteQueue = Promise.resolve();
async function showStartupToast(user) {
  if (!user?.uid) return;
  try {
    const snap = await getDocs(query(collection(firestore, 'notifications'), where('userId', '==', user.uid), limit(100)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(n => n.type === 'startup_toast' && n.title && n.message)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const latest = items[0];
    if (!latest) return;
    try { if (localStorage.getItem(`gbzin-startup-toast:${user.uid}:${latest.id}`) === 'seen') return; } catch {}
    try { localStorage.setItem(`gbzin-startup-toast:${user.uid}:${latest.id}`, 'seen'); } catch {}
    const messageText = String(latest.message);
    toast(`${latest.title}: ${messageText.slice(0, 180)}${messageText.length > 180 ? '… Confira a central de notificações para ler tudo.' : ''}`, 'info');
  } catch (err) {
    // Falha na leitura de avisos não deve impedir login nem carregar a loja.
    console.warn('[Toast de entrada] Não foi possível consultar avisos:', err?.code || err?.message || err);
  }
}
const state = {
  route: 'home', params: {}, user: null, isAdmin: false, isOwner: false,
  products: [], cart: {}, favorites: {}, settings: { storeName: 'Gbzin Shop' },
  maintenance: false, profileTab: 'data', coupons: {}, publicCoupons: {}, couponMirrorInitialized: false, 
  unsubCart: null, unsubProducts: null, unsubSettings: null, unsubFavs: null, unsubMaintenance: null
};

/* ------------------------------ HEADER -------------------------------- */
function renderHeader() {
  if (state.maintenance && !state.isAdmin) return;

  let account = '';
  if (state.user) {
    if (state.isAdmin) account += `<button class="btn btn-outline" onclick="window.navigate('admin')"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span class="label">Painel</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.navigate('account')"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.5 3.1-5.5 7-5.5s6.4 2 7 5.5"/></svg><span class="label">Conta</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.signOutUser()"><span class="label">Sair</span></button>`;
  } else {
    account = `<button class="btn btn-outline" onclick="window.navigate('login')"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.5 3.1-5.5 7-5.5s6.4 2 7 5.5"/></svg><span class="label">Entrar</span></button>`;
  }

  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);

  headerEl().innerHTML = `
    <div class="header-inner">
      <button class="logo" type="button" onclick="window.navigate('home')" aria-label="Voltar à loja"><img src="assets/gbzin-mark-white.png" alt=""><span>${escapeHtml(state.settings.storeName)}</span></button>
      <nav class="main-nav" aria-label="Navegação principal">
        <button onclick="window.navigate('home')">Loja</button>
        <button onclick="window.navigate('promotions')">Ofertas</button>
        <button onclick="window.navigate('new')">Novidades</button>
        <button onclick="window.navigate('guide')">Como comprar</button>
        <button onclick="window.navigate('vip')">Clube VIP</button>
        ${state.user ? `<button onclick="window.navigate('systems')">Benefícios</button><button onclick="window.navigate('transactions')">Transações</button>` : ''}
        <button onclick="window.navigate('tracking')">Pedidos</button>
      </nav>
      <div class="header-actions">
        <button class="btn btn-icon btn-outline" onclick="window.navigate('support')" title="Suporte" aria-label="Suporte"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="12" width="4" height="6" rx="2"/><rect x="17" y="12" width="4" height="6" rx="2"/><path d="M17 19c-1 1.2-2.6 1.8-5 1.8"/></svg></button>
        <button class="btn btn-icon btn-outline" onclick="window.navigate('favorites')" title="Favoritos" aria-label="Favoritos"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 8.8c0 5-8.8 10-8.8 10s-8.8-5-8.8-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/></svg></button>
        <button class="btn btn-icon btn-outline" onclick="window.navigate('cart')" title="Carrinho" aria-label="Carrinho"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>
        ${account}
      </div>
    </div>`;
}

/* ------------------------------ NAVEGAÇÃO ----------------------------- */
window.shopToast = (message) => toast(message, 'success');

function navigate(route, params = {}) {
  state.route = route; state.params = { ...state.params, ...params };
  
  if (state.maintenance && !state.isAdmin && route !== 'login' && route !== 'maintenance') {
     return renderMaintenance();
  }

  renderHeader();
  switch (route) {
    case 'home': return renderHome();
    case 'login': return renderLogin();
    case 'register': return renderRegister();
    case 'account': return renderAccount(state);
    case 'systems': return renderSystems(state, params.tab || 'overview');
    case 'rewards': return renderSystems(state, 'rewards');
    case 'requests': return renderSystems(state, 'requests');
    case 'affiliates': return renderSystems(state, 'referrals');
    case 'favorites': state.profileTab = 'favorites'; return renderAccount(state);
    case 'support': return renderSupport(state);
    case 'vip': return renderVip(state);
    case 'admin': return renderAdmin(state, params.tab || 'dashboard');
    case 'product-form': return renderProductForm(state, params.id);
    case 'cart': return renderCart();
    case 'checkout': return renderCheckout();
    case 'product-details': return renderProductDetails(params.id);
    case 'maintenance': return renderMaintenance();
    case 'about': return renderInfoPage('about');
    case 'faq': return renderInfoPage('faq');
    case 'contact': return renderInfoPage('contact');
    case 'shipping': return renderInfoPage('shipping');
    case 'privacy': return renderInfoPage('privacy');
    case 'terms': return renderInfoPage('terms');
    case 'tracking': return renderTracking();
    case 'transactions': return renderTransactionHistory(state.user);
    case 'new': return renderInfoPage('new');
    case 'promotions': return renderInfoPage('promotions');
    case 'guide': return renderInfoPage('guide');
    default: return renderHome();
  }
}
window.navigate = navigate;

/* ------------------------------ AÇÕES GLOBAIS ------------------------ */
window.signOutUser = async () => { try { await signOut(auth); toast('Sessão encerrada.', 'success'); navigate('home'); } catch (e) { console.error(e); toast('Não foi possível sair. Tente novamente.', 'error'); } };

document.addEventListener('setProfileTab', (e) => {
  state.profileTab = e.detail;
  renderAccount(state);
});

window.toggleFav = async (pid, isFav) => {
  if (!state.user) return toast('Faça login.', 'error');
  await store.toggleFavorite(state.user.uid, pid, isFav);
};

async function persistCartOptimistically(nextCart) {
  if (!state.user) return navigate('login');
  const uid = state.user.uid;
  state.cart = nextCart;
  renderHeader();
  if (state.route === 'cart') renderCart();
  // Serialize whole-cart writes so rapid +/- clicks cannot overwrite each other out of order.
  const snapshot = structuredClone(nextCart);
  cartWriteQueue = cartWriteQueue.catch(() => {}).then(() => store.updateCart(uid, snapshot));
  try {
    await cartWriteQueue;
  } catch (e) {
    console.error('[Carrinho] Falha ao salvar:', e);
    toast('Não foi possível salvar o carrinho. Confira sua conexão e as regras do banco.', 'error');
    // Re-read persisted state via listener; avoid overwriting a newer local interaction.
    try {
      const persisted = await store.getCart(uid);
      state.cart = persisted || {};
      renderHeader();
      if (state.route === 'cart') renderCart();
    } catch {}
    throw e;
  }
}

window.addCart = async (pid) => {
  if (!state.user) return navigate('login');
  const product = state.products.find(p => p.id === pid && p.active !== false);
  if (!product) return toast('Este produto não está disponível.', 'error');
  const current = Math.max(0, Math.floor(Number(state.cart[pid]?.qty) || 0));
  const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
  const nextQty = current + 1;
  if (nextQty > stock) return toast('Quantidade maior que o estoque disponível.', 'error');
  try {
    await persistCartOptimistically({ ...state.cart, [pid]: { qty: nextQty } });
    toast('Adicionado ao carrinho!', 'success');
  } catch {}
};

window.updateCartQty = async (pid, qty) => {
  if (!state.user) return navigate('login');
  const requested = Math.floor(Number(qty));
  if (!Number.isFinite(requested)) return;
  const product = state.products.find(p => p.id === pid);
  const newCart = { ...state.cart };
  if (requested <= 0) delete newCart[pid];
  else {
    if (!product || product.active === false) return toast('Este produto não está mais disponível.', 'error');
    const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    if (requested > stock) return toast(`Estoque disponível: ${stock}.`, 'error');
    newCart[pid] = { qty: requested };
  }
  try { await persistCartOptimistically(newCart); }
  catch {}
};

/* ------------------------------ TELAS BÁSICAS ------------------------- */
function renderMaintenance() {
  headerEl().innerHTML = '';
  appEl().innerHTML = `<div class="empty-state" style="height: 70vh;"><h1 style="font-size: 3rem; margin-bottom: 16px;"></h1><h2>Estamos em Manutenção</h2><p>Voltamos em breve.</p><button class="btn btn-primary mt-6" onclick="window.navigate('login')">Fazer Login</button></div>`;
}

function renderHome() {
  const list = state.products.filter(p => p.active !== false);
  const renderCard = (p, isFav) => `
    <article class="product-card">
      <div class="thumb" role="button" tabindex="0" aria-label="Ver ${escapeHtml(p.name)}" onclick="window.navigate('product-details', {id: '${p.id}'})" onkeydown="if(event.key==='Enter')window.navigate('product-details',{id:'${p.id}'})">
        ${p.image ? `<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'"/>` : `<div class="placeholder"></div>`}
      </div>
      <button class="fav-btn" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" onclick="window.toggleFav('${p.id}', ${Boolean(isFav)})">${isFav ? '' : ''}</button>
      <div class="info">
        <div class="category">${escapeHtml(p.category || 'Geral')}</div>
        <div class="name">${escapeHtml(p.name || 'Produto')}</div>
        <div class="price">${Number(p.promoPrice) > 0 ? `${brl(p.promoPrice)} <small class="muted" style="text-decoration:line-through">${brl(p.price)}</small>` : brl(p.price)}</div>
        <small class="muted">${Number(p.stock) > 0 ? `${Number(p.stock)} em estoque` : 'Estoque indisponível'}</small>
      </div>
      <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${p.id}')" ${Number(p.stock) <= 0 ? 'disabled' : ''}>${Number(p.stock) <= 0 ? 'Esgotado' : 'Adicionar ao carrinho'}</button></div>
    </article>`;

  const categories = [...new Set(list.map(p => p.category).filter(Boolean))].sort();
  appEl().innerHTML = `
    <section class="hero card" style="padding:clamp(22px,5vw,48px);margin-bottom:28px;background:radial-gradient(ellipse at top right,rgba(99,102,241,.22),transparent 55%),var(--bg-elev)">
      <p class="muted" style="text-transform:uppercase;letter-spacing:.14em;font-weight:700">Bem-vindo à loja</p>
      <h1 style="font-size:clamp(1.8rem,5vw,3rem);margin:8px 0 12px">${escapeHtml(state.settings.storeName || 'Gbzin Shop')}</h1>
      <p class="muted" style="max-width:620px;font-size:1rem">Encontre seus itens favoritos com uma experiência simples, rápida e segura.</p>
      <div class="flex gap-3 flex-wrap mt-6">
        <button class="btn btn-primary" onclick="document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth'})">Explorar produtos</button>
        <button class="btn btn-outline" onclick="window.navigate('support')">Central de suporte</button>
      </div>
    </section>
    <section id="catalogo">
      <div class="flex-between flex-wrap gap-4 mb-4"><div><h2 class="section-title" style="margin-bottom:6px">Catálogo</h2><p class="muted">${list.length} produto(s) disponíveis</p></div></div>
      <div class="catalog-tools flex gap-3 flex-wrap mb-6">
        <input id="productSearch" type="search" placeholder="Buscar por nome ou descrição..." aria-label="Buscar produtos" style="flex:2;min-width:220px;padding:12px 14px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg-elev);color:var(--text)">
        <select id="categoryFilter" aria-label="Filtrar categoria" style="flex:1;min-width:160px;padding:12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg-elev);color:var(--text)">
          <option value="">Todas as categorias</option>${categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
        <select id="sortProducts" aria-label="Ordenar produtos" style="flex:1;min-width:150px;padding:12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg-elev);color:var(--text)">
          <option value="featured">Em destaque</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A–Z</option>
        </select>
      </div>
      <div id="catalogResults" class="product-grid">${list.map(p=>renderCard(p,state.favorites[p.id])).join('')}</div>
      ${list.length ? '' : '<div class="empty-state"><h3>A loja está sendo preparada</h3><p class="muted">Novos produtos aparecerão aqui em breve.</p></div>'}
    </section>`;
  const updateCatalog = () => {
    const term = ($('#productSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const category = $('#categoryFilter')?.value || '';
    const sort = $('#sortProducts')?.value || 'featured';
    let filtered = list.filter(p => `${p.name || ''} ${p.description || ''} ${p.category || ''}`.toLocaleLowerCase('pt-BR').includes(term) && (!category || p.category === category));
    if (sort === 'price-asc') filtered.sort((a,b)=>(Number(a.promoPrice)||Number(a.price)||0)-(Number(b.promoPrice)||Number(b.price)||0));
    if (sort === 'price-desc') filtered.sort((a,b)=>(Number(b.promoPrice)||Number(b.price)||0)-(Number(a.promoPrice)||Number(a.price)||0));
    if (sort === 'name') filtered.sort((a,b)=>(a.name||'').localeCompare(b.name||'', 'pt-BR'));
    $('#catalogResults').innerHTML = filtered.length ? filtered.map(p=>renderCard(p,state.favorites[p.id])).join('') : '<div class="empty-state" style="grid-column:1/-1"><h3>Nenhum produto encontrado</h3><p class="muted">Tente mudar a busca ou os filtros.</p><button class="btn btn-outline mt-4" id="clearFilters">Limpar filtros</button></div>';
    $('#clearFilters')?.addEventListener('click',()=>{ $('#productSearch').value=''; $('#categoryFilter').value=''; $('#sortProducts').value='featured'; updateCatalog(); });
  };
  $('#productSearch').addEventListener('input', updateCatalog);
  $('#categoryFilter').addEventListener('change', updateCatalog);
  $('#sortProducts').addEventListener('change', updateCatalog);
}

function renderInfoPage(page) {
  const pages = {
    about: { title: 'Sobre a Gbzin Shop', intro: 'Uma experiência de compra digital simples, transparente e pensada para a comunidade.', body: `<div class="feature-grid"><article class="feature-card"><span></span><h3>Compra simples</h3><p>Encontre o que procura com busca, categorias e detalhes claros.</p></article><article class="feature-card"><span></span><h3>Conta pessoal</h3><p>Acompanhe seus pedidos e mantenha suas informações em um só lugar.</p></article><article class="feature-card"><span></span><h3>Suporte</h3><p>Precisa de ajuda? Acesse nossa central de atendimento.</p></article></div>` },
    new: { title: 'Novidades e destaques', intro: 'Confira os itens disponíveis e descubra o que chegou recentemente.', body: `<div class="product-grid">${state.products.filter(p=>p.active!==false).slice(0,8).map(p=>`<article class="product-card"><div class="thumb" onclick="window.navigate('product-details',{id:'${p.id}'})">${p.image?`<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`:'<div class="placeholder"></div>'}</div><div class="info"><div class="category">${escapeHtml(p.category||'Destaque')}</div><div class="name">${escapeHtml(p.name||'Produto')}</div><div class="price">${brl(Number(p.promoPrice)>0?p.promoPrice:p.price)}</div></div><div class="actions"><button class="btn btn-primary" onclick="window.navigate('product-details',{id:'${p.id}'})">Ver produto</button></div></article>`).join('')}</div>` },
    promotions: { title: 'Ofertas e cupons', intro: 'Confira produtos em promoção e cupons que a loja disponibilizou para sua conta.', body: `
      <div class="promo-banner"><div><span class="eyebrow">OFERTAS DA COMUNIDADE</span><h2>Uma boa oportunidade para sua próxima compra.</h2><p class="muted">Os cupons publicados aqui são controlados pela equipe da loja. Use o código no checkout para consultar a validade.</p></div><button class="btn btn-primary" onclick="window.navigate('home')">Explorar produtos</button></div>
      <h2 class="section-title mt-6">Cupons publicados</h2>
      <div class="coupon-public-grid">${Object.values(state.publicCoupons || {}).filter(c=>c.active===true && c.showInAccount===true).map(c=>`<article class="public-coupon"><div><span class="coupon-label">CUPOM</span><h3>${escapeHtml(c.code)}</h3><p>${c.type==='percent'?`${Number(c.discount)}% de desconto`:`${brl(c.discount)} de desconto`}</p></div><button class="btn btn-outline" onclick="navigator.clipboard.writeText('${escapeHtml(c.code)}').then(()=>window.shopToast ? window.shopToast('Cupom copiado!') : alert('Cupom copiado!')).catch(()=>alert('Código: ${escapeHtml(c.code)}'))">Copiar código</button></article>`).join('') || '<div class="empty-state"><h3>Nenhum cupom publicado</h3><p>Quando houver uma campanha disponível, ela aparecerá nesta página.</p></div>'}</div>
      <h2 class="section-title mt-8">Produtos em oferta</h2>
      <div class="product-grid">${state.products.filter(p=>p.active!==false && Number(p.promoPrice)>0 && Number(p.promoPrice)<Number(p.price)).map(p=>`<article class="product-card"><div class="thumb" onclick="window.navigate('product-details',{id:'${p.id}'})">${p.image?`<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">`:'<div class="placeholder"></div>'}</div><div class="info"><div class="category">${escapeHtml(p.category||'Oferta')}</div><div class="name">${escapeHtml(p.name||'Produto')}</div><div class="price">${brl(p.promoPrice)} <del class="muted">${brl(p.price)}</del></div></div><div class="actions"><button class="btn btn-primary" onclick="window.navigate('product-details',{id:'${p.id}'})">Ver oferta</button></div></article>`).join('') || '<div class="empty-state"><p>Não há produtos com preço promocional no momento.</p></div>'}</div>` },
    guide: { title: 'Como comprar', intro: 'Do catálogo ao acompanhamento do pedido, sem complicação.', body: `<div class="guide-grid"><article class="guide-step"><span>01</span><h3>Escolha seu produto</h3><p>Use a busca e os filtros para encontrar o item ideal. Confira a descrição e disponibilidade.</p></article><article class="guide-step"><span>02</span><h3>Adicione ao carrinho</h3><p>Entre na sua conta para manter seu carrinho e associar a compra ao seu perfil.</p></article><article class="guide-step"><span>03</span><h3>Aplique seu cupom</h3><p>Se tiver um código válido, informe-o no checkout e confira o desconto estimado antes de prosseguir.</p></article><article class="guide-step"><span>04</span><h3>Confira o pagamento</h3><p>Confira o valor e os dados no aplicativo do banco. A loja não confirma pagamentos apenas pela tela do navegador.</p></article><article class="guide-step"><span>05</span><h3>Acompanhe o pedido</h3><p>Consulte o status na área de pedidos. Produtos digitais dependem da confirmação e da disponibilização.</p></article></div>` },
    faq: { title: 'Perguntas frequentes', intro: 'Respostas rápidas para ajudar você a comprar com tranquilidade.', body: `<div class="faq-list"><details><summary>Como faço uma compra?</summary><p>Escolha um produto, adicione ao carrinho, entre na sua conta e siga as etapas de finalização.</p></details><details><summary>Preciso criar uma conta?</summary><p>Sim. A conta permite associar seus pedidos ao seu perfil e consultar o histórico.</p></details><details><summary>Como acompanho meu pedido?</summary><p>Entre na sua conta e abra a área “Meus pedidos” para consultar o status disponível.</p></details><details><summary>Tenho um problema com a compra. O que faço?</summary><p>Abra a Central de suporte e descreva o ocorrido com o máximo de detalhes, sem compartilhar sua senha.</p></details><details><summary>Os produtos aparecem esgotados?</summary><p>O catálogo mostra a disponibilidade registrada pela loja. Se houver divergência, entre em contato com o suporte.</p></details></div>` },
    contact: { title: 'Central de contato', intro: 'Fale com a equipe da Gbzin Shop.', body: `<div class="card contact-card"><h3>Como podemos ajudar?</h3><p class="muted">Informe sua dúvida, o número do pedido (se houver) e o e-mail da sua conta. Nunca envie senhas ou códigos de autenticação.</p><button class="btn btn-primary mt-4" onclick="window.navigate('support')">Abrir suporte</button><button class="btn btn-outline mt-4" onclick="window.navigate('account')">Ver minha conta</button></div>` },
    shipping: { title: 'Entrega e disponibilização', intro: 'Informações sobre o acesso aos produtos comprados.', body: `<div class="policy-content"><h3>Produtos digitais</h3><p>A forma e o prazo de disponibilização dependem do produto e da confirmação do pedido. Consulte a descrição do item e o status na sua conta.</p><h3>Problemas de acesso</h3><p>Se o produto não estiver disponível após a confirmação, entre em contato com o suporte e informe o número do pedido.</p><h3>Disponibilidade</h3><p>O catálogo pode mudar conforme estoque e disponibilidade. A confirmação final depende da validação do pedido.</p></div>` },
    privacy: { title: 'Política de privacidade', intro: 'Entenda quais informações podem ser tratadas, para quais finalidades e como solicitar suporte sobre seus dados.', body: `<div class="policy-document"><div class="policy-callout"><strong>Compromisso com a transparência</strong><p>Esta página resume as práticas pretendidas da Gbzin Shop. Antes de publicar, complete os dados de identificação e contato do responsável pela loja e confirme se o texto corresponde às integrações realmente utilizadas.</p></div><p class="policy-updated">Última atualização: 23 de outubro de 2026</p><nav class="policy-index" aria-label="Índice da política"><a href="#priv-dados">Dados coletados</a><a href="#priv-finalidade">Finalidades</a><a href="#priv-base">Bases e compartilhamento</a><a href="#priv-retencao">Retenção e segurança</a><a href="#priv-direitos">Seus direitos</a><a href="#priv-contato">Contato</a></nav><section id="priv-dados"><h2>1. Informações tratadas</h2><p>Conforme os recursos utilizados, a loja pode tratar nome de exibição, e-mail, identificador da conta, dados de perfil fornecidos pelo cliente, produtos e pedidos, status de pagamento, solicitações de suporte, preferências, favoritos, cupons e registros de uso necessários à operação.</p><p>Não envie senhas, códigos de autenticação, dados completos de cartão ou documentos pessoais em campos de observação ou chamados de suporte.</p></section><section id="priv-finalidade"><h2>2. Para que usamos os dados</h2><ul><li>Criar e manter sua conta e permitir o acesso seguro;</li><li>registrar pedidos, disponibilizar produtos digitais e prestar suporte;</li><li>prevenir fraude, abuso, duplicidade de solicitações e uso indevido de cupons;</li><li>administrar carteira, pontos, recompensas e programa de afiliados quando esses recursos estiverem ativos;</li><li>cumprir obrigações legais e resolver disputas relacionadas às compras.</li></ul></section><section id="priv-base"><h2>3. Bases legais e compartilhamento</h2><p>O tratamento deve se apoiar em uma base legal aplicável, como execução de contrato, cumprimento de obrigação legal, exercício regular de direitos, legítimo interesse avaliado ou consentimento quando necessário. A base adequada depende da operação concreta.</p><p>A infraestrutura pode utilizar Firebase/Google e, se configurados, provedores de pagamento, hospedagem e ferramentas de atendimento. Esses serviços recebem apenas os dados necessários para executar suas funções, de acordo com suas configurações e políticas. A loja não deve vender dados pessoais.</p></section><section id="priv-retencao"><h2>4. Armazenamento, retenção e segurança</h2><p>Os dados podem permanecer enquanto a conta estiver ativa e pelo período necessário para entregar pedidos, manter registros financeiros, prevenir fraude ou cumprir obrigações legais. A exclusão da conta não implica necessariamente apagar registros que precisem ser conservados por lei ou para defesa de direitos.</p><p>São necessárias regras de acesso restritivas no Firebase, credenciais administrativas protegidas, revisão de permissões e uso de backend confiável para operações financeiras. Nenhuma transmissão ou armazenamento pode ser garantido como absolutamente livre de risco.</p></section><section id="priv-direitos"><h2>5. Seus direitos e exclusão da conta</h2><p>Nos termos da legislação aplicável, incluindo a LGPD quando pertinente, você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento e, quando cabível, anonimização, bloqueio, eliminação ou portabilidade dos dados.</p><p>Para solicitar análise ou exclusão, utilize a Central de atendimento autenticado. Poderemos pedir informações razoáveis para confirmar que a solicitação vem do titular. Alguns registros podem ser retidos quando houver obrigação legal ou outra justificativa válida.</p></section><section id="priv-criancas"><h2>6. Crianças e adolescentes</h2><p>Se o serviço for utilizado por crianças ou adolescentes, o tratamento deve respeitar as exigências legais aplicáveis e considerar seu melhor interesse. Responsáveis devem entrar em contato com a equipe caso identifiquem dados enviados indevidamente.</p></section><section id="priv-alteracoes"><h2>7. Alterações desta política</h2><p>Podemos atualizar este texto para refletir mudanças nos recursos, fornecedores ou exigências legais. A versão publicada indicará a data da última atualização. Mudanças relevantes devem ser comunicadas por meios adequados.</p></section><section id="priv-contato"><h2>8. Contato e solicitações</h2><p>Use a <a href="#" onclick="window.navigate('support');return false">Central de atendimento</a> para dúvidas relacionadas à privacidade. Antes de publicar, a loja deve informar aqui o nome empresarial ou responsável e um canal de contato válido para assuntos de dados pessoais.</p></section></div>` },
    terms: { title: 'Termos de uso', intro: 'Condições de navegação, pedidos, pagamentos, produtos digitais e utilização da conta na Gbzin Shop.', body: `<div class="policy-document"><div class="policy-callout"><strong>Leia antes de comprar</strong><p>Estes termos descrevem regras gerais de uso da loja. Devem ser revisados pelo responsável pela operação para refletir os produtos, prazos, política de cancelamento e legislação aplicável.</p></div><p class="policy-updated">Última atualização: 23 de outubro de 2026</p><nav class="policy-index" aria-label="Índice dos termos"><a href="#term-aceite">Aceitação e conta</a><a href="#term-catalogo">Produtos e preços</a><a href="#term-pedido">Pedidos e pagamentos</a><a href="#term-entrega">Entrega digital</a><a href="#term-cupom">Cupons e benefícios</a><a href="#term-conduta">Uso permitido</a><a href="#term-cancelamento">Atendimento e cancelamento</a></nav><section id="term-aceite"><h2>1. Aceitação e conta</h2><p>Ao navegar, criar uma conta ou fazer um pedido, você concorda em utilizar a plataforma de forma lícita e fornecer informações corretas e atualizadas. Você é responsável por proteger suas credenciais e avisar a equipe se suspeitar de acesso não autorizado.</p><p>A equipe pode restringir temporariamente acessos quando houver indícios razoáveis de fraude, abuso ou risco à segurança, observadas as obrigações legais aplicáveis.</p></section><section id="term-catalogo"><h2>2. Produtos, disponibilidade e preços</h2><p>Descrições, imagens, preços, promoções e estoque são apresentados para ajudar na escolha e podem ser atualizados. A disponibilidade final é verificada durante o processamento do pedido. Se houver erro evidente de preço, descrição ou estoque, a equipe deverá analisar o caso e informar o cliente antes de concluir a operação afetada.</p><p>Marcas e conteúdos de terceiros pertencem aos respectivos titulares. A compra concede apenas o acesso ou licença expressamente descritos na página do produto, quando aplicável.</p></section><section id="term-pedido"><h2>3. Pedidos e pagamentos</h2><p>Um pedido criado pode permanecer pendente até que o pagamento seja confirmado pelo provedor ou pela equipe autorizada. Gerar QR Code, copiar um código Pix ou enviar comprovante não significa, por si só, que o pagamento foi confirmado.</p><p>Não realize pagamentos adicionais para compensar uma demora sem antes consultar o status do pedido ou a Central de atendimento. O saldo de carteira e os pontos só podem ser alterados após validação autorizada.</p></section><section id="term-entrega"><h2>4. Entrega e produtos digitais</h2><p>O método e o prazo de disponibilização dependem da descrição do produto e da confirmação do pagamento. Alguns itens podem exigir processamento manual, integração externa ou dados adicionais. Acompanhe o status em “Pedidos” e entre em contato se a entrega não ocorrer conforme informado.</p><p>Não compartilhe publicamente códigos, chaves ou conteúdos digitais entregues à sua conta. O uso deve respeitar as condições apresentadas no anúncio e os direitos de terceiros.</p></section><section id="term-cupom"><h2>5. Cupons, pontos, carteira e afiliados</h2><p>Cupons, recompensas, pontos, saldo promocional e benefícios de afiliados estão sujeitos às condições, validade, elegibilidade e limites informados no momento da oferta. A solicitação de um benefício não significa aprovação automática.</p><p>É proibido explorar falhas, criar contas para manipular campanhas, realizar autoindicações ou divulgar links por spam. Comissões e pagamentos a afiliados dependem de regras do programa e da confirmação válida das transações.</p></section><section id="term-conduta"><h2>6. Uso permitido</h2><p>Não é permitido tentar acessar contas alheias, contornar controles de segurança, interferir no funcionamento do site, enviar conteúdo malicioso ou utilizar a loja para fraude. O uso indevido pode levar à suspensão de funcionalidades e à análise dos pedidos relacionados, sem afastar os direitos garantidos por lei.</p></section><section id="term-cancelamento"><h2>7. Cancelamento, reembolso e suporte</h2><p>Pedidos de cancelamento, reembolso, correção ou análise devem ser encaminhados pela Central de atendimento, com o identificador do pedido e uma descrição objetiva. Cada caso será analisado conforme o status da operação, as condições informadas e a legislação aplicável, inclusive normas de proteção do consumidor quando cabíveis.</p><p>Nenhuma cláusula destes termos pretende excluir direitos obrigatórios do consumidor. Se houver divergência, prevalecem as normas legais aplicáveis.</p></section><section id="term-privacidade"><h2>8. Privacidade</h2><p>O tratamento de dados é descrito na <a href="#" onclick="window.navigate('privacy');return false">Política de privacidade</a>. Ao utilizar recursos da loja, você deve evitar inserir dados pessoais desnecessários em campos públicos ou observações.</p></section><section id="term-alteracoes"><h2>9. Alterações e contato</h2><p>Os termos podem ser atualizados quando os recursos ou exigências aplicáveis mudarem. A versão vigente será disponibilizada nesta página. Para dúvidas, utilize a <a href="#" onclick="window.navigate('support');return false">Central de atendimento</a>.</p></section></div>` }
  };
  const data = pages[page] || pages.about;
  appEl().innerHTML = `<section class="page-hero"><div class="eyebrow">GBZIN SHOP / CENTRAL</div><h1>${data.title}</h1><p>${data.intro}</p></section><section class="info-page">${data.body}</section><div class="page-cta"><div><h3>Precisa de ajuda?</h3><p class="muted">Nossa central reúne orientações e acesso ao suporte.</p></div><button class="btn btn-primary" onclick="window.navigate('support')">Ir para o suporte</button></div>`;
}

async function renderTracking() {
  if (!state.user) { appEl().innerHTML = `<div class="empty-state"><h2>Consulte seus pedidos</h2><p>Entre na sua conta para visualizar compras e status.</p><button class="btn btn-primary mt-4" onclick="window.navigate('login')">Entrar</button></div>`; return; }
  appEl().innerHTML = `<section class="page-hero"><div class="eyebrow">ÁREA DO CLIENTE</div><h1>Meus pedidos</h1><p>Consulte o andamento das suas compras.</p></section><div class="card loading-card">Carregando seus pedidos…</div>`;
  try {
    const orders = await store.getMyOrders(state.user.uid);
    if (state.route !== 'tracking') return;
    const labels = {pending:'Aguardando Pix',paid:'Pagamento confirmado',shipped:'Enviado / disponibilizado',completed:'Concluído',canceled:'Cancelado',payment_rejected:'Pagamento recusado',payment_expired:'Cobrança expirada',refunded:'Reembolsado',charged_back:'Pagamento contestado',payment_review:'Pagamento em análise',payment_error:'Erro ao gerar pagamento'};
    appEl().innerHTML = `<section class="page-hero"><div class="eyebrow">ÁREA DO CLIENTE</div><h1>Meus pedidos</h1><p>Consulte o andamento das suas compras.</p></section>${orders.length ? `<div class="orders-list">${orders.map(o=>`<article class="order-card"><div><span class="order-id">Pedido #${escapeHtml(o.id.slice(0,8).toUpperCase())}</span><h3>${brl(o.total||0)}</h3><p class="muted">${o.createdAt?.toDate?o.createdAt.toDate().toLocaleString('pt-BR'):'Data em processamento'}</p></div><span class="status-pill status-${escapeHtml(o.status||'pending')}">${labels[o.status]||'Em análise'}</span><div class="order-items">${(o.items||[]).map(i=>`${escapeHtml(i.name||'Produto')} × ${Number(i.qty)||1}`).join(' · ')}</div>${o.status === 'paid' && Array.isArray(o.deliveries) && o.deliveries.length ? `<section style="margin-top:16px;padding:14px;border-radius:10px;background:var(--bg-elev)"><h4 style="margin-bottom:10px">Seus produtos digitais</h4>${o.deliveries.map((d, di)=>d.type==='digital'?`<div style="margin-bottom:12px"><strong>${escapeHtml(d.productName||'Produto')}</strong><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:var(--bg);border-radius:8px;margin-top:6px">${escapeHtml(d.content||'')}</pre><button class="btn btn-outline copy-delivery" type="button" data-copy-delivery="${di}" data-delivery-content="${escapeHtml(d.content||'')}">Copiar conteúdo</button></div>`:`<div style="margin-bottom:10px"><strong>${escapeHtml(d.planName||d.productName||'VIP')}</strong><p class="muted">Benefício VIP ativado por ${Number(d.durationDays)||0} dias. A integração com o servidor do jogo pode ser necessária para aplicar as permissões.</p></div>`).join('')}</section>` : ''}${o.status === 'paid' && o.fulfillmentStatus === 'manual_delivery' ? `<p class="muted" style="margin-top:12px">Pagamento aprovado. A equipe finalizará a entrega deste item.</p>` : ''}</article>`).join('')}</div>` : `<div class="empty-state"><h3>Você ainda não tem pedidos</h3><p>Quando fizer uma compra, ela aparecerá aqui.</p><button class="btn btn-primary mt-4" onclick="window.navigate('home')">Explorar loja</button></div>`}`;
    appEl().querySelectorAll('.copy-delivery').forEach(button => button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(button.dataset.deliveryContent || ''); toast('Conteúdo copiado.', 'success'); } catch { toast('Não foi possível copiar automaticamente.', 'error'); } }));
  } catch (e) { console.error(e); appEl().innerHTML = `<div class="empty-state"><h3>Não foi possível carregar seus pedidos</h3><p>Verifique sua conexão e as regras do Firestore.</p><button class="btn btn-outline mt-4" onclick="window.navigate('tracking')">Tentar novamente</button></div>`; }
}

function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id && x.active !== false);
  if (!p) return navigate('home');
  appEl().innerHTML = `<div class="card flex gap-6 flex-wrap" style="max-width:900px;margin:0 auto;padding:clamp(18px,4vw,32px)"><div style="flex:1;min-width:240px">${p.image ? `<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;border-radius:12px;object-fit:cover">` : '<div class="empty-state"></div>'}</div><div style="flex:1;min-width:240px"><button class="btn btn-outline mb-4" onclick="window.navigate('home')">← Voltar à loja</button><h2>${escapeHtml(p.name)}</h2><p class="muted mt-2">${escapeHtml(p.category || 'Geral')}</p><h3 class="mt-4" style="color:var(--primary)">${brl(p.promoPrice > 0 ? p.promoPrice : p.price)}</h3><p class="mt-4">${escapeHtml(p.description || 'Sem descrição disponível.').replace(/\\n/g,'<br>')}</p><p class="muted mt-4">${Number(p.stock)>0 ? `${Number(p.stock)} em estoque` : 'Produto esgotado'}</p><button class="btn btn-primary mt-6" onclick="window.addCart('${p.id}')" style="width:100%" ${Number(p.stock)<=0?'disabled':''}>${Number(p.stock)<=0?'Esgotado':'Adicionar ao carrinho'}</button></div></div>`;
}

function renderLogin() {
  appEl().innerHTML = `<div class="card card-wide auth-card" style="max-width:420px"><h2 class="text-center mb-2">Entrar</h2><p class="muted text-center mb-6">Acesse sua conta Gbzin Shop.</p><button class="btn btn-google mt-2" id="googleLogin" type="button"><span class="google-g" aria-hidden="true">G</span> Continuar com Google</button><div class="auth-divider"><span>ou entre com e-mail</span></div><form id="form"><div class="form-group"><label>E-mail</label><input type="email" id="email" autocomplete="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" autocomplete="current-password" required></div><button class="btn btn-primary mt-4" style="width:100%" type="submit">Entrar</button></form><p class="muted text-center mt-4"><a href="#" onclick="window.navigate('register');return false">Criar conta</a></p></div>`;
  $('#googleLogin')?.addEventListener('click', async () => {
    const btn=$('#googleLogin'); btn.disabled=true; btn.textContent='Conectando ao Google…';
    try { const provider=new GoogleAuthProvider(); provider.addScope('email'); provider.addScope('profile'); provider.setCustomParameters({prompt:'select_account'}); await signInWithPopup(auth,provider); toast('Login com Google realizado!','success'); navigate('home'); }
    catch(err) { console.error('[Google Auth]',err); const messages={'auth/popup-closed-by-user':'A janela de login foi fechada.','auth/unauthorized-domain':'Este domínio ainda não está autorizado no Firebase Authentication.','auth/account-exists-with-different-credential':'Este e-mail já usa outro método de login. Entre com ele primeiro.','auth/popup-blocked':'O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.'}; toast(messages[err.code] || 'Não foi possível entrar com Google. Confira a configuração do provedor no Firebase.', 'error'); }
    finally { btn.disabled=false; btn.innerHTML='<span class="google-g" aria-hidden="true">G</span> Continuar com Google'; }
  });
  $('#form').onsubmit = async (e) => {
    e.preventDefault(); const form=$('#form'); const submit=form.querySelector('button[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='Entrando…';}
    try { await signInWithEmailAndPassword(auth,$('#email').value.trim(),$('#pass').value); toast('Login realizado com sucesso!','success'); navigate('home'); }
    catch(err) { const messages={'auth/invalid-credential':'E-mail ou senha incorretos.','auth/invalid-email':'Digite um e-mail válido.','auth/too-many-requests':'Muitas tentativas. Aguarde um pouco e tente novamente.','auth/network-request-failed':'Falha de conexão. Verifique sua internet e tente novamente.'}; toast(messages[err.code] || 'Não foi possível entrar. Confira seus dados e tente novamente.','error'); }
    finally { if(submit&&submit.isConnected){submit.disabled=false;submit.textContent='Entrar';} }
  };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card card-wide" style="max-width: 400px;"><h2 class="text-center mb-6">Criar Conta</h2><form id="form"><div class="form-group"><label>Nome</label><input type="text" id="name" required></div><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required minlength="6"></div><button class="btn btn-primary mt-4" style="width:100%">Cadastrar</button></form></div>`;
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const form = $('#form');
    const submit = form.querySelector('button[type="submit"], button:not([type])');
    const name = $('#name').value.trim();
    const email = $('#email').value.trim().toLowerCase();
    const password = $('#pass').value;
    if (name.length < 2 || name.length > 120) return toast('Informe um nome entre 2 e 120 caracteres.', 'error');
    if (password.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'error');
    if (submit) { submit.disabled = true; submit.textContent = 'Criando conta…'; }
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      let profileSaved = true;
      try {
        await store.saveCustomerProfile(credential.user, { name });
      } catch (profileError) {
        profileSaved = false;
        console.error('[Cadastro] Conta criada, mas o perfil não foi salvo no Firestore:', profileError.code || profileError.message);
      }
      if (!profileSaved) {
        toast('Conta criada e login realizado. O perfil não foi salvo por uma regra do Firestore; algumas funções podem ficar limitadas.', 'error');
      } else {
        toast('Conta criada com sucesso! Você já pode usar a loja.', 'success');
      }
      navigate('home');
    } catch (err) {
      console.error('[Cadastro]', err.code || err.name, err.message);
      const messages = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado. Entre na sua conta ou recupere a senha.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/weak-password': 'Escolha uma senha com pelo menos 6 caracteres.',
        'auth/network-request-failed': 'Falha de conexão. Verifique sua internet e tente novamente.',
        'permission-denied': 'A conta foi autenticada, mas o perfil foi bloqueado pelas regras do Firestore. Publique firestore.rules e confira se o projeto Firebase é o correto.',
        'firestore/permission-denied': 'O Firestore recusou a criação do perfil. Publique as regras atualizadas no projeto Firebase correto.'
      };
      if (err.code === 'auth/email-already-in-use') {
        navigate('login');
        const loginEmail = $('#email');
        if (loginEmail) { loginEmail.value = email; loginEmail.focus(); }
        toast('Este e-mail já tem uma conta. Entre com sua senha ou use “Esqueci minha senha”.', 'info');
      } else {
        toast(messages[err.code] || (err.code && err.code.includes('permission-denied') ? 'Permissão negada ao criar o perfil. Confira as regras do Firestore publicadas.' : 'Não foi possível concluir o cadastro. Confira seus dados e tente novamente.'), 'error');
      }
    } finally {
      if (submit && submit.isConnected) { submit.disabled = false; submit.textContent = 'Cadastrar'; }
    }
  };
}

function renderCart() { return renderCartPage(state); }

/* =====================================================================
   CHECKOUT COM CUPOM E QR CODE PIX
   ===================================================================== */
async function renderCheckout() {
  if (!state.user) return navigate('login');
  const cartEntries = Object.entries(state.cart);
  if (!cartEntries.length) { toast('Seu carrinho está vazio.', 'error'); return navigate('cart'); }
  const items = cartEntries.map(([pid, i]) => {
    const p = state.products.find(x => x.id === pid);
    if (!p || p.active === false) return null;
    return { productId: pid, name: p.name, image: p.image || '', price: Number(p.promoPrice) > 0 ? Number(p.promoPrice) : Number(p.price), qty: Number(i.qty) };
  });
  if (items.some(item => !item) || items.some(item => !Number.isInteger(item.qty) || item.qty < 1)) {
    toast('Um produto do carrinho não está mais disponível. Atualize seu carrinho.', 'error'); return navigate('cart');
  }
  const subtotal = items.reduce((acc, item) => acc + item.price * item.qty, 0);
  let couponCode = '';
  let previewDiscount = 0;
  const money = (v) => brl(Number(v) || 0);

  appEl().innerHTML = `
    <div class="card card-wide" style="max-width:900px;margin:auto">
      <h2 class="mb-4">Finalizar compra</h2>
      <div style="display:grid;gap:12px;margin-bottom:24px">
        ${items.map(item => `<div class="flex-between gap-3" style="padding:12px 0;border-bottom:1px solid var(--border)"><div style="display:flex;gap:12px;align-items:center;min-width:0">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">` : ''}<div><strong>${escapeHtml(item.name)}</strong><div class="muted">Quantidade: ${item.qty}</div></div></div><strong>${money(item.price * item.qty)}</strong></div>`).join('')}
      </div>
      <section style="background:var(--bg-elev);padding:16px;border-radius:12px;margin-bottom:20px">
        <label for="couponInput" style="font-weight:600;display:block;margin-bottom:8px">Cupom de desconto</label>
        <div class="flex gap-2"><input type="text" id="couponInput" placeholder="Código do cupom" autocomplete="off" style="flex:1;min-width:0;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);text-transform:uppercase"><button class="btn btn-outline" id="btnApplyCoupon" type="button">Aplicar</button></div>
        <p id="couponMsg" class="muted" style="margin-top:8px;display:none"></p>
      </section>
      <div class="flex-between mb-2"><span class="muted">Subtotal</span><span>${money(subtotal)}</span></div>
      <div id="discountRow" class="flex-between mb-2" style="display:none;color:var(--success)"><span>Desconto estimado</span><span id="discountValue">-R$ 0,00</span></div>
      <div class="flex-between items-center" style="padding-top:12px;border-top:1px solid var(--border)"><strong>Total estimado</strong><h3 id="finalTotal" style="font-size:1.6rem;color:var(--primary)">${money(subtotal)}</h3></div>
      <p class="muted" style="font-size:.85rem;margin-top:8px">O QR Code é gerado a partir do código Pix configurado e do total estimado. A loja não cria uma cobrança nem confirma pagamentos automaticamente.</p>
      <button class="btn btn-primary" id="btnFinish" style="width:100%;padding:14px;margin-top:20px">Gerar QR Code com este valor</button>
      <section id="pixPaymentPanel" style="display:none;background:var(--bg-elev-2);padding:22px;border-radius:12px;margin-top:24px;text-align:center">
        <h3 style="color:var(--primary);margin-bottom:6px">Pagamento via Pix</h3>
        <p id="pixOrderLabel" class="muted" style="font-size:.82rem;overflow-wrap:anywhere">Pix para Gbin Groups</p>
        <p id="pixPaymentAmount" style="font-size:1.8rem;font-weight:800;margin:8px 0 16px"></p>
        <div id="pixGatewayQr" style="display:inline-block;background:#fff;padding:12px;border-radius:10px;max-width:100%"></div>
        <p id="pixPaymentStatus" role="status" style="font-weight:700;margin:16px 0;color:var(--warning)">O pagamento não é verificado automaticamente pela loja.</p>
        <label for="pixCopyPaste" style="display:block;text-align:left;margin-top:16px">Pix Copia e Cola</label>
        <div class="flex gap-2 mt-2"><textarea id="pixCopyPaste" readonly rows="4" style="flex:1;min-width:0;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:monospace;font-size:12px;overflow-wrap:anywhere"></textarea><button class="btn btn-outline" id="copyPixPayload" type="button">Copiar</button></div>
        <p class="muted" style="font-size:.85rem;margin-top:14px">Confira o valor no aplicativo do banco antes de confirmar a transferência.</p><button class="btn btn-primary" id="btnAlreadyPaid" type="button" style="width:100%;margin-top:14px">Já paguei — enviar para análise</button><p class="muted" id="paidRequestHint" style="font-size:.82rem;margin-top:8px">A equipe verificará o pagamento antes de aprovar o pedido.</p>
      </section>
    </div>`;

  const el = (id) => document.getElementById(id);
  const showCouponMessage = (text, success) => { const node = el('couponMsg'); node.textContent = text; node.style.display = 'block'; node.style.color = success ? 'var(--success)' : 'var(--danger)'; };
  el('btnApplyCoupon').onclick = async () => {
    const code = el('couponInput').value.trim().toUpperCase();
    if (!code) { couponCode = ''; previewDiscount = 0; showCouponMessage('Digite um código de cupom.', false); }
    else {
      const coupon = await store.validateCoupon(code);
      if (coupon && coupon.active === true && Number(coupon.discount) > 0) {
        couponCode = code;
        previewDiscount = coupon.type === 'percent' ? subtotal * Math.min(Number(coupon.discount), 100) / 100 : Math.min(subtotal, Number(coupon.discount));
        showCouponMessage(`Cupom ${code} aplicado. A equipe precisa confirmar o desconto antes de aprovar o pedido.`, true);
      } else { couponCode = ''; previewDiscount = 0; showCouponMessage('Cupom inválido ou expirado.', false); }
    }
    el('discountRow').style.display = previewDiscount > 0 ? 'flex' : 'none';
    el('discountValue').textContent = `-${money(previewDiscount)}`;
    el('finalTotal').textContent = money(Math.max(0, subtotal - previewDiscount));
    if (el('pixPaymentPanel').style.display === 'block') createPayment();
  };

  const renderPayment = (payload, total) => {
    el('pixPaymentPanel').style.display = 'block';
    el('pixOrderLabel').textContent = 'Pix para Gbin Groups · valor preenchido no QR Code';
    el('pixPaymentAmount').textContent = money(total);
    el('pixCopyPaste').value = payload;
    const qr = el('pixGatewayQr');
    qr.textContent = '';
    const img = document.createElement('img');
    img.alt = 'QR Code Pix com valor preenchido';
    img.width = 280;
    img.height = 280;
    img.style.cssText = 'display:block;width:280px;max-width:100%;height:auto';
    img.referrerPolicy = 'no-referrer';
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(payload)}`;
    img.onerror = () => {
      qr.textContent = 'Não foi possível carregar a imagem do QR Code. Use o código Pix Copia e Cola abaixo.';
    };
    qr.appendChild(img);
    el('pixPaymentStatus').textContent = 'Após transferir, informe a confirmação para a equipe analisar seu pedido.';
    el('btnFinish').disabled = false;
    el('btnFinish').textContent = 'Atualizar QR Code com este valor';
  };

  const createPayment = () => {
    const btn = el('btnFinish');
    try {
      const total = Math.round((subtotal - previewDiscount) * 100) / 100;
      if (!Number.isFinite(total) || total <= 0) throw new Error('O total precisa ser maior que R$ 0,00.');
      const payload = buildPixPayload(DEFAULT_PIX_PAYLOAD, total);
      renderPayment(payload, total);
      toast('QR Code Pix atualizado com o valor do pedido.', 'success');
    } catch (err) {
      console.error('Falha ao gerar QR Code Pix:', err);
      toast(err.message || 'Não foi possível gerar o QR Code Pix.', 'error');
    } finally {
      btn.disabled = false;
    }
  };
  el('btnFinish').onclick = createPayment;
  el('copyPixPayload').onclick = async () => {
    const value = el('pixCopyPaste').value;
    if (!value) return toast('Código Pix ainda não disponível.', 'error');
    try { await navigator.clipboard.writeText(value); toast('Pix copia e cola copiado.', 'success'); }
    catch { el('pixCopyPaste').select(); toast('Selecione e copie o código Pix.', 'info'); }
  };
  el('btnAlreadyPaid').onclick = async () => {
    const button = el('btnAlreadyPaid');
    if (!state.user) return navigate('login');
    const total = Math.round((subtotal - previewDiscount) * 100) / 100;
    if (!Number.isFinite(total) || total <= 0) return toast('O valor do pedido é inválido.', 'error');
    button.disabled = true; button.textContent = 'Enviando solicitação...';
    try {
      const ref = await addDoc(collection(firestore, 'systemRequests'), {
        userId: state.user.uid, kind: 'order_payment_review', title: 'Cliente informou pagamento Pix',
        amount: total, items: items.map(i => ({ productId: String(i.productId || i.id || ''), name: String(i.name || 'Produto').slice(0,120), qty: Math.max(1, Number(i.qty || 1)), price: Number(i.price || 0) })), couponCode: couponCode || '', referralCode: window.getReferralCode?.() || '', note: `Itens: ${items.map(i => `${i.name} x${i.qty}`).join(', ')}${couponCode ? ` | Cupom: ${couponCode}` : ''}${window.getReferralCode?.() ? ` | Indicação: ${window.getReferralCode()}` : ''}`.slice(0, 500),
        status: 'pending', createdAt: serverTimestamp()
      });
      el('pixPaymentStatus').textContent = `Solicitação enviada para análise. Protocolo: ${ref.id.slice(0, 8).toUpperCase()}`;
      el('paidRequestHint').textContent = 'Guarde o protocolo. A equipe precisa conferir o recebimento real do Pix e processar o pedido; este aviso sozinho não cria um pedido nem confirma o pagamento.';
      button.textContent = 'Solicitação enviada';
      toast('Aviso enviado para a equipe administrativa.', 'success');
    } catch (err) {
      console.error('Falha ao enviar confirmação de pagamento:', err);
      toast('Não foi possível enviar. Confira as regras do Firestore e tente novamente.', 'error');
      button.disabled = false; button.textContent = 'Já paguei — enviar para análise';
    }
  };

}

/* ------------------------------ BOOTSTRAP ----------------------------- */
state.unsubSettings = store.listenSettings((s) => { if (s.storeName) state.settings = s; renderHeader(); });
state.unsubMaintenance = store.listenMaintenance((m) => {
  state.maintenance = m;
  if (m && !state.isAdmin) renderMaintenance();
  else if (!m && state.route === 'maintenance') navigate('home');
});

// Cupons exigem autenticação nas regras do Realtime Database.
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    window.currentUserUid = user.uid;
    const adminEmailAllowed = ADMINS.includes(String(user.email || '').trim().toLowerCase());
    // Não exigimos e-mail verificado. O painel é liberado apenas para os
    // endereços administrativos explicitamente autorizados abaixo.
    state.isOwner = adminEmailAllowed;
    state.isAdmin = adminEmailAllowed;
    
    if (state.unsubCart) state.unsubCart();
    state.unsubCart = store.listenCart(user.uid, (c) => { state.cart = c || {}; renderHeader(); if (state.route === 'cart') renderCart(); });

    if (state.unsubFavs) state.unsubFavs();
    state.unsubFavs = store.listenFavorites(user.uid, (f) => { state.favorites = f; if (state.route === 'home') renderHome(); });

    if (state.unsubCoupons) state.unsubCoupons();
    state.unsubCoupons = state.isAdmin ? store.listenCoupons((c) => {
      state.coupons = c;
      if (!state.couponMirrorInitialized) {
        state.couponMirrorInitialized = true;
        Object.values(c).forEach(coupon => {
          if (coupon?.code) store.syncPublicCoupon(coupon.code, coupon).catch(err => console.warn('[Cupons públicos] Sincronização inicial falhou:', err?.code || err?.message));
        });
      }
    }, (err) => {
      console.error('[Cupons admin] A leitura foi recusada pelas regras do Realtime Database.', err?.code || err?.message || err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast('Acesso aos cupons negado. Confira se esta conta está na lista de administradores e publique as regras atualizadas de database.txt no Realtime Database.', 'error');
      }
    }) : null;

    try { await store.saveCustomerProfile(user); } catch (profileError) { console.error('[Perfil do cliente] Não foi possível garantir o perfil:', profileError.code || profileError.message); }
    showStartupToast(user);
  } else {
    window.currentUserUid = null;
    state.isAdmin = false; state.cart = {}; state.favorites = {};
    if (state.unsubCart) state.unsubCart();
    if (state.unsubFavs) state.unsubFavs();
    if (state.unsubCoupons) state.unsubCoupons();
    state.coupons = {};
    renderHeader();
  }

  // Depois de autenticar, não mantenha o usuário preso na tela de login/cadastro.
  // O callback do Firebase pode disparar antes ou depois do handler do formulário.
  if (user && (state.route === 'login' || state.route === 'register')) {
    state.route = 'home';
    state.params = {};
  }

  if (state.maintenance && !state.isAdmin && state.route !== 'login') renderMaintenance();
  else if (state.route === 'home') renderHome(); else navigate(state.route, state.params);
});

if (!state.unsubPublicCoupons) {
  state.unsubPublicCoupons = store.listenPublicCoupons((coupons) => {
    state.publicCoupons = coupons;
    if (state.route === 'promotions') renderInfoPage('promotions');
    if (state.route === 'account' || state.route === 'favorites') renderAccount(state);
  }, () => { state.publicCoupons = {}; });
}

if (state.unsubProducts) state.unsubProducts = null;
state.unsubProducts = store.listenProducts((list) => {
  state.products = list;
  if (state.route === 'home') renderHome();
});

document.getElementById('year').textContent = new Date().getFullYear();
navigate('home');