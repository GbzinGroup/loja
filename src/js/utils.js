/* =====================================================================
   utils.js — Utilitários Globais do Projeto
   ===================================================================== */

// Seletores Rápidos
export const $ = (selector) => document.querySelector(selector);
export const appEl = () => document.getElementById('app');
export const headerEl = () => document.getElementById('header');

// Formatadores
export const brl = (value) => {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatDate = (timestamp) => {
  if (!timestamp) return '';
  // Lida com Timestamp do Firestore, Timestamp do RTDB ou Date comum
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });
};

export const escapeHtml = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (match) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
  });
};

// Máscaras e Inputs
export const maskCPF = (value) => {
  return String(value)
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto entre o terceiro e o quarto dígitos
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto entre o sétimo e o oitavo dígitos
    .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Coloca hífen entre o terceiro e o quarto dígitos
    .replace(/(-\d{2})\d+?$/, '$1'); // Impede que o usuário digite mais de 11 dígitos
};

// Ícones para o Painel Admin
export const icons = {
  edit: '✏️',
  trash: '🗑️',
  plus: '➕',
  eye: '👁️',
  eyeOff: '🙈',
  close: '❌',
  check: '✅',
  search: '🔍',
  copy: '📋',
  settings: '⚙️',
  logout: '🚪',
  cart: '🛒'
};

// Sistema de Notificações (Toast)
export function toast(message, type = 'info') {
  // Cria o container de toasts se ele não existir no HTML
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  
  // Define as cores baseado no tipo
  const bgColors = {
    error: '#ef4444',
    success: '#10b981',
    info: '#6366f1'
  };

  el.style.cssText = `
    background: ${bgColors[type] || bgColors.info}; 
    color: white; 
    padding: 12px 24px; 
    border-radius: 8px; 
    font-weight: 600; 
    font-family: 'Inter', sans-serif;
    font-size: 0.95rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
    animation: slideDown 0.3s ease forwards;
    pointer-events: auto;
  `;
  
  el.textContent = message;
  container.appendChild(el);

  // Remove o toast após 3 segundos
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
