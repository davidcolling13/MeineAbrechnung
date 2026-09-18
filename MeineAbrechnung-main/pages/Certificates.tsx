import React, { useState, useEffect } from 'react';
import { Contact, AppSettings } from '../types';
import { db } from '../services/db';
import { Download, Calendar, Mail, Loader2 } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { CertificateDocument } from '../components/pdf/CertificateDocument';
import { useToast } from '../components/Toast';
import { generateUUID } from '../utils/formatting';

interface CertificatesProps {
  contacts: Contact[];
}

export const Certificates: React.FC<CertificatesProps> = ({ contacts }) => {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingState, setSendingState] = useState({ current: 0, total: 0, active: false });
  const { addToast } = useToast();

  // Filter: Nur Athleten erhalten Bescheinigungen
  const athletes = contacts.filter(c => c.type === 'Athlet');

  const [formData, setFormData] = useState({
    title: 'Klettertechnik Fortgeschritten',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    location: 'Kletterzentrum Köln',
    text: ''
  });

  useEffect(() => {
    const loadSettings = async () => {
        try {
            const s = await db.getSettings();
            setSettings(s);
            setFormData(prev => ({ ...prev, text: s.certificateText }));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    loadSettings();
  }, []);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedContacts.length === athletes.length) setSelectedContacts([]);
    else setSelectedContacts(athletes.map(c => c.id));
  };

  const handleSaveToHistory = async (contact: Contact, method: 'download' | 'email', invNumber: string) => {
    try {
        await db.saveInvoice({
            id: generateUUID(),
            invoiceNumber: invNumber,
            recipientName: `${contact.firstName} ${contact.lastName}`,
            date: new Date().toISOString().split('T')[0], 
            totalAmount: 0,
            title: `Teilnahmebescheinigung: ${formData.title}`,
            type: 'Certificate',
            deliveryMethod: method
        });
    } catch (e) {
        console.error("Archiving certificate failed", e);
    }
  };

  const handleDownload = async () => {
      if (!settings || selectedContacts.length === 0) return;
      
      try {
          const nextInvStr = await db.getNextInvoiceNumber('BES');
          let numVal = parseInt(nextInvStr.split('-').pop() || '0', 10);
          const prefix = nextInvStr.split('-').slice(0, 2).join('-');
          
          const contactsWithInvoices = selectedContacts.map(id => {
              const c = contacts.find(c => c.id === id);
              const invNum = `${prefix}-${numVal.toString().padStart(3, '0')}`;
              numVal++;
              return { contact: c, invoiceNumber: invNum };
          }).filter(c => c.contact) as { contact: Contact, invoiceNumber: string }[];
          
          const blob = await pdf(
              <CertificateDocument 
                contactsWithInvoices={contactsWithInvoices}
                settings={settings}
                formData={formData}
              />
          ).toBlob();
          
          for (const item of contactsWithInvoices) {
              await handleSaveToHistory(item.contact, 'download', item.invoiceNumber);
          }
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Bescheinigung_${contactsWithInvoices.length === 1 ? contactsWithInvoices[0].contact.lastName : 'Sammel'}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
      } catch (e) {
          console.error(e);
      }
  };

  const handleBulkEmailSend = async () => {
      if (!settings || selectedContacts.length === 0) return;
      setSendingState({current: 0, total: selectedContacts.length, active: true});
      let successCount = 0;

      const nextInvStr = await db.getNextInvoiceNumber('BES');
      let numVal = parseInt(nextInvStr.split('-').pop() || '0', 10);
      const prefix = nextInvStr.split('-').slice(0, 2).join('-');

      for (const id of selectedContacts) {
          const contact = contacts.find(c => c.id === id);
          if (!contact || !contact.email) continue;
          
          const invNum = `${prefix}-${numVal.toString().padStart(3, '0')}`;
          
          try {
              const blob = await pdf(
                  <CertificateDocument 
                    contactsWithInvoices={[{ contact, invoiceNumber: invNum }]}
                    settings={settings}
                    formData={formData}
                  />
              ).toBlob();
              
              const reader = new FileReader();
              const base64data = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
              });

              const response = await fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: contact.email,
                        subject: `Teilnahmebescheinigung: ${formData.title}`,
                        text: `Hallo ${contact.firstName},\n\nanbei deine Teilnahmebescheinigung für den Lehrgang ${formData.title}.\n\nViele Grüße\nDAV Alpinkader NRW`,
                        filename: `Bescheinigung_${contact.lastName}.pdf`,
                        pdfBase64: base64data
                    })
              });

              if (response.ok) {
                  await handleSaveToHistory(contact, 'email', invNum);
                  successCount++;
                  numVal++;
              }
          } catch (e) {
              console.error(`Fehler bei ${contact.lastName}`, e);
          }
          setSendingState(prev => ({...prev, current: prev.current + 1}));
      }

      setSendingState({current: 0, total: 0, active: false});
      addToast(`${successCount} von ${selectedContacts.length} E-Mails erfolgreich versendet.`, successCount === selectedContacts.length ? 'success' : 'info');
  };

  if (isLoading || !settings) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Lehrgangsbescheinigungen</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800">1. Lehrgangsdaten</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lehrgangsbezeichnung</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full rounded-lg border-slate-300 border px-3 py-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Startdatum</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full rounded-lg border-slate-300 border pl-10 pr-2 py-2 text-sm" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Enddatum</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full rounded-lg border-slate-300 border pl-10 pr-2 py-2 text-sm" />
                    </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ort</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full rounded-lg border-slate-300 border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Textvorlage</label>
                <textarea rows={6} value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full rounded-lg border-slate-300 border px-3 py-2 font-mono text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Selection Column */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">2. Teilnehmer auswählen (nur Athleten)</h3>
                <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  {selectedContacts.length === athletes.length && athletes.length > 0 ? 'Keine auswählen' : 'Alle auswählen'}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[400px] border rounded-lg border-slate-100">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <input type="checkbox" checked={selectedContacts.length === athletes.length && athletes.length > 0} onChange={selectAll} className="rounded border-slate-300" />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Typ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {athletes.length > 0 ? athletes.map(contact => (
                      <tr key={contact.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleContact(contact.id)}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedContacts.includes(contact.id)} onChange={() => toggleContact(contact.id)} className="rounded border-slate-300 pointer-events-none" />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800">{contact.lastName}, {contact.firstName}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{contact.type}</td>
                      </tr>
                    )) : (
                        <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-500 text-sm">
                                Keine Athleten in den Stammdaten gefunden.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                 <span className="text-sm text-slate-500">{selectedContacts.length} Teilnehmer ausgewählt</span>
                 <div className="flex gap-3">
                    {selectedContacts.length > 0 && (
                         <>
                         <button 
                            disabled={selectedContacts.length === 0 || sendingState.active}
                            onClick={handleBulkEmailSend}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                         >
                            {sendingState.active ? <Loader2 className="w-4 h-4 animate-spin"/> : <Mail className="w-4 h-4" />}
                            {sendingState.active 
                                ? `Sende ${sendingState.current}/${sendingState.total}` 
                                : 'Alle per E-Mail senden'
                            }
                         </button>
                         <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors decoration-0"
                         >
                            <Download className="w-4 h-4" /> {selectedContacts.length > 1 ? 'Sammel-PDF herunterladen' : 'PDF herunterladen'}
                         </button>
                         </>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};