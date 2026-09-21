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

const findColumnIndex = (
  headerRow: any[], 
  exactMatches: string[], 
  fuzzyMatches: string[] = [], 
  excludeMatches: string[] = []
): number => {
  const cleanCells = headerRow.map(cell => 
    cell !== null && cell !== undefined ? cell.toString().toLowerCase().trim() : ''
  );

  // 1. Exact match against exactMatches
  let idx = cleanCells.findIndex(cell => 
    cell && exactMatches.some(m => cell === m.toLowerCase())
  );
  if (idx !== -1) return idx;

  // 2. Fuzzy match without excluded words
  if (fuzzyMatches.length > 0) {
    idx = cleanCells.findIndex(cell => {
      if (!cell) return false;
      const hasExclude = excludeMatches.some(ex => cell.includes(ex.toLowerCase()));
      if (hasExclude) return false;
      return fuzzyMatches.some(m => cell.includes(m.toLowerCase()));
    });
    if (idx !== -1) return idx;
  }

  // 3. Fallback fuzzy match if no exclusions specified
  if (fuzzyMatches.length > 0 && excludeMatches.length === 0) {
    return cleanCells.findIndex(cell => 
      cell && fuzzyMatches.some(m => cell.includes(m.toLowerCase()))
    );
  }

  return -1;
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
      articleNo: findColumnIndex(
          headerRow,
          ['art-nr', 'art.-nr.', 'art.-nr', 'artikelnr', 'artikel-nr', 'artikel-nr.', 'artikelnummer', 'artikel-nummer', 'art.nr', 'art.nr.', 'art nr', 'artnr', 'art_nr', 'sku', 'art-no', 'item-no'],
          ['artikelnr', 'artikelnummer', 'art-nr', 'art.-nr', 'art.nr', 'art nr', 'artnr', 'sku'],
          ['name', 'bezeichnung', 'beschreibung', 'titel']
      ),
      name: findColumnIndex(
          headerRow,
          ['artikel', 'artikelname', 'artikel-name', 'bezeichnung', 'artikelbezeichnung', 'produkt', 'produktname', 'produktbezeichnung', 'modell', 'modellname', 'beschreibung', 'artikelbeschreibung', 'ware', 'warenbezeichnung', 'titel', 'gegenstand', 'item', 'item name'],
          ['artikelname', 'artikelbezeichnung', 'bezeichnung', 'produktname', 'produktbezeichnung', 'modell', 'beschreibung', 'titel', 'ware', 'produkt', 'artikel'],
          ['nr', 'nummer', 'sku', 'code', 'art.-nr', 'art-nr', 'art.nr', 'artnr']
      ),
      size: findColumnIndex(
          headerRow,
          ['größe', 'size', 'groesse', 'größe (eu)', 'groesse (eu)'],
          ['größe', 'groesse', 'size'],
          []
      ),
      color: findColumnIndex(
          headerRow,
          ['farbe', 'color', 'farbbezeichnung', 'colour'],
          ['farbe', 'color'],
          []
      ),
      quantity: findColumnIndex(
          headerRow,
          ['menge', 'anzahl', 'stk', 'stück', 'stueck', 'qty', 'quantity'],
          ['menge', 'anzahl', 'stk', 'stück'],
          []
      ),
      price: findColumnIndex(
          headerRow,
          ['preis', 'einzel', 'einzelpreis', 'preis einzel', 'preis/stk', 'vk', 'ek', 'price', 'betrag'],
          ['preis', 'einzel', 'price'],
          ['gesamt', 'total', 'summe']
      ),
      person: findColumnIndex(
          headerRow,
          ['besteller', 'person', 'athlet', 'trainer', 'empfänger', 'wer', 'kaderathlet', 'kader', 'bestellt von', 'name des bestellers', 'name'],
          ['besteller', 'athlet', 'trainer', 'empfänger', 'kader', 'bestell'],
          []
      ),
      status: findColumnIndex(
          headerRow,
          ['status', 'lieferung', 'lieferstatus', 'bemerkung', 'info'],
          ['status', 'lieferung', 'lieferstatus'],
          []
      ),
      shipping: findColumnIndex(
          headerRow,
          ['versand', 'shipping', 'porto', 'versandkosten', 'fracht', 'versand & verpackung'],
          ['versand', 'porto', 'shipping', 'fracht'],
          []
      )
  };

  // Disambiguate articleNo and name if both pointed to the same column
  if (idxMap.articleNo !== -1 && idxMap.articleNo === idxMap.name) {
      const colStr = headerRow[idxMap.articleNo]?.toString().toLowerCase().trim() || '';
      const looksLikeNumberCol = ['nr', 'nummer', 'art', 'sku', 'code'].some(k => colStr.includes(k));
      if (looksLikeNumberCol) {
          const otherCol = headerRow.findIndex((cell, i) => {
              if (i === idxMap.articleNo || !cell) return false;
              const str = cell.toString().toLowerCase().trim();
              return ['artikel', 'bezeichnung', 'name', 'produkt', 'modell', 'beschreibung'].some(k => str.includes(k)) &&
                     !['nr', 'nummer', 'sku', 'code'].some(k => str.includes(k));
          });
          idxMap.name = otherCol;
      } else {
          const otherCol = headerRow.findIndex((cell, i) => {
              if (i === idxMap.name || !cell) return false;
              const str = cell.toString().toLowerCase().trim();
              return ['nr', 'nummer', 'art', 'sku', 'code'].some(k => str.includes(k));
          });
          idxMap.articleNo = otherCol;
      }
  }

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

      let articleNo = (idxMap.articleNo > -1 ? row[idxMap.articleNo] : '')?.toString().trim() || '';
      let articleName = (idxMap.name > -1 ? row[idxMap.name] : '')?.toString().trim() || '';

      // If articleName is empty or identical to articleNo, check other columns for descriptive text
      if (!articleName || articleName === articleNo) {
          const ignoredCols = new Set([
              idxMap.articleNo, idxMap.size, idxMap.color, idxMap.quantity, 
              idxMap.price, idxMap.person, idxMap.status, idxMap.shipping
          ]);
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
              if (ignoredCols.has(colIdx)) continue;
              const val = row[colIdx]?.toString().trim();
              if (val && val !== articleNo && typeof val === 'string' && val.length > 1) {
                  articleName = val;
                  break;
              }
          }
          if (!articleName) {
              articleName = articleNo || 'Artikel';
          }
      }

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
