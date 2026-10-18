/* =====================================================================
   account.js — Painel do Cliente Super Complexo
   ===================================================================== */
import { store } from './store.js';
import { $, appEl, brl, escapeHtml, toast, formatDate } from './utils.js';
import { firestore } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function renderAccount(state) {
  if (!state.user) return window.navigate('login'); 
  
  try {
    const profile = await store.getCustomerProfile(state.user.uid); 
    const myOrders = await store.getMyOrders(state.user.uid);
    const allCoupons = Object.values(state.coupons || {}).filter(c => c.active);
    const tab = state.profileTab || 'data';

    // Cálculos
    const totalPaid = myOrders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
    const totalOrders = myOrders.length;
    const userName = profile?.name || state.user.email.split('@')[0];
    const initial = userName.charAt(0).toUpperCase();

    // ================== ABAS ==================
    let content = '';

    if (tab === 'data') {
      content = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px;">
          <div class="card" style="padding:24px; background:var(--bg-elev);">
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
              <div style="width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg, var(--primary), var(--accent)); color:#fff; display:grid; place-items:center; font-size:1.5rem; font-weight:800;">${initial}</div>
              <div>
                <h3 style="margin-bottom:4px;">${escapeHtml(userName)}</h3>
                <p class="muted" style="font-size:0.85rem;">${state.isAdmin ? 'Administrador' : 'Cliente VIP'}</p>
              </div>
            </div>
            <div class="form-group"><label>Nome de Exibição</label><input type="text" id="editName" value="${escapeHtml(userName)}" /></div>
            <div class="form-group"><label>E-mail</label><input type="text" value="${state.user.email}" disabled /></div>
            <button class="btn btn-primary mt-2" id="btnSaveName" style="width:100%">Salvar Alterações</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card" style="padding:24px; border-left:4px solid var(--success);">
              <div class="muted" style="font-size:0.8rem; text-transform:uppercase;">Total Gasto</div>
              <h2 style="font-size:2rem; color:var(--success); margin-top:8px;">${brl(totalPaid)}</h2>
            </div>
            <div class="card" style="padding:24px; border-left:4px solid var(--primary);">
              <div class="muted" style="font-size:0.8rem; text-transform:uppercase;">Pedidos Realizados</div>
              <h2 style="font-size:2rem; margin-top:8px;">${totalOrders}</h2>
            </div>
          </div>
        </div>
      `;
    } 
    else if (tab === 'orders') {
      content = myOrders.length ? myOrders.map(o => {
        let borderColor = o.status === 'paid' ? 'var(--success)' : o.status === 'canceled' ? 'var(--danger)' : o.status === 'shipped' ? 'var(--primary)' : 'var(--warning)';
        let statusText = o.status === 'paid' ? '✅ Pago' : o.status === 'canceled' ? '❌ Cancelado' : o.status === 'shipped' ? '📦 Enviado' : '⏳ Pendente';
        
        return `
          <div style="background:var(--bg-elev); padding:20px; border-radius:12px; margin-bottom:16px; border-left:4px solid ${borderColor}; border-top:1px solid var(--border); border-right:1px solid var(--border); border-bottom:1px solid var(--border);">
            <div class="flex-between mb-4" style="flex-wrap:wrap; gap:12px;">
              <div>
                <strong style="font-size:1rem;">Pedido #${o.id.slice(0,8).toUpperCase()}</strong>
                <div class="muted" style="font-size:0.8rem;">${formatDate(o.createdAt)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:800; font-size:1.1rem; color:var(--primary);">${brl(o.total)}</div>
                <div style="font-size:0.85rem; color:${borderColor}; font-weight:600;">${statusText}</div>
              </div>
            </div>
            <div style="background:var(--bg); padding:12px; border-radius:8px;">
              ${o.items.map(i => `<div class="flex-between" style="font-size:0.85rem; margin-bottom:6px;"><span>${i.qty}x ${escapeHtml(i.name)}</span> <span>${brl(i.price * i.qty)}</span></div>`).join('')}
              ${o.extras && o.extras.length ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border); font-size:0.8rem; color:var(--text-muted);"><strong>Serviços:</strong> ${o.extras.map(e => e.name).join(', ')}</div>` : ''}
            </div>
          </div>`;
      }).join('') : `<div class="empty-state"><h3>Nenhum pedido</h3><p>Suas compras aparecerão aqui.</p></div>`;
    } 
    else if (tab === 'favorites') {
      const favIds = Object.keys(state.favorites || {});
      const favs = state.products.filter(prod => favIds.includes(prod.id));
      
      content = favs.length ? `<div class="product-grid">${favs.map(f => `
        <div class="product-card">
          <div class="thumb" onclick="window.navigate('product-details', {id: '${f.id}'})" style="cursor:pointer">
            ${f.image ? `<img src="${f.image}" />` : `<div class="placeholder">🛍️</div>`}
          </div>
          <div class="info"><div class="name">${escapeHtml(f.name)}</div><div class="price">${brl(f.promoPrice || f.price)}</div></div>
          <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${f.id}')">Comprar</button></div>
        </div>`).join('')}</div>` 
        : `<div class="empty-state"><h3>Sem favoritos</h3></div>`;
    } 
    else if (tab === 'library') {
      const boughtItems = myOrders.filter(o => o.status === 'paid').flatMap(o => o.items);
      const libraryProducts = [];
      const uniqueIds = new Set();
      boughtItems.forEach(i => {
        if (!uniqueIds.has(i.productId)) {
          const prod = state.products.find(x => x.id === i.productId);
          if (prod) { libraryProducts.push(prod); uniqueIds.add(i.productId); }
        }
      });

      content = libraryProducts.length ? `<div class="product-grid">${libraryProducts.map(p => `
        <div class="product-card" style="border-color:var(--success);">
          <div class="thumb">${p.image ? `<img src="${p.image}" />` : `<div class="placeholder">🛍️</div>`}</div>
          <div class="info"><div class="name">${escapeHtml(p.name)}</div><div class="price" style="color:var(--success);">Adquirido</div></div>
          <div class="actions"><button class="btn btn-outline" onclick="alert('Download iniciado!')" style="width:100%; color:var(--success); border-color:var(--success);">📥 Baixar</button></div>
        </div>`).join('')}</div>` 
        : `<div class="empty-state"><h3>Biblioteca Vazia</h3></div>`;
    }
    else if (tab === 'coupons') {
      content = allCoupons.length ? `
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
          ${allCoupons.map(c => `
            <div style="background:linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2)); border:1px dashed var(--primary); padding:20px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:1.2rem; font-weight:800; letter-spacing:1px; color:var(--primary);">${c.code}</div>
                <div class="muted" style="font-size:0.8rem;">${c.type === 'percent' ? `${c.discount}% OFF` : `${brl(c.discount)} OFF`}</div>
              </div>
              <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${c.code}'); alert('Copiado!')" style="padding:6px 12px; font-size:0.8rem;">Copiar</button>
            </div>
          `).join('')}
        </div>` 
        : `<div class="empty-state"><h3>Nenhum cupom ativo</h3></div>`;
    }

    // ================== RENDER DA TELA ==================
    appEl().innerHTML = `
      <div style="max-width:1000px; margin:0 auto; width:100%;">
        
        <div class="flex-between mb-6" style="align-items:flex-end; flex-wrap:wrap; gap:16px;">
          <div>
            <h2 style="font-size:2rem; margin-bottom:4px;">Olá, ${escapeHtml(userName.split(' ')[0])} 👋</h2>
            <p class="muted">Gerencie seus dados, pedidos e favoritos.</p>
          </div>
          <button class="btn btn-outline" onclick="window.signOutUser()" style="color:var(--danger); border-color:var(--danger);">Sair da Conta</button>
        </div>

        <div style="display:flex; gap:8px; border-bottom:1px solid var(--border); margin-bottom:32px; overflow-x:auto; padding-bottom:2px;">
          <button class="tab-btn ${tab === 'data' ? 'active' : ''}" onclick="window.setTab('data')">Meus Dados</button>
          <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.setTab('orders')">Histórico de Pedidos</button>
          <button class="tab-btn ${tab === 'library' ? 'active' : ''}" onclick="window.setTab('library')">Biblioteca</button>
          <button class="tab-btn ${tab === 'favorites' ? 'active' : ''}" onclick="window.setTab('favorites')">Favoritos</button>
          <button class="tab-btn ${tab === 'coupons' ? 'active' : ''}" onclick="window.setTab('coupons')">Cupons</button>
        </div>

        <div>${content}</div>
      </div>
    `;

    // Listener para salvar o nome
    $('#btnSaveName')?.addEventListener('click', async () => {
      const newName = $('#editName').value.trim();
      if (!newName) return toast('O nome não pode ser vazio.', 'error');
      
      try {
        await updateDoc(doc(firestore, 'customers', state.user.uid), { name: newName });
        toast('Nome atualizado com sucesso!', 'success');
        renderAccount(state); // Recarrega a tela
      } catch (err) {
        console.error(err);
        toast('Erro ao atualizar.', 'error');
      }
    });

  } catch (error) {
    console.error("Erro ao renderizar conta:", error);
    appEl().innerHTML = `<div class="card" style="text-align:center; padding:40px;"><h2>Ops!</h2><p class="muted">Ocorreu um erro ao carregar sua conta.</p><button class="btn btn-primary mt-4" onclick="window.navigate('home')">Voltar para a Loja</button></div>`;
  }
}

// Ações globais da Conta
window.setTab = (t) => {
  const event = new CustomEvent('setProfileTab', { detail: t });
  document.dispatchEvent(event);
};
