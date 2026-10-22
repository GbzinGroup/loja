/* =====================================================================
   admin.js — Painel Administrativo
   ===================================================================== */
import { store } from './store.js';
import { $, appEl, brl, escapeHtml, toast } from './utils.js';
import { renderAdminOrders } from './adminOrders.js';
import { renderCustomers } from './customers.js';
import { firestore } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function renderAdmin(state, tab = 'dashboard') {
  if (!state.isAdmin) return window.navigate('login');
  
  let content = '';
  
  // ================== ROTEAMENTO DAS ABAS ==================
  if (tab === 'orders') {
    content = await renderAdminOrders(state);
  } 
  else if (tab === 'customers') {
    content = await renderCustomers(state);
  } 
  else if (tab === 'systemRequests') {
    const snap = await getDocs(query(collection(firestore, 'systemRequests'), orderBy('createdAt', 'desc'), limit(100)));
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    content = `<div class="card system-card"><h2>Solicitações dos clientes</h2><p class="muted">Revise recargas, recompensas, resgates e pedidos de parceria. Aprovar uma solicitação não confirma um pagamento Pix.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Solicitação</th><th>Cliente</th><th>Detalhes</th><th>Status</th><th>Ações</th></tr></thead><tbody>${requests.length ? requests.map(r => `<tr><td><strong>${escapeHtml(r.title || r.kind || 'Solicitação')}</strong><br><small class="muted">${escapeHtml(r.kind || '')}</small></td><td><code>${escapeHtml(r.userId || '')}</code></td><td>${r.amount ? brl(r.amount) : ''}${r.note ? `<br>${escapeHtml(r.note)}` : ''}${r.code ? `<br>Código: ${escapeHtml(r.code)}` : ''}</td><td>${escapeHtml(r.status || 'pending')}</td><td><div class="flex gap-2 flex-wrap"><button class="btn btn-outline" onclick="window.updateSystemRequest('${r.id}','approved')">Aprovar</button><button class="btn btn-danger" onclick="window.updateSystemRequest('${r.id}','rejected')">Recusar</button></div></td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhuma solicitação.</td></tr>'}</tbody></table></div></div><div class="card system-card"><h2>Ajuste manual de carteira</h2><p class="muted">Use apenas após conferir o motivo e os comprovantes. Toda operação gera uma transação de auditoria.</p><form id="walletAdjustForm" class="system-form"><label>UID do cliente<input id="walletUid" required maxlength="128"></label><label>Operação<select id="walletOperation"><option value="credit">Creditar</option><option value="debit">Debitar</option></select></label><label>Valor (R$)<input id="walletAdjustAmount" type="number" min="0.01" max="100000" step="0.01" required></label><label>Descrição<input id="walletAdjustDescription" maxlength="160" required></label><button class="btn btn-primary">Registrar ajuste</button></form></div>`;
  }
  else if (tab === 'dashboard') {
    const orders = await store.getAllOrders();
    const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
    
    content = `
      <div class="dashboard-grid">
        <div class="stat-card green">
          <div class="label">Faturamento (Pagos)</div>
          <h2 style="color: var(--success);">${brl(totalRevenue)}</h2>
        </div>
        <div class="stat-card purple">
          <div class="label">Produtos Cadastrados</div>
          <h2>${state.products.length}</h2>
        </div>
        <div class="stat-card warning">
          <div class="label" style="margin-bottom: 12px;">Modo Manutenção</div>
          <label class="switch">
            <input type="checkbox" id="maintenanceToggle" ${state.maintenance ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  } 
  else if (tab === 'products') {
    const rows = state.products.length ? state.products.map((p) => `
      <tr>
        <td>${p.image ? `<img src="${p.image}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px;">` : ''}</td>
        <td>
          <strong>${escapeHtml(p.name)}</strong><br>
          <span class="muted" style="font-size: 0.75rem;">Cat: ${escapeHtml(p.category)} | Estoque: ${p.stock}</span>
        </td>
        <td style="color: var(--primary); font-weight: 700;">${brl(p.promoPrice || p.price)}</td>
        <td class="text-right">
          <button class="btn btn-outline" onclick="window.navigate('product-form', {id: '${p.id}'})">Editar</button> 
          <button class="btn btn-danger" onclick="window.deleteProduct('${p.id}')">Excluir</button>
        </td>
      </tr>`).join('') 
      : `<tr><td colspan="4" class="muted text-center" style="padding: 32px;">Nenhum produto cadastrado.</td></tr>`;

    content = `
      <div class="flex-between mb-4">
        <h3>Meus Produtos</h3>
        <button class="btn btn-primary" onclick="window.navigate('product-form')">+ Novo Produto</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th style="width: 60px;">Foto</th><th>Info</th><th>Preço</th><th class="text-right">Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }
  else if (tab === 'coupons') {
    const coupons = Object.values(state.coupons || {});
    
    content = `
      <div class="card mb-6" style="max-width: 700px; border-color: var(--primary);">
        <h3 class="mb-4">Criar Novo Cupom</h3>
        <form id="addCouponForm" class="flex gap-3 items-end flex-wrap">
          <div class="form-group" style="flex: 2; margin: 0; min-width: 150px;">
            <label>Código (Ex: GBZIN10)</label>
            <input type="text" id="cCode" required style="text-transform: uppercase;">
          </div>
          <div class="form-group" style="flex: 1; margin: 0; min-width: 100px;">
            <label>Desconto</label>
            <input type="number" id="cVal" step="0.01" min="0" required>
          </div>
          <div class="form-group" style="flex: 1; margin: 0; min-width: 120px;">
            <label>Tipo</label>
            <select id="cType">
              <option value="fixed">R$ (Fixo)</option>
              <option value="percent">% (Porcentagem)</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="height: 42px;">Criar Cupom</button>
        </form>
      </div>
      
      <h3 class="mb-4">Cupons Ativos</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Desconto</th><th>Tipo</th><th>Visibilidade na conta</th><th class="text-right">Ações</th></tr></thead>
          <tbody>
            ${coupons.length ? coupons.map(c => `
              <tr>
                <td><strong style="color: var(--primary); font-size: 1rem;">${c.code}</strong></td>
                <td>${c.type === 'percent' ? `${c.discount}%` : brl(c.discount)}</td>
                <td>${c.type === 'percent' ? 'Porcentagem' : 'Valor Fixo'}</td>
                <td><label class="switch" title="Mostrar este cupom na conta dos clientes"><input type="checkbox" ${c.showInAccount === true ? 'checked' : ''} onchange="window.toggleCouponVisibility('${c.code}', this.checked)"><span class="slider"></span></label><small class="muted" style="display:block">${c.showInAccount === true ? 'Visível' : 'Oculto'}</small></td>
                <td class="text-right">
                  <button class="btn btn-danger" onclick="window.deleteCoupon('${c.code}')">Excluir</button>
                </td>
              </tr>`).join('') 
            : '<tr><td colspan="5" class="muted text-center" style="padding: 20px;">Nenhum cupom ativo no momento.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  // ================== RENDERIZAÇÃO DA TELA ==================
  appEl().innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
      <div class="account-tabs">
        <button class="tab-btn ${tab === 'dashboard' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'dashboard'})">Visão Geral</button>
        <button class="tab-btn ${tab === 'products' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'products'})">Produtos</button>
        <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'orders'})">Pedidos</button>
        <button class="tab-btn ${tab === 'coupons' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'coupons'})">Cupons</button>
        <button class="tab-btn ${tab === 'customers' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'customers'})">Clientes</button>
        <button class="tab-btn ${tab === 'systemRequests' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'systemRequests'})">Solicitações e carteira</button>
        <button class="tab-btn" onclick="window.navigate('vip')">Clube VIP</button>
        <button class="tab-btn" onclick="window.navigate('support')">Suporte</button>
      </div>
      ${content}
    </div>
  `;

  // ================== EVENTOS ==================
  $('#maintenanceToggle')?.addEventListener('change', async (e) => {
    await store.saveMaintenance(e.target.checked);
    toast(`Manutenção ${e.target.checked ? 'Ativada' : 'Desativada'}`, 'success');
  });

  $('#walletAdjustForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = $('#walletUid').value.trim();
    const amount = Number($('#walletAdjustAmount').value);
    const operation = $('#walletOperation').value;
    const description = $('#walletAdjustDescription').value.trim();
    if (!uid || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !description) return toast('Confira os dados do ajuste.', 'error');
    try {
      await runTransaction(firestore, async tx => {
        const walletRef = doc(firestore, 'wallets', uid);
        const snap = await tx.get(walletRef);
        const balance = Number(snap.exists() ? snap.data().balance || 0 : 0);
        const next = operation === 'credit' ? balance + amount : balance - amount;
        if (next < 0) throw new Error('Saldo insuficiente para débito.');
        tx.set(walletRef, { balance: Number(next.toFixed(2)), currency: 'BRL', updatedAt: serverTimestamp() }, { merge: true });
        const transactionRef = doc(collection(firestore, 'transactions'));
        tx.set(transactionRef, { userId: uid, amount: Number((operation === 'credit' ? amount : -amount).toFixed(2)), type: operation, description, status: 'confirmed', createdAt: serverTimestamp() });
      });
      toast('Ajuste registrado com auditoria.', 'success');
      $('#walletAdjustForm').reset();
    } catch (err) { console.error(err); toast(err.message || 'Não foi possível ajustar a carteira.', 'error'); }
  });

  $('#addCouponForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#cCode').value.trim().toUpperCase();
    const val = Number($('#cVal').value);
    const type = $('#cType').value;

    if (val <= 0) return toast('O desconto deve ser maior que zero.', 'error');

    try {
      await store.addCoupon(code, val, type);
      toast('Cupom criado com sucesso!', 'success');
      renderAdmin(state, 'coupons'); // Recarrega a aba
    } catch (err) {
      toast('Erro ao criar cupom.', 'error');
      console.error(err);
    }
  });
}

// ================== FUNÇÕES GLOBAIS ==================
// Atualização administrativa de solicitações, sem liberação automática de saldo.
window.updateSystemRequest = async (id, status) => {
  if (!['approved','rejected'].includes(status) || !confirm(`Marcar solicitação como ${status === 'approved' ? 'aprovada' : 'recusada'}?`)) return;
  try {
    await updateDoc(doc(firestore, 'systemRequests', id), { status, updatedAt: serverTimestamp() });
    toast('Solicitação atualizada. Se for recarga, confira o pagamento antes de creditar a carteira.', 'success');
    window.navigate('admin', { tab: 'systemRequests' });
  } catch (err) { console.error(err); toast('Não foi possível atualizar a solicitação.', 'error'); }
};

window.deleteProduct = async (id) => {
  if (confirm('Deseja realmente excluir este produto?')) { 
    await store.deleteProduct(id); 
    toast('Produto excluído.', 'success'); 
    window.navigate('admin', {tab: 'products'});
  }
};

window.deleteCoupon = async (code) => {
  if (confirm('Deseja realmente apagar este cupom?')) {
    await store.removeCoupon(code);
    toast('Cupom removido.', 'success');
    window.navigate('admin', {tab: 'coupons'});
  }
};
window.toggleCouponVisibility = async (code, visible) => {
  try {
    await store.setCouponAccountVisibility(code, visible);
    toast(visible ? 'Cupom visível na conta dos clientes.' : 'Cupom ocultado da conta dos clientes.', 'success');
    window.navigate('admin', { tab: 'coupons' });
  } catch (err) {
    console.error('Erro ao alterar visibilidade do cupom:', err);
    toast(err?.message || 'Não foi possível alterar a visibilidade.', 'error');
    window.navigate('admin', { tab: 'coupons' });
  }
};
