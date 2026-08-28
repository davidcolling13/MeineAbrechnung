export type ContactType = 'Athlet' | 'Trainer';
export type Gender = 'male' | 'female' | 'other';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  zip: string;
  city: string;
  email: string;
  type: ContactType;
  gender: Gender;
}

export interface BulkOrderItem {
  id: string;
  contactId: string;
  articleNo: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  singlePrice: number;
  totalPrice: number;
}

export interface AppSettings {
  invoiceText: string;
  certificateText: string;
  bankDetails: string; // IBAN Text
  senderLine: string;
  footerInfo: string[];
  
  // SMTP Settings
  smtpHost?: string;
  smtpPort?: string; // String for easier input handling, parsed to int on usage
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean; // true = 465 (SSL), false = TLS/STARTTLS
  smtpFrom?: string; // Custom sender address
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string; // z.B. "2024-001"
  recipientName: string;
  date: string;
  totalAmount: number;
  title: string;
  type: 'Training' | 'BulkOrder' | 'Certificate';
  deliveryMethod?: 'email' | 'download'; // Neu: Versandart
}

export type SortField = 'lastName' | 'city' | 'type';
export type SortDirection = 'asc' | 'desc';