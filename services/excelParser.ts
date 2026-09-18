import { Contact, BulkOrderItem } from '../types';
import { roundCurrency, parseGermanFloat, calculateDueDate, calculateDueDateISO, formatDateDE } from '../utils/formatting';
// @ts-ignore
import readXlsxFile from 'read-excel-file';
import { db } from './db';

export interface ParseResult {
  invoices: GeneratedInvoiceData[];
  unmatchedNames: string[];
}

export interface GeneratedInvoiceData {
  id: string;
  invoiceNumber: string;
  contact: Contact;
  items: BulkOrderItem[];
  shippingCost: number;
  total: number;
  date: string;
  isoDate: string;
  dueDate: string;
  dueDateISO: string;
}

const findColumnIndex = (headerRow: any[], possibleNames: string[]): number => {
  let idx = headerRow.findIndex(cell => 
      cell && typeof cell === 'string' && possibleNames.some(name => cell.toLowerCase().trim() === name.toLowerCase())
  );
  if (idx === -1) {
      idx = headerRow.findIndex(cell => 
          cell && typeof cell === 'string' && possibleNames.some(name => cell.toLowerCase().includes(name.toLowerCase()))
      );
  }
  return idx;
};

const findContact = (nameFromExcel: string, contacts: Contact[]): Contact | undefined => {
  const cleanName = nameFromExcel.toLowerCase().trim();
  
  return contacts.find(c => {
      const first = c.firstName.toLowerCase();
      const last = c.lastName.toLowerCase();
      const full = `${first} ${last}`;
      const fullReverse = `${last} ${first}`;

      if (cleanName === full || cleanName === fullReverse) return true;
      if (cleanName.includes(first) && cleanName.includes(last)) return true;
      if (cleanName === last) return true;
      if (cleanName === first) return true;
      
      return false;
  });
};

export const parseBulkOrderExcel = async (file: File, contacts: Contact[], customDate?: string): Promise<ParseResult> => {
  const rows = await readXlsxFile(file);
  
  if (!rows || rows.length < 2) {
      throw new Error("Die Excel-Datei scheint leer zu sein oder hat keine Kopfzeile.");
  }

  const headerRow = rows[0];
  
  const idxMap = {
      articleNo: findColumnIndex(headerRow, ['art', 'nr', 'nummer', 'artikelnummer']),
      name: findColumnIndex(headerRow, ['artikel', 'bezeichnung', 'produkt']),
      size: findColumnIndex(headerRow, ['größe', 'size', 'groesse']),
      color: findColumnIndex(headerRow, ['farbe', 'color']),
      quantity: findColumnIndex(headerRow, ['menge', 'anzahl', 'stk']),
      price: findColumnIndex(headerRow, ['preis', 'einzel', 'einzelpreis']),
      person: findColumnIndex(headerRow, ['besteller', 'person', 'athlet', 'trainer', 'empfänger', 'wer']),
      status: findColumnIndex(headerRow, ['status', 'lieferung']),
      shipping: findColumnIndex(headerRow, ['versand', 'shipping', 'porto', 'versandkosten'])
  };

  if (idxMap.person === -1 || idxMap.price === -1 || idxMap.quantity === -1) {
       throw new Error("Konnte notwendige Spalten (Besteller/Person, Preis oder Menge) nicht automatisch erkennen.");
  }

  const dataRows = rows.slice(1);
  const ordersByPerson = new Map<string, BulkOrderItem[]>();
  const shippingByPerson = new Map<string, number>();
  const missingContacts = new Set<string>();

  dataRows.forEach((row: any[], index: number) => {
      if (!row) return;

      const personName = (idxMap.person > -1 ? row[idxMap.person] : '')?.toString().trim();
      const status = (idxMap.status > -1 ? row[idxMap.status] : '')?.toString().toLowerCase() || '';

      if (!personName || status.includes('nachlieferung')) return;

      const articleNo = (idxMap.articleNo > -1 ? row[idxMap.articleNo] : '')?.toString() || '';
      const articleName = (idxMap.name > -1 ? row[idxMap.name] : '')?.toString() || 'Unbekannter Artikel';
      const size = (idxMap.size > -1 ? row[idxMap.size] : '')?.toString() || '';
      const color = (idxMap.color > -1 ? row[idxMap.color] : '')?.toString() || '';
      
      const quantityRaw = idxMap.quantity > -1 ? row[idxMap.quantity] : 0;
      const quantity = parseInt(quantityRaw?.toString() || '0');
      
      const singlePrice = parseGermanFloat(idxMap.price > -1 ? row[idxMap.price] : 0);
      const rowShipping = idxMap.shipping > -1 ? parseGermanFloat(row[idxMap.shipping]) : 0;
      
      if (!ordersByPerson.has(personName)) {
          ordersByPerson.set(personName, []);
      }

      if (rowShipping > 0) {
          const currentMax = shippingByPerson.get(personName) || 0;
          if (rowShipping > currentMax) {
              shippingByPerson.set(personName, rowShipping);
          }
      }

      ordersByPerson.get(personName)?.push({
          id: `item-${index}`,
          contactId: '', 
          articleNo,
          name: articleName,
          size,
          color,
          quantity,
          singlePrice,
          totalPrice: roundCurrency(quantity * singlePrice)
      });
  });

  const matchedOrders: { contact: Contact; items: BulkOrderItem[]; name: string }[] = [];
  
  ordersByPerson.forEach((items, name) => {
      const contact = findContact(name, contacts);
      if (contact) {
          matchedOrders.push({ contact, items, name });
      } else {
          missingContacts.add(name);
      }
  });

  // Globale fortlaufende Belegnummern für alle Rechnungen dieser Sammelbestellung allokieren
  const allocatedNumbers = matchedOrders.length > 0
      ? await db.allocateDocumentNumbers(matchedOrders.length)
      : [];

  const isoDate = customDate || new Date().toISOString().split('T')[0];
  const displayDate = formatDateDE(isoDate);
  const dueDateFormatted = calculateDueDate(isoDate, 14);
  const dueDateISO = calculateDueDateISO(isoDate, 14);
  const newInvoices: GeneratedInvoiceData[] = [];

  matchedOrders.forEach(({ contact, items, name }, idx) => {
      const itemsTotal = items.reduce((sum, item) => roundCurrency(sum + item.totalPrice), 0);
      const specificShipping = shippingByPerson.get(name);
      const finalShipping = specificShipping !== undefined ? specificShipping : 0;
      const finalTotal = roundCurrency(itemsTotal + finalShipping);
      const invNum = allocatedNumbers[idx] || `DOC-${idx + 1}`;

      newInvoices.push({
          id: `inv-${contact.id}-${Date.now()}-${idx}`,
          invoiceNumber: invNum,
          contact: contact,
          items: items.map(i => ({...i, contactId: contact.id})),
          shippingCost: finalShipping,
          total: finalTotal,
          date: displayDate,
          isoDate: isoDate,
          dueDate: dueDateFormatted,
          dueDateISO: dueDateISO
      });
  });

  return {
    invoices: newInvoices,
    unmatchedNames: Array.from(missingContacts)
  };
};
