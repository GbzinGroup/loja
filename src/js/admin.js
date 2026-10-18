import { store } from './store.js';
import { $, appEl, brl, escapeHtml, toast, icons } from './utils.js';
import { renderAdminOrders } from './adminOrders.js';
import { renderCustomers } from './customers.js';
import { renderReviews } from './reviews.js';

export async function renderAdmin(state, tab = 'dashboard') {
  if (!state.isAdmin) return window.navigate('login');
  
  let content = '';
  
  if (tab === 'orders') content = await renderAdminOrders(state);
  else if (tab === 'customers') content = await renderCustomers(state);
  else if (tab === 'reviews') content = await renderReviews(state);
  else if (tab === 'dashboard') {
    const orders = await store.getAllOrders();
    const rev = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);
    content = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:20px; margin-bottom:32px;">
        <div class="card" style="padding:24px; border-left:4px solid var(--success);"><div class="muted">Faturamento</div><h2 style="font-size:2rem; color:var(--success);">${brl(rev)}</h2></div>
        <div class="card" style="padding:24px; border-left:4px solid var(--primary);"><div class="muted">Produtos</div><h2 style="font-size:2rem;">${state.products.length}</h2></div>
        <div class="card" style="padding:24px; border-left:4px solid var(--warning);">
          <div class="muted" style="margin-bottom:8px;">Manutenção</div>
          <label class="switch"><input type="checkbox" id="maintenanceToggle" ${state.maintenance ? 'checked' : ''}><span class="slider"></span></label>
        </div>
      </div>
    `;
  } 
  else if (tab === 'products') {
    content = `
      <div class="flex-between mb-4"><h3>Produtos</h3><button class="btn btn-primary" onclick="window.navigate('product-form')">+ Novo</button></div>
      <div class="table-wrap"><table class="data-table"><tbody>
        ${state.products.map(p => `<tr><td>${p.image ? `<img src="${p.image}" width="40">` : '🛍️'}</td><td>${p.name}</td><td>${brl(p.price)}</td>
        <td class="text-right"><button class="btn btn-outline" onclick="window.navigate('product-form', {id: '${p.id}'})">Editar</button> <button class="btn btn-danger" onclick="window.deleteProduct('${p.id}')">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>`;
  }

  appEl().innerHTML = `
    <div style="max-width:1200px; margin:0 auto; width:100%;">
      <div style="margin-bottom:24px; border-bottom:1px solid var(--border); display:flex; gap:24px; overflow-x:auto;">
        <button class="tab-btn ${tab === 'dashboard' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'dashboard'})">Visão Geral</button>
        <button class="tab-btn ${tab === 'products' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'products'})">Produtos</button>
        <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'orders'})">Pedidos</button>
        <button class="tab-btn ${tab === 'customers' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'customers'})">Clientes</button>
        <button class="tab-btn ${tab === 'reviews' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'reviews'})">Avaliações</button>
      </div>
      ${content}
    </div>`;

  $('#maintenanceToggle')?.addEventListener('change', async (e) => {
    await store.saveMaintenance(e.target.checked);
    toast(`Manutenção ${e.target.checked ? 'ON' : 'OFF'}`, 'success');
  });
}
window.deleteProduct = async (id) => {
  if (confirm('Excluir?')) { await store.deleteProduct(id); toast('Excluído!', 'success'); }
};
