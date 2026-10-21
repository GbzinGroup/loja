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
import { $, appEl, headerEl, brl, escapeHtml, toast, formatDate } from './utils.js';

// Importação dos módulos
import { renderAdmin } from './admin.js';
import { renderSupport } from './support.js';
import { renderProductForm } from './productForm.js';
import { renderAccount } from './account.js';

// Importação do gerador de QR Code (CDN)
import { toDataURL } from 'https://esm.sh/qrcode@1.5.3';

// LISTA DE ADMINS
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
  maintenance: false, profileTab: 'data', coupons: {}, 
  unsubCart: null, unsubProducts: null, unsubSettings: null, unsubFavs: null, unsubMaintenance: null
};

/* ------------------------------ HEADER -------------------------------- */
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
      <nav class="main-nav" aria-label="Navegação principal">
        <button onclick="window.navigate('home')">Loja</button>
        <button onclick="window.navigate('new')">Novidades</button>
        <button onclick="window.navigate('tracking')">Meus pedidos</button>
        <button onclick="window.navigate('faq')">Ajuda</button>
      </nav>
      <div class="header-actions">
        <button class="btn btn-icon btn-outline" onclick="window.navigate('support')" title="Suporte">🎧</button>
        <button class="btn btn-icon btn-outline" onclick="window.navigate('favorites')" title="Favoritos">❤️</button>
        <button class="btn btn-icon btn-outline" onclick="window.navigate('cart')" title="Carrinho">🛒${count > 0 ? `<span class="badge">${count}</span>` : ''}</button>
        ${account}
      </div>
    </div>`;
}

/* ------------------------------ NAVEGAÇÃO ----------------------------- */
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
    case 'favorites': state.profileTab = 'favorites'; return renderAccount(state);
    case 'support': return renderSupport();
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
    case 'new': return renderInfoPage('new');
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

window.addCart = async (pid) => {
  if (!state.user) return navigate('login');
  const product = state.products.find(p => p.id === pid && p.active !== false);
  if (!product) return toast('Este produto não está disponível.', 'error');
  const itemRef = state.cart[pid];
  const nextQty = (Number(itemRef?.qty) || 0) + 1;
  if (nextQty > Number(product.stock || 0)) return toast('Quantidade maior que o estoque disponível.', 'error');
  try {
    await store.updateCart(state.user.uid, { ...state.cart, [pid]: { qty: nextQty } });
    toast('Adicionado ao carrinho!', 'success');
  } catch (e) { console.error(e); toast('Não foi possível atualizar o carrinho.', 'error'); }
};

window.updateCartQty = async (pid, qty) => {
  if (!state.user) return navigate('login');
  const product = state.products.find(p => p.id === pid);
  const newCart = { ...state.cart };
  if (qty <= 0) delete newCart[pid];
  else {
    if (!product || qty > Number(product.stock || 0)) return toast('Quantidade indisponível no estoque.', 'error');
    newCart[pid] = { qty: Math.floor(Number(qty)) };
  }
  try { await store.updateCart(state.user.uid, newCart); }
  catch (e) { console.error(e); toast('Não foi possível atualizar o carrinho.', 'error'); }
};

/* ------------------------------ TELAS BÁSICAS ------------------------- */
function renderMaintenance() {
  headerEl().innerHTML = '';
  appEl().innerHTML = `<div class="empty-state" style="height: 70vh;"><h1 style="font-size: 3rem; margin-bottom: 16px;">🚧</h1><h2>Estamos em Manutenção</h2><p>Voltamos em breve.</p><button class="btn btn-primary mt-6" onclick="window.navigate('login')">Fazer Login</button></div>`;
}

function renderHome() {
  const list = state.products.filter(p => p.active !== false);
  const renderCard = (p, isFav) => `
    <article class="product-card">
      <div class="thumb" role="button" tabindex="0" aria-label="Ver ${escapeHtml(p.name)}" onclick="window.navigate('product-details', {id: '${p.id}'})" onkeydown="if(event.key==='Enter')window.navigate('product-details',{id:'${p.id}'})">
        ${p.image ? `<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'"/>` : `<div class="placeholder">🛍️</div>`}
      </div>
      <button class="fav-btn" aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" onclick="window.toggleFav('${p.id}', ${Boolean(isFav)})">${isFav ? '❤️' : '🤍'}</button>
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
    about: { title: 'Sobre a Gbzin Shop', intro: 'Uma experiência de compra digital simples, transparente e pensada para a comunidade.', body: `<div class="feature-grid"><article class="feature-card"><span>⚡</span><h3>Compra simples</h3><p>Encontre o que procura com busca, categorias e detalhes claros.</p></article><article class="feature-card"><span>🔒</span><h3>Conta pessoal</h3><p>Acompanhe seus pedidos e mantenha suas informações em um só lugar.</p></article><article class="feature-card"><span>💬</span><h3>Suporte</h3><p>Precisa de ajuda? Acesse nossa central de atendimento.</p></article></div>` },
    new: { title: 'Novidades e destaques', intro: 'Confira os itens disponíveis e descubra o que chegou recentemente.', body: `<div class="product-grid">${state.products.filter(p=>p.active!==false).slice(0,8).map(p=>`<article class="product-card"><div class="thumb" onclick="window.navigate('product-details',{id:'${p.id}'})">${p.image?`<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`:'<div class="placeholder">✦</div>'}</div><div class="info"><div class="category">${escapeHtml(p.category||'Destaque')}</div><div class="name">${escapeHtml(p.name||'Produto')}</div><div class="price">${brl(Number(p.promoPrice)>0?p.promoPrice:p.price)}</div></div><div class="actions"><button class="btn btn-primary" onclick="window.navigate('product-details',{id:'${p.id}'})">Ver produto</button></div></article>`).join('')}</div>` },
    faq: { title: 'Perguntas frequentes', intro: 'Respostas rápidas para ajudar você a comprar com tranquilidade.', body: `<div class="faq-list"><details><summary>Como faço uma compra?</summary><p>Escolha um produto, adicione ao carrinho, entre na sua conta e siga as etapas de finalização.</p></details><details><summary>Preciso criar uma conta?</summary><p>Sim. A conta permite associar seus pedidos ao seu perfil e consultar o histórico.</p></details><details><summary>Como acompanho meu pedido?</summary><p>Entre na sua conta e abra a área “Meus pedidos” para consultar o status disponível.</p></details><details><summary>Tenho um problema com a compra. O que faço?</summary><p>Abra a Central de suporte e descreva o ocorrido com o máximo de detalhes, sem compartilhar sua senha.</p></details><details><summary>Os produtos aparecem esgotados?</summary><p>O catálogo mostra a disponibilidade registrada pela loja. Se houver divergência, entre em contato com o suporte.</p></details></div>` },
    contact: { title: 'Central de contato', intro: 'Fale com a equipe da Gbzin Shop.', body: `<div class="card contact-card"><h3>Como podemos ajudar?</h3><p class="muted">Informe sua dúvida, o número do pedido (se houver) e o e-mail da sua conta. Nunca envie senhas ou códigos de autenticação.</p><button class="btn btn-primary mt-4" onclick="window.navigate('support')">Abrir suporte</button><button class="btn btn-outline mt-4" onclick="window.navigate('account')">Ver minha conta</button></div>` },
    shipping: { title: 'Entrega e disponibilização', intro: 'Informações sobre o acesso aos produtos comprados.', body: `<div class="policy-content"><h3>Produtos digitais</h3><p>A forma e o prazo de disponibilização dependem do produto e da confirmação do pedido. Consulte a descrição do item e o status na sua conta.</p><h3>Problemas de acesso</h3><p>Se o produto não estiver disponível após a confirmação, entre em contato com o suporte e informe o número do pedido.</p><h3>Disponibilidade</h3><p>O catálogo pode mudar conforme estoque e disponibilidade. A confirmação final depende da validação do pedido.</p></div>` },
    privacy: { title: 'Política de privacidade', intro: 'Como os dados são utilizados nesta experiência de loja.', body: `<div class="policy-content"><h3>Dados da conta</h3><p>Os dados fornecidos são utilizados para autenticação, atendimento e associação de pedidos à conta.</p><h3>Armazenamento</h3><p>A loja utiliza serviços Firebase para autenticação e armazenamento. Configure as regras de segurança e permissões do projeto antes de operar em produção.</p><h3>Segurança</h3><p>Não compartilhe senhas, códigos de acesso ou informações de pagamento em mensagens de suporte.</p><h3>Solicitações</h3><p>Para dúvidas ou solicitações sobre seus dados, utilize a Central de suporte.</p></div>` },
    terms: { title: 'Termos de uso', intro: 'Regras gerais para utilizar a Gbzin Shop.', body: `<div class="policy-content"><h3>Uso da plataforma</h3><p>Utilize a loja de forma lícita e forneça informações corretas ao realizar pedidos.</p><h3>Pedidos e pagamentos</h3><p>Um pedido pode permanecer pendente até a confirmação. A criação do pedido, por si só, não comprova pagamento.</p><h3>Disponibilidade e preços</h3><p>Produtos, preços e estoque podem ser atualizados. A confirmação depende da validação da loja.</p><h3>Suporte</h3><p>Em caso de dúvida, contate a equipe antes de repetir uma compra.</p></div>` }
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
    const labels = {pending:'Aguardando confirmação',paid:'Pagamento confirmado',shipped:'Enviado / disponibilizado',completed:'Concluído',canceled:'Cancelado'};
    appEl().innerHTML = `<section class="page-hero"><div class="eyebrow">ÁREA DO CLIENTE</div><h1>Meus pedidos</h1><p>Consulte o andamento das suas compras.</p></section>${orders.length ? `<div class="orders-list">${orders.map(o=>`<article class="order-card"><div><span class="order-id">Pedido #${escapeHtml(o.id.slice(0,8).toUpperCase())}</span><h3>${brl(o.total||0)}</h3><p class="muted">${o.createdAt?.toDate?o.createdAt.toDate().toLocaleString('pt-BR'):'Data em processamento'}</p></div><span class="status-pill status-${escapeHtml(o.status||'pending')}">${labels[o.status]||'Em análise'}</span><div class="order-items">${(o.items||[]).map(i=>`${escapeHtml(i.name||'Produto')} × ${Number(i.qty)||1}`).join(' · ')}</div></article>`).join('')}</div>` : `<div class="empty-state"><h3>Você ainda não tem pedidos</h3><p>Quando fizer uma compra, ela aparecerá aqui.</p><button class="btn btn-primary mt-4" onclick="window.navigate('home')">Explorar loja</button></div>`}`;
  } catch (e) { console.error(e); appEl().innerHTML = `<div class="empty-state"><h3>Não foi possível carregar seus pedidos</h3><p>Verifique sua conexão e as regras do Firestore.</p><button class="btn btn-outline mt-4" onclick="window.navigate('tracking')">Tentar novamente</button></div>`; }
}

function renderProductDetails(id) {
  const p = state.products.find(x => x.id === id && x.active !== false);
  if (!p) return navigate('home');
  appEl().innerHTML = `<div class="card flex gap-6 flex-wrap" style="max-width:900px;margin:0 auto;padding:clamp(18px,4vw,32px)"><div style="flex:1;min-width:240px">${p.image ? `<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;border-radius:12px;object-fit:cover">` : '<div class="empty-state">🛍️</div>'}</div><div style="flex:1;min-width:240px"><button class="btn btn-outline mb-4" onclick="window.navigate('home')">← Voltar à loja</button><h2>${escapeHtml(p.name)}</h2><p class="muted mt-2">${escapeHtml(p.category || 'Geral')}</p><h3 class="mt-4" style="color:var(--primary)">${brl(p.promoPrice > 0 ? p.promoPrice : p.price)}</h3><p class="mt-4">${escapeHtml(p.description || 'Sem descrição disponível.').replace(/\\n/g,'<br>')}</p><p class="muted mt-4">${Number(p.stock)>0 ? `${Number(p.stock)} em estoque` : 'Produto esgotado'}</p><button class="btn btn-primary mt-6" onclick="window.addCart('${p.id}')" style="width:100%" ${Number(p.stock)<=0?'disabled':''}>${Number(p.stock)<=0?'Esgotado':'Adicionar ao carrinho'}</button></div></div>`;
}

function renderLogin() {
  appEl().innerHTML = `<div class="card card-wide" style="max-width: 400px;"><h2 class="text-center mb-6">Entrar</h2><form id="form"><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required></div><button class="btn btn-primary mt-4" style="width:100%">Entrar</button></form><p class="muted text-center mt-4"><a href="#" onclick="window.navigate('register')">Cadastre-se</a></p></div>`;
  $('#form').onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, $('#email').value, $('#pass').value); } catch (err) { toast(err.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.' : (err.message || 'Ocorreu um erro.'), 'error'); } };
}

function renderRegister() {
  appEl().innerHTML = `<div class="card card-wide" style="max-width: 400px;"><h2 class="text-center mb-6">Criar Conta</h2><form id="form"><div class="form-group"><label>Nome</label><input type="text" id="name" required></div><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required minlength="6"></div><button class="btn btn-primary mt-4" style="width:100%">Cadastrar</button></form></div>`;
  $('#form').onsubmit = async (e) => { e.preventDefault(); try { const c = await createUserWithEmailAndPassword(auth, $('#email').value, $('#pass').value); await store.saveCustomerProfile(c.user, {name: $('#name').value}); toast('Conta criada!', 'success'); navigate('home'); } catch (err) { toast(err.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.' : (err.message || 'Ocorreu um erro.'), 'error'); } };
}

function renderCart() {
  if (!state.user) return navigate('login');
  const items = Object.entries(state.cart);
  if (!items.length) return appEl().innerHTML = `<div class="empty-state"><h3>Carrinho vazio</h3><button class="btn btn-outline mt-4" onclick="window.navigate('home')">Voltar</button></div>`;
  let total = 0;
  const html = items.map(([pid, i]) => { const p = state.products.find(x => x.id === pid); if (!p) return ''; total += (p.promoPrice || p.price) * i.qty; return `<div class="cart-item flex-between"><div><div style="font-weight: 600;">${p.name}</div><div class="muted">${brl(p.promoPrice || p.price)}</div></div><div class="flex items-center gap-2"><button class="btn btn-outline" onclick="window.updateCartQty('${pid}', ${i.qty - 1})">-</button><span>${i.qty}</span><button class="btn btn-outline" onclick="window.updateCartQty('${pid}', ${i.qty + 1})">+</button></div></div>`; }).join('');
  appEl().innerHTML = `<h2 class="section-title">Carrinho</h2>${html}<div class="cart-summary mt-6 flex-between items-center"><h3 style="margin: 0;">Total: ${brl(total)}</h3><button class="btn btn-primary" onclick="window.navigate('checkout')">Continuar</button></div>`;
}

/* =====================================================================
   CHECKOUT COM CUPOM E QR CODE PIX
   ===================================================================== */
async function renderCheckout() {
  if (!state.user) return navigate('login');
  
  const items = Object.entries(state.cart).map(([pid, i]) => { 
    const p = state.products.find(x => x.id === pid); 
    return { productId: pid, name: p.name, price: p.promoPrice || p.price, qty: i.qty }; 
  });
  
  const totalOriginal = items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  const pixKey = state.settings.pixKey || 'a7a8c1e6-5a54-45a1-a186-784fb6aced6c';
  
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
      
      <!-- Pagamento PIX com QR Code -->
      <div style="background: var(--bg-elev-2); padding: 24px; border-radius: 12px; margin-top: 24px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <h3 style="margin: 0; color: var(--primary);">Pagamento via PIX</h3>
        
        <div id="qrcodeContainer" style="background: #fff; padding: 12px; border-radius: 8px;">
          <div id="loadingQR" class="muted">Gerando QR Code...</div>
        </div>
        
        <div class="form-group" style="width: 100%; text-align: center;">
          <label>Ou copie a chave abaixo:</label>
          <div class="flex gap-2 justify-center mt-2">
            <input type="text" value="${pixKey}" readonly style="flex: 1; padding: 10px; border-radius: 8px; border: 1px dashed var(--border-strong); background: var(--bg); color: var(--text); font-family: monospace; text-align: center;">
            <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${pixKey}'); alert('Chave PIX copiada!')">Copiar</button>
          </div>
        </div>
      </div>

      <div class="flex-between items-center mt-8">
        <div>
          <div class="muted" style="font-size: 0.85rem;">Total a Pagar</div>
          <h3 style="font-size: 1.8rem; color: var(--primary);" id="finalTotal">${brl(totalOriginal)}</h3>
        </div>
        <button class="btn btn-primary" id="btnFinish" style="padding: 14px 32px;">Já realizei o Pagamento</button>
      </div>
    </div>`;

  // GERA O QR CODE
  try {
    const qrDataUrl = await toDataURL(pixKey, { width: 200, margin: 1 });
    const qrContainer = document.getElementById('qrcodeContainer');
    if (qrContainer) {
      qrContainer.innerHTML = `<img src="${qrDataUrl}" alt="QR Code PIX" />`;
    }
  } catch (err) {
    console.error("Erro ao gerar QR Code", err);
    const qrContainer = document.getElementById('qrcodeContainer');
    if (qrContainer) qrContainer.innerHTML = `<span class="muted" style="color:var(--danger);">Erro ao gerar QR Code. Use a chave abaixo.</span>`;
  }

  // Ação de Aplicar Cupom
  $('#btnApplyCoupon').onclick = async () => {
    const code = $('#couponInput').value.trim().toUpperCase();
    if (!code) return toast('Digite um cupom.', 'error');
    
    const coupon = await store.validateCoupon(code);
    const msgEl = $('#couponMsg');
    
    if (coupon && coupon.active) {
      if (coupon.type === 'percent') {
        window.checkoutDiscount = totalOriginal * (coupon.discount / 100);
      } else {
        window.checkoutDiscount = Math.min(coupon.discount, totalOriginal);
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
      console.error('Falha ao finalizar pedido:', err);
      toast(err?.message || 'Não foi possível finalizar o pedido. Confira sua conexão e tente novamente.', 'error'); 
      btn.textContent = 'Já realizei o Pagamento'; btn.disabled = false;
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
    state.isOwner = ADMINS.includes(user.email);
    state.isAdmin = ADMINS.includes(user.email);
    
    if (state.unsubCart) state.unsubCart();
    state.unsubCart = store.listenCart(user.uid, (c) => { state.cart = c; renderHeader(); });

    if (state.unsubFavs) state.unsubFavs();
    state.unsubFavs = store.listenFavorites(user.uid, (f) => { state.favorites = f; if (state.route === 'home') renderHome(); });

    if (state.unsubCoupons) state.unsubCoupons();
    state.unsubCoupons = store.listenCoupons((c) => { state.coupons = c; });

    await store.saveCustomerProfile(user);
  } else {
    window.currentUserUid = null;
    state.isAdmin = false; state.cart = {}; state.favorites = {};
    if (state.unsubCart) state.unsubCart();
    if (state.unsubFavs) state.unsubFavs();
    if (state.unsubCoupons) state.unsubCoupons();
    state.coupons = {};
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
