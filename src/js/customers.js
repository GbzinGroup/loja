import { store } from './store.js';
import { escapeHtml, formatDate } from './utils.js';

export async function renderCustomers(state) {
  try {
    const customers = await store.getAllCustomers();
    if (!customers.length) return `<div class="card system-card"><h2>Clientes</h2><p class="muted">Nenhum perfil de cliente foi encontrado no Firestore. Os usuários precisam ter criado uma conta e o perfil precisa existir em <code>customers</code>.</p></div>`;
    return `<div class="card system-card"><div class="flex-between mb-4"><div><h2>Clientes cadastrados</h2><p class="muted">${customers.length} perfil(is) localizado(s).</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Nome</th><th>E-mail</th><th>UID</th><th>Cadastro</th></tr></thead><tbody>
      ${customers.map(c => `<tr><td><strong>${escapeHtml(c.name || 'Cliente')}</strong></td><td>${escapeHtml(c.email || '—')}</td><td><code>${escapeHtml(c.id || '')}</code></td><td>${escapeHtml(formatDate(c.createdAt))}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  } catch (error) {
    console.error('[Painel clientes] Falha ao listar clientes:', error);
    return `<div class="card system-card"><h2>Clientes</h2><p class="muted">Não foi possível carregar os clientes. Verifique se as regras do Firestore permitem leitura da coleção <code>customers</code> para administradores.</p><p class="muted">Detalhe técnico: ${escapeHtml(error?.code || error?.message || 'erro desconhecido')}</p></div>`;
  }
}
