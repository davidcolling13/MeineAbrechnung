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
