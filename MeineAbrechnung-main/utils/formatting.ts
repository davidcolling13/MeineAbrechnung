export const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const formatDateDE = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE');
};

export const parseGermanFloat = (value: string | number): number => {
  if (typeof value === 'number') return roundCurrency(value);
  if (typeof value === 'string') {
    // 1.200,50 -> 1200,50 -> 1200.50
    const clean = value.replace(/[^0-9,-]/g, '').replace(',', '.');
    return roundCurrency(parseFloat(clean) || 0);
  }
  return 0;
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 UUID Fallback für ungesicherte HTTP-Kontexte (z.B. lokales Netzwerk / NAS via IP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
