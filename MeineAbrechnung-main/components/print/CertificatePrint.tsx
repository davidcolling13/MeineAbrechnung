import React from 'react';
import { Contact, AppSettings } from '../../types';
import { formatDateDE } from '../../utils/formatting';

interface CertificatePrintProps {
  contacts: Contact[];
  selectedContactIds: string[];
  settings: AppSettings;
  formData: {
    title: string;
    certificateDate?: string;
    location: string;
    date: string;
    text: string;
  };
  invoiceNumbers?: Record<string, string>;
}

export const CertificatePrint: React.FC<CertificatePrintProps> = ({ 
  contacts, 
  selectedContactIds, 
  settings, 
  formData,
  invoiceNumbers
}) => {
  const certDateStr = formData.certificateDate || formData.date || new Date().toISOString().split('T')[0];
  const certDateFormatted = formatDateDE(certDateStr);
  
  const getSalutation = (contact: Contact) => {
    if (contact.gender === 'male') return `Lieber ${contact.firstName},`;
    if (contact.gender === 'female') return `Liebe ${contact.firstName},`;
    return `Hallo ${contact.firstName},`;
  };

  const replacePlaceholders = (text: string, invNum: string) => {
    return text
      .replace(/{Titel}/g, formData.title)
      .replace(/{Ort}/g, formData.location)
      .replace(/{Datum}/g, formatDateDE(formData.date))
      .replace(/{Bescheinigungsdatum}/g, certDateFormatted)
      .replace(/{Ausstellungsdatum}/g, certDateFormatted)
      .replace(/{Belegnummer}/g, invNum)
      .replace(/{Nummer}/g, invNum);
  };

  return (
    <div id="print-area" className="hidden print:block font-sans text-black bg-white">
      {selectedContactIds.map(id => {
        const contact = contacts.find(c => c.id === id);
        if (!contact) return null;
        const invNum = invoiceNumbers?.[id] || '';

        return (
          <div key={id} className="h-screen print:h-[297mm] relative p-[15mm] flex flex-col break-after-page mx-auto max-w-[210mm] box-border">
             {/* Header */}
             <div className="flex justify-between items-start mb-6">
                <img src="/logo1.png" alt="DAV Alpinkader NRW" className="h-20 max-w-[60%] object-contain" />
                <img src="/logo2.png" alt="Landeslehrteam NRW" className="h-16 w-48 object-contain" />
             </div>

             <div className="text-[8px] underline mb-6 text-slate-600">
                {settings.senderLine}
             </div>

             <div className="flex justify-between items-start mb-12">
                <div className="text-sm">
                    <p>{contact.firstName} {contact.lastName}</p>
                    <p>{contact.address}</p>
                    <p>{contact.zip} {contact.city}</p>
                </div>

                <div className="text-right text-xs text-slate-600">
                     <p className="mb-1"><a href="http://www.alpinkader.nrw" className="text-blue-600 underline">www.alpinkader.nrw</a></p>
                     <p className="mb-4">✉ Info@alpinkader.nrw</p>
                     <p className="text-black text-sm">Datum: {certDateFormatted}</p>
                     {invNum && <p className="text-black font-semibold text-sm">Beleg-Nr.: {invNum}</p>}
                </div>
             </div>

             <h2 className="text-2xl font-bold mb-1">
               {invNum ? `Teilnahmebescheinigung ${invNum}: ${formData.title}` : `Teilnahmebescheinigung: ${formData.title}`}
             </h2>
             {invNum ? (
               <p className="text-sm text-slate-600 mb-6">Bescheinigungs-Nr.: {invNum}</p>
             ) : (
               <div className="mb-6" />
             )}

             <div className="text-[15px] leading-relaxed max-w-3xl mb-8">
               <p className="mb-6">{getSalutation(contact)}</p>
               <p className="whitespace-pre-wrap">{replacePlaceholders(formData.text, invNum)}</p>
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
