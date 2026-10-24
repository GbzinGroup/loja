import { store } from './store.js';
import { $, appEl, brl, escapeHtml, toast, formatDate } from './utils.js';
import { firestore } from './firebase-config.js';
import { doc, updateDoc, collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function renderAccount(state) {
  if (!state.user) return window.navigate('login'); 
  
  try {
    const profile = await store.getCustomerProfile(state.user.uid); 
    const myOrders = await store.getMyOrders(state.user.uid);
    const notificationSnap = await getDocs(query(collection(firestore, 'notifications'), where('userId', '==', state.user.uid), limit(100))).catch(() => ({ docs: [] }));
    const accountNotifications = notificationSnap.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,50);
    const unreadNotifications = accountNotifications.filter(n => !n.read).length;
    const allCoupons = Object.values(state.publicCoupons || {}).filter(c => c.active === true && c.showInAccount === true);
    const requestedTab = state.profileTab || 'data';
    const tab = requestedTab === 'coupons' && !allCoupons.length ? 'data' : requestedTab;

    const totalPaid = myOrders.filter(o => ['paid','shipped','completed'].includes(o.status)).reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = myOrders.length;
    const pendingOrders = myOrders.filter(o => ['pending','awaiting_payment','payment_review'].includes(o.status)).length;
    const favoritesCount = Object.keys(state.favorites || {}).length;
    const userName = profile?.name || state.user.email.split('@')[0];
    const initial = userName.charAt(0).toUpperCase();

    let content = '';

    // ABA: DADOS
    if (tab === 'data') {
      content = `
        <div class="flex gap-6 flex-wrap mt-4">
          <div class="card flex-col gap-4" style="flex: 2; min-width: 300px;">
            <div class="flex items-center gap-4 mb-4">
              <div class="avatar">${initial}</div>
              <div>
                <h3>${escapeHtml(userName)}</h3>
                <p class="muted">${state.isAdmin ? 'Administrador' : 'Cliente'}</p>
              </div>
            </div>
            <div class="form-group">
              <label>Nome de Exibição</label>
              <input type="text" id="editName" value="${escapeHtml(userName)}" maxlength="60" autocomplete="name" required />
            </div>
            <div class="form-group">
              <label>E-mail</label>
              <input type="email" value="${escapeHtml(state.user.email || '')}" disabled autocomplete="email" />
            </div>
            <button class="btn btn-primary mt-2" id="btnSaveName">Salvar Alterações</button>
          </div>

          <div class="account-overview-metrics" style="flex: 1.35; min-width: 260px;">
            <div class="card stat-card green"><div class="label">Total confirmado</div><h2 style="color: var(--success);">${brl(totalPaid)}</h2><small class="muted">Compras pagas/concluídas</small></div>
            <div class="card stat-card purple"><div class="label">Meus pedidos</div><h2>${totalOrders}</h2><small class="muted">Todos os status</small></div>
            <div class="card stat-card warning"><div class="label">Em andamento</div><h2>${pendingOrders}</h2><small class="muted">Acompanhe atualizações</small></div>
            <div class="card stat-card"><div class="label">Favoritos</div><h2>${favoritesCount}</h2><small class="muted">Itens salvos</small></div>
            <div class="card system-card account-shortcut"><h3>Central da sua conta</h3><p class="muted">Acesse carteira, pontos, notificações, histórico financeiro e outros recursos.</p><button class="btn btn-primary" onclick="window.navigate('systems',{tab:'overview'})">Abrir central da conta</button></div>
          </div>
        </div>
      `;
    } 
    // ABA: PEDIDOS
    else if (tab === 'orders') {
      content = myOrders.length ? myOrders.map(o => {
        let color = o.status === 'paid' ? 'var(--success)' : o.status === 'canceled' ? 'var(--danger)' : o.status === 'shipped' ? 'var(--primary)' : 'var(--warning)';
        let text = o.status === 'paid' ? ' Pago' : o.status === 'canceled' ? ' Cancelado' : o.status === 'shipped' ? ' Enviado' : '⏳ Pendente';
        
        return `
          <div class="card mb-4" style="border-left: 4px solid ${color};">
            <div class="flex-between flex-wrap gap-4 mb-4">
              <div>
                <strong>Pedido #${o.id.slice(0,8).toUpperCase()}</strong>
                <div class="muted">${formatDate(o.createdAt)}</div>
              </div>
              <div class="text-right">
                <div style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">${brl(o.total)}</div>
                <div style="font-size: 0.85rem; color: ${color}; font-weight: 600;">${text}</div>
              </div>
            </div>
            <div style="background: var(--bg-elev); padding: 12px; border-radius: 8px;">
              ${o.items.map(i => `<div class="flex-between mb-2" style="font-size: 0.85rem;"><span>${i.qty}x ${escapeHtml(i.name)}</span> <span>${brl(i.price * i.qty)}</span></div>`).join('')}
            </div>
          </div>`;
      }).join('') : `<div class="empty-state"><h3>Nenhum pedido</h3><p>Suas compras aparecerão aqui.</p></div>`;
    } 
    // ABA: FAVORITOS
    else if (tab === 'favorites') {
      const favIds = Object.keys(state.favorites || {});
      const favs = state.products.filter(prod => favIds.includes(prod.id));
      content = favs.length ? `
        <div class="product-grid">
          ${favs.map(f => `
          <div class="product-card card-hover">
            <div class="thumb" onclick="window.navigate('product-details', {id: '${f.id}'})">
              ${f.image ? `<img src="${f.image}" />` : `<div class="placeholder"></div>`}
            </div>
            <div class="info">
              <div class="name">${escapeHtml(f.name)}</div>
              <div class="price">${brl(f.promoPrice || f.price)}</div>
            </div>
            <div class="actions"><button class="btn btn-primary" onclick="window.addCart('${f.id}')">Comprar</button></div>
          </div>`).join('')}
        </div>` : `<div class="empty-state"><h3>Sem favoritos</h3></div>`;
    } 
    // ABA: BIBLIOTECA
    else if (tab === 'library') {
      const boughtItems = myOrders.filter(o => o.status === 'paid').flatMap(o => o.items);
      const libProds = [];
      const uniqueIds = new Set();
      boughtItems.forEach(i => {
        if (!uniqueIds.has(i.productId)) {
          const prod = state.products.find(x => x.id === i.productId);
          if (prod) { libProds.push(prod); uniqueIds.add(i.productId); }
        }
      });

      content = libProds.length ? `
        <div class="product-grid">
          ${libProds.map(p => `
          <div class="product-card" style="border-color: var(--success);">
            <div class="thumb">${p.image ? `<img src="${p.image}" />` : `<div class="placeholder"></div>`}</div>
            <div class="info">
              <div class="name">${escapeHtml(p.name)}</div>
              <div class="price" style="color: var(--success);">Adquirido</div>
            </div>
            <div class="actions"><button class="btn btn-outline" onclick="alert('Download iniciado!')" style="width:100%;"> Baixar</button></div>
          </div>`).join('')}
        </div>` : `<div class="empty-state"><h3>Biblioteca Vazia</h3></div>`;
    }
    // ABA: CUPONS
    else if (tab === 'coupons') {
      content = allCoupons.length ? `
        <div class="flex gap-4 flex-wrap">
          ${allCoupons.map(c => `
            <div class="card flex-between" style="flex: 1; min-width: 280px; border: 1px dashed var(--primary); background: rgba(99,102,241,0.05);">
              <div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">${c.code}</div>
                <div class="muted">${c.type === 'percent' ? `${c.discount}% OFF` : `${brl(c.discount)} OFF`}</div>
              </div>
              <button class="btn btn-outline account-copy-coupon" type="button" data-coupon-code="${escapeHtml(c.code)}">Copiar código</button>
            </div>
          `).join('')}
        </div>` : `<div class="empty-state"><h3>Nenhum cupom ativo</h3></div>`;
    }

    // ABA: MENSAGENS E AVISOS
    else if (tab === 'notifications') {
      content = accountNotifications.length ? `<div class="card system-card"><div class="flex-between flex-wrap gap-2"><div><h3>Mensagens e avisos</h3><p class="muted">Comunicados enviados pela equipe da Gbzin Shop, incluindo avisos de entrada.</p></div><span class="system-pill">${unreadNotifications} não lida(s)</span></div><div class="system-list">${accountNotifications.map(n=>`<article class="system-list-row"><div><strong>${escapeHtml(n.title||'Aviso da loja')}</strong><small>${escapeHtml(n.message||'')}<br>${formatDate(n.createdAt)}</small></div><span class="system-pill ${n.read?'':'status-success'}">${n.read?'Lida':`<button class="btn btn-outline account-mark-notification" type="button" data-notification-id="${escapeHtml(n.id)}">Marcar como lida</button>`}</span></article>`).join('')}</div></div>` : `<div class="card system-card empty-state"><h3>Nenhuma mensagem por enquanto</h3><p>Quando a equipe enviar um aviso ou comunicado, ele aparecerá aqui.</p></div>`;
    }

    // RENDER PRINCIPAL DA CONTA
    appEl().innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; width: 100%;">
        
        <div class="account-header">
          <div>
            <h2 style="font-size: 2rem; margin-bottom: 4px;">Olá, ${escapeHtml(userName.split(' ')[0])} </h2>
            <p class="muted">Gerencie seus dados, acompanhe pedidos e organize seus benefícios em um só lugar.</p>
          </div>
          <button class="btn btn-outline" onclick="window.signOutUser()" style="color: var(--danger); border-color: var(--danger);">Sair da Conta</button>
        </div>

        <div class="account-tabs">
          <button class="tab-btn ${tab === 'data' ? 'active' : ''}" onclick="window.setTab('data')">Meus Dados</button>
          <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.setTab('orders')">Pedidos</button>
          <button class="tab-btn ${tab === 'library' ? 'active' : ''}" onclick="window.setTab('library')">Biblioteca</button>
          <button class="tab-btn ${tab === 'favorites' ? 'active' : ''}" onclick="window.setTab('favorites')">Favoritos</button>
          <button class="tab-btn" type="button" onclick="window.navigate('systems',{tab:'referrals'})">Afiliados</button>
          <button class="tab-btn ${tab === 'notifications' ? 'active' : ''}" onclick="window.setTab('notifications')">Mensagens e avisos${unreadNotifications ? ` (${unreadNotifications})` : ''}</button>
          ${allCoupons.length ? `<button class="tab-btn ${tab === 'coupons' ? 'active' : ''}" onclick="window.setTab('coupons')">Cupons</button>` : ''}
        </div>

        <div>${content}</div>
      </div>
    `;

    appEl().querySelectorAll('.account-mark-notification').forEach(button => button.addEventListener('click', async () => {
      const id = button.dataset.notificationId; if (!id) return;
      button.disabled = true;
      try { await updateDoc(doc(firestore, 'notifications', id), { read: true }); toast('Mensagem marcada como lida.', 'success'); renderAccount(state); }
      catch (err) { console.error('[Notificações]', err); button.disabled = false; toast('Não foi possível atualizar a mensagem. Confira as regras Firestore.', 'error'); }
    }));

    appEl().querySelectorAll('.account-copy-coupon').forEach(button => button.addEventListener('click', async () => {
      const code = button.dataset.couponCode || '';
      try {
        await navigator.clipboard.writeText(code);
        toast('Código do cupom copiado.', 'success');
      } catch {
        toast(`Código do cupom: ${code}`, 'info');
      }
    }));

    $('#btnSaveName')?.addEventListener('click', async () => {
      const newName = $('#editName').value.trim();
      if (!newName) return toast('O nome não pode ser vazio.', 'error');
      if (newName.length > 60) return toast('Use até 60 caracteres no nome.', 'error');
      const saveButton = $('#btnSaveName');
      if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Salvando…'; }
      try {
        await updateDoc(doc(firestore, 'customers', state.user.uid), { name: newName });
        toast('Nome atualizado!', 'success');
        renderAccount(state); 
      } catch (err) { console.error('[Perfil] Falha ao salvar nome:', err); toast('Não foi possível atualizar seu perfil. Confira sua conexão e as regras do Firestore.', 'error'); } finally { const saveButton = $('#btnSaveName'); if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Salvar Alterações'; } }
    });

  } catch (error) {
    console.error("Erro na conta:", error);
    appEl().innerHTML = `<div class="card text-center" style="padding: 40px;"><h2>Ops!</h2><p class="muted">Ocorreu um erro ao carregar sua conta.</p><button class="btn btn-primary mt-4" onclick="window.navigate('home')">Voltar para a Loja</button></div>`;
  }
}

window.setTab = (t) => { document.dispatchEvent(new CustomEvent('setProfileTab', { detail: t })); };