/* =====================================================================
   productForm.js — Gerenciamento de Criação e Edição de Produtos
   ===================================================================== */
import { store } from './store.js';
import { $, appEl, escapeHtml, toast } from './utils.js';

export function renderProductForm(state, id) {
  if (!state.isAdmin) { 
    toast('Acesso restrito.', 'error'); 
    return window.navigate('login'); 
  }
  
  const ed = id ? state.products.find((p) => p.id === id) : null;
  const isDraft = ed ? ed.active === false : false;

  // HTML do formulário
  appEl().innerHTML = `
    <div class="card wide" style="max-width:1000px; width:100%; padding:32px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div>
          <h2 style="margin-bottom:4px;">${ed ? 'Editar Produto' : 'Cadastrar Novo Produto'}</h2>
          <p class="muted">${ed ? 'Atualize as informações da capa' : 'Adicione uma nova capa ao catálogo'}</p>
        </div>
        <button class="btn btn-outline" onclick="window.navigate('admin', {tab:'products'})">Voltar</button>
      </div>

      <form id="productForm" style="display:grid; grid-template-columns: 1fr 1.2fr; gap:32px;">
        
        <!-- COLUNA ESQUERDA: Imagem e Status -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <div class="form-group">
            <label>Imagem da Capa (Upload)</label>
            <div style="border: 2px dashed var(--border-strong); padding: 20px; border-radius: 12px; text-align: center; position: relative; min-height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition: border-color 0.2s;">
               <input type="file" id="pFile" accept="image/*" style="position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%;" />
               ${ed?.image ? `<img id="imgPreview" src="${ed.image}" style="max-width:100%; max-height:240px; object-fit:cover; border-radius:8px;" />` : `<img id="imgPreview" style="display:none; max-width:100%; max-height:240px; object-fit:cover; border-radius:8px;" />`}
               <div id="uploadText" style="${ed?.image ? 'display:none' : 'display:flex; flex-direction:column; align-items:center; gap:12px;'}">
                 <span style="font-size:3rem;">📸</span>
                 <span class="muted" style="font-weight:600;">Clique para escolher uma imagem</span>
                 <span class="muted" style="font-size:0.75rem;">Formatos: JPG, PNG (Máx 2MB)</span>
               </div>
            </div>
          </div>

          <div class="form-group" style="background:var(--bg-elev); padding:20px; border-radius:12px; border:1px solid var(--border);">
            <label style="margin-bottom:12px; font-size:0.9rem;">Status de Publicação</label>
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:12px; font-size:0.9rem;">
              <input type="radio" name="pStatus" value="true" ${!isDraft ? 'checked' : ''} style="accent-color:var(--primary); width:18px; height:18px;"> Publicar (Visível na loja)
            </label>
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:0.9rem;">
              <input type="radio" name="pStatus" value="false" ${isDraft ? 'checked' : ''} style="accent-color:var(--primary); width:18px; height:18px;"> Salvar como Rascunho (Oculto)
            </label>
          </div>
        </div>

        <!-- COLUNA DIREITA: Informações -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div class="form-group">
            <label>Nome do Produto</label>
            <input type="text" id="pName" required value="${ed ? escapeHtml(ed.name) : ''}" placeholder="Ex: Capa Optifine Pro" style="font-size:1rem;" />
          </div>

          <div style="display:flex; gap:16px;">
            <div class="form-group" style="flex:1;">
              <label>Preço Original (R$)</label>
              <input type="number" id="pPrice" step="0.01" min="0" required value="${ed ? ed.price : ''}" placeholder="0.00" />
            </div>
            <div class="form-group" style="flex:1;">
              <label>Preço Promocional (R$)</label>
              <input type="number" id="pPromo" step="0.01" min="0" value="${ed ? ed.promoPrice : ''}" placeholder="0.00" />
            </div>
          </div>

          <div style="display:flex; gap:16px;">
            <div class="form-group" style="flex:1;">
              <label>Estoque Disponível</label>
              <input type="number" id="pStock" min="0" required value="${ed ? ed.stock : '10'}" />
            </div>
            <div class="form-group" style="flex:1;">
              <label>Categoria / Estilo</label>
              <input type="text" id="pCategory" required value="${ed ? escapeHtml(ed.category) : ''}" placeholder="Ex: Anime, Futebol" />
            </div>
          </div>

          <div class="form-group">
            <label>Raridade da Capa</label>
            <select id="pRarity" class="filter-select" style="width:100%; height:44px; font-size:1rem;">
              <option value="Comum" ${ed?.rarity === 'Comum' ? 'selected' : ''}>Comum</option>
              <option value="Rara" ${ed?.rarity === 'Rara' ? 'selected' : ''}>Rara</option>
              <option value="Épica" ${ed?.rarity === 'Épica' ? 'selected' : ''}>Épica</option>
              <option value="Lendária" ${ed?.rarity === 'Lendária' ? 'selected' : ''}>Lendária</option>
            </select>
          </div>

          <div class="form-group">
            <label>Descrição Detalhada</label>
            <textarea id="pDesc" rows="4" placeholder="Descreva os detalhes da capa...">${ed ? escapeHtml(ed.description) : ''}</textarea>
          </div>

          <!-- Sistema de Tempo Limitado -->
          <div class="form-group" style="background:rgba(245, 158, 11, 0.1); padding:20px; border-radius:12px; border:1px solid rgba(245, 158, 11, 0.3);">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin-bottom:12px; color:var(--warning); font-weight:700;">
              <input type="checkbox" id="pLimited" ${ed?.isLimited ? 'checked' : ''} onchange="document.getElementById('pExpires').disabled = !this.checked" style="width:18px; height:18px; accent-color:var(--warning);" />
              Ativar Promoção Relâmpago (Capa Limitada)
            </label>
            <label style="font-size:0.85rem;">Data e Hora de Expiração:</label>
            <input type="datetime-local" id="pExpires" value="${ed?.expiresAt ? new Date(ed.expiresAt).toISOString().slice(0,16) : ''}" ${!ed?.isLimited ? 'disabled' : ''} style="padding:10px; background:var(--bg-elev); border:1px solid var(--border); color:var(--text); border-radius:8px; width:100%; margin-top:8px; opacity: ${!ed?.isLimited ? '0.5' : '1'};" />
          </div>

          <div class="form-actions" style="margin-top:12px;">
            <button type="submit" class="btn btn-primary" id="btnSubmit" style="padding:16px; font-size:1.05rem; border-radius:12px;">${ed ? 'Salvar Alterações' : 'Cadastrar Produto'}</button>
          </div>
        </div>
      </form>
    </div>`;

  let base64Image = ed ? ed.image : '';
  
  // Preview da Imagem
  $('#pFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('A imagem é muito grande (Máx 2MB)', 'error');
    
    const reader = new FileReader();
    reader.onload = (ev) => { 
      base64Image = ev.target.result; 
      $('#imgPreview').src = base64Image; 
      $('#imgPreview').style.display = 'block';
      $('#uploadText').style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  // Submit do Formulário
  $('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btnSubmit'); 
    btn.textContent = 'Salvando...'; 
    btn.disabled = true;
    
    let expiresVal = 0;
    if ($('#pLimited').checked && $('#pExpires').value) {
      expiresVal = new Date($('#pExpires').value).getTime();
    }
    
    const isActive = document.querySelector('input[name="pStatus"]:checked').value === 'true';

    const data = { 
      name: $('#pName').value.trim(), 
      price: Number($('#pPrice').value), 
      promoPrice: Number($('#pPromo').value) || 0,
      stock: Number($('#pStock').value),
      category: $('#pCategory').value.trim(),
      rarity: $('#pRarity').value,
      isLimited: $('#pLimited').checked,
      expiresAt: expiresVal,
      description: $('#pDesc').value.trim(), 
      image: base64Image,
      active: isActive
    };
    
    try {
      if (ed) await store.updateProduct(ed.id, data); 
      else await store.addProduct(data);
      toast('Produto salvo com sucesso!', 'success'); 
      window.navigate('admin', {tab:'products'});
    } catch (err) { 
      toast('Erro ao salvar. Verifique o console.', 'error'); 
      console.error("Erro no Firebase:", err); 
      btn.disabled = false; 
      btn.textContent = ed ? 'Salvar Alterações' : 'Cadastrar Produto'; 
    }
  });
}
