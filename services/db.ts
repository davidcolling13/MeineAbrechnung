import { Contact, AppSettings, InvoiceRecord, SystemLogEntry, LogsResponse, LogLevel } from '../types';
import { DEFAULT_INVOICE_TEXT, DEFAULT_CERTIFICATE_TEXT, FOOTER_INFO, SENDER_LINE, BULK_ORDER_PAYMENT_TEXT } from '../constants';

let isOffline = false;
const CONTACTS_KEY = 'meineabrechnung_contacts';
const SETTINGS_KEY = 'meineabrechnung_settings';
const INVOICES_KEY = 'meineabrechnung_invoices';
const LOGS_KEY = 'meineabrechnung_logs';

// --- LocalStorage Helpers ---
const getLocal = <T>(key: string): T | null => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const saveLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Default Settings
const defaultSettings: AppSettings = {
    invoiceText: DEFAULT_INVOICE_TEXT,
    certificateText: DEFAULT_CERTIFICATE_TEXT,
    bankDetails: BULK_ORDER_PAYMENT_TEXT,
    senderLine: SENDER_LINE,
    footerInfo: FOOTER_INFO,
    nextDocNumber: 1,
    docNumberPrefix: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpSecure: false,
    smtpFrom: 'info@alpinkader.nrw'
};

export const db = {
  isOfflineMode(): boolean {
    return isOffline;
  },

  async init(): Promise<void> {
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error(`Server status: ${response.status}`);
      isOffline = false;
      console.log("DB: Verbunden mit Server.");
    } catch (e) {
      console.warn("DB: Server nicht erreichbar. Offline-Modus.", e);
      isOffline = true;
      
      if (!getLocal(CONTACTS_KEY)) {
        const mockData: Contact[] = [
            { id: 'mock-1', firstName: 'Max', lastName: 'Mustermann', address: 'Teststraße 1', zip: '12345', city: 'Musterstadt', email: 'max@example.com', type: 'Athlet', gender: 'male' },
            { id: 'mock-2', firstName: 'Sarah', lastName: 'Trainer', address: 'Sportweg 5', zip: '54321', city: 'Sportdorf', email: 'sarah@example.com', type: 'Trainer', gender: 'female' }
        ];
        saveLocal(CONTACTS_KEY, mockData);
      }
    }
  },

  // --- CONTACTS ---
  async getAllContacts(): Promise<Contact[]> {
    if (isOffline) return getLocal<Contact[]>(CONTACTS_KEY) || [];
    const response = await fetch('/api/contacts');
    if (!response.ok) throw new Error('Fehler beim Laden der Kontakte');
    return await response.json();
  },

  async addContact(contact: Contact): Promise<Contact> {
    if (isOffline) {
      const contacts = getLocal<Contact[]>(CONTACTS_KEY) || [];
      const newContact = { ...contact }; 
      contacts.push(newContact);
      saveLocal(CONTACTS_KEY, contacts);
      return newContact;
    }
    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    if (!response.ok) {
      let errorMsg = 'Fehler beim Speichern';
      try {
        const errorData = await response.json();
        if (errorData?.error) errorMsg = errorData.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }
    return await response.json();
  },

  async updateContact(contact: Contact): Promise<Contact> {
    if (isOffline) {
      const contacts = getLocal<Contact[]>(CONTACTS_KEY) || [];
      const index = contacts.findIndex(c => c.id === contact.id);
      if (index !== -1) {
        contacts[index] = contact;
        saveLocal(CONTACTS_KEY, contacts);
      }
      return contact;
    }
    const response = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    if (!response.ok) {
      let errorMsg = 'Fehler beim Update';
      try {
        const errorData = await response.json();
        if (errorData?.error) errorMsg = errorData.error;
      } catch (_) {}
      throw new Error(errorMsg);
    }
    return contact;
  },

  async deleteContact(id: string): Promise<void> {
    if (isOffline) {
      const contacts = getLocal<Contact[]>(CONTACTS_KEY) || [];
      const filtered = contacts.filter(c => c.id !== id);
      saveLocal(CONTACTS_KEY, filtered);
      return;
    }
    const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Fehler beim Löschen');
  },

  // --- SETTINGS ---
  async getSettings(): Promise<AppSettings> {
      let remoteSettings: Partial<AppSettings> = {};

      if (isOffline) {
          remoteSettings = getLocal<Partial<AppSettings>>(SETTINGS_KEY) || {};
      } else {
          try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                // Das Backend liefert nun sauberes JSON, kein manuelles Parsen mehr nötig.
                remoteSettings = await res.json();
            }
          } catch (e) { 
            console.error("Failed to fetch settings", e); 
          }
      }
      
      return { ...defaultSettings, ...remoteSettings };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
      if (isOffline) {
          saveLocal(SETTINGS_KEY, settings);
          return;
      }
      const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error("Fehler beim Speichern der Einstellungen");
  },

  // --- GLOBALE DOKUMENTENNUMMERN ---
  async getNextDocumentNumber(): Promise<{ nextNumber: string; counter: number }> {
      if (isOffline) {
          const invoices = getLocal<InvoiceRecord[]>(INVOICES_KEY) || [];
          const currentYear = new Date().getFullYear().toString();
          let maxFound = 0;
          for (const inv of invoices) {
              const match = inv.invoiceNumber?.match(/(\d{4})-(\d+)/);
              if (match && match[1] === currentYear) {
                  const num = parseInt(match[2], 10);
                  if (num > maxFound) maxFound = num;
              }
          }
          const settings = getLocal<AppSettings>(SETTINGS_KEY) || defaultSettings;
          const start = Math.max(maxFound + 1, settings.nextDocNumber || 1);
          const prefix = settings.docNumberPrefix || '';
          const padLength = start >= 1000 ? 4 : 3;
          const numStr = start.toString().padStart(padLength, '0');
          const nextNumber = prefix ? `${prefix}${currentYear}-${numStr}` : `${currentYear}-${numStr}`;
          return { nextNumber, counter: start };
      }
      const response = await fetch('/api/documents/next-number');
      if (!response.ok) throw new Error("Fehler beim Abrufen der nächsten Belegnummer");
      return await response.json();
  },

  async allocateDocumentNumbers(count: number = 1): Promise<string[]> {
      if (isOffline) {
          const { nextNumber, counter } = await this.getNextDocumentNumber();
          const settings = getLocal<AppSettings>(SETTINGS_KEY) || defaultSettings;
          const currentYear = new Date().getFullYear().toString();
          const prefix = settings.docNumberPrefix || '';
          const numbers: string[] = [];
          for (let i = 0; i < count; i++) {
              const c = counter + i;
              const padLength = c >= 1000 ? 4 : 3;
              numbers.push(prefix ? `${prefix}${currentYear}-${c.toString().padStart(padLength, '0')}` : `${currentYear}-${c.toString().padStart(padLength, '0')}`);
          }
          settings.nextDocNumber = counter + count;
          saveLocal(SETTINGS_KEY, settings);
          return numbers;
      }
      const response = await fetch('/api/documents/allocate-numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count })
      });
      if (!response.ok) throw new Error("Fehler beim Zuweisen der Belegnummern");
      const data = await response.json();
      return data.numbers;
  },

  async syncDocumentCounter(): Promise<{ counter: number; nextNumber: string }> {
      if (isOffline) {
          const invoices = getLocal<InvoiceRecord[]>(INVOICES_KEY) || [];
          const currentYear = new Date().getFullYear().toString();
          let maxFound = 0;
          for (const inv of invoices) {
              const match = inv.invoiceNumber?.match(/(\d{4})-(\d+)/);
              if (match && match[1] === currentYear) {
                  const num = parseInt(match[2], 10);
                  if (num > maxFound) maxFound = num;
              }
          }
          const settings = getLocal<AppSettings>(SETTINGS_KEY) || defaultSettings;
          settings.nextDocNumber = maxFound + 1;
          saveLocal(SETTINGS_KEY, settings);
          return await this.getNextDocumentNumber();
      }
      const response = await fetch('/api/documents/sync-counter', { method: 'POST' });
      if (!response.ok) throw new Error("Fehler beim Synchronisieren des Belegnummern-Zählers");
      return await response.json();
  },

  // --- INVOICE HISTORY ---
  async getInvoices(): Promise<InvoiceRecord[]> {
      if (isOffline) return getLocal<InvoiceRecord[]>(INVOICES_KEY) || [];
      
      const response = await fetch('/api/invoices');
      if (!response.ok) throw new Error("Fehler beim Laden der Rechnungen");
      return await response.json();
  },

  async saveInvoice(invoice: InvoiceRecord): Promise<void> {
      if (isOffline) {
          const invoices = getLocal<InvoiceRecord[]>(INVOICES_KEY) || [];
          invoices.unshift(invoice);
          saveLocal(INVOICES_KEY, invoices);
          return;
      }
      const response = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoice)
      });
      if (!response.ok) throw new Error("Fehler beim Archivieren der Rechnung");
  },

  async updateInvoice(invoice: InvoiceRecord): Promise<void> {
      if (isOffline) {
          const invoices = getLocal<InvoiceRecord[]>(INVOICES_KEY) || [];
          const index = invoices.findIndex(i => i.id === invoice.id);
          if (index !== -1) {
              invoices[index] = invoice;
              saveLocal(INVOICES_KEY, invoices);
          }
          return;
      }
      const response = await fetch(`/api/invoices/${invoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoice)
      });
      if (!response.ok) throw new Error("Fehler beim Aktualisieren der Rechnung");
  },

  async deleteInvoice(id: string): Promise<void> {
      if (isOffline) {
          const invoices = getLocal<InvoiceRecord[]>(INVOICES_KEY) || [];
          const filtered = invoices.filter(i => i.id !== id);
          saveLocal(INVOICES_KEY, filtered);
          return;
      }
      const response = await fetch(`/api/invoices/${id}`, {
          method: 'DELETE'
      });
      if (!response.ok) throw new Error("Fehler beim Löschen der Rechnung");
  },

  // --- SYSTEM LOGS ---
  async getLogs(filters?: { level?: string; source?: string; search?: string; limit?: number }): Promise<LogsResponse> {
      if (isOffline) {
          let logs = getLocal<SystemLogEntry[]>(LOGS_KEY) || [];
          if (filters?.level && filters.level !== 'ALL') {
              logs = logs.filter(l => l.level === filters.level);
          }
          if (filters?.source && filters.source !== 'ALL') {
              logs = logs.filter(l => l.source === filters.source);
          }
          if (filters?.search) {
              const q = filters.search.toLowerCase();
              logs = logs.filter(l => l.message.toLowerCase().includes(q) || (l.details && l.details.toLowerCase().includes(q)));
          }
          const limit = filters?.limit || 200;
          return {
              logs: logs.slice(0, limit),
              totalCount: logs.length,
              maxLimit: 500
          };
      }

      const params = new URLSearchParams();
      if (filters?.level && filters.level !== 'ALL') params.set('level', filters.level);
      if (filters?.source && filters.source !== 'ALL') params.set('source', filters.source);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.limit) params.set('limit', filters.limit.toString());

      const url = `/api/logs${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error("Fehler beim Laden des Systemprotokolls");
      }
      return await response.json();
  },

  async clearLogs(): Promise<void> {
      if (isOffline) {
          saveLocal(LOGS_KEY, []);
          return;
      }
      const response = await fetch('/api/logs', { method: 'DELETE' });
      if (!response.ok) {
          throw new Error("Fehler beim Leeren des Systemprotokolls");
      }
  },

  async logClientEvent(level: LogLevel, message: string, details?: any): Promise<void> {
      try {
          if (isOffline) {
              const logs = getLocal<SystemLogEntry[]>(LOGS_KEY) || [];
              const newEntry: SystemLogEntry = {
                  id: Date.now(),
                  timestamp: new Date().toISOString(),
                  level,
                  source: 'Client (Offline)',
                  message,
                  details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null
              };
              logs.unshift(newEntry);
              if (logs.length > 100) logs.length = 100;
              saveLocal(LOGS_KEY, logs);
              return;
          }

          await fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  level,
                  source: 'Client',
                  message,
                  details
              })
          });
      } catch (err) {
          console.warn("Client konnte Log nicht an Server senden:", err);
      }
  }
};