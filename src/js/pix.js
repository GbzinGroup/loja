/** Pix EMV BR Code helpers. Recalcula o campo de valor e o CRC16 do payload estático. */
export const DEFAULT_PIX_PAYLOAD = '00020126360014br.gov.bcb.pix0114+55819848192325204000053039865802BR5911Gbin Groups6009Sao Paulo62240520daqr222758773521097563042F9A';

function parseTlv(payload) {
  const result = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) throw new Error('Payload Pix inválido: campo incompleto.');
    const id = payload.slice(i, i + 2);
    const sizeText = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(sizeText)) throw new Error('Payload Pix inválido: estrutura TLV incorreta.');
    const size = Number(sizeText);
    const value = payload.slice(i + 4, i + 4 + size);
    if (value.length !== size) throw new Error('Payload Pix inválido: tamanho de campo incorreto.');
    result.push({ id, value });
    i += 4 + size;
  }
  return result;
}
function encodeTlv({ id, value }) {
  const str = String(value ?? '');
  if (str.length > 99) throw new Error(`Campo Pix ${id} excede o limite de tamanho.`);
  return id + String(str.length).padStart(2, '0') + str;
}
export function crc16Ccitt(text) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function buildPixPayload(basePayload, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 99999999.99) throw new Error('O valor do Pix precisa ser maior que R$ 0,00.');
  const payload = String(basePayload || '').trim();
  if (!payload) throw new Error('Configure o payload Pix do Mercado Pago.');
  const fields = parseTlv(payload);
  if (!fields.some(f => f.id === '00' && f.value === '01')) throw new Error('O código informado não parece ser um BR Code Pix válido.');
  const withoutAmountAndCrc = fields.filter(f => f.id !== '54' && f.id !== '63');
  const currencyIndex = withoutAmountAndCrc.findIndex(f => f.id === '53');
  const amountField = { id: '54', value: value.toFixed(2) };
  const insertAt = currencyIndex >= 0 ? currencyIndex + 1 : withoutAmountAndCrc.length;
  withoutAmountAndCrc.splice(insertAt, 0, amountField);
  const body = withoutAmountAndCrc.map(encodeTlv).join('') + '6304';
  return body + crc16Ccitt(body);
}