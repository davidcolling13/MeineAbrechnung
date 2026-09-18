export const roundCurrency = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const formatDateDE = (dateStr: string): string => {
  if (!dateStr) return '';
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('de-DE');
  }
  return new Date(dateStr).toLocaleDateString('de-DE');
 };

/**
 * Berechnet das Zahlungsziel: Standardmäßig 14 Tage ab Rechnungsdatum.
 * Berücksichtigt Zeitzonen und Datumsformate exakt.
 */
export const calculateDueDate = (invoiceDateStr?: string, days = 14): string => {
  if (!invoiceDateStr) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('de-DE');
  }
  let baseDate: Date;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(invoiceDateStr)) {
    const [day, month, year] = invoiceDateStr.split('.');
    baseDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  } else {
    const parts = invoiceDateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      baseDate = new Date(invoiceDateStr);
    }
  }

  if (isNaN(baseDate.getTime())) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('de-DE');
  }

  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toLocaleDateString('de-DE');
};

/**
 * Berechnet das Zahlungsziel als ISO-String (YYYY-MM-DD) für Datenbank und Speicherung.
 */
export const calculateDueDateISO = (invoiceDateStr?: string, days = 14): string => {
  if (!invoiceDateStr) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  let baseDate: Date;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(invoiceDateStr)) {
    const [day, month, year] = invoiceDateStr.split('.');
    baseDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  } else {
    const parts = invoiceDateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      baseDate = new Date(invoiceDateStr);
    }
  }

  if (isNaN(baseDate.getTime())) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  baseDate.setDate(baseDate.getDate() + days);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
