// ---------- CARRINHO ATLAS MC ----------
function getCarrinho() {
  return JSON.parse(localStorage.getItem('atlas_carrinho') || '[]');
}

function setCarrinho(c) {
  localStorage.setItem('atlas_carrinho', JSON.stringify(c));
  atualizarContador();
}

function addCarrinho(nome, preco) {
  const c = getCarrinho();
  const existente = c.find(i => i.nome === nome);
  if (existente) {
    existente.qtd = (existente.qtd || 1) + 1;
  } else {
    c.push({ nome, preco, qtd: 1 });
  }
  setCarrinho(c);
  alert(`✅ "${nome}" adicionado ao carrinho!`);
}

function removerItem(index) {
  const c = getCarrinho();
  c.splice(index, 1);
  setCarrinho(c);
  renderCarrinho();
}

function atualizarContador() {
  const el = document.getElementById('contador');
  if (!el) return;
  const c = getCarrinho();
  const total = c.reduce((s, i) => s + (i.qtd || 1), 0);
  el.textContent = total;
}

function renderCarrinho() {
  const container = document.getElementById('itens-carrinho');
  const totalEl = document.getElementById('total');
  if (!container) return;

  const c = getCarrinho();
  container.innerHTML = '';

  if (c.length === 0) {
    container.innerHTML = '<div class="vazio">😢 O teu carrinho está vazio!</div>';
    totalEl.textContent = 'Total: R$ 0,00';
    return;
  }

  let total = 0;
  c.forEach((item, i) => {
    const qtd = item.qtd || 1;
    const subtotal = item.preco * qtd;
    total += subtotal;
    container.innerHTML += `
      <div class="item-carrinho">
        <div>
          <strong>${item.nome}</strong><br>
          <small>${qtd}x R$ ${item.preco.toFixed(2)} = R$ ${subtotal.toFixed(2)}</small>
        </div>
        <button onclick="removerItem(${i})">Remover</button>
      </div>
    `;
  });

  totalEl.textContent = `Total: R$ ${total.toFixed(2)}`;
}

function finalizar() {
  const c = getCarrinho();
  if (c.length === 0) {
    alert('O carrinho está vazio!');
    return;
  }
  alert('🎉 Compra finalizada! Entra no servidor para receber os teus itens.\n\nNick: (será pedido)\nIP: play.atlasmc.com');
  localStorage.removeItem('atlas_carrinho');
  atualizarContador();
  renderCarrinho();
}

// Atualiza contador ao carregar qualquer página
document.addEventListener('DOMContentLoaded', atualizarContador);
