import { firestore } from './firebase-config.js';
import { collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { appEl, brl, escapeHtml, toast, formatDate } from './utils.js';

const PAGE_SIZE = 25;
const stateByUid = new Map();
const amountOf = item => Number(item.amount ?? item.value ?? 0);
const dateOf = item => item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt instanceof Date ? item.createdAt : item.createdAt ? new Date(item.createdAt) : null;
const statusLabel = status => ({pending:'Pendente',registered:'Registrada',approved:'Aprovada',paid:'Paga',completed:'Concluída',rejected:'Recusada',failed:'Falhou',refunded:'Estornada',cancelled:'Cancelada'}[String(status||'').toLowerCase()] || status || 'Registrada');
const typeLabel = type => ({credit:'Crédito',debit:'Débito',topup:'Recarga',wallet_topup:'Recarga Pix',purchase:'Compra',refund:'Estorno',cashback:'Cashback',adjustment:'Ajuste',order:'Pedido'}[String(type||'').toLowerCase()] || type || 'Transação');

export async function renderTransactionHistory(user, options = {}) {
  const root = appEl();
  if (!user?.uid) { root.innerHTML = '<div class="empty-state"><h2>Entre para consultar suas transações</h2><button class="btn btn-primary" onclick="window.navigate(\'login\')">Entrar</button></div>'; return; }
  const uid = user.uid;
  const current = stateByUid.get(uid) || { items: [], filter: 'all', search: '', page: 1, loading: false, error: '' };
  stateByUid.set(uid, current);
  root.innerHTML = `<section class="page-hero"><div class="eyebrow">CONTA / FINANCEIRO</div><h1>Histórico de transações</h1><p>Consulte créditos, débitos, recargas e registros financeiros vinculados à sua conta.</p><div class="flex gap-2 flex-wrap mt-4"><button class="btn btn-outline" onclick="window.navigate('systems',{tab:'wallet'})">Voltar à carteira</button><button class="btn btn-outline" onclick="window.navigate('systems',{tab:'overview'})">Visão geral</button></div></section><section class="card system-card transaction-history"><div class="transaction-summary"><div><span class="muted">Registros encontrados</span><strong id="txCount">—</strong></div><div><span class="muted">Créditos registrados</span><strong id="txCredits">—</strong></div><div><span class="muted">Débitos registrados</span><strong id="txDebits">—</strong></div></div><div class="transaction-controls"><input id="txSearch" type="search" placeholder="Buscar por descrição ou código" value="${escapeHtml(current.search)}" aria-label="Buscar transações"><select id="txFilter" aria-label="Filtrar transações"><option value="all" ${current.filter==='all'?'selected':''}>Todos os tipos</option><option value="credit" ${current.filter==='credit'?'selected':''}>Créditos</option><option value="debit" ${current.filter==='debit'?'selected':''}>Débitos</option><option value="pending" ${current.filter==='pending'?'selected':''}>Pendentes</option><option value="completed" ${current.filter==='completed'?'selected':''}>Concluídas</option><option value="rejected" ${current.filter==='rejected'?'selected':''}>Recusadas</option></select><button class="btn btn-outline" id="txRefresh" type="button">Atualizar</button><button class="btn btn-outline" id="txExport" type="button">Exportar CSV</button></div><div id="txFeedback" class="muted" role="status">${current.loading?'Carregando transações…':''}</div><div id="txRows" class="transaction-rows"></div><div class="transaction-pagination"><span id="txPageLabel" class="muted"></span><div><button class="btn btn-outline" id="txPrev" type="button">Anterior</button> <button class="btn btn-outline" id="txNext" type="button">Próxima</button></div></div></section>`;
  const load = async (force = false) => {
    const feedback = document.getElementById('txFeedback');
    const rows = document.getElementById('txRows');
    if (!feedback || !rows) return;
    feedback.textContent = 'Carregando transações…';
    rows.innerHTML = '<div class="transaction-skeleton"></div><div class="transaction-skeleton"></div><div class="transaction-skeleton"></div>';
    try {
      // Consulta apenas pelo usuário para evitar depender do índice composto userId + createdAt.
      // A ordenação é feita localmente após limitar os registros retornados.
      const result = await getDocs(query(collection(firestore, 'transactions'), where('userId', '==', uid), limit(500)));
      const docs = result.docs;
      current.items = docs.map(snap => ({ id: snap.id, ...snap.data() })).sort((a,b) => (dateOf(b)?.getTime()||0) - (dateOf(a)?.getTime()||0));
      current.error = '';
      renderRows();
    } catch (error) {
      console.error('[Histórico de transações]', error);
      current.error = error.code === 'permission-denied' ? 'O Firestore negou a leitura. Publique as regras que permitem ao cliente ler somente suas próprias transações.' : 'Não foi possível carregar o histórico. Verifique a conexão e tente novamente.';
      feedback.textContent = current.error;
      rows.innerHTML = '<div class="empty-state"><h3>Histórico indisponível</h3><p>Os registros não foram alterados. Tente atualizar novamente.</p></div>';
      document.getElementById('txCount').textContent = '—';
      document.getElementById('txCredits').textContent = '—';
      document.getElementById('txDebits').textContent = '—';
    }
  };
  const renderRows = () => {
    const feedback = document.getElementById('txFeedback');
    const rows = document.getElementById('txRows');
    if (!feedback || !rows) return;
    const search = current.search.trim().toLocaleLowerCase('pt-BR');
    const filtered = current.items.filter(item => {
      const type = String(item.type||'').toLowerCase();
      const status = String(item.status||'registered').toLowerCase();
      const matchesFilter = current.filter==='all' || (current.filter==='credit' ? ['credit','topup','wallet_topup','refund','cashback'].includes(type) : current.filter==='debit' ? ['debit','purchase','order'].includes(type) : current.filter===status || (current.filter==='completed' && ['paid','approved'].includes(status)));
      const haystack = `${item.description||''} ${item.type||''} ${item.orderId||''} ${item.id}`.toLocaleLowerCase('pt-BR');
      return matchesFilter && (!search || haystack.includes(search));
    });
    const credits = filtered.filter(t => ['credit','topup','wallet_topup','refund','cashback'].includes(String(t.type||'').toLowerCase())).reduce((sum,t)=>sum+Math.abs(amountOf(t)),0);
    const debits = filtered.filter(t => ['debit','purchase','order'].includes(String(t.type||'').toLowerCase())).reduce((sum,t)=>sum+Math.abs(amountOf(t)),0);
    document.getElementById('txCount').textContent = String(filtered.length);
    document.getElementById('txCredits').textContent = brl(credits);
    document.getElementById('txDebits').textContent = brl(debits);
    const pageCount = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); current.page=Math.min(current.page,pageCount);
    const pageItems = filtered.slice((current.page-1)*PAGE_SIZE,current.page*PAGE_SIZE);
    feedback.textContent = current.items.length ? `${filtered.length} resultado(s) de ${current.items.length} transação(ões).` : 'Nenhuma transação financeira foi registrada para esta conta.';
    rows.innerHTML = pageItems.length ? pageItems.map(item => {
      const type = String(item.type||'').toLowerCase();
      const positive = ['credit','topup','wallet_topup','refund','cashback'].includes(type);
      const amount = amountOf(item);
      const date = dateOf(item);
      const dateText = date ? formatDate(date) : 'Data não informada';
      const code = item.orderId || item.id;
      return `<article class="transaction-row"><div class="transaction-mark ${positive?'is-credit':'is-debit'}" aria-hidden="true">${positive?'+':'−'}</div><div class="transaction-description"><strong>${escapeHtml(item.description||typeLabel(item.type))}</strong><span>${escapeHtml(typeLabel(item.type))} · ${escapeHtml(dateText)}</span><small>Referência: ${escapeHtml(String(code).slice(0,18))}</small></div><div class="transaction-value"><strong class="${positive?'text-credit':'text-debit'}">${positive?'+':(['debit','purchase','order'].includes(type)?'−':'')}${brl(Math.abs(amount))}</strong><span class="transaction-status status-${escapeHtml(String(item.status||'registered').toLowerCase().replace(/[^a-z0-9_-]/g,''))}">${escapeHtml(statusLabel(item.status))}</span></div></article>`;
    }).join('') : '<div class="empty-state"><h3>Nenhum resultado</h3><p>Não há transações para os filtros selecionados.</p></div>';
    document.getElementById('txPageLabel').textContent = `Página ${current.page} de ${pageCount}`;
    document.getElementById('txPrev').disabled = current.page<=1;
    document.getElementById('txNext').disabled = current.page>=pageCount;
  };
  document.getElementById('txSearch').addEventListener('input', e=>{current.search=e.target.value;current.page=1;renderRows();});
  document.getElementById('txFilter').addEventListener('change',e=>{current.filter=e.target.value;current.page=1;renderRows();});
  document.getElementById('txRefresh').addEventListener('click',()=>load(true));
  document.getElementById('txPrev').addEventListener('click',()=>{current.page=Math.max(1,current.page-1);renderRows();});
  document.getElementById('txNext').addEventListener('click',()=>{current.page++;renderRows();});
  document.getElementById('txExport').addEventListener('click',()=>{
    const csvRows = [['Data','Descricao','Tipo','Status','Valor','Referencia'], ...current.items.map(t=>[dateOf(t)?.toISOString()||'',t.description||'',typeLabel(t.type),statusLabel(t.status),amountOf(t),t.orderId||t.id])];
    const csv = '\ufeff' + csvRows.map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a'); link.href=url; link.download='gbzin-shop-transacoes.csv'; link.click(); URL.revokeObjectURL(url);
    toast('Arquivo CSV preparado.','success');
  });
  await load();
}