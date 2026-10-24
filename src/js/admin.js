/* =====================================================================
   admin.js — Painel Administrativo
   ===================================================================== */
import { store } from './store.js';
import { $, appEl, brl, escapeHtml, toast } from './utils.js';
import { renderAdminOrders } from './adminOrders.js';
import { renderCustomers } from './customers.js';
import { firestore, auth } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
    const [requestResult, walletResult, transactionResult] = await Promise.allSettled([
      getDocs(query(collection(firestore, 'systemRequests'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(firestore, 'wallets'), limit(100))),
      getDocs(query(collection(firestore, 'transactions'), orderBy('createdAt', 'desc'), limit(100)))
    ]);
    const requests = requestResult.status === 'fulfilled' ? requestResult.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    const wallets = walletResult.status === 'fulfilled' ? walletResult.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    const transactions = transactionResult.status === 'fulfilled' ? transactionResult.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    const pendingRequests = requests.filter(r => (r.status || 'pending') === 'pending').length;
    const pendingTopups = requests.filter(r => r.kind === 'wallet_topup' && (r.status || 'pending') === 'pending').length;
    const pendingRewardsPartners = requests.filter(r => ['reward','partner'].includes(r.kind) && (r.status || 'pending') === 'pending').length;
    content = `<div class="dashboard-grid request-overview-grid"><article class="card system-stat"><span class="muted">Solicitações pendentes</span><strong>${pendingRequests}</strong><small>Precisam de análise</small></article><article class="card system-stat"><span class="muted">Recargas pendentes</span><strong>${pendingTopups}</strong><small>Confira os comprovantes</small></article><article class="card system-stat"><span class="muted">Benefícios e parceiros</span><strong>${pendingRewardsPartners}</strong><small>Recompensas e afiliados</small></article></div><div class="card system-card"><div class="flex-between flex-wrap gap-3"><div><h2>Central de solicitações e carteira</h2><p class="muted">Gerencie recargas, pagamentos informados, resgates de recompensas, parcerias e códigos em um só lugar. Aprovar uma solicitação não confirma automaticamente um Pix.</p></div><div class="flex gap-2 flex-wrap"><button class="btn btn-outline" type="button" onclick="document.getElementById('adminRequestKind').value='reward';window.filterAdminRequests()">Recompensas</button><button class="btn btn-outline" type="button" onclick="document.getElementById('adminRequestKind').value='partner';window.filterAdminRequests()">Afiliados</button><button class="btn btn-outline" type="button" onclick="document.getElementById('adminRequestKind').value='';document.getElementById('adminRequestStatus').value='pending';window.filterAdminRequests()">Ver pendentes</button></div></div>${requestResult.status === 'rejected' ? '<p class="muted">Não foi possível carregar as solicitações. Confira as regras do Firestore.</p>' : ''}<div class="request-filters"><input id="adminRequestSearch" type="search" placeholder="Buscar título, UID, código ou detalhe..." oninput="window.filterAdminRequests()"><select id="adminRequestKind" onchange="window.filterAdminRequests()"><option value="">Todos os tipos</option><option value="wallet_topup">Recargas</option><option value="order_payment_review">Pagamentos</option><option value="reward">Recompensas</option><option value="partner">Afiliados/parcerias</option><option value="redeem_code">Códigos</option></select><select id="adminRequestStatus" onchange="window.filterAdminRequests()"><option value="">Todos os status</option><option value="pending">Em análise</option><option value="approved">Aprovadas</option><option value="rejected">Recusadas</option><option value="completed">Concluídas</option><option value="payment_confirmed">Pix conferido</option></select><span class="system-pill">${requests.length} registro(s)</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Solicitação</th><th>Cliente</th><th>Detalhes</th><th>Status</th><th>Ações</th></tr></thead><tbody id="adminRequestsRows">${requests.length ? requests.map(r => `<tr data-request-kind="${escapeHtml(r.kind||'')}" data-request-status="${escapeHtml(r.status||'pending')}" data-request-search="${escapeHtml([r.title,r.kind,r.userId,r.note,r.code,r.amount].filter(Boolean).join(' ').toLowerCase())}"><td><strong>${escapeHtml(r.title || r.kind || 'Solicitação')}</strong><br><small class="muted">${escapeHtml(r.kind || '')}</small></td><td><code>${escapeHtml(r.userId || '')}</code></td><td>${r.amount ? brl(r.amount) : ''}${r.note ? `<br>${escapeHtml(r.note)}` : ''}${r.code ? `<br>Código: ${escapeHtml(r.code)}` : ''}</td><td><span class="system-pill">${escapeHtml(r.kind==='order_payment_review' && r.status==='approved' && !r.paymentConfirmedAt ? 'Solicitação aprovada · Pix não confirmado' : ({pending:'Em análise',approved:'Aprovada',rejected:'Recusada',completed:'Concluída',payment_confirmed:'Pix conferido · pedido pendente'})[r.status]||r.status||'Em análise')}</span></td><td><div class="flex gap-2 flex-wrap">${r.kind==='order_payment_review' ? `<button class="btn btn-primary" onclick="window.updateSystemRequest('${r.id}','payment_confirmed')" ${r.status!=='pending'?'disabled':''}>Marcar Pix conferido</button>` : `<button class="btn btn-outline" onclick="window.updateSystemRequest('${r.id}','approved')" ${r.status!=='pending'?'disabled':''}>Aprovar</button>`}<button class="btn btn-danger" onclick="window.updateSystemRequest('${r.id}','rejected')" ${r.status!=='pending'?'disabled':''}>Recusar</button><button class="btn btn-danger" onclick="window.deleteSystemRequest('${r.id}')">Excluir</button></div></td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhuma solicitação.</td></tr>'}</tbody></table></div><p id="adminRequestsEmptyFilter" class="muted" hidden>Nenhuma solicitação corresponde aos filtros.</p></div>
    <div class="card system-card"><h2>Carteiras dos clientes</h2><p class="muted">Excluir uma carteira remove o documento do saldo atual, mas não apaga o histórico de transações. Use com cuidado.</p>${walletResult.status === 'rejected' ? '<p class="muted">Não foi possível carregar as carteiras. Confira as regras do Firestore.</p>' : ''}<div class="table-wrap"><table class="data-table"><thead><tr><th>UID do cliente</th><th>Saldo</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>${wallets.length ? wallets.map(w => `<tr><td><code>${escapeHtml(w.id)}</code></td><td><strong>${brl(Number(w.balance || 0))}</strong></td><td>${escapeHtml(w.updatedAt?.toDate ? w.updatedAt.toDate().toLocaleString('pt-BR') : '—')}</td><td><button class="btn btn-danger" onclick="window.deleteWallet('${w.id}')">Excluir carteira</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">Nenhuma carteira encontrada.</td></tr>'}</tbody></table></div></div>
    <div class="card system-card"><h2>Histórico de transações da carteira</h2><p class="muted">Excluir aqui remove apenas o registro do extrato; não altera o saldo da carteira nem reverte pagamentos.</p>${transactionResult.status === 'rejected' ? '<p class="muted">Não foi possível carregar as transações. Confira as regras do Firestore.</p>' : ''}<div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>${transactions.length ? transactions.map(t => `<tr><td><code>${escapeHtml(t.userId || '')}</code></td><td>${escapeHtml(t.description || t.type || 'Transação')}</td><td>${brl(Number(t.amount || 0))}</td><td>${escapeHtml(t.status || 'registrada')}</td><td><button class="btn btn-danger" onclick="window.deleteWalletTransaction('${t.id}')">Excluir registro</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhuma transação encontrada.</td></tr>'}</tbody></table></div></div>
    <div class="card system-card"><h2>Ajuste manual de carteira</h2><p class="muted">Use apenas após conferir o motivo e os comprovantes. Toda operação gera uma transação de auditoria.</p><form id="walletAdjustForm" class="system-form"><label>UID do cliente<input id="walletUid" required maxlength="128"></label><label>Operação<select id="walletOperation"><option value="credit">Creditar</option><option value="debit">Debitar</option></select></label><label>Valor (R$)<input id="walletAdjustAmount" type="number" min="0.01" max="100000" step="0.01" required></label><label>Descrição<input id="walletAdjustDescription" maxlength="160" required></label><button class="btn btn-primary">Registrar ajuste</button></form></div>`;
    content += `<div class="card system-card"><div class="flex-between flex-wrap gap-3"><div><h2>Programa de benefícios e fidelidade</h2><p class="muted">A central reúne os pedidos de resgate e parcerias; para editar catálogo e pontos, use a gestão avançada abaixo.</p></div><button class="btn btn-outline" type="button" onclick="window.navigate('admin',{tab:'rewards'})">Gerenciar catálogo e pontos</button></div></div>`;
  }
  else if (tab === 'codes') {
    const [codesResult, requestsResult] = await Promise.allSettled([
      getDocs(query(collection(firestore, 'promoCodes'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(firestore, 'systemRequests'), where('kind', '==', 'redeem_code'), limit(100)))
    ]);
    const codes = codesResult.status === 'fulfilled' ? codesResult.value.docs.map(d => ({id:d.id,...d.data()})) : [];
    const codeRequests = requestsResult.status === 'fulfilled' ? requestsResult.value.docs.map(d => ({id:d.id,...d.data()})) : [];
    content = `<div class="card system-card"><div class="flex-between flex-wrap gap-3"><div><span class="eyebrow">CAMPANHAS E BENEFÍCIOS</span><h2>Códigos promocionais</h2><p class="muted">Crie códigos que os clientes podem enviar para validação. Nenhum saldo ou benefício é liberado pelo navegador; a equipe precisa aprovar a solicitação.</p></div><span class="system-pill">${codes.length} código(s)</span></div>
      <form id="adminPromoCodeForm" class="system-form"><label>Código<input id="promoCodeValue" required minlength="3" maxlength="64" pattern="[A-Za-z0-9_-]+" placeholder="GBZIN-2026"></label><label>Descrição do benefício<input id="promoCodeDescription" required maxlength="180" placeholder="Ex.: bônus de boas-vindas"></label><label>Tipo de recompensa<select id="promoCodeRewardType"><option value="virtual_money">Dinheiro virtual (carteira)</option><option value="points">Pontos de recompensa</option><option value="manual">Benefício manual</option></select></label><label>Valor da recompensa<input id="promoCodeRewardAmount" type="number" min="0" max="100000" step="0.01" value="10.00" required></label><label>Limite de resgates<input id="promoCodeMaxUses" type="number" min="1" max="100000" step="1" value="1" required></label><label>Validade (opcional)<input id="promoCodeExpiry" type="datetime-local"></label><button class="btn btn-primary" type="submit">Criar código</button></form>
      ${codesResult.status === 'rejected' ? '<p class="muted">Não foi possível carregar os códigos. Publique as regras atualizadas do Firestore.</p>' : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Benefício</th><th>Uso</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>${codes.length ? codes.map(c=>`<tr><td><code>${escapeHtml(c.code||'')}</code></td><td>${escapeHtml(c.description||'')}<br><small class="muted">${c.rewardType==='virtual_money'?`Carteira: ${brl(Number(c.rewardAmount||0))}`:c.rewardType==='points'?`${Number(c.rewardAmount||0)} pontos`:'Benefício manual'}</small></td><td>${Number(c.usedCount||0)} / ${Number(c.maxUses||1)}</td><td>${escapeHtml(c.expiresAt?.toDate ? c.expiresAt.toDate().toLocaleString('pt-BR') : 'Sem validade')}</td><td>${c.active ? 'Ativo' : 'Pausado'}</td><td><button class="btn btn-outline" onclick="window.togglePromoCode('${c.id}',${!c.active})">${c.active?'Pausar':'Ativar'}</button> <button class="btn btn-danger" onclick="window.deletePromoCode('${c.id}')">Excluir</button></td></tr>`).join('') : '<tr><td colspan="6" class="muted">Nenhum código criado ainda.</td></tr>'}</tbody></table></div>`}</div>
      <div class="card system-card"><h2>Solicitações de resgate de códigos</h2><p class="muted">Confira o cliente e o código antes de aprovar. Aprovações respeitam o limite de usos.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Código</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>${codeRequests.length ? codeRequests.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).map(r=>`<tr><td><code>${escapeHtml(r.userId||'')}</code></td><td><strong>${escapeHtml(r.code||'')}</strong><br><small>${escapeHtml(r.rewardDescription||'')}</small></td><td>${escapeHtml(r.createdAt?.toDate?r.createdAt.toDate().toLocaleString('pt-BR'):'—')}</td><td>${escapeHtml(({pending:'Em análise',approved:'Aprovada',rejected:'Recusada'})[r.status]||r.status||'Em análise')}</td><td><button class="btn btn-primary" onclick="window.updateSystemRequest('${r.id}','approved')" ${r.status!=='pending'?'disabled':''}>Aprovar</button> <button class="btn btn-danger" onclick="window.updateSystemRequest('${r.id}','rejected')" ${r.status!=='pending'?'disabled':''}>Recusar</button></td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhum resgate solicitado.</td></tr>'}</tbody></table></div></div>`;
  }
  else if (tab === 'messages') {
    const [messagesResult, customersResult] = await Promise.allSettled([
      getDocs(query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'), limit(60))),
      getDocs(query(collection(firestore, 'customers'), limit(500)))
    ]);
    const messages = messagesResult.status === 'fulfilled' ? messagesResult.value.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    const customers = customersResult.status === 'fulfilled' ? customersResult.value.docs : [];
    content = `<section class="messages-admin-hero card system-card"><div class="messages-admin-icon" aria-hidden="true">✦</div><div><span class="eyebrow">COMUNICAÇÃO DA LOJA</span><h2>Mensagens e avisos</h2><p class="muted">Envie comunicados para a central do cliente ou crie um toast que aparece quando a pessoa entrar na loja. Tudo usa a paleta azul da Gbzin Shop.</p></div><div class="messages-admin-stats"><span><strong>${messages.length}</strong><small>avisos recentes</small></span><span><strong>${customers.length}</strong><small>perfis carregados</small></span></div></section>
    <div class="messages-admin-layout"><section class="card system-card"><div class="messages-section-heading"><div><h3>Criar comunicado</h3><p class="muted">Escolha o público, o formato e confira a prévia antes de publicar.</p></div><span class="system-pill">Administração</span></div>
    <form id="adminMessageForm" class="system-form messages-admin-form">
      <label>Título<input id="adminMessageTitle" required minlength="2" maxlength="160" placeholder="Ex.: Novidades da Gbzin Shop"></label>
      <label>Mensagem<textarea id="adminMessageBody" required minlength="2" maxlength="2000" rows="5" placeholder="Escreva um aviso curto, útil e claro para os clientes..."></textarea><small class="muted">Até 2.000 caracteres.</small></label>
      <div class="messages-form-row"><label>Formato<select id="adminMessageType"><option value="message">Mensagem na central da conta</option><option value="startup_toast">Toast ao iniciar / entrar</option></select></label><label>Destinatários<select id="adminMessageAudience"><option value="all">Clientes encontrados (até 500 por envio)</option><option value="one">Um cliente específico</option></select></label></div>
      <label id="adminMessageUidWrap" hidden>UID do cliente<input id="adminMessageUid" maxlength="128" placeholder="Cole o UID exato do cliente"></label>
      <div class="messages-preview-wrap"><span class="eyebrow">PRÉVIA</span><article class="messages-preview-card"><span class="messages-preview-mark">✦ <span id="adminMessagePreviewLabel">AVISO DA LOJA</span></span><strong id="adminMessagePreviewTitle">Título do comunicado</strong><p id="adminMessagePreviewBody">Sua mensagem aparecerá aqui para você conferir o visual.</p><small>GBZIN SHOP · AGORA</small></article></div>
      <label class="messages-confirm"><input type="checkbox" id="adminMessageConfirm" required><span>Revisei o texto e confirmo o envio para o público selecionado.</span></label>
      <button class="btn btn-primary messages-publish-btn" id="adminMessagePublish" type="submit">Publicar comunicado <span aria-hidden="true">→</span></button>
      ${customersResult.status === 'rejected' ? '<p class="muted">A lista de clientes não pôde ser carregada. Você ainda pode enviar para um UID específico, se as regras permitirem.</p>' : `<p class="muted messages-admin-footnote">O envio em massa considera até ${customers.length} perfis nesta consulta. Para uma base maior, use paginação ou um processo de backend.</p>`}
    </form></section>
    <section class="card system-card messages-history-card"><div class="messages-section-heading"><div><h3>Publicações recentes</h3><p class="muted">Mensagens e toasts publicados recentemente.</p></div><button type="button" class="btn btn-outline" onclick="window.navigate('admin',{tab:'messages'})">Atualizar</button></div>
    ${messagesResult.status === 'rejected' ? '<div class="empty-state"><h3>Não foi possível carregar o histórico</h3><p>Confira as regras do Firestore.</p></div>' : messages.length ? `<div class="messages-history-list">${messages.map(m => `<article class="messages-history-item"><div class="messages-history-top"><span class="messages-type-chip ${m.type === 'startup_toast' ? 'is-toast' : ''}">${m.type === 'startup_toast' ? 'Toast de entrada' : 'Mensagem'}</span><time>${escapeHtml(m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString('pt-BR') : 'Recente')}</time></div><strong>${escapeHtml(m.title || 'Aviso da loja')}</strong><p>${escapeHtml(m.message || '')}</p><small class="muted">Destinatário: <code>${escapeHtml(m.userId || '—')}</code></small><div style="margin-top:10px"><button class="btn btn-danger" type="button" onclick="window.deleteAdminNotification('${m.id}')">Excluir mensagem</button></div></article>`).join('')}</div>` : '<div class="empty-state"><h3>Nenhum comunicado publicado</h3><p>As publicações aparecerão aqui depois do primeiro envio.</p></div>'}</section></div>`;
  }
  else if (tab === 'rewards') {
    const [customersResult, rewardsResult, requestsResult] = await Promise.allSettled([
      getDocs(query(collection(firestore, 'customers'), limit(150))),
      getDocs(query(collection(firestore, 'rewardsCatalog'), limit(100))),
      getDocs(query(collection(firestore, 'systemRequests'), where('kind', '==', 'reward'), limit(100)))
    ]);
    const customers = customersResult.status === 'fulfilled' ? customersResult.value.docs.map(d=>({id:d.id,...d.data()})) : [];
    const rewards = rewardsResult.status === 'fulfilled' ? rewardsResult.value.docs.map(d=>({id:d.id,...d.data()})) : [];
    const rewardRequests = requestsResult.status === 'fulfilled' ? requestsResult.value.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)) : [];
    content = `<div class="card system-card"><h2>Programa de recompensas</h2><p class="muted">Gerencie o catálogo e ajuste pontos de fidelidade. Os pontos ficam salvos no Firestore e continuam após atualizar a página.</p>
      <form id="rewardPointsForm" class="system-form"><label>UID do cliente<select id="rewardCustomerUid" required><option value="">Selecione um cliente</option>${customers.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name||c.email||c.id)} · ${escapeHtml(c.id)}</option>`).join('')}</select></label><label>Operação<select id="rewardPointsOperation"><option value="add">Adicionar pontos</option><option value="remove">Remover pontos</option><option value="set">Definir saldo</option></select></label><label>Quantidade de pontos<input id="rewardPointsAmount" type="number" min="0" max="10000000" step="1" required></label><label>Motivo do ajuste<input id="rewardPointsReason" maxlength="160" required placeholder="Ex.: campanha de lançamento"></label><button class="btn btn-primary">Salvar pontos</button></form>
      ${customersResult.status==='rejected'?'<p class="muted">Não foi possível listar clientes. Confira as regras do Firestore.</p>':''}</div>
      <div class="card system-card"><h2>Criar recompensa</h2><form id="rewardCatalogForm" class="system-form"><label>Nome<input id="rewardTitle" required maxlength="120" placeholder="Ex.: Cupom de 10%"></label><label>Descrição<input id="rewardDescription" maxlength="500" placeholder="Detalhes do benefício"></label><label>Custo em pontos<input id="rewardCost" type="number" min="0" max="10000000" step="1" required></label><label>Tipo<select id="rewardType"><option value="coupon">Cupom</option><option value="vip">Benefício VIP</option><option value="digital">Produto digital</option><option value="other">Outro benefício</option></select></label><button class="btn btn-primary">Publicar recompensa</button></form><h3 class="mt-4">Catálogo publicado</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Recompensa</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rewards.length?rewards.map(r=>`<tr><td><strong>${escapeHtml(r.title||'Recompensa')}</strong><br><small class="muted">${escapeHtml(r.description||'')}</small></td><td>${Number(r.cost||0).toLocaleString('pt-BR')} pontos</td><td>${r.active?'Ativa':'Pausada'}</td><td><div class="flex gap-2 flex-wrap"><button class="btn btn-outline" onclick="window.toggleReward('${r.id}',${!r.active})">${r.active?'Pausar':'Ativar'}</button><button class="btn btn-danger" onclick="window.deleteReward('${r.id}')">Excluir</button></div></td></tr>`).join(''):'<tr><td colspan="4" class="muted">Nenhuma recompensa publicada.</td></tr>'}</tbody></table></div>${rewardsResult.status==='rejected'?'<p class="muted">Não foi possível carregar o catálogo. Confira as regras do Firestore.</p>':''}</div>
      <div class="card system-card"><h2>Solicitações de resgate</h2><p class="muted">A aprovação desconta os pontos no mesmo processo; se não houver saldo, o resgate não será aprovado.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Recompensa</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rewardRequests.length?rewardRequests.map(r=>`<tr><td><code>${escapeHtml(r.userId||'')}</code></td><td>${escapeHtml(r.title||'Recompensa')}</td><td>${Number(r.rewardCost||0).toLocaleString('pt-BR')} pontos</td><td>${escapeHtml(r.status||'pending')}</td><td>${r.status==='pending'?`<div class="flex gap-2 flex-wrap"><button class="btn btn-primary" onclick="window.reviewRewardRequest('${r.id}','approved')">Aprovar e descontar</button><button class="btn btn-danger" onclick="window.reviewRewardRequest('${r.id}','rejected')">Recusar</button></div>`:'—'}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">Nenhum resgate solicitado.</td></tr>'}</tbody></table></div>${requestsResult.status==='rejected'?'<p class="muted">Não foi possível carregar os resgates. Confira as regras do Firestore.</p>':''}</div>`;
  }
  else if (tab === 'dashboard') {
    const orders = await store.getAllOrders();
    const paidOrders = orders.filter(o => ['paid','shipped','completed'].includes(o.status));
    const pendingOrders = orders.filter(o => ['pending','awaiting_payment','payment_review'].includes(o.status));
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const averageOrder = paidOrders.length ? totalRevenue / paidOrders.length : 0;
    const recentOrders = [...orders].sort((a,b) => ((b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime() || 0) - (a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime() || 0))).slice(0,5);
    const statusLabel = s => ({paid:'Pago',shipped:'Enviado',completed:'Concluído',pending:'Pendente',awaiting_payment:'Aguardando pagamento',payment_review:'Em análise',canceled:'Cancelado',cancelled:'Cancelado'})[s] || s || 'Indefinido';
    content = `
      <section class="admin-welcome card system-card"><div><span class="eyebrow">CENTRAL DE CONTROLE</span><h2>Painel da Gbzin Shop</h2><p class="muted">Resumo operacional da loja, com atalhos para as tarefas mais importantes.</p></div><span class="system-pill">${state.maintenance ? 'Modo manutenção ativo' : 'Loja em funcionamento'}</span></section>
      <div class="dashboard-grid admin-metrics-grid">
        <article class="stat-card green"><div class="label">Faturamento confirmado</div><h2 style="color: var(--success);">${brl(totalRevenue)}</h2><small>${paidOrders.length} pedido(s) pagos ou concluídos</small></article>
        <article class="stat-card purple"><div class="label">Produtos cadastrados</div><h2>${state.products.length}</h2><small>Catálogo atual</small></article>
        <article class="stat-card warning"><div class="label">Pedidos aguardando</div><h2>${pendingOrders.length}</h2><small>Precisam de acompanhamento</small></article>
        <article class="stat-card"><div class="label">Ticket médio</div><h2>${brl(averageOrder)}</h2><small>Por pedido confirmado</small></article>
      </div>
      <div class="card system-card"><div class="flex-between flex-wrap gap-3"><div><h3>Ações rápidas</h3><p class="muted">Acesse diretamente as áreas mais usadas do painel.</p></div><div class="flex gap-2 flex-wrap"><button class="btn btn-primary" onclick="window.navigate('admin',{tab:'products'})">＋ Novo produto</button><button class="btn btn-outline" onclick="window.navigate('admin',{tab:'orders'})">Gerenciar pedidos</button><button class="btn btn-outline" onclick="window.navigate('admin',{tab:'customers'})">Ver clientes</button><button class="btn btn-outline" onclick="window.navigate('admin',{tab:'systemRequests'})">Solicitações e carteira</button></div></div></div>
      <div class="card system-card"><div class="flex-between flex-wrap gap-3"><div><h3>Pedidos recentes</h3><p class="muted">Últimos pedidos registrados na loja.</p></div><button class="btn btn-outline" onclick="window.navigate('admin',{tab:'orders'})">Ver todos</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th></tr></thead><tbody>${recentOrders.length ? recentOrders.map(o => `<tr><td><strong>#${escapeHtml(String(o.id || '').slice(0,8).toUpperCase())}</strong></td><td>${escapeHtml(o.customerName || o.name || o.email || 'Cliente')}</td><td>${escapeHtml(o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString('pt-BR') : (o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '—'))}</td><td>${brl(Number(o.total || 0))}</td><td><span class="system-pill">${escapeHtml(statusLabel(o.status))}</span></td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhum pedido registrado ainda.</td></tr>'}</tbody></table></div></div>
      <div class="card system-card maintenance-panel"><div><h3>Modo de manutenção</h3><p class="muted">Use quando precisar pausar temporariamente a loja durante uma atualização.</p></div><label class="switch"><input type="checkbox" id="maintenanceToggle" ${state.maintenance ? 'checked' : ''}><span class="slider"></span></label></div>
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
    const coupons = Object.values(state.coupons || {}).filter(c => /^[A-Z0-9_-]{3,50}$/.test(String(c?.code || '')));
    
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
      
      <h3 class="mb-4">Cupons cadastrados</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Desconto</th><th>Tipo</th><th>Ativo</th><th>Visibilidade na conta</th><th class="text-right">Ações</th></tr></thead>
          <tbody>
            ${coupons.length ? coupons.map(c => `
              <tr>
                <td><strong style="color: var(--primary); font-size: 1rem;">${c.code}</strong></td>
                <td>${c.type === 'percent' ? `${c.discount}%` : brl(c.discount)}</td>
                <td>${c.type === 'percent' ? 'Porcentagem' : 'Valor Fixo'}</td>
                <td><label class="switch" title="Ativar ou desativar o cupom"><input type="checkbox" ${c.active === true ? 'checked' : ''} onchange="window.toggleCouponActive('${c.code}', this.checked)"><span class="slider"></span></label><small class="muted" style="display:block">${c.active === true ? 'Ativo' : 'Desativado'}</small></td>
                <td><label class="switch" title="Mostrar este cupom na conta dos clientes"><input type="checkbox" ${c.showInAccount === true ? 'checked' : ''} onchange="window.toggleCouponVisibility('${c.code}', this.checked)" ${c.active !== true ? 'disabled' : ''}><span class="slider"></span></label><small class="muted" style="display:block">${c.showInAccount === true && c.active === true ? 'Publicado' : 'Oculto'}</small></td>
                <td class="text-right">
                  <button class="btn btn-danger" onclick="window.deleteCoupon('${c.code}')">Excluir</button>
                </td>
              </tr>`).join('') 
            : '<tr><td colspan="6" class="muted text-center" style="padding: 20px;">Nenhum cupom cadastrado.</td></tr>'}
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
        <button class="tab-btn ${tab === 'messages' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'messages'})">Mensagens e avisos</button>
        <button class="tab-btn ${tab === 'codes' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'codes'})">Códigos promocionais</button>
        <button class="tab-btn ${tab === 'systemRequests' || tab === 'rewards' ? 'active' : ''}" onclick="window.navigate('admin', {tab:'systemRequests'})">Solicitações e carteira</button>
        <button class="tab-btn" onclick="window.navigate('vip')">Clube VIP</button>
        <button class="tab-btn" onclick="window.navigate('support')">Suporte</button>
      </div>
      ${content}
    </div>
  `;

  // ================== EVENTOS ==================
  const promoRewardTypeInput = $('#promoCodeRewardType');
  const promoRewardAmountInput = $('#promoCodeRewardAmount');
  const syncPromoRewardInput = () => {
    if (!promoRewardTypeInput || !promoRewardAmountInput) return;
    const manual = promoRewardTypeInput.value === 'manual';
    promoRewardAmountInput.disabled = manual;
    promoRewardAmountInput.required = !manual;
    promoRewardAmountInput.step = promoRewardTypeInput.value === 'points' ? '1' : '0.01';
    promoRewardAmountInput.min = promoRewardTypeInput.value === 'manual' ? '0' : '0.01';
    if (manual) promoRewardAmountInput.value = '0';
    else if (Number(promoRewardAmountInput.value) <= 0) promoRewardAmountInput.value = promoRewardTypeInput.value === 'points' ? '10' : '10.00';
  };
  promoRewardTypeInput?.addEventListener('change', syncPromoRewardInput);
  syncPromoRewardInput();

  $('#adminPromoCodeForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const code = ($('#promoCodeValue')?.value || '').trim().toUpperCase();
    const description = ($('#promoCodeDescription')?.value || '').trim();
    const maxUses = Number($('#promoCodeMaxUses')?.value || 1);
    const rewardType = $('#promoCodeRewardType')?.value || 'manual';
    const rawRewardAmount = ($('#promoCodeRewardAmount')?.value || '0').trim().replace(',', '.');
    const rewardAmount = rewardType === 'manual' ? 0 : Number(rawRewardAmount);
    const expiryValue = $('#promoCodeExpiry')?.value;
    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) return toast('O código deve ter de 3 a 64 caracteres: letras, números, hífen ou sublinhado.', 'error');
    if (description.length < 2) return toast('Informe uma descrição de pelo menos 2 caracteres.', 'error');
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) return toast('O limite de usos deve ser um número inteiro entre 1 e 100.000.', 'error');
    if (!['virtual_money','points','manual'].includes(rewardType)) return toast('Selecione um tipo de recompensa válido.', 'error');
    if (rewardType !== 'manual' && (!rawRewardAmount || !Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100000)) return toast('Informe um valor de recompensa maior que zero e até 100.000.', 'error');
    if (rewardType === 'points' && !Number.isInteger(rewardAmount)) return toast('A recompensa em pontos precisa ser um número inteiro.', 'error');
    try {
      const existing = await getDocs(query(collection(firestore, 'promoCodes'), where('code', '==', code), limit(1)));
      if (!existing.empty) return toast('Este código já existe. Escolha outro.', 'error');
      const data = { code, description, rewardType, rewardAmount, active: true, maxUses, usedCount: 0, createdAt: serverTimestamp(), createdBy: state.user?.uid || '' };
      if (expiryValue) { const date = new Date(expiryValue); if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return toast('A validade precisa ser uma data futura.', 'error'); data.expiresAt = date; }
      await addDoc(collection(firestore, 'promoCodes'), data);
      toast('Código promocional criado.', 'success'); window.navigate('admin', {tab:'codes'});
    } catch (err) { console.error('[Códigos promocionais]', err); toast('Não foi possível criar o código. Publique as regras atualizadas do Firestore.', 'error'); }
  });
  window.togglePromoCode = async (id, active) => { try { await updateDoc(doc(firestore,'promoCodes',id), {active:Boolean(active), updatedAt:serverTimestamp()}); toast(active?'Código ativado.':'Código pausado.','success'); window.navigate('admin',{tab:'codes'}); } catch(err) { console.error(err); toast('Não foi possível alterar o código. Confira as regras Firestore.','error'); } };
  window.deletePromoCode = async id => { if(!state.isAdmin || !id || !confirm('Excluir este código promocional?')) return; try { await deleteDoc(doc(firestore,'promoCodes',id)); toast('Código excluído.','success'); window.navigate('admin',{tab:'codes'}); } catch(err) { console.error(err); toast('Não foi possível excluir o código. Confira as regras Firestore.','error'); } };
  window.deleteAdminNotification = async id => { if(!state.isAdmin || !id || !confirm('Excluir esta mensagem/toast do histórico e da central do destinatário?')) return; try { await deleteDoc(doc(firestore,'notifications',id)); toast('Mensagem excluída.','success'); window.navigate('admin',{tab:'messages'}); } catch(err) { console.error(err); toast('Não foi possível excluir a mensagem. Confira as regras Firestore.','error'); } };

  const messageAudience = $('#adminMessageAudience');
  const messageUidWrap = $('#adminMessageUidWrap');
  const messageType = $('#adminMessageType');
  const messageTitle = $('#adminMessageTitle');
  const messageBody = $('#adminMessageBody');
  const updateMessagePreview = () => {
    const title = $('#adminMessagePreviewTitle'); const body = $('#adminMessagePreviewBody'); const label = $('#adminMessagePreviewLabel');
    if (title) title.textContent = messageTitle?.value.trim() || 'Título do comunicado';
    if (body) body.textContent = messageBody?.value.trim() || 'Sua mensagem aparecerá aqui para você conferir o visual.';
    if (label) label.textContent = messageType?.value === 'startup_toast' ? 'TOAST DE ENTRADA' : 'AVISO DA LOJA';
  };
  messageAudience?.addEventListener('change', () => { if (messageUidWrap) messageUidWrap.hidden = messageAudience.value !== 'one'; });
  messageTitle?.addEventListener('input', updateMessagePreview);
  messageBody?.addEventListener('input', updateMessagePreview);
  messageType?.addEventListener('change', updateMessagePreview);
  $('#adminMessageForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title = messageTitle?.value.trim() || '';
    const message = messageBody?.value.trim() || '';
    const type = messageType?.value === 'startup_toast' ? 'startup_toast' : 'message';
    const audience = messageAudience?.value || 'all';
    const uid = $('#adminMessageUid')?.value.trim() || '';
    if (title.length < 2 || message.length < 2 || title.length > 160 || message.length > 2000) return toast('Confira o título e a mensagem antes de publicar.', 'error');
    if (audience === 'one' && !/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return toast('Informe um UID de cliente válido.', 'error');
    if (!confirm(audience === 'all' ? `Publicar para até 500 clientes encontrados${type === 'startup_toast' ? ' (toast ao entrar)' : ''}?` : `Publicar para o cliente ${uid}?`)) return;
    const button = $('#adminMessagePublish'); if (button) { button.disabled = true; button.textContent = 'Publicando…'; }
    try {
      let recipients = [];
      if (audience === 'one') recipients = [uid];
      else {
        const snap = await getDocs(query(collection(firestore, 'customers'), limit(500)));
        recipients = snap.docs.map(d => d.id);
      }
      if (!recipients.length) throw new Error('Não há clientes para receber este comunicado.');
      // Cada documento segue o esquema de notifications já autorizado nas regras do Firestore.
      for (let i = 0; i < recipients.length; i += 40) {
        await Promise.all(recipients.slice(i, i + 40).map(userId => addDoc(collection(firestore, 'notifications'), {
          userId, title, message, read: false, type, createdAt: serverTimestamp()
        })));
      }
      toast(`Publicado para ${recipients.length} cliente(s).`, 'success');
      window.navigate('admin', { tab: 'messages' });
    } catch (err) {
      console.error('[Mensagens admin]', err);
      toast(err?.message || 'Não foi possível publicar. Confira as regras do Firestore.', 'error');
      if (button) { button.disabled = false; button.innerHTML = 'Publicar comunicado <span aria-hidden="true">→</span>'; }
    }
  });

  $('#maintenanceToggle')?.addEventListener('change', async (e) => {
    await store.saveMaintenance(e.target.checked);
    toast(`Manutenção ${e.target.checked ? 'Ativada' : 'Desativada'}`, 'success');
  });

  $('#rewardPointsForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const uid=$('#rewardCustomerUid').value; const amount=Number($('#rewardPointsAmount').value); const operation=$('#rewardPointsOperation').value; const reason=$('#rewardPointsReason').value.trim();
    if(!uid || !Number.isInteger(amount) || amount<0 || amount>10000000 || !reason) return toast('Confira cliente, quantidade inteira e motivo.','error');
    try { await runTransaction(firestore, async tx=>{ const ref=doc(firestore,'customers',uid); const snap=await tx.get(ref); if(!snap.exists()) throw new Error('Cliente não encontrado.'); const current=Math.max(0,Math.floor(Number(snap.data().rewardPoints||0))); const next=operation==='add'?current+amount:operation==='remove'?current-amount:amount; if(next<0) throw new Error('O cliente não tem pontos suficientes para esse ajuste.'); tx.update(ref,{rewardPoints:next,rewardPointsUpdatedAt:serverTimestamp()}); const ledger=doc(collection(firestore,'pointsLedger')); tx.set(ledger,{userId:uid,amount:next-current,balanceAfter:next,reason,createdAt:serverTimestamp(),adminUid:state.user?.uid||''}); }); toast('Pontos salvos permanentemente.','success'); renderAdmin(state,'rewards'); } catch(err){ console.error('[Recompensas: pontos]',err); toast(err.message||'Falha ao salvar pontos. Confira as regras Firestore.','error'); }
  });
  $('#rewardCatalogForm')?.addEventListener('submit', async e=>{ e.preventDefault(); const title=$('#rewardTitle').value.trim(); const description=$('#rewardDescription').value.trim(); const cost=Number($('#rewardCost').value); const type=$('#rewardType').value; if(title.length<2||!Number.isInteger(cost)||cost<0||cost>10000000) return toast('Informe nome e custo válido em pontos.','error'); try { await addDoc(collection(firestore,'rewardsCatalog'),{title,description,cost,type,active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); toast('Recompensa publicada no catálogo.','success'); renderAdmin(state,'rewards'); } catch(err){ console.error('[Catálogo de recompensas]',err); toast('Não foi possível publicar. Confira as regras do Firestore.','error'); } });

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
      console.error('[Cupons admin] Falha ao criar cupom:', err?.code || err?.message || err);
      if (err?.code === 'PERMISSION_DENIED') {
        toast('Permissão negada pelo Firebase. Confirme o e-mail da conta admin e publique as regras de database.txt no Realtime Database.', 'error');
      } else {
        toast(err?.message || 'Não foi possível criar o cupom.', 'error');
      }
    }
  });
}

// Filtros locais da central de solicitações.
window.filterAdminRequests = () => {
  const q = String(document.getElementById('adminRequestSearch')?.value || '').trim().toLowerCase();
  const kind = String(document.getElementById('adminRequestKind')?.value || '');
  const status = String(document.getElementById('adminRequestStatus')?.value || '');
  const rows = [...(document.getElementById('adminRequestsRows')?.querySelectorAll('tr[data-request-kind]') || [])];
  let visible = 0;
  rows.forEach(row => { const ok = (!q || (row.dataset.requestSearch || '').includes(q)) && (!kind || row.dataset.requestKind === kind) && (!status || row.dataset.requestStatus === status); row.hidden = !ok; if (ok) visible++; });
  const empty = document.getElementById('adminRequestsEmptyFilter'); if (empty) empty.hidden = visible !== 0;
};

// ================== FUNÇÕES GLOBAIS ==================
// Atualização administrativa de solicitações, sem liberação automática de saldo.
window.updateSystemRequest = async (id, status) => {
  if (!['approved','rejected','payment_confirmed'].includes(status)) return;
  const promptText = status === 'payment_confirmed' ? 'Confirme somente se você verificou o recebimento real do Pix no extrato bancário. Isso apenas registra a conferência; o pedido ainda precisa ser criado/processado.' : `Marcar solicitação como ${status === 'approved' ? 'aprovada' : 'recusada'}?`;
  if (!confirm(promptText)) return;
  try {
    if (status === 'approved' || status === 'payment_confirmed') {
      await runTransaction(firestore, async tx => {
        const requestRef = doc(firestore, 'systemRequests', id); const requestSnap = await tx.get(requestRef);
        if (!requestSnap.exists() || requestSnap.data().status !== 'pending') throw new Error('A solicitação já foi processada.');
        const requestData = requestSnap.data();
        if (status === 'payment_confirmed') {
          if (requestData.kind !== 'order_payment_review') throw new Error('Esta ação só vale para avisos de pagamento de pedido.');
          tx.update(requestRef, { status: 'payment_confirmed', paymentConfirmedAt: serverTimestamp(), paymentConfirmedBy: auth.currentUser?.uid || '', updatedAt: serverTimestamp(), adminNote: 'Pix conferido manualmente; pedido ainda precisa ser processado.' });
          return;
        }
        if (requestData.kind === 'redeem_code') {
          const codeRef = doc(firestore, 'promoCodes', String(requestData.promoCodeId || '')); const codeSnap = await tx.get(codeRef);
          if (!codeSnap.exists()) throw new Error('O código promocional não existe mais.');
          const codeData = codeSnap.data();
          if (!codeData.active || String(codeData.code).toUpperCase() !== String(requestData.code).toUpperCase()) throw new Error('Este código está pausado ou não corresponde à solicitação.');
          if (codeData.expiresAt?.toMillis && codeData.expiresAt.toMillis() < Date.now()) throw new Error('Este código expirou.');
          const used = Number(codeData.usedCount || 0); const max = Number(codeData.maxUses || 1);
          if (used >= max) throw new Error('O limite de resgates deste código já foi atingido.');
          const rewardType = codeData.rewardType || 'manual';
          const rewardAmount = Number(codeData.rewardAmount || 0);
          let walletRef = null, walletSnap = null, customerRef = null, customerSnap = null;
          if (rewardType === 'virtual_money') {
            if (!Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100000) throw new Error('Valor de recompensa inválido.');
            walletRef = doc(firestore, 'wallets', requestData.userId); walletSnap = await tx.get(walletRef);
          } else if (rewardType === 'points') {
            if (!Number.isInteger(rewardAmount) || rewardAmount <= 0 || rewardAmount > 10000000) throw new Error('Quantidade de pontos inválida.');
            customerRef = doc(firestore, 'customers', requestData.userId); customerSnap = await tx.get(customerRef);
            if (!customerSnap.exists()) throw new Error('Perfil do cliente não encontrado para receber os pontos.');
          }
          // Todas as leituras da transação ocorrem antes da primeira escrita.
          tx.update(codeRef, { usedCount: used + 1, updatedAt: serverTimestamp() });
          if (rewardType === 'virtual_money') {
            const oldBalance = Number(walletSnap.exists() ? walletSnap.data().balance || 0 : 0);
            const nextBalance = Math.round((oldBalance + rewardAmount) * 100) / 100;
            tx.set(walletRef, { userId: requestData.userId, balance: nextBalance, currency: 'BRL', updatedAt: serverTimestamp() }, { merge: true });
            const ledgerRef = doc(collection(firestore, 'transactions'));
            tx.set(ledgerRef, { userId: requestData.userId, amount: rewardAmount, type: 'promo_reward', status: 'approved', description: `Recompensa do código ${String(requestData.code || codeData.code).slice(0,64)}`, balanceAfter: nextBalance, createdAt: serverTimestamp(), adminUid: auth.currentUser?.uid || '' });
          } else if (rewardType === 'points') {
            const nextPoints = Math.max(0, Math.floor(Number(customerSnap.data().rewardPoints || 0))) + rewardAmount;
            tx.update(customerRef, { rewardPoints: nextPoints, rewardPointsUpdatedAt: serverTimestamp() });
            const ledgerRef = doc(collection(firestore, 'pointsLedger'));
            tx.set(ledgerRef, { userId: requestData.userId, amount: rewardAmount, balanceAfter: nextPoints, reason: `Recompensa do código ${String(requestData.code || codeData.code).slice(0,64)}`, createdAt: serverTimestamp(), adminUid: auth.currentUser?.uid || '' });
          }
          tx.update(requestRef, { status, rewardType, rewardAmount, updatedAt: serverTimestamp() });
          return;
        }
        tx.update(requestRef, { status, updatedAt: serverTimestamp() });
      });
    } else {
      await updateDoc(doc(firestore, 'systemRequests', id), { status, updatedAt: serverTimestamp() });
    }
    toast(status === 'payment_confirmed' ? 'Pix marcado como conferido. O pedido ainda precisa ser processado.' : status === 'approved' ? 'Solicitação aprovada.' : 'Solicitação recusada.', 'success');
    window.navigate('admin', { tab: 'systemRequests' });
  } catch (err) { console.error(err); toast(err.message || 'Não foi possível atualizar a solicitação.', 'error'); }
};

window.deleteSystemRequest = async (id) => {
  if (!id || !confirm('Excluir permanentemente esta solicitação? Esta ação não pode ser desfeita.')) return;
  try {
    await deleteDoc(doc(firestore, 'systemRequests', id));
    toast('Solicitação excluída.', 'success');
    window.navigate('admin', { tab: 'systemRequests' });
  } catch (err) { console.error('[Solicitações] exclusão falhou:', err); toast('Não foi possível excluir a solicitação. Verifique as regras do Firestore.', 'error'); }
};

window.deleteWallet = async (uid) => {
  if (!uid || !confirm('Excluir o documento desta carteira e remover o saldo atual? O histórico de transações permanecerá.')) return;
  try {
    await deleteDoc(doc(firestore, 'wallets', uid));
    toast('Documento da carteira excluído.', 'success');
    window.navigate('admin', { tab: 'systemRequests' });
  } catch (err) { console.error('[Carteira] exclusão falhou:', err); toast('Não foi possível excluir a carteira. Verifique as regras do Firestore.', 'error'); }
};

window.deleteWalletTransaction = async (id) => {
  if (!id || !confirm('Excluir somente este registro do histórico? O saldo da carteira não será alterado.')) return;
  try {
    await deleteDoc(doc(firestore, 'transactions', id));
    toast('Registro do histórico excluído.', 'success');
    window.navigate('admin', { tab: 'systemRequests' });
  } catch (err) { console.error('[Transações] exclusão falhou:', err); toast('Não foi possível excluir o registro. Verifique as regras do Firestore.', 'error'); }
};

window.toggleReward = async (id, active) => { try { await updateDoc(doc(firestore,'rewardsCatalog',id),{active:Boolean(active),updatedAt:serverTimestamp()}); toast(active?'Recompensa ativada.':'Recompensa pausada.','success'); window.navigate('admin',{tab:'rewards'}); } catch(e){ console.error(e); toast('Não foi possível alterar a recompensa. Confira as regras.','error'); } };
window.deleteReward = async id => { if(!id||!confirm('Excluir esta recompensa do catálogo? Solicitações antigas serão preservadas.')) return; try { await deleteDoc(doc(firestore,'rewardsCatalog',id)); toast('Recompensa excluída.','success'); window.navigate('admin',{tab:'rewards'}); } catch(e){ console.error(e); toast('Não foi possível excluir a recompensa.','error'); } };
window.reviewRewardRequest = async (id,status) => { if(!['approved','rejected'].includes(status)||!confirm(status==='approved'?'Aprovar o resgate e descontar os pontos agora?':'Recusar este resgate?')) return; try { await runTransaction(firestore,async tx=>{ const reqRef=doc(firestore,'systemRequests',id); const reqSnap=await tx.get(reqRef); if(!reqSnap.exists()) throw new Error('Solicitação não encontrada.'); const req=reqSnap.data(); if(req.kind!=='reward'||req.status!=='pending') throw new Error('Esta solicitação já foi processada.'); if(status==='approved'){ const customerRef=doc(firestore,'customers',req.userId); const customerSnap=await tx.get(customerRef); if(!customerSnap.exists()) throw new Error('Perfil do cliente não encontrado.'); const balance=Math.max(0,Math.floor(Number(customerSnap.data().rewardPoints||0))); const cost=Math.max(0,Math.floor(Number(req.rewardCost||0))); if(balance<cost) throw new Error(`Saldo insuficiente: cliente possui ${balance} pontos e precisa de ${cost}.`); tx.update(customerRef,{rewardPoints:balance-cost,rewardPointsUpdatedAt:serverTimestamp()}); const ledger=doc(collection(firestore,'pointsLedger')); tx.set(ledger,{userId:req.userId,amount:-cost,balanceAfter:balance-cost,reason:`Resgate aprovado: ${String(req.title||'Recompensa').slice(0,100)}`,createdAt:serverTimestamp(),adminUid:auth.currentUser?.uid||''}); } tx.update(reqRef,{status,updatedAt:serverTimestamp()}); }); toast(status==='approved'?'Resgate aprovado e pontos descontados.':'Resgate recusado.','success'); window.navigate('admin',{tab:'rewards'}); } catch(e){ console.error('[Resgate]',e); toast(e.message||'Não foi possível processar o resgate.','error'); } };

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
window.toggleCouponActive = async (code, active) => {
  try {
    await store.setCouponActive(code, active);
    toast(active ? 'Cupom ativado.' : 'Cupom desativado e removido das listagens públicas.', 'success');
    window.navigate('admin', { tab: 'coupons' });
  } catch (err) {
    console.error('Erro ao alterar status do cupom:', err);
    toast(err?.message || 'Não foi possível alterar o status do cupom.', 'error');
    window.navigate('admin', { tab: 'coupons' });
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