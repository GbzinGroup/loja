import { store } from './store.js';
import { brl, escapeHtml, toast } from './utils.js';

export async function renderAdminOrders(state) {
  const [list, events] = await Promise.all([store.getAllOrders(), store.getPaymentEvents().catch(() => [])]);
  if (!list.length && !events.length) return `<p class="muted">Nenhum pedido ou evento de pagamento.</p>`;

  return `${list.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Status do pedido</th><th>Pagamento</th><th>ID Mercado Pago</th><th>Data</th></tr></thead><tbody>
    ${list.map(o => `
      <tr>
        <td>#${o.id.slice(0,6)}</td>
        <td>${escapeHtml(o.customerName)}<br><small class="muted">${escapeHtml(o.cpf)}</small></td>
        <td>${brl(o.total)}</td>
        <td>
          <select onchange="window.updateOrderStatus('${o.id}', this.value)" style="padding:6px; border-radius:6px; background:var(--bg-elev); color:var(--text);">
            <option value="${o.status}" selected>${escapeHtml(o.status || 'pending')}</option>
            <option value="shipped">Enviado</option>
            <option value="completed">Concluído</option>
            <option value="canceled">Cancelado</option>
          </select>
        </td>
        <td>${escapeHtml(o.paymentStatus || '—')}</td>
        <td><code>${escapeHtml(String(o.paymentId || '—'))}</code></td>
        <td>${escapeHtml(o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('pt-BR') : '—')}</td>
      </tr>`).join('')}
  </tbody></table></div>` : '<p class="muted">Nenhum pedido registrado.</p>'}<section class="card" style="margin-top:24px"><h3>Histórico de notificações do Mercado Pago</h3><p class="muted">Últimos 100 eventos com assinatura validada.</p>${events.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Pedido</th><th>Pagamento</th><th>Status</th><th>Valor</th><th>Resultado</th></tr></thead><tbody>${events.map(e=>`<tr><td>${escapeHtml(e.receivedAt?.toDate ? e.receivedAt.toDate().toLocaleString('pt-BR') : '—')}</td><td><code>${escapeHtml(e.orderId || '—')}</code></td><td><code>${escapeHtml(e.paymentId || '—')}</code></td><td>${escapeHtml(e.paymentStatus || '—')}</td><td>${brl(e.amount || 0)}</td><td>${escapeHtml(e.result || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Ainda não há eventos. Eles aparecerão após o Mercado Pago chamar o webhook.</p>'}</section>`;
}

window.updateOrderStatus = async (id, status) => {
  try { await store.updateOrderStatus(id, status); toast('Status atualizado', 'success'); } catch (e) { console.error(e); toast(e.message || 'Não foi possível atualizar o pedido.', 'error'); }
};
