import { Contact, AppSettings, InvoiceRecord } from '../types';
import { DEFAULT_INVOICE_TEXT, DEFAULT_CERTIFICATE_TEXT, FOOTER_INFO, SENDER_LINE, BULK_ORDER_PAYMENT_TEXT } from '../constants';

let isOffline = false;
const CONTACTS_KEY = 'meineabrechnung_contacts';
const SETTINGS_KEY = 'meineabrechnung_settings';
const INVOICES_KEY = 'meineabrechnung_invoices';

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
    if (!response.ok) throw new Error('Fehler beim Speichern');
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
    if (!response.ok) throw new Error('Fehler beim Update');
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
  }
};