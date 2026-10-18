import { store } from './store.js';
import { $, appEl, headerEl, brl, escapeHtml, toast, icons } from './utils.js';

export async function renderAdmin(state, tab = 'dashboard') {
  if (!state.isAdmin) return window.navigate('login');
  
  const qtdProdutos = state.products.length;
  let content = '';

  if (tab === 'dashboard') {
    const orders = await store.getAllOrders();
    const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
    const bestSellers = [...state.products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 5);
    
    content = `
      <div class="dashboard-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:20px; margin-bottom:32px;">
        <div class="card" style="padding:24px; border-left:4px solid var(--success);">
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">Faturamento (Pagos) ${icons.dollar}</div>
          <h2 style="font-size:2rem; margin-top:8px; color:var(--success);">${brl(totalRevenue)}</h2>
        </div>
        <div class="card" style="padding:24px; border-left:4px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">Produtos Ativos ${icons.box}</div>
          <h2 style="font-size:2rem; margin-top:8px;">${qtdProdutos}</h2>
        </div>
        <div class="card" style="padding:24px; border-left:4px solid var(--warning);">
          <div style="display:flex; justify-content:space-between; color:var(--text-muted);">Modo Manutenção</div>
          <div style="margin-top:12px; display:flex; align-items:center; gap:12px;">
            <label class="switch"><input type="checkbox" id="maintenanceToggle" ${state.maintenance ? 'checked' : ''}><span class="slider"></span></label>
            <span id="maintenanceLabel" style="font-weight:600; color:${state.maintenance ? 'var(--danger)' : 'var(--success)'};">${state.maintenance ? 'Ativado' : 'Desativado'}</span>
          </div>
        </div>
      </div>
      <div class="card" style="padding:24px;">
        <h3>Top 5 Capas Mais Vendidas</h3>
        <ul style="list-style:none; padding:0; margin-top:16px;">
          ${bestSellers.map((p, i) => `<li style="padding:12px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;"><span>${i+1}. ${escapeHtml(p.name)}</span> <strong>${p.salesCount || 0} vendas</strong></li>`).join('')}
        </ul>
      </div>
    `;
  } 
  else if (tab === 'products') {
    const rows = state.products.length ? state.products.map((p) => `
      <tr style="${p.active === false ? 'opacity:0.5;' : ''}">
        <td>${p.image ? `<img src="${p.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;" />` : '🛍️'}</td>
        <td><strong>${escapeHtml(p.name)}</strong><br><span class="muted" style="font-size:0.75rem;">Cat: ${escapeHtml(p.category)} | Estoque: ${p.stock}</span></td>
        <td style="color:var(--primary); font-weight:700;">${brl(p.promoPrice || p.price)}</td>
        <td class="text-right">
          <button class="btn btn-outline" style="padding:6px 12px; font-size:.8rem;" data-toggle="${p.id}" data-active="${p.active}">${p.active === false ? 'Ativar' : 'Pausar'}</button>
          <button class="btn btn-outline" style="padding:6px 12px; font-size:.8rem;" data-edit="${p.id}">${icons.edit}</button> 
          <button class="btn btn-danger" style="padding:6px 12px; font-size:.8rem;" data-del="${p.id}">${icons.trash}</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="4" class="muted" style="text-align:center;padding:32px;">Vazio.</td></tr>`;

    content = `
      <div class="flex-between mb-4">
        <h3>Meus Produtos</h3>
        <button class="btn btn-primary" style="display:flex; gap:6px; align-items:center;" onclick="window.navigate('product-form')">${icons.plus} Novo Produto</button>
      </div>
      <div class="table-wrap">
        <table class="data-table"><thead><tr><th style="width:70px;">Foto</th><th>Info</th><th>Preço</th><th class="text-right">Ações</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }
  else if (tab === 'orders') {
    const list = await store.getAllOrders(); 
    const rows = list.length ? list.map(o => {
      let statusColor = o.status === 'paid' ? 'var(--success)' : o.status === 'canceled' ? 'var(--danger)' : o.status === 'shipped' ? 'var(--primary)' : 'var(--warning)';
      return `
      <tr>
        <td><span style="font-family:monospace; font-size:0.8rem; color:var(--text-muted);">#${o.id.slice(0,6).toUpperCase()}</span></td>
        <td>
          <strong>${escapeHtml(o.customerName || 'Cliente')}</strong><br>
          <span class="muted" style="font-size:0.75rem;">${o.items.length} item(s) | CPF: ${escapeHtml(o.cpf || 'N/I')}</span>
        </td>
        <td style="font-weight:700; color:var(--success);">${brl(o.total)}</td>
        <td>
          <select data-order-status="${o.id}" style="padding:6px; border-radius:6px; background:var(--bg-elev); color:${statusColor}; border:1px solid ${statusColor}; font-weight:bold;">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>⏳ Pendente</option>
            <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>✅ Pago</option>
            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>📦 Enviado</option>
            <option value="canceled" ${o.status === 'canceled' ? 'selected' : ''}>❌ Cancelado</option>
          </select>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" class="muted" style="text-align:center;padding:32px;">Nenhum pedido encontrado.</td></tr>`;

    content = `<h3 class="mb-4">Gerenciamento de Pedidos</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Cliente / CPF</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  else if (tab === 'settings') {
    content = `
      <div class="card wide" style="max-width:600px;">
        <h3>Configurações da Loja</h3>
        <p class="muted mb-4">Defina as configurações principais do site.</p>
        <form id="settingsForm">
          <div class="form-group"><label>Nome da Loja</label><input type="text" id="setStoreName" required value="${escapeHtml(state.settings.storeName || 'Gbzin Shop')}" /></div>
          <div class="form-group"><label>Chave PIX</label><input type="text" id="setPixKey" required value="${escapeHtml(state.settings.pixKey || '')}" /></div>
          <div class="form-group"><label>Nome do Beneficiário</label><input type="text" id="setPixName" required value="${escapeHtml(state.settings.pixName || '')}" /></div>
          <div class="form-group"><label>WhatsApp de Suporte (ex: 11999999999)</label><input type="text" id="setWhatsapp" value="${escapeHtml(state.settings.whatsapp || '')}" /></div>
          <div class="form-actions" style="margin-top:24px;"><button type="submit" class="btn btn-primary">Salvar Configurações</button></div>
        </form>
      </div>
    `;
  }
  else if (tab === 'coupons') {
    const coupons = Object.values(state.coupons || {});
    content = `
      <div class="card" style="max-width:600px; margin-bottom:24px; border-color:var(--primary);">
        <h3>Criar Cupom</h3>
        <form id="addCouponForm" style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
          <div class="form-group" style="flex:1; margin:0;"><label>Código</label><input type="text" id="cCode" required /></div>
          <div class="form-group" style="flex:1; margin:0;"><label>Valor</label><input type="number" id="cVal" required /></div>
          <div class="form-group" style="flex:1; margin:0;"><label>Tipo</label><select id="cType" class="filter-select"><option value="fixed">R$</option><option value="percent">%</option></select></div>
          <button type="submit" class="btn btn-primary">Criar</button>
        </form>
      </div>
      <h3>Cupons Ativos</h3>
      <div class="table-wrap mt-4">
        <table class="data-table"><thead><tr><th>Código</th><th>Desconto</th><th>Tipo</th></tr></thead><tbody>
          ${coupons.length ? coupons.map(c => `<tr><td><strong>${c.code}</strong></td><td>${c.type === 'percent' ? c.discount + '%' : brl(c.discount)}</td><td>${c.type === 'percent' ? 'Porcentagem' : 'Fixo'}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Nenhum cupom.</td></tr>'}
        </tbody></table>
      </div>
    `;
  }

  const tabsHtml = `
    <div style="margin-bottom:24px; border-bottom:1px solid var(--border); display:flex; gap:24px; overflow-x:auto;">
      <button class="tab-btn ${tab === 'dashboard' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'dashboard'})">Visão Geral</button>
      <button class="tab-btn ${tab === 'products' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'products'})">Produtos</button>
      <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'orders'})">Pedidos</button>
      <button class="tab-btn ${tab === 'coupons' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'coupons'})">Cupons</button>
      <button class="tab-btn ${tab === 'settings' ? 'active' : ''}" onclick="window.navigate('admin', {tab: 'settings'})">Configurações</button>
    </div>
  `;

  appEl().innerHTML = `<div style="max-width:1200px; margin:0 auto; width:100%;">${tabsHtml}${content}</div>`;

  // Listeners
  appEl().querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => window.navigate('product-form', { id: b.getAttribute('data-edit') })));
  appEl().querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    await store.toggleProductStatus(b.getAttribute('data-toggle'), b.getAttribute('data-active') === 'true');
    toast('Status alterado.', 'success');
  }));
  appEl().querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (confirm('Excluir produto?')) { await store.deleteProduct(b.getAttribute('data-del')); toast('Excluído.', 'success'); }
  }));
  appEl().querySelectorAll('[data-order-status]').forEach((sel) => sel.addEventListener('change', async (e) => {
    await store.updateOrderStatus(sel.getAttribute('data-order-status'), e.target.value);
    toast('Status atualizado!', 'success');
  }));

  $('#maintenanceToggle')?.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await store.saveMaintenance(isChecked);
    $('#maintenanceLabel').textContent = isChecked ? 'Ativado' : 'Desativado';
    $('#maintenanceLabel').style.color = isChecked ? 'var(--danger)' : 'var(--success)';
    toast(`Manutenção ${isChecked ? 'ativada' : 'desativada'}!`, 'success');
  });

  $('#settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.saveSettings({ 
      storeName: $('#setStoreName').value.trim(),
      pixKey: $('#setPixKey').value.trim(), 
      pixName: $('#setPixName').value.trim(),
      whatsapp: $('#setWhatsapp').value.trim()
    });
    toast('Salvo!', 'success');
  });

  $('#addCouponForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.addCoupon($('#cCode').value.trim(), Number($('#cVal').value), $('#cType').value);
    toast('Cupom criado!', 'success');
    renderAdmin(state, 'coupons');
  });
}
