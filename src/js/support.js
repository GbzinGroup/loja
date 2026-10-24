import { $, appEl, escapeHtml, toast, formatDate } from './utils.js';
import { firestore, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where, orderBy, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let busy = false;

export async function renderSupport(state) {
  const user = auth.currentUser;
  if (!user) {
    appEl().innerHTML = `<section class="card" style="max-width:720px;margin:auto"><h2>Central de suporte</h2><p class="muted">Entre na sua conta para abrir e acompanhar chamados privados.</p><button class="btn btn-primary" onclick="window.navigate('login')">Entrar</button></section>`;
    return;
  }
  const isStaff = Boolean(state.isAdmin);
  appEl().innerHTML = `<section class="page-hero"><div class="eyebrow">${isStaff ? 'PAINEL INTERNO' : 'ÁREA DO CLIENTE'}</div><h1>${isStaff ? 'Central de atendimento' : 'Central de suporte'}</h1><p>${isStaff ? 'Gerencie chamados e responda clientes. O acesso é limitado aos administradores autorizados.' : 'Abra um chamado e acompanhe a conversa em um espaço privado vinculado à sua conta.'}</p></section>
    <section class="support-layout ${isStaff ? 'support-staff' : ''}">
      ${isStaff ? '' : `<form id="ticketCreate" class="card support-create"><div class="eyebrow">NOVO CHAMADO</div><h2>Como podemos ajudar?</h2><p class="muted">Nunca envie senhas, códigos de autenticação ou dados completos de cartão.</p><div class="form-group"><label for="ticketSubject">Assunto</label><input id="ticketSubject" maxlength="120" required minlength="3" placeholder="Ex.: problema com pedido"></div><div class="form-group"><label for="ticketCategory">Categoria</label><select id="ticketCategory"><option>Pedido</option><option>Pagamento</option><option>VIP</option><option>Produto digital</option><option>Conta</option><option>Outro</option></select></div><div class="form-group"><label for="ticketMessage">Mensagem inicial</label><textarea id="ticketMessage" maxlength="3000" rows="5" required placeholder="Descreva o problema"></textarea></div><button class="btn btn-primary" type="submit">Abrir chamado</button></form>`}
      <div class="card support-inbox"><div class="support-inbox-head"><div><div class="eyebrow">${isStaff ? 'FILA DE ATENDIMENTO' : 'SEU HISTÓRICO'}</div><h2>${isStaff ? 'Chamados recebidos' : 'Meus chamados'}</h2></div><button id="refreshTickets" class="btn btn-outline" type="button">Atualizar</button></div><div id="ticketList" class="ticket-list"><p class="muted">Carregando chamados…</p></div><div id="ticketConversation" class="ticket-conversation" hidden><div class="ticket-conversation-head"><div><h3 id="ticketTitle"></h3><p id="ticketMeta" class="muted"></p></div><div id="ticketActions"></div></div><div id="ticketMessages" class="ticket-messages" aria-live="polite"></div><form id="ticketReply" class="ticket-reply"><textarea id="ticketReplyText" maxlength="3000" rows="2" required placeholder="Escreva uma resposta…"></textarea><button class="btn btn-primary" type="submit">Enviar resposta</button></form><p class="muted support-security-note">Mensagens são vinculadas ao chamado e escapadas antes de serem exibidas.</p></div></div>
    </section>`;

  async function loadTickets() {
    const listEl = $('#ticketList');
    listEl.innerHTML = '<p class="muted">Carregando chamados…</p>';
    try {
      const q = isStaff ? collection(firestore, 'supportTickets') : query(collection(firestore, 'supportTickets'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      listEl.innerHTML = tickets.length ? tickets.map(t => `<div class="ticket-list-row"><button class="ticket-list-item" type="button" data-ticket="${escapeHtml(t.id)}"><span class="ticket-list-top"><strong>${escapeHtml(t.subject || 'Chamado')}</strong><span class="status-pill ${t.status === 'closed' ? 'status-canceled' : 'status-paid'}">${t.status === 'closed' ? 'Encerrado' : 'Aberto'}</span></span><span class="muted">${escapeHtml(t.category || 'Outro')}${isStaff ? ` · Cliente ${escapeHtml(String(t.userId || '').slice(0,8))}` : ''}</span><span class="ticket-list-date">${escapeHtml(formatDate(t.updatedAt || t.createdAt))}</span></button>${isStaff ? `<button class="btn btn-danger ticket-delete-btn" type="button" data-delete-ticket="${escapeHtml(t.id)}" aria-label="Excluir chamado">Excluir</button>` : ''}</div>`).join('') : `<div class="empty-state"><h3>${isStaff ? 'Nenhum chamado recebido' : 'Você ainda não abriu chamados'}</h3><p class="muted">${isStaff ? 'Novas solicitações aparecerão aqui.' : 'Quando precisar de ajuda, abra um chamado nesta página.'}</p></div>`;
      listEl.querySelectorAll('[data-ticket]').forEach(btn => btn.addEventListener('click', () => openTicket(btn.dataset.ticket)));
      if (isStaff) listEl.querySelectorAll('[data-delete-ticket]').forEach(btn => btn.addEventListener('click', async (event) => {
        event.preventDefault(); event.stopPropagation();
        const ticketId = btn.dataset.deleteTicket;
        if (!ticketId || !confirm('Excluir este chamado e todas as mensagens? Esta ação não pode ser desfeita.')) return;
        btn.disabled = true;
        try {
          const messagesSnap = await getDocs(collection(firestore, 'supportTickets', ticketId, 'messages'));
          await Promise.all(messagesSnap.docs.map(messageDoc => deleteDoc(messageDoc.ref)));
          await deleteDoc(doc(firestore, 'supportTickets', ticketId));
          $('#ticketConversation').hidden = true;
          toast('Chamado e mensagens excluídos.', 'success');
          await loadTickets();
        } catch (err) {
          console.error('[Suporte: exclusão]', err);
          toast('Não foi possível excluir. Publique as regras do Firestore atualizadas.', 'error');
          btn.disabled = false;
        }
      }));
    } catch (e) {
      console.error('[Suporte: lista]', e);
      listEl.innerHTML = '<p class="muted">Não foi possível carregar os chamados. Confira se firestore.rules foi publicado no projeto correto.</p>';
    }
  }

  async function openTicket(id) {
    try {
      const ticketSnap = await getDoc(doc(firestore, 'supportTickets', id));
      if (!ticketSnap.exists()) throw new Error('Chamado não encontrado.');
      const ticket = ticketSnap.data();
      if (!isStaff && ticket.userId !== user.uid) throw new Error('Você não tem acesso a este chamado.');
      $('#ticketConversation').hidden = false;
      $('#ticketTitle').textContent = ticket.subject || 'Chamado';
      $('#ticketMeta').textContent = `${ticket.category || 'Outro'} · ${ticket.status === 'closed' ? 'Encerrado' : 'Aberto'} · ${formatDate(ticket.createdAt)}`;
      $('#ticketActions').innerHTML = isStaff ? `<button id="toggleTicketStatus" class="btn btn-outline" type="button">${ticket.status === 'closed' ? 'Reabrir' : 'Encerrar'}</button>` : '';
      $('#toggleTicketStatus')?.addEventListener('click', async () => {
        try {
          const next = ticket.status === 'closed' ? 'open' : 'closed';
          await setDoc(doc(firestore, 'supportTickets', id), { status: next, updatedAt: serverTimestamp() }, { merge: true });
          toast(next === 'closed' ? 'Chamado encerrado.' : 'Chamado reaberto.', 'success');
          await loadTickets(); await openTicket(id);
        } catch (e) { console.error(e); toast('Não foi possível alterar o status.', 'error'); }
      });
      const q = query(collection(firestore, 'supportTickets', id, 'messages'), orderBy('createdAt', 'asc'));
      const messages = await getDocs(q);
      $('#ticketMessages').innerHTML = messages.docs.map(d => {
        const m = d.data();
        const own = m.senderUid === user.uid;
        const label = own ? (isStaff ? 'Equipe · você' : 'Você') : (m.senderRole === 'staff' ? 'Equipe de suporte' : 'Cliente');
        return `<article class="ticket-message ${own ? 'mine' : ''}"><div class="ticket-message-meta"><strong>${label}</strong><time>${escapeHtml(formatDate(m.createdAt))}</time></div><p>${escapeHtml(m.text || '')}</p></article>`;
      }).join('') || '<p class="muted">Ainda não há mensagens neste chamado.</p>';
      $('#ticketReply').onsubmit = async e => {
        e.preventDefault();
        const input = $('#ticketReplyText'); const text = input.value.trim();
        if (!text || text.length > 3000) return toast('A mensagem deve ter entre 1 e 3000 caracteres.', 'error');
        if (ticket.status === 'closed' && !isStaff) return toast('Este chamado está encerrado. Peça à equipe para reabri-lo.', 'error');
        const send = $('#ticketReply').querySelector('button'); send.disabled = true;
        try {
          await addDoc(collection(firestore, 'supportTickets', id, 'messages'), { senderUid: user.uid, senderRole: isStaff ? 'staff' : 'customer', text, createdAt: serverTimestamp() });
          await setDoc(doc(firestore, 'supportTickets', id), { updatedAt: serverTimestamp(), lastMessageAt: serverTimestamp(), ...(isStaff && ticket.status === 'closed' ? { status: 'open' } : {}) }, { merge: true });
          input.value = ''; await openTicket(id); await loadTickets();
        } catch (e) { console.error('[Suporte: mensagem]', e); toast('Não foi possível enviar. Verifique as regras do Firestore.', 'error'); }
        finally { send.disabled = false; }
      };
      $('#ticketMessages').scrollTop = $('#ticketMessages').scrollHeight;
    } catch (e) {
      console.error('[Suporte: conversa]', e); toast(e.message || 'Não foi possível abrir a conversa.', 'error');
    }
  }

  $('#refreshTickets').addEventListener('click', loadTickets);
  if (!isStaff) {
    $('#ticketCreate').onsubmit = async e => {
      e.preventDefault(); if (busy) return; busy = true;
      const subject = $('#ticketSubject').value.trim(), message = $('#ticketMessage').value.trim(), category = $('#ticketCategory').value;
      if (subject.length < 3 || subject.length > 120 || !message || message.length > 3000) { busy = false; return toast('Confira o assunto e a mensagem.', 'error'); }
      const submit = $('#ticketCreate').querySelector('button[type="submit"]'); submit.disabled = true;
      try {
        const ref = await addDoc(collection(firestore, 'supportTickets'), { userId: user.uid, subject, category, status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessageAt: serverTimestamp() });
        await addDoc(collection(firestore, 'supportTickets', ref.id, 'messages'), { senderUid: user.uid, senderRole: 'customer', text: message, createdAt: serverTimestamp() });
        toast('Chamado criado com sucesso.', 'success'); await loadTickets(); await openTicket(ref.id);
      } catch (err) { console.error('[Suporte: criação]', err); toast('Não foi possível criar o chamado. Confira as regras do Firestore.', 'error'); }
      finally { busy = false; if (submit.isConnected) submit.disabled = false; }
    };
  }
  await loadTickets();
}