import React from 'react';
import { Contact, AppSettings } from '../../types';

interface TrainingInvoicePrintProps {
  contacts: Contact[];
  selectedContactIds: string[];
  settings: AppSettings;
  formData: {
    title: string;
    location: string;
    date: string;
    fee: number;
    text: string;
  };
}

export const TrainingInvoicePrint: React.FC<TrainingInvoicePrintProps> = ({ 
  contacts, 
  selectedContactIds, 
  settings, 
  formData 
}) => {
  
  const getPaymentDeadline = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 14); 
    return date.toLocaleDateString('de-DE');
  };

  const getSalutation = (contact: Contact) => {
      if (contact.gender === 'male') return `Lieber ${contact.firstName},`;
      if (contact.gender === 'female') return `Liebe ${contact.firstName},`;
      return `Hallo ${contact.firstName},`;
  };

  const replacePlaceholders = (text: string, contact: Contact) => {
    return text
      .replace(/{Titel}/g, formData.title)
      .replace(/{Ort}/g, formData.location)
      .replace(/{Datum}/g, new Date(formData.date).toLocaleDateString('de-DE'))
      .replace(/{Gebühr}/g, formData.fee.toFixed(2))
      .replace(/{Frist}/g, getPaymentDeadline(formData.date));
  };

  return (
    <div id="print-area" className="hidden print:block font-sans text-black bg-white">
       {selectedContactIds.map(id => {
        const contact = contacts.find(c => c.id === id);
        if (!contact) return null;
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
                     <p className="mb-4">✉ Info@alpinkader.nrw</p>
                     <p className="text-black text-sm">{new Date().toISOString().split('T')[0]}</p>
                </div>
             </div>

             <h1 className="text-xl font-bold mb-8">Rechnung Lehrgang: {formData.title}</h1>
             <p className="mb-6">{getSalutation(contact)}</p>
             <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-normal mb-8">
                {replacePlaceholders(formData.text, contact)}
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
