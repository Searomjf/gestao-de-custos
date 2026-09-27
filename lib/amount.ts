// A comma is decimal; a dot followed by groups of three is a thousands separator.
export function parseAmount(raw: string): number {
  let text = String(raw).trim().toLowerCase();
  if (!text) return NaN;
  const scaled = /\s*(mil|k)$/.test(text);
  text = text.replace(/\s*(mil|k)$/, '').trim();
  if (!text && scaled) return 1000;
  if (!text || !/^[\d.,]+$/.test(text)) return NaN;
  if (text.includes(',') && text.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text)) text = text.replaceAll('.', '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(text)) text = text.replaceAll(',', '');
    else return NaN;
  } else if (text.includes(',')) {
    if (!/^\d*,\d+$/.test(text)) return NaN;
    text = text.replace(',', '.');
  } else if (!scaled && /^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) {
    text = text.replaceAll('.', '');
  } else if (!/^\d+(\.\d+)?$/.test(text) && !/^\.\d+$/.test(text)) return NaN;
  const result = Number(text) * (scaled ? 1000 : 1);
  return Number.isFinite(result) && result <= Number.MAX_SAFE_INTEGER / 100 ? Math.round((result + Number.EPSILON) * 100) / 100 : NaN;
}


export function formatAmountInput(raw: string): string {
  const value = parseAmount(raw);
  return Number.isFinite(value) ? value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : raw;
}
