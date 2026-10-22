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
                 <span style="font-size:2.5rem;"></span><span class="muted">Clique para escolher</span>
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
          <div class="form-group" style="padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-elev)">
            <label for="pFulfillmentType">Tipo de entrega</label>
            <select id="pFulfillmentType" style="width:100%;padding:10px;border-radius:8px;background:var(--bg);color:var(--text);border:1px solid var(--border)">
              <option value="manual" ${(ed?.fulfillmentType || 'manual') === 'manual' ? 'selected' : ''}>Manual pela equipe</option>
              <option value="digital" ${ed?.fulfillmentType === 'digital' ? 'selected' : ''}>Digital automática (código/link)</option>
              <option value="vip" ${ed?.fulfillmentType === 'vip' ? 'selected' : ''}>Ativação de VIP</option>
            </select>
            <div id="digitalDeliveryFields" style="margin-top:12px;${ed?.fulfillmentType === 'digital' ? '' : 'display:none'}">
              <label for="pDeliveryContent">Conteúdo secreto para entregar após o pagamento</label>
              <textarea id="pDeliveryContent" rows="4" maxlength="12000" placeholder="Key, código ou instruções privadas. Não coloque aqui dados que não devem ser entregues ao cliente."></textarea>
              <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="pClearDelivery"> Apagar conteúdo de entrega existente</label>
              <p class="muted" style="font-size:.8rem">O conteúdo fica em um caminho privado do Realtime Database e só é anexado ao pedido após a confirmação do Mercado Pago. Ao editar, deixe em branco para preservar o conteúdo atual.</p>
            </div>
            <div id="vipDeliveryFields" style="margin-top:12px;${ed?.fulfillmentType === 'vip' ? '' : 'display:none'}">
              <label for="pVipName">Nome do benefício VIP</label><input id="pVipName" maxlength="100" value="${escapeHtml(ed?.vipPlanName || '')}" placeholder="VIP Ouro">
              <label for="pVipDays" style="margin-top:8px">Duração em dias</label><input id="pVipDays" type="number" min="1" max="3650" step="1" value="${Number(ed?.vipDurationDays) || 30}">
              <p class="muted" style="font-size:.8rem">Ao confirmar o Pix, o backend cria uma assinatura VIP com validade. A entrega no servidor Minecraft ainda exige integração própria.</p>
            </div>
          </div>
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
  const syncDeliveryFields = () => {
    const type = $('#pFulfillmentType')?.value;
    $('#digitalDeliveryFields').style.display = type === 'digital' ? 'block' : 'none';
    $('#vipDeliveryFields').style.display = type === 'vip' ? 'block' : 'none';
  };
  $('#pFulfillmentType')?.addEventListener('change', syncDeliveryFields);
  syncDeliveryFields();
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
      fulfillmentType: $('#pFulfillmentType').value,
      vipPlanName: $('#pVipName').value.trim().slice(0, 100),
      vipDurationDays: $('#pFulfillmentType').value === 'vip' ? Number($('#pVipDays').value) : 0,
      active: document.querySelector('input[name="pStatus"]:checked').value === 'true'
    };
    const deliveryContent = $('#pDeliveryContent').value.trim();
    if (data.fulfillmentType === 'vip' && (!data.vipPlanName || !Number.isInteger(data.vipDurationDays) || data.vipDurationDays < 1 || data.vipDurationDays > 3650)) { toast('Informe o nome e a duração válida do VIP.', 'error'); btn.disabled = false; btn.textContent = 'Salvar Produto'; return; }
    try {
      if (data.fulfillmentType === 'digital' && !deliveryContent) {
        const existingDelivery = ed && !$('#pClearDelivery').checked ? await store.getProductDelivery(ed.id) : null;
        if (!existingDelivery?.content) throw new Error('Informe um link ou instruções de entrega para o produto digital.');
      }
      let productId = ed?.id;
      if (ed) await store.updateProduct(ed.id, data); else productId = await store.addProduct(data);
      if (data.fulfillmentType === 'digital') {
        if (deliveryContent) await store.saveProductDelivery(productId, deliveryContent);
        else if ($('#pClearDelivery').checked) await store.saveProductDelivery(productId, '');
      } else if ($('#pClearDelivery')?.checked) await store.saveProductDelivery(productId, '');
      toast('Produto salvo com sucesso!', 'success'); window.navigate('admin', {tab:'products'});
    } catch (err) { console.error('[Produto]', err); toast(err.message || 'Não foi possível salvar o produto.', 'error'); btn.disabled = false; btn.textContent = 'Salvar Produto'; }
  };
}   
