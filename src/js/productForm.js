import { store } from './store.js';
import { $, appEl, escapeHtml, toast } from './utils.js';

export function renderProductForm(state, id) {
  if (!state.isAdmin) return window.navigate('login');
  const ed = id ? state.products.find(p => p.id === id) : null;
  const isDraft = ed ? ed.active === false : false;

  appEl().innerHTML = `
    <div class="card wide" style="max-width:1000px; width:100%; padding:32px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div><h2>${ed ? 'Editar Produto' : 'Novo Produto'}</h2><p class="muted">Preencha os dados abaixo</p></div>
        <button class="btn btn-outline" onclick="window.navigate('admin', {tab:'products'})">Voltar</button>
      </div>
      <form id="productForm" style="display:grid; grid-template-columns: 1fr 1.2fr; gap:32px;">
        <div style="display:flex; flex-direction:column; gap:24px;">
          <div class="form-group">
            <label>Imagem do Produto</label>
            <div style="border: 2px dashed var(--border-strong); padding: 20px; border-radius: 12px; text-align: center; position: relative; min-height:280px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;">
               <input type="file" id="pFile" accept="image/*" style="position:absolute; inset:0; opacity:0; cursor:pointer;" />
               ${ed?.image ? `<img id="imgPreview" src="${ed.image}" style="max-width:100%; max-height:240px; border-radius:8px;" />` : `<img id="imgPreview" style="display:none; max-width:100%; max-height:240px; border-radius:8px;" />`}
               <div id="uploadText" style="${ed?.image ? 'display:none' : 'display:flex; flex-direction:column; gap:8px;'}">
                 <span style="font-size:2.5rem;">📸</span><span class="muted">Clique para escolher</span>
               </div>
            </div>
          </div>
          <div class="form-group" style="background:var(--bg-elev); padding:20px; border-radius:12px; border:1px solid var(--border);">
            <label style="margin-bottom:12px; font-weight:bold;">Status</label>
            <label style="display:flex; gap:10px; cursor:pointer; margin-bottom:10px;"><input type="radio" name="pStatus" value="true" ${!isDraft ? 'checked' : ''}> Publicar</label>
            <label style="display:flex; gap:10px; cursor:pointer;"><input type="radio" name="pStatus" value="false" ${isDraft ? 'checked' : ''}> Rascunho</label>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div class="form-group"><label>Nome</label><input type="text" id="pName" required value="${ed ? escapeHtml(ed.name) : ''}" /></div>
          <div style="display:flex; gap:16px;">
            <div class="form-group" style="flex:1;"><label>Preço (R$)</label><input type="number" id="pPrice" step="0.01" required value="${ed ? ed.price : ''}" /></div>
            <div class="form-group" style="flex:1;"><label>Promocional (R$)</label><input type="number" id="pPromo" step="0.01" value="${ed ? ed.promoPrice : ''}" /></div>
          </div>
          <div style="display:flex; gap:16px;">
            <div class="form-group" style="flex:1;"><label>Estoque</label><input type="number" id="pStock" required value="${ed ? ed.stock : '10'}" /></div>
            <div class="form-group" style="flex:1;"><label>Categoria</label><input type="text" id="pCategory" required value="${ed ? escapeHtml(ed.category) : ''}" /></div>
          </div>
          <div class="form-group">
            <label>Raridade</label>
            <select id="pRarity" class="filter-select" style="width:100%; height:44px;">
              <option value="Comum" ${ed?.rarity === 'Comum' ? 'selected' : ''}>Comum</option>
              <option value="Rara" ${ed?.rarity === 'Rara' ? 'selected' : ''}>Rara</option>
              <option value="Épica" ${ed?.rarity === 'Épica' ? 'selected' : ''}>Épica</option>
              <option value="Lendária" ${ed?.rarity === 'Lendária' ? 'selected' : ''}>Lendária</option>
            </select>
          </div>
          <div class="form-group"><label>Descrição</label><textarea id="pDesc" rows="3">${ed ? escapeHtml(ed.description) : ''}</textarea></div>
          <div class="form-group" style="background:rgba(245,158,11,0.1); padding:20px; border-radius:12px; border:1px solid rgba(245,158,11,0.3);">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; color:var(--warning); font-weight:bold; margin-bottom:12px;">
              <input type="checkbox" id="pLimited" ${ed?.isLimited ? 'checked' : ''} onchange="document.getElementById('pExpires').disabled = !this.checked" /> Capa Limitada?
            </label>
            <input type="datetime-local" id="pExpires" value="${ed?.expiresAt ? new Date(ed.expiresAt).toISOString().slice(0,16) : ''}" ${!ed?.isLimited ? 'disabled' : ''} style="width:100%; padding:10px; border-radius:8px; background:var(--bg-elev); color:var(--text); border:1px solid var(--border);" />
          </div>
          <button type="submit" class="btn btn-primary" id="btnSubmit" style="padding:16px; font-size:1.1rem;">Salvar Produto</button>
        </div>
      </form>
    </div>`;

  let base64Image = ed ? ed.image : '';
  $('#pFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return toast('Máx 2MB', 'error');
    const reader = new FileReader();
    reader.onload = (ev) => { base64Image = ev.target.result; $('#imgPreview').src = base64Image; $('#imgPreview').style.display = 'block'; $('#uploadText').style.display = 'none'; };
    reader.readAsDataURL(file);
  });

  $('#productForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#btnSubmit'); btn.textContent = 'Salvando...'; btn.disabled = true;
    let expiresVal = $('#pLimited').checked && $('#pExpires').value ? new Date($('#pExpires').value).getTime() : 0;
    const data = { 
      name: $('#pName').value, price: Number($('#pPrice').value), promoPrice: Number($('#pPromo').value) || 0,
      stock: Number($('#pStock').value), category: $('#pCategory').value, rarity: $('#pRarity').value,
      isLimited: $('#pLimited').checked, expiresAt: expiresVal, description: $('#pDesc').value, image: base64Image,
      active: document.querySelector('input[name="pStatus"]:checked').value === 'true'
    };
    try {
      if (ed) await store.updateProduct(ed.id, data); else await store.addProduct(data);
      toast('Salvo!', 'success'); window.navigate('admin', {tab:'products'});
    } catch (err) { toast('Erro.', 'error'); btn.disabled = false; btn.textContent = 'Salvar'; }
  };
}
