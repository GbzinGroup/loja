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
import { renderVip } from './vip.js';
import { renderProductForm } from './productForm.js';
import { renderAccount } from './account.js';
import { renderSystems } from './systems.js';
import { DEFAULT_PIX_PAYLOAD, buildPixPayload } from './pix.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
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
    if (state.isAdmin) account += `<button class="btn btn-outline" onclick="window.navigate('admin')"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span class="label">Painel</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.navigate('account')"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.5 3.1-5.5 7-5.5s6.4 2 7 5.5"/></svg><span class="label">Conta</span></button>`;
    account += `<button class="btn btn-outline" onclick="window.signOutUser()"><span class="label">Sair</span></button>`;
  } else {
    account = `<button class="btn btn-outline" onclick="window.navigate('login')"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.5 3.1-5.5 7-5.5s6.4 2 7 5.5"/></svg><span class="label">Entrar</span></button>`;
  }

  const count = Object.values(state.cart).reduce((s, i) => s + (i.qty || 0), 0);

  headerEl().innerHTML = `
    <div class="header-inner">
      <div class="logo" onclick="window.navigate('home')">${escapeHtml(state.settings.storeName)}</div>
      <nav class="main-nav" aria-label="Navegação principal">
        <button onclick="window.navigate('home')">Loja</button>
        <button onclick="window.navigate('new')">Novidades</button>
        <button onclick="window.navigate('vip')">Clube VIP</button>
        ${state.user ? `<button onclick="window.navigate('systems')">Benefícios</button>` : ''}
        <button onclick="window.navigate('tracking')">Meus pedidos</button>
        <button onclick="window.navigate('faq')">Ajuda</button>
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
  appEl().innerHTML = `<div class="card card-wide" style="max-width: 400px;"><h2 class="text-center mb-6">Entrar</h2><form id="form"><div class="form-group"><label>E-mail</label><input type="email" id="email" required></div><div class="form-group"><label>Senha</label><input type="password" id="pass" required></div><button class="btn btn-primary mt-4" style="width:100%">Entrar</button></form><p class="muted text-center mt-4"><a href="#" onclick="window.navigate('register')">Cadastre-se</a></p></div>`;
  $('#form').onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, $('#email').value, $('#pass').value); } catch (err) { toast(err.code === 'auth/invalid-credential' ? 'E-mail ou senha incorretos.' : (err.message || 'Ocorreu um erro.'), 'error'); } };
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
      await store.saveCustomerProfile(credential.user, { name });
      toast('Conta criada com sucesso!', 'success');
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
      toast(messages[err.code] || (err.code && err.code.includes('permission-denied') ? 'Permissão negada ao criar o perfil. Confira as regras do Firestore publicadas.' : 'Não foi possível concluir o cadastro. Confira o Console do navegador.'), 'error');
    } finally {
      if (submit && submit.isConnected) { submit.disabled = false; submit.textContent = 'Cadastrar'; }
    }
  };
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
      <p class="muted" style="font-size:.85rem;margin-top:8px">O QR Code abaixo terá o valor preenchido automaticamente. Este modo não confirma pagamentos nem cria cobranças pelo Mercado Pago.</p>
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
        showCouponMessage(`Cupom ${code} aplicado. O desconto final será validado pelo servidor.`, true);
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
        amount: total, note: `Itens: ${items.map(i => `${i.name} x${i.qty}`).join(', ')}${couponCode ? ` | Cupom: ${couponCode}` : ''}`.slice(0, 500),
        status: 'pending', createdAt: serverTimestamp()
      });
      el('pixPaymentStatus').textContent = `Solicitação enviada para análise. Protocolo: ${ref.id.slice(0, 8).toUpperCase()}`;
      el('paidRequestHint').textContent = 'Não feche esta tela até guardar o protocolo. O pedido só será aprovado após conferência administrativa.';
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
    state.isOwner = ADMINS.includes(String(user.email || '').toLowerCase());
    state.isAdmin = ADMINS.includes(String(user.email || '').toLowerCase());
    
    if (state.unsubCart) state.unsubCart();
    state.unsubCart = store.listenCart(user.uid, (c) => { state.cart = c; renderHeader(); });

    if (state.unsubFavs) state.unsubFavs();
    state.unsubFavs = store.listenFavorites(user.uid, (f) => { state.favorites = f; if (state.route === 'home') renderHome(); });

    if (state.unsubCoupons) state.unsubCoupons();
    state.unsubCoupons = store.listenCoupons((c) => { state.coupons = c; });

    try { await store.saveCustomerProfile(user); } catch (profileError) { console.error('[Perfil do cliente] Não foi possível garantir o perfil:', profileError.code || profileError.message); }
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
