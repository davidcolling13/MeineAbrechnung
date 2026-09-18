import React, { useState, useEffect } from 'react';
import { Contact, AppSettings } from '../types';
import { db } from '../services/db';
import { useToast } from '../components/Toast';
import { Printer, Euro, Calendar, Mail, Loader2, Download, Hash } from 'lucide-react';
import { CardSkeleton } from '../components/Skeleton';
import { TrainingInvoicePrint } from '../components/print/TrainingInvoicePrint';
import { roundCurrency, generateUUID, calculateDueDate, calculateDueDateISO, formatDateDE } from '../utils/formatting';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { TrainingInvoiceDocument } from '../components/pdf/TrainingInvoiceDocument';

interface TrainingInvoicesProps {
  contacts: Contact[];
}

export const TrainingInvoices: React.FC<TrainingInvoicesProps> = ({ contacts }) => {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingState, setSendingState] = useState<{current: number, total: number, active: boolean}>({current: 0, total: 0, active: false});
  const [nextDocInfo, setNextDocInfo] = useState<{ nextNumber: string; counter: number } | null>(null);
  
  // Filter: Nur Athleten erhalten Lehrgangsrechnungen
  const athletes = contacts.filter(c => c.type === 'Athlet');

  const [formData, setFormData] = useState({
    title: 'Alpinklettern 09/2025',
    invoiceDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    location: 'Colico, Italien',
    fee: 300.00,
    text: ''
  });
  
  const { addToast } = useToast();

  const loadDocNumber = async () => {
    try {
      const info = await db.getNextDocumentNumber();
      setNextDocInfo(info);
    } catch (e) {
      console.error("Fehler beim Abrufen der Belegnummer:", e);
    }
  };

  useEffect(() => {
    const loadData = async () => {
        try {
            const s = await db.getSettings();
            setSettings(s);
            setFormData(prev => ({ ...prev, text: s.invoiceText }));
            await loadDocNumber();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, []);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllAthletes = () => {
    if (selectedContacts.length === athletes.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(athletes.map(a => a.id));
    }
  };

  // Berechne die voraussichtlichen globalen Belegnummern für die ausgewählten Kontakte
  const getProjectedNumbers = (): Record<string, string> => {
    if (!nextDocInfo) return {};
    const map: Record<string, string> = {};
    const year = new Date().getFullYear().toString();
    const prefix = settings?.docNumberPrefix || '';
    
    selectedContacts.forEach((id, idx) => {
        const c = nextDocInfo.counter + idx;
        const padLength = c >= 1000 ? 4 : 3;
        const numStr = c.toString().padStart(padLength, '0');
        map[id] = prefix ? `${prefix}${year}-${numStr}` : `${year}-${numStr}`;
    });
    return map;
  };

  const projectedNumbers = getProjectedNumbers();

  const contactsWithInvoices = selectedContacts
    .map(id => {
      const contact = contacts.find(c => c.id === id);
      if (!contact) return null;
      return {
        contact,
        invoiceNumber: projectedNumbers[id] || nextDocInfo?.nextNumber || ''
      };
    })
    .filter((item): item is { contact: Contact; invoiceNumber: string } => item !== null);

  const handleDownloadClick = async () => {
    if (selectedContacts.length === 0) return;
    try {
      // 1. Allokiere die fortlaufenden globalen Nummern verbindlich in der DB
      const allocated = await db.allocateDocumentNumbers(selectedContacts.length);
      
      // 2. Dokumente im Rechnungsbuch archivieren
      const invDate = formData.invoiceDate || new Date().toISOString().split('T')[0];
      const dueDate = calculateDueDateISO(invDate, 14);
      for (let i = 0; i < selectedContacts.length; i++) {
        const id = selectedContacts[i];
        const contact = contacts.find(c => c.id === id);
        if (contact) {
          await db.saveInvoice({
            id: generateUUID(),
            invoiceNumber: allocated[i],
            recipientName: `${contact.firstName} ${contact.lastName}`,
            date: invDate,
            dueDate: dueDate,
            totalAmount: roundCurrency(formData.fee),
            title: `Rechnung ${allocated[i]}: ${formData.title}`,
            type: 'Training',
            deliveryMethod: 'download'
          });
        }
      }
      
      await loadDocNumber();
      addToast(`${selectedContacts.length} Belegnummer(n) erfolgreich archiviert (${allocated[0]}${allocated.length > 1 ? ' bis ' + allocated[allocated.length - 1] : ''})`, 'success');
    } catch (e: any) {
      console.error("Fehler beim Archivieren:", e);
    }
  };

  const handleBulkEmailSend = async () => {
      if (!settings || selectedContacts.length === 0) return;
      setSendingState({current: 0, total: selectedContacts.length, active: true});
      let successCount = 0;

      try {
        // Reserviere globale fortlaufende Nummern im System
        const allocated = await db.allocateDocumentNumbers(selectedContacts.length);

        for (let i = 0; i < selectedContacts.length; i++) {
            const id = selectedContacts[i];
            const contact = contacts.find(c => c.id === id);
            if (!contact || !contact.email) continue;
            
            const invoiceNumber = allocated[i];

            try {
                // PDF mit der echten globalen Nummer generieren
                const blob = await pdf(
                    <TrainingInvoiceDocument 
                      contactsWithInvoices={[{ contact, invoiceNumber }]}
                      settings={settings}
                      formData={formData}
                    />
                ).toBlob();
                
                const reader = new FileReader();
                const base64data = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });

                const invDate = formData.invoiceDate || new Date().toISOString().split('T')[0];
                const dueDateISO = calculateDueDateISO(invDate, 14);
                const dueDateFormatted = calculateDueDate(invDate, 14);

                const response = await fetch('/api/email/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          to: contact.email,
                          subject: `Rechnung ${invoiceNumber}: Lehrgang ${formData.title}`,
                          text: `Hallo ${contact.firstName},\n\nanbei die Rechnung ${invoiceNumber} für den Lehrgang ${formData.title} mit Rechnungsdatum ${formatDateDE(invDate)} und Zahlungsziel bis zum ${dueDateFormatted} (14 Tage ab Rechnungsdatum).\n\nViele Grüße\nDAV Alpinkader NRW`,
                          filename: `Rechnung_${invoiceNumber}_${contact.lastName}.pdf`,
                          pdfBase64: base64data
                      })
                });

                if (response.ok) {
                    await db.saveInvoice({
                        id: generateUUID(),
                        invoiceNumber: invoiceNumber,
                        recipientName: `${contact.firstName} ${contact.lastName}`,
                        date: invDate,
                        dueDate: dueDateISO,
                        totalAmount: roundCurrency(formData.fee),
                        title: `Rechnung ${invoiceNumber}: ${formData.title}`,
                        type: 'Training',
                        deliveryMethod: 'email'
                    });
                    successCount++;
                }
            } catch (e) {
                console.error(`Fehler bei ${contact.lastName}`, e);
            }
            setSendingState(prev => ({...prev, current: prev.current + 1}));
        }

        await loadDocNumber();
        addToast(`${successCount} von ${selectedContacts.length} E-Mails erfolgreich versendet.`, successCount === selectedContacts.length ? 'success' : 'info');
      } catch (e: any) {
        addToast(e.message || "Fehler beim E-Mail-Versand", 'error');
      } finally {
        setSendingState({current: 0, total: 0, active: false});
      }
  };

  const handlePrint = async () => {
    if (selectedContacts.length === 0) return;
    try {
      const allocated = await db.allocateDocumentNumbers(selectedContacts.length);
      const invDate = formData.invoiceDate || new Date().toISOString().split('T')[0];
      const dueDate = calculateDueDateISO(invDate, 14);
      for (let i = 0; i < selectedContacts.length; i++) {
        const id = selectedContacts[i];
        const contact = contacts.find(c => c.id === id);
        if (contact) {
          await db.saveInvoice({
            id: generateUUID(),
            invoiceNumber: allocated[i],
            recipientName: `${contact.firstName} ${contact.lastName}`,
            date: invDate,
            dueDate: dueDate,
            totalAmount: roundCurrency(formData.fee),
            title: `Rechnung ${allocated[i]}: ${formData.title}`,
            type: 'Training',
            deliveryMethod: 'download'
          });
        }
      }
      await loadDocNumber();
      window.print();
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  if (isLoading || !settings) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      
      {/* Main UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lehrgangsrechnungen</h1>
          <p className="text-sm text-slate-500 mt-0.5">Erstelle und versende Rechnungen mit globaler Belegnummer</p>
        </div>
        {nextDocInfo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-medium">
            <Hash className="w-4 h-4 text-blue-600" />
            <span>Nächste globale Beleg-Nr.: <strong className="font-mono">{nextDocInfo.nextNumber}</strong></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800">1. Rechnungsdaten</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lehrgangsbezeichnung</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Rechnungsdatum mit Zahlungszielanzeige */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                <label className="block text-sm font-semibold text-blue-950">Rechnungsdatum (Belegdatum)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                  <input 
                    type="date" 
                    value={formData.invoiceDate} 
                    onChange={e => setFormData({...formData, invoiceDate: e.target.value})} 
                    className="w-full rounded-lg border-blue-200 bg-white border pl-10 pr-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 text-slate-800" 
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-blue-900 pt-0.5">
                  <span>Zahlungsziel (14 Tage):</span>
                  <span className="font-bold">{calculateDueDate(formData.invoiceDate, 14)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Startdatum</label>
                  <div className="relative">
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full rounded-lg border-slate-300 border pl-10 pr-2 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Enddatum</label>
                  <div className="relative">
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full rounded-lg border-slate-300 border pl-10 pr-2 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ort</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gebühr (€)</label>
                <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="number" step="0.01" value={formData.fee} onChange={e => setFormData({...formData, fee: parseFloat(e.target.value) || 0})} className="w-full rounded-lg border-slate-300 border pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Textvorlage</label>
                <textarea rows={8} value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full rounded-lg border-slate-300 border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-slate-400 mt-1">Platzhalter: {'{Titel}'}, {'{Ort}'}, {'{Datum}'}, {'{Gebühr}'}, {'{Frist}'}, {'{Belegnummer}'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selection Column */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">2. Empfänger auswählen (nur Athleten)</h3>
                  {selectedContacts.length > 0 && nextDocInfo && (
                    <p className="text-xs text-blue-600 font-mono mt-0.5">
                      Belegnummernfolge: {projectedNumbers[selectedContacts[0]]} {selectedContacts.length > 1 ? `bis ${projectedNumbers[selectedContacts[selectedContacts.length - 1]]}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-800">
                    Gesamt: {roundCurrency(selectedContacts.length * formData.fee).toFixed(2)} €
                  </div>
                  <button 
                    type="button" 
                    onClick={selectAllAthletes}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {selectedContacts.length === athletes.length ? 'Auswahl aufheben' : 'Alle Athleten auswählen'}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[400px] border rounded-lg border-slate-100">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-12"></th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Vorgesehene Beleg-Nr.</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Typ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {athletes.length > 0 ? athletes.map(contact => {
                      const isSelected = selectedContacts.includes(contact.id);
                      return (
                        <tr key={contact.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleContact(contact.id)}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleContact(contact.id)} className="rounded border-slate-300 pointer-events-none" />
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800 font-medium">{contact.lastName}, {contact.firstName}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">
                            {isSelected ? (
                              <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                {projectedNumbers[contact.id]}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{contact.type}</td>
                        </tr>
                      );
                    }) : (
                         <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                                Keine Athleten in den Stammdaten gefunden.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-between items-center">
                 <span className="text-sm text-slate-500">{selectedContacts.length} von {athletes.length} ausgewählt</span>
                 
                 <div className="flex flex-wrap gap-2">
                    <button 
                      type="button"
                      disabled={selectedContacts.length === 0}
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg disabled:opacity-40 transition-colors text-sm font-medium"
                    >
                      <Printer className="w-4 h-4" /> Drucken
                    </button>

                    {/* Generierung der PDF(s) on demand für den Download */}
                    {selectedContacts.length > 0 && (
                         <PDFDownloadLink
                            document={
                                <TrainingInvoiceDocument 
                                    contactsWithInvoices={contactsWithInvoices}
                                    settings={settings}
                                    formData={formData}
                                />
                            }
                            fileName={`Rechnung_${selectedContacts.length === 1 ? contacts.find(c => c.id === selectedContacts[0])?.lastName : 'Sammel'}.pdf`}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors decoration-0 text-sm font-medium"
                            onClick={handleDownloadClick}
                         >
                            <Download className="w-4 h-4" /> {selectedContacts.length > 1 ? 'Sammel-PDF' : 'PDF Herunterladen'}
                         </PDFDownloadLink>
                    )}

                    <button 
                      disabled={selectedContacts.length === 0 || sendingState.active}
                      onClick={handleBulkEmailSend}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {sendingState.active ? <Loader2 className="w-4 h-4 animate-spin"/> : <Mail className="w-4 h-4" />}
                      {sendingState.active 
                        ? `Sende ${sendingState.current}/${sendingState.total}` 
                        : 'Alle per E-Mail senden'
                      }
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Hidden Print Section */}
      <TrainingInvoicePrint 
        contacts={contacts}
        selectedContactIds={selectedContacts}
        settings={settings}
        formData={{
          title: formData.title,
          invoiceDate: formData.invoiceDate,
          location: formData.location,
          date: formData.startDate,
          fee: formData.fee,
          text: formData.text
        }}
        invoiceNumbers={projectedNumbers}
      />
    </div>
  );
};
