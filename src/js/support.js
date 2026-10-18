import { $, appEl, escapeHtml } from './utils.js';

export function renderSupport() {
  appEl().innerHTML = `
    <div class="card wide" style="max-width:900px;">
      <h2>Central de Suporte</h2>
      <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:24px;">
        <div style="flex:1;">
          <h3>FAQ</h3>
          <details style="background:var(--bg-elev); padding:12px; border-radius:8px; margin-top:8px;"><summary>Como instalo a capa?</summary><p class="muted">Baixe na biblioteca e aplique.</p></details>
          <details style="background:var(--bg-elev); padding:12px; border-radius:8px; margin-top:8px;"><summary>Como funciona o PIX?</summary><p class="muted">Pague e envie o comprovante.</p></details>
        </div>
        <div style="flex:1; background:var(--bg-elev-2); padding:20px; border-radius:12px;">
          <h3>Fale Conosco</h3>
          <div id="chatBox" style="height:200px; overflow-y:auto; background:var(--bg-elev); border-radius:8px; padding:12px; margin:16px 0;"></div>
          <form id="chatForm" style="display:flex; gap:8px;">
            <input type="text" id="chatInput" placeholder="Sua mensagem..." style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-elev); color:var(--text);" />
            <button type="submit" class="btn btn-primary">Enviar</button>
          </form>
        </div>
      </div>
    </div>`;
  
  $('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const msg = $('#chatInput').value.trim();
    if (!msg) return;
    const chat = $('#chatBox');
    chat.innerHTML += `<div style="background:var(--primary); color:#fff; padding:8px; border-radius:8px; margin-bottom:8px; text-align:right;">${escapeHtml(msg)}</div>`;
    $('#chatInput').value = '';
    setTimeout(() => { chat.innerHTML += `<div style="background:var(--bg-elev-2); padding:8px; border-radius:8px; margin-bottom:8px;">Aguarde, um atendente responderá.</div>`; }, 800);
  };
}
