import { $, appEl, brl, escapeHtml, toast, formatDate } from './utils.js';
import { auth, firestore } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where, doc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function renderVip(state) {
  const user = auth.currentUser;
  if (!user) {
    appEl().innerHTML = `<section class="card" style="max-width:800px;margin:auto"><h2>Clube VIP</h2><p class="muted">Entre para consultar benefícios, validade e solicitações.</p><button class="btn btn-primary" id="vipLoginButton" type="button">Entrar</button></section>`;
    document.getElementById('vipLoginButton')?.addEventListener('click', () => window.navigate?.('login'));
    return;
  }
  appEl().innerHTML = `<section class="page-hero"><div class="eyebrow">GBZIN SHOP / BENEFÍCIOS</div><h1>Clube VIP <span class="vip-mark"></span></h1><p>Planos e benefícios exclusivos, com status e validade visíveis na sua conta.</p></section><div id="vipContent" class="loading-card card">Carregando informações do Clube VIP…</div>`;
  const root = $('#vipContent');
  try {
    const planQuery = state.isAdmin ? collection(firestore, 'vipPlans') : query(collection(firestore, 'vipPlans'), where('active', '==', true));
    const purchaseQuery = state.isAdmin ? collection(firestore, 'vipPurchaseRequests') : query(collection(firestore, 'vipPurchaseRequests'), where('userId', '==', user.uid));
    const [plansSnap, subsSnap, purchasesSnap] = await Promise.all([
      getDocs(planQuery),
      getDocs(query(collection(firestore, 'vipSubscriptions'), where('userId', '==', user.uid))),
      getDocs(purchaseQuery)
    ]);
    const plans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (Number(a.price)||0)-(Number(b.price)||0));
    const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.activatedAt?.toMillis?.() || 0) - (a.activatedAt?.toMillis?.() || 0));
    const purchases = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const active = subs.find(s => s.status === 'active' && (s.expiresAt?.toMillis?.() ? s.expiresAt.toMillis() : Number(s.expiresAt || 0)) > Date.now());

    root.innerHTML = `${active ? `<section class="card vip-active"><div class="vip-active-head"><span class="vip-seal"> VIP</span><span class="status-pill status-paid">Ativo</span></div><h2>${escapeHtml(active.planName || 'Plano VIP')}</h2><div class="vip-dates"><div><span class="muted">Ativado em</span><strong>${escapeHtml(formatDate(active.activatedAt))}</strong></div><div><span class="muted">Válido até</span><strong>${escapeHtml(formatDate(active.expiresAt))}</strong></div></div></section>` : `<section class="card vip-inactive"><div class="eyebrow">SEU STATUS</div><h2>${state.isAdmin ? 'Área de gestão VIP' : 'Você ainda não tem VIP ativo'}</h2><p class="muted">${state.isAdmin ? 'Gerencie planos e consulte as solicitações dos clientes nesta página.' : 'Escolha um plano abaixo para registrar sua solicitação. Os benefícios só são ativados após confirmação de pagamento pelo sistema seguro.'}</p></section>`}
      <div class="vip-section-heading"><div><div class="eyebrow">PLANOS</div><h2>${state.isAdmin ? 'Todos os planos' : 'Escolha seu plano'}</h2></div></div>
      <div class="product-grid vip-plans">${plans.length ? plans.filter(p => state.isAdmin || p.active === true).map(p => `<article class="product-card vip-plan ${p.active ? '' : 'vip-plan-disabled'}"><div class="info"><span class="category">CLUBE VIP ${p.active ? '' : '· PAUSADO'}</span><h3>${escapeHtml(p.name || 'Plano VIP')}</h3><p class="muted">${escapeHtml(p.description || 'Benefícios exclusivos para clientes VIP.')}</p><div class="price">${brl(p.price)}</div><p class="muted">${Number(p.durationDays) || 30} dias de validade</p>${state.isAdmin ? `<div class="vip-admin-actions"><button class="btn btn-outline" type="button" data-edit-plan="${escapeHtml(p.id)}">Editar preço/duração</button><button class="btn btn-outline" type="button" data-toggle-plan="${escapeHtml(p.id)}" data-active="${p.active ? 'true' : 'false'}">${p.active ? 'Pausar plano' : 'Ativar plano'}</button></div>` : `<button class="btn btn-primary" type="button" data-buy="${escapeHtml(p.id)}" ${p.active ? '' : 'disabled'}>Solicitar compra</button>`}</div></article>`).join('') : '<div class="empty-state"><h3>Nenhum plano disponível</h3><p class="muted">Volte mais tarde para conferir os planos VIP.</p></div>'}</div>
      ${state.isAdmin ? `<section class="card vip-admin-panel"><div class="eyebrow">ADMINISTRAÇÃO</div><h2>Criar plano VIP</h2><form id="vipPlanForm" class="vip-plan-form"><div class="form-group"><label for="vpName">Nome do plano</label><input id="vpName" maxlength="100" minlength="2" placeholder="Ex.: VIP Ouro" required></div><div class="form-group"><label for="vpPrice">Preço (R$)</label><input id="vpPrice" type="number" min="0" step="0.01" placeholder="19,90" required></div><div class="form-group"><label for="vpDays">Duração (dias)</label><input id="vpDays" type="number" min="1" max="3650" step="1" value="30" required></div><div class="form-group"><label for="vpDesc">Descrição</label><input id="vpDesc" maxlength="500" placeholder="Benefícios do plano"></div><button class="btn btn-primary" type="submit">Criar plano</button></form><p class="muted">A ativação manual, suspensão de benefícios e confirmação de pagamentos ficam bloqueadas no navegador; exigem backend confiável para não permitir falsificação de VIP.</p></section>
      <section class="card vip-admin-panel"><div class="vip-section-heading"><div><div class="eyebrow">SOLICITAÇÕES</div><h2>Compras de clientes</h2></div><span class="status-pill">${purchases.length} registro(s)</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente UID</th><th>Plano</th><th>Nick/conta</th><th>Valor</th><th>Método</th><th>Status</th><th>Data</th></tr></thead><tbody>${purchases.length ? purchases.map(p => `<tr><td><code>${escapeHtml(String(p.userId || '').slice(0,12))}</code></td><td>${escapeHtml(p.planName || 'VIP')}</td><td>${escapeHtml(p.gameAccount || '—')}</td><td>${brl(p.price || 0)}</td><td>${escapeHtml(p.paymentMethod || '—')}</td><td>${escapeHtml(p.status || 'pending')}</td><td>${escapeHtml(formatDate(p.createdAt))}</td></tr>`).join('') : '<tr><td colspan="7">Nenhuma solicitação registrada.</td></tr>'}</tbody></table></div></section>` : ''}
      <section class="card vip-history"><div class="eyebrow">HISTÓRICO</div><h2>${state.isAdmin ? 'Suas solicitações' : 'Suas solicitações de compra'}</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Plano</th><th>Nick/conta</th><th>Pagamento</th><th>Status</th><th>Data</th></tr></thead><tbody>${purchases.filter(p => p.userId === user.uid).length ? purchases.filter(p => p.userId === user.uid).map(p => `<tr><td>${escapeHtml(p.planName || 'VIP')}</td><td>${escapeHtml(p.gameAccount || '—')}</td><td>${escapeHtml(p.paymentMethod || '—')}</td><td>${escapeHtml(p.status || 'pending')}</td><td>${escapeHtml(formatDate(p.createdAt))}</td></tr>`).join('') : '<tr><td colspan="5">Nenhuma solicitação registrada.</td></tr>'}</tbody></table></div></section>`;

    root.querySelectorAll('[data-buy]').forEach(btn => btn.addEventListener('click', async () => {
      const plan = plans.find(p => p.id === btn.dataset.buy && p.active === true); if (!plan) return;
      const gameAccount = prompt('Informe seu nick/conta do jogo:');
      if (!gameAccount || gameAccount.trim().length < 2 || gameAccount.trim().length > 64) return;
      const method = (prompt('Método de pagamento (PIX ou outro disponível):', 'PIX') || 'PIX').trim().slice(0,30);
      btn.disabled = true;
      try {
        await addDoc(collection(firestore, 'vipPurchaseRequests'), { userId:user.uid, planId:plan.id, planName:plan.name, price:Number(plan.price), durationDays:Number(plan.durationDays)||30, gameAccount:gameAccount.trim(), paymentMethod:method, status:'pending', createdAt:serverTimestamp() });
        toast('Solicitação registrada. A compra ainda precisa ser confirmada pelo sistema de pagamento.', 'success'); await renderVip(state);
      } catch (e) { console.error('[VIP: solicitação]', e); toast('Falha ao solicitar o VIP. Confira as regras do Firestore publicadas.', 'error'); btn.disabled = false; }
    }));
    root.querySelectorAll('[data-toggle-plan]').forEach(btn => btn.addEventListener('click', async () => {
      const plan = plans.find(p => p.id === btn.dataset.togglePlan); if (!plan) return;
      try { await updateDoc(doc(firestore, 'vipPlans', plan.id), { active: !plan.active }); toast(plan.active ? 'Plano pausado.' : 'Plano ativado.', 'success'); await renderVip(state); }
      catch (e) { console.error('[VIP: status plano]', e); toast('Não foi possível alterar o plano. Confira as permissões administrativas.', 'error'); }
    }));
    root.querySelectorAll('[data-edit-plan]').forEach(btn => btn.addEventListener('click', async () => {
      const plan = plans.find(p => p.id === btn.dataset.editPlan); if (!plan) return;
      const rawPrice = prompt('Novo preço em reais:', String(plan.price)); if (rawPrice === null) return;
      const rawDays = prompt('Nova duração em dias (1 a 3650):', String(plan.durationDays)); if (rawDays === null) return;
      const price = Number(rawPrice.replace(',', '.')), durationDays = Number(rawDays);
      if (!Number.isFinite(price) || price < 0 || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) return toast('Preço ou duração inválidos.', 'error');
      try { await updateDoc(doc(firestore, 'vipPlans', plan.id), { price, durationDays }); toast('Plano atualizado.', 'success'); await renderVip(state); }
      catch (e) { console.error('[VIP: editar plano]', e); toast('Não foi possível editar o plano. Confira as regras administrativas.', 'error'); }
    }));
    $('#vipPlanForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#vpName').value.trim(), price = Number($('#vpPrice').value), durationDays = Number($('#vpDays').value), description = $('#vpDesc').value.trim();
      if (name.length < 2 || name.length > 100 || !Number.isFinite(price) || price < 0 || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650 || description.length > 500) return toast('Confira os dados do plano.', 'error');
      const btn = $('#vipPlanForm').querySelector('button'); btn.disabled = true;
      try { await addDoc(collection(firestore, 'vipPlans'), { name, price, durationDays, description, active:true, createdAt:serverTimestamp() }); toast('Plano criado.', 'success'); await renderVip(state); }
      catch (e) { console.error('[VIP: criar plano]', e); toast('Não foi possível criar o plano. Confira se seu usuário é administrador.', 'error'); btn.disabled = false; }
    });
  } catch (e) {
    console.error('[VIP: carregamento]', e);
    root.innerHTML = '<div class="empty-state"><h3>Não foi possível carregar o Clube VIP</h3><p class="muted">Confira as regras publicadas do Firestore e se você está acessando o projeto Firebase correto.</p></div>';
  }
}