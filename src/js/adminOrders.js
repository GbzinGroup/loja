import { store } from './store.js';
import { brl, escapeHtml, toast } from './utils.js';

export async function renderAdminOrders(state) {
  const list = await store.getAllOrders();
  if (!list.length) return `<p class="muted">Nenhum pedido.</p>`;

  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Status</th></tr></thead><tbody>
    ${list.map(o => `
      <tr>
        <td>#${o.id.slice(0,6)}</td>
        <td>${escapeHtml(o.customerName)}<br><small class="muted">${escapeHtml(o.cpf)}</small></td>
        <td>${brl(o.total)}</td>
        <td>
          <select onchange="window.updateOrderStatus('${o.id}', this.value)" style="padding:6px; border-radius:6px; background:var(--bg-elev); color:var(--text);">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pendente</option>
            <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>Pago</option>
            <option value="canceled" ${o.status === 'canceled' ? 'selected' : ''}>Cancelado</option>
          </select>
        </td>
      </tr>`).join('')}
  </tbody></table></div>`;
}

window.updateOrderStatus = async (id, status) => {
  await store.updateOrderStatus(id, status);
  toast('Status atualizado', 'success');
};
