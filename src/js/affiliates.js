const STORAGE_KEY = 'gbzin_shop_referral_v2';
const LEGACY_KEY = 'gbzin_shop_referral_v1';
const CODE_RE = /^[A-Z0-9_-]{3,64}$/;
const ATTRIBUTION_TTL = 30 * 24 * 60 * 60 * 1000;

export function captureReferralCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const candidate = String(params.get('ref') || '').trim().toUpperCase();
    if (!CODE_RE.test(candidate)) return;
    // A new explicit referral link replaces an old attribution. Keep it for 30 days.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: candidate, capturedAt: Date.now() }));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code: candidate, capturedAt: Date.now() }));
  } catch (error) { console.warn('[Afiliados] Não foi possível guardar atribuição.', error); }
}

export function getReferralCode() {
  for (const storage of [localStorageSafe(), sessionStorageSafe()]) {
    if (!storage) continue;
    try {
      let raw = storage.getItem(STORAGE_KEY);
      if (!raw && storage === localStorageSafe()) {
        const legacy = storage.getItem(LEGACY_KEY);
        if (legacy && CODE_RE.test(String(legacy).toUpperCase())) {
          raw = JSON.stringify({ code: String(legacy).toUpperCase(), capturedAt: Date.now() });
          storage.setItem(STORAGE_KEY, raw);
        }
      }
      if (!raw) continue;
      let item;
      try { item = JSON.parse(raw); } catch { item = { code: raw, capturedAt: Date.now() }; }
      const code = String(item.code || '').trim().toUpperCase();
      const capturedAt = Number(item.capturedAt || 0);
      if (!CODE_RE.test(code) || !capturedAt || Date.now() - capturedAt > ATTRIBUTION_TTL) { storage.removeItem(STORAGE_KEY); continue; }
      return code;
    } catch {}
  }
  return '';
}
function localStorageSafe(){ try{return localStorage;}catch{return null;} }
function sessionStorageSafe(){ try{return sessionStorage;}catch{return null;} }

export function buildReferralLink(code, base = window.location.origin + window.location.pathname) {
  const safe = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(safe)) throw new Error('Código de indicação inválido.');
  const url = new URL(base, window.location.origin);
  url.searchParams.set('ref', safe);
  return url.toString();
}
export async function copyReferralValue(value) {
  if (!value) throw new Error('Não há conteúdo para copiar.');
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.appendChild(input); input.select(); const ok = document.execCommand('copy'); input.remove(); if (!ok) throw new Error('Não foi possível copiar automaticamente.');
}
window.getReferralCode = getReferralCode;
window.copyAffiliateValue = copyReferralValue;
