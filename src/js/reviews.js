import { store } from './store.js';
import { escapeHtml } from './utils.js';

export async function renderReviews(state) {
  return `<p class="muted">Selecione um produto para ver avaliações (ou exiba todas aqui).</p>`;
}