import React from 'react';
import { Contact, AppSettings } from '../../types';
import { calculateDueDate, formatDateDE } from '../../utils/formatting';

interface TrainingInvoicePrintProps {
  contacts: Contact[];
  selectedContactIds: string[];
  settings: AppSettings;
  formData: {
    title: string;
    invoiceDate?: string;
    location: string;
    date: string;
    fee: number;
    text: string;
  };
  invoiceNumbers?: Record<string, string>;
}

export const TrainingInvoicePrint: React.FC<TrainingInvoicePrintProps> = ({ 
  contacts, 
  selectedContactIds, 
  settings, 
  formData,
  invoiceNumbers
}) => {
  const invoiceDateStr = formData.invoiceDate || new Date().toISOString().split('T')[0];
  const dueDateFormatted = calculateDueDate(invoiceDateStr, 14);
  const invoiceDateFormatted = formatDateDE(invoiceDateStr);

  const getSalutation = (contact: Contact) => {
      if (contact.gender === 'male') return `Lieber ${contact.firstName},`;
      if (contact.gender === 'female') return `Liebe ${contact.firstName},`;
      return `Hallo ${contact.firstName},`;
  };

  const replacePlaceholders = (text: string, contact: Contact, invNum: string) => {
    return text
      .replace(/{Titel}/g, formData.title)
      .replace(/{Ort}/g, formData.location)
      .replace(/{Datum}/g, formatDateDE(formData.date))
      .replace(/{Gebühr}/g, formData.fee.toFixed(2))
      .replace(/{Frist}/g, dueDateFormatted)
      .replace(/{Zahlungsziel}/g, dueDateFormatted)
      .replace(/{Rechnungsdatum}/g, invoiceDateFormatted)
      .replace(/{Belegnummer}/g, invNum)
      .replace(/{Nummer}/g, invNum);
  };

  return (
    <div id="print-area" className="hidden print:block font-sans text-black bg-white">
       {selectedContactIds.map((id, index) => {
        const contact = contacts.find(c => c.id === id);
        if (!contact) return null;
        const invNum = invoiceNumbers?.[id] || '';

        return (
          <div key={id} className="h-screen print:h-[297mm] relative p-[15mm] flex flex-col break-after-page mx-auto max-w-[210mm] box-border">
             {/* Header */}
             <div className="flex justify-between items-start mb-8">
                <img src="/logo1.png" alt="DAV Alpinkader NRW" className="h-24 max-w-[60%] object-contain" />
                <img src="/logo2.png" alt="Landeslehrteam NRW" className="h-16 w-48 object-contain" />
             </div>

             <div className="text-[8px] underline mb-8 text-slate-600">
                {settings.senderLine}
             </div>

             <div className="flex justify-between items-start mb-16">
                <div className="text-sm">
                    <p>{contact.firstName} {contact.lastName}</p>
                    <p>{contact.address}</p>
                    <p>{contact.zip} {contact.city}</p>
                </div>

                <div className="text-right text-xs text-slate-600">
                     <p className="mb-1"><a href="http://www.alpinkader.nrw" className="text-blue-600 underline">www.alpinkader.nrw</a></p>
                     <p className="mb-2">✉ Info@alpinkader.nrw</p>
                     <p className="text-black text-sm font-medium">Rechnungsdatum: {invoiceDateFormatted}</p>
                     <p className="text-blue-800 text-xs font-semibold mb-2">Zahlungsziel: {dueDateFormatted} (14 Tage)</p>
                     {invNum && <p className="text-black font-semibold text-sm">Beleg-Nr.: {invNum}</p>}
                </div>
             </div>

             <h1 className="text-xl font-bold mb-8">{invNum ? `Rechnung ${invNum}: Lehrgang ${formData.title}` : `Rechnung Lehrgang: ${formData.title}`}</h1>
             <p className="mb-6">{getSalutation(contact)}</p>
             <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-normal mb-8">
                {replacePlaceholders(formData.text, contact, invNum)}
             </div>

             <div className="mt-auto pt-4 border-t border-slate-300 text-[8px] leading-tight text-slate-500">
                {settings.footerInfo.map((line, i) => (
                    <p key={i}>{line}</p>
                ))}
             </div>
          </div>
        );
      })}
    </div>
  );
};
