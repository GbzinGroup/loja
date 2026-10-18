import { $, appEl, escapeHtml } from './utils.js';

export function renderSupport() {
  appEl().innerHTML = `
    <div class="card wide" style="max-width:900px;">
      <h2>Central de Suporte</h2>
      <p class="muted mb-4">Estamos aqui para ajudar com pagamentos, compatibilidade e dúvidas.</p>

      <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:24px;">
        <!-- FAQ -->
        <div style="flex:1; min-width:300px;">
          <h3>Perguntas Frequentes</h3>
          <div style="margin-top:16px;">
            <details style="background:var(--bg-elev); padding:12px; border-radius:8px; margin-bottom:8px; cursor:pointer;">
              <summary style="font-weight:600;">Como instalo a capa no meu celular?</summary>
              <p class="muted mt-2">Após a compra, você recebe o link de download na sua biblioteca. Basta baixar e aplicar conforme o tutorial enviado.</p>
            </details>
            <details style="background:var(--bg-elev); padding:12px; border-radius:8px; margin-bottom:8px; cursor:pointer;">
              <summary style="font-weight:600;">A capa é compatível com meu modelo?</summary>
              <p class="muted mt-2">Todas as capas listam os modelos compatíveis na descrição. Se tiver dúvidas, use o chat ao lado.</p>
            </details>
            <details style="background:var(--bg-elev); padding:12px; border-radius:8px; margin-bottom:8px; cursor:pointer;">
              <summary style="font-weight:600;">Como funciona o PIX?</summary>
              <p class="muted mt-2">No checkout, você recebe a chave PIX. Após pagar, o vendedor aprova o pedido e a capa é liberada na sua biblioteca.</p>
            </details>
          </div>
        </div>

        <!-- Chat -->
        <div style="flex:1; min-width:300px; background:var(--bg-elev-2); padding:20px; border-radius:12px;">
          <h3>Fale Conosco</h3>
          <div id="chatBox" style="height:200px; overflow-y:auto; background:var(--bg-elev); border-radius:8px; padding:12px; margin:16px 0; font-size:0.85rem;">
            <p style="color:var(--text-muted); text-align:center; margin-top:60px;">Inicie uma conversa...</p>
          </div>
          <form id="chatForm" style="display:flex; gap:8px;">
            <input type="text" id="chatInput" placeholder="Digite sua mensagem..." style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-elev); color:var(--text);" />
            <button type="submit" class="btn btn-primary">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  `;

  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('#chatInput').value.trim();
    if (!msg) return;
    
    const chat = $('#chatBox');
    if (chat.querySelector('p')) chat.innerHTML = '';
    
    // Mensagem do usuário
    chat.innerHTML += `<div style="background:var(--primary); color:#fff; padding:8px 12px; border-radius:8px; margin-bottom:8px; width:fit-content; margin-left:auto;">${escapeHtml(msg)}</div>`;
    $('#chatInput').value = '';
    
    // Resposta simulada do bot
    setTimeout(() => {
      chat.innerHTML += `<div style="background:var(--bg-elev-2); padding:8px 12px; border-radius:8px; margin-bottom:8px; width:fit-content;">Olá! Um atendente responderá em breve. Sua mensagem foi registrada.</div>`;
      chat.scrollTop = chat.scrollHeight;
    }, 800);
  });
}
