import { store } from './store.js';
import { escapeHtml } from './utils.js';

export async function renderCustomers(state) {
  const customers = await store.getAllCustomers();
  if (!customers.length) return `<p class="muted">Nenhum cliente.</p>`;

  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nome</th><th>E-mail</th></tr></thead><tbody>
    ${customers.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
