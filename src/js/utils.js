export const $ = (selector) => document.querySelector(selector);
export const appEl = () => document.getElementById('app');
export const headerEl = () => document.getElementById('header');

export const brl = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const escapeHtml = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (match) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
  });
};

export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:10px;';
    document.body.appendChild(el);
    return el;
  })();

  const el = document.createElement('div');
  const bg = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6366f1';
  el.style.cssText = `background:${bg}; color:white; padding:10px 20px; border-radius:8px; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); animation:fadeIn 0.3s;`;
  el.textContent = message;
  
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
