import React from 'react';
import { Contact, BulkOrderItem } from '../../types';
import { BULK_ORDER_PAYMENT_TEXT, FOOTER_INFO, SENDER_LINE } from '../../constants';
import { calculateDueDate } from '../../utils/formatting';

// Interface matching the generated data structure
export interface InvoicePrintData {
  id: string;
  invoiceNumber: string;
  contact: Contact;
  items: BulkOrderItem[];
  shippingCost: number;
  total: number;
  date: string;
  isoDate?: string;
  dueDate?: string;
}

interface BulkInvoicePrintProps {
  invoice: InvoicePrintData | null;
}

export const BulkInvoicePrint: React.FC<BulkInvoicePrintProps> = ({ invoice }) => {
  if (!invoice) return null;

  const dueDate = invoice.dueDate || calculateDueDate(invoice.isoDate || invoice.date, 14);
  const paymentText = BULK_ORDER_PAYMENT_TEXT
    .replace(/{Frist}/g, dueDate)
    .replace(/{Zahlungsziel}/g, dueDate)
    .replace(/{Rechnungsdatum}/g, invoice.date)
    .replace(/{Belegnummer}/g, invoice.invoiceNumber)
    .replace(/{Nummer}/g, invoice.invoiceNumber);

  return (
    <div id="print-area" className="hidden print:block font-sans text-black bg-white">
        <div className="h-screen print:h-[297mm] relative p-[15mm] flex flex-col break-after-page mx-auto max-w-[210mm] box-border">
             <div className="flex justify-between items-start mb-8">
                <img src="/logo1.png" alt="DAV Alpinkader NRW" className="h-24 max-w-[60%] object-contain" />
                <img src="/logo2.png" alt="Landeslehrteam NRW" className="h-16 w-48 object-contain" />
             </div>
             <div className="text-[8px] underline mb-8 text-slate-600">
                {SENDER_LINE}
             </div>
             <div className="flex justify-between items-start mb-16">
                <div className="text-sm">
                    <p>{invoice.contact.firstName} {invoice.contact.lastName}</p>
                    <p>{invoice.contact.address}</p>
                    <p>{invoice.contact.zip} {invoice.contact.city}</p>
                </div>

                <div className="text-right text-xs text-slate-600">
                     <p className="mb-1"><a href="http://www.alpinkader.nrw" className="text-blue-600 underline">www.alpinkader.nrw</a></p>
                     <p className="mb-2">✉ Info@alpinkader.nrw</p>
                     <p className="text-black text-sm font-medium">Rechnungsdatum: {invoice.date}</p>
                     <p className="text-blue-800 text-xs font-semibold mb-2">Zahlungsziel: {dueDate} (14 Tage)</p>
                     <p className="text-black font-semibold text-sm">Beleg-Nr.: {invoice.invoiceNumber}</p>
                </div>
             </div>
             <h1 className="text-xl font-bold mb-4">Rechnung {invoice.invoiceNumber}: Sammelbestellung</h1>
             <p className="mb-4 text-sm">Ausrüstungsbestellung für den DAV Alpinkader NRW:</p>
             
             {/* Changed text-sm to text-xs for smaller table font */}
             <table className="w-full mb-8 text-xs border-collapse">
                <thead>
                  <tr className="border border-black">
                    <th className="border border-black px-2 py-1 text-left font-normal">Artikel-Nr.</th>
                    <th className="border border-black px-2 py-1 text-left font-normal">Artikelname</th>
                    <th className="border border-black px-2 py-1 text-left font-normal">Größe</th>
                    <th className="border border-black px-2 py-1 text-left font-normal">Farbe</th>
                    <th className="border border-black px-2 py-1 text-right font-normal">Menge</th>
                    <th className="border border-black px-2 py-1 text-right font-normal"></th>
                    <th className="border border-black px-2 py-1 text-right font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="border border-black">
                      <td className="border border-black px-2 py-1">{item.articleNo}</td>
                      <td className="border border-black px-2 py-1">{item.name}</td>
                      <td className="border border-black px-2 py-1">{item.size}</td>
                      <td className="border border-black px-2 py-1">{item.color}</td>
                      <td className="border border-black px-2 py-1 text-right">{item.quantity}</td>
                      <td className="border border-black px-2 py-1 text-right">{item.singlePrice.toFixed(2)} €</td>
                      <td className="border border-black px-2 py-1 text-right">{item.totalPrice.toFixed(2)} €</td>
                    </tr>
                  ))}
                  <tr className="border border-black">
                    <td className="border border-black px-2 py-1">Versand / Porto</td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1 text-right">{invoice.shippingCost.toFixed(2)} €</td>
                  </tr>
                  <tr className="border border-black font-bold">
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1 text-right">{invoice.total.toFixed(2)} €</td>
                  </tr>
                </tbody>
             </table>
             <div className="whitespace-pre-wrap text-[14px] leading-relaxed font-normal mb-8">
                {paymentText}
             </div>
             <div className="mt-auto pt-4 border-t border-slate-300 text-[8px] leading-tight text-slate-500">
                {FOOTER_INFO.map((line, i) => (
                    <p key={i}>{line}</p>
                ))}
             </div>
        </div>
    </div>
  );
};