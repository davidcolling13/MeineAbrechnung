import React, { useState, useEffect } from 'react';
import { Contact, AppSettings } from '../types';
import { Upload, Check, Printer, Mail, AlertCircle, Edit2, Download, Loader2, X, Send, Paperclip, Calendar } from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../components/Toast';
import { parseBulkOrderExcel, GeneratedInvoiceData } from '../services/excelParser';
import { roundCurrency, calculateDueDate, calculateDueDateISO, formatDateDE } from '../utils/formatting';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { BulkInvoiceDocument } from '../components/pdf/BulkInvoiceDocument';
import { CardSkeleton } from '../components/Skeleton';

interface BulkOrdersProps {
  contacts: Contact[];
}

export const BulkOrders: React.FC<BulkOrdersProps> = ({ contacts }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [dragActive, setDragActive] = useState(false);
  const [generatedInvoices, setGeneratedInvoices] = useState<GeneratedInvoiceData[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customInvoiceDate, setCustomInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Configuration
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Email Preview State
  const [previewInvoice, setPreviewInvoice] = useState<GeneratedInvoiceData | null>(null);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    const loadSettings = async () => {
        try {
            const s = await db.getSettings();
            setSettings(s);
        } catch (e) {
            console.error(e);
            addToast("Fehler beim Laden der Einstellungen", "error");
        } finally {
            setIsLoading(false);
        }
    };
    loadSettings();
  }, []);

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    try {
        const result = await parseBulkOrderExcel(file, contacts, customInvoiceDate);
        setUnmatchedNames(result.unmatchedNames);
        setGeneratedInvoices(result.invoices);
        setStep(2);
    } catch (error: any) {
        console.error("Error parsing Excel:", error);
        setErrorMsg(error.message || "Fehler beim Lesen der Datei.");
    }
  };

  const handleGlobalDateChange = (newDate: string) => {
    setCustomInvoiceDate(newDate);
    setGeneratedInvoices(prev => prev.map(inv => ({
      ...inv,
      date: formatDateDE(newDate),
      isoDate: newDate,
      dueDate: calculateDueDate(newDate, 14),
      dueDateISO: calculateDueDateISO(newDate, 14)
    })));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const updateInvoiceShipping = (invoiceId: string, newShippingCost: number) => {
      setGeneratedInvoices(prev => prev.map(inv => {
          if (inv.id === invoiceId) {
              const safeShipping = roundCurrency(newShippingCost);
              const itemsTotal = inv.items.reduce((sum, item) => roundCurrency(sum + item.totalPrice), 0);
              return {
                  ...inv,
                  shippingCost: safeShipping,
                  total: roundCurrency(itemsTotal + safeShipping)
              };
          }
          return inv;
      }));
  };

  const handleSaveToHistory = async (inv: GeneratedInvoiceData, method: 'email' | 'download') => {
    try {
        await db.saveInvoice({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            recipientName: `${inv.contact.firstName} ${inv.contact.lastName}`,
            date: inv.isoDate, 
            dueDate: inv.dueDateISO || calculateDueDateISO(inv.isoDate, 14),
            totalAmount: inv.total,
            title: `Rechnung ${inv.invoiceNumber}: Sammelbestellung`,
            type: 'BulkOrder',
            deliveryMethod: method
        });
    } catch (e) {
        console.error("Archiving failed", e);
    }
  };

  const handleDownload = async (inv: GeneratedInvoiceData) => {
      if (!settings) return;
      
      try {
          // Use current state of invoice (might have edited shipping cost)
          const blob = await pdf(<BulkInvoiceDocument invoice={inv} settings={settings} />).toBlob();
          
          await handleSaveToHistory(inv, 'download');
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Rechnung_${inv.invoiceNumber}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
      } catch (e) {
          console.error(e);
      }
  };

  // 1. Öffnet das Modal und setzt die Standardwerte
  const openEmailPreview = (inv: GeneratedInvoiceData) => {
      setPreviewInvoice(inv);
      const dueFormatted = inv.dueDate || calculateDueDate(inv.isoDate, 14);
      setPreviewSubject(`Rechnung ${inv.invoiceNumber} - DAV Alpinkader NRW`);
      setPreviewMessage(`Hallo ${inv.contact.firstName},\n\nanbei deine Rechnung ${inv.invoiceNumber} über ${inv.total.toFixed(2)}€ vom ${inv.date || formatDateDE(inv.isoDate)} mit einem Zahlungsziel von 14 Tagen (fällig am ${dueFormatted}).\n\nViele Grüße\nDAV Alpinkader NRW`);
      setIsSending(false);
  };

  const closeEmailPreview = () => {
      setPreviewInvoice(null);
      setIsSending(false);
  };

  // 2. Führt den eigentlichen Versand aus (wird vom Modal aufgerufen)
  const handleConfirmSend = async () => {
      if (!settings || !previewInvoice) return;
      
      setIsSending(true);
      const inv = previewInvoice;

      try {
        // 1. Generate PDF Blob
        const blob = await pdf(<BulkInvoiceDocument invoice={inv} settings={settings} />).toBlob();
        
        // 2. Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64data = reader.result as string;
            
            // 3. Send to Backend
            const response = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: inv.contact.email,
                    subject: previewSubject,
                    text: previewMessage,
                    filename: `Rechnung_${inv.invoiceNumber}.pdf`,
                    pdfBase64: base64data
                })
            });

            if (response.ok) {
                addToast(`E-Mail an ${inv.contact.firstName} gesendet`, 'success');
                handleSaveToHistory(inv, 'email'); // Auto-archive as Email
                closeEmailPreview();
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Serverfehler');
            }
        };
      } catch (e: any) {
          console.error(e);
          addToast(e.message || "Fehler beim Senden", 'error');
          setIsSending(false);
      }
  };

  if (isLoading || !settings) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Sammelabrechnung</h1>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-center gap-3">
             <AlertCircle className="w-5 h-5" />
             <span>{errorMsg}</span>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-xl mx-auto mt-6 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-2">
            <label className="block text-sm font-semibold text-slate-800">Rechnungsdatum festlegen</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
              <input 
                type="date" 
                value={customInvoiceDate} 
                onChange={e => setCustomInvoiceDate(e.target.value)} 
                className="w-full rounded-lg border-blue-200 bg-white border pl-10 pr-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 text-slate-800" 
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Zahlungsziel (14 Tage):</span>
              <span className="font-bold text-blue-700">{calculateDueDate(customInvoiceDate, 14)}</span>
            </div>
          </div>

          <div 
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Excel-Datei hier ablegen</h3>
            <p className="text-slate-500 mb-6">oder klicken zum Auswählen (.xlsx)</p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls"
              className="hidden" 
              id="file-upload" 
              onChange={handleManualUpload}
            />
            <label 
              htmlFor="file-upload"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
            >
              Datei auswählen
            </label>
            
            <p className="text-xs text-slate-400 mt-4">Erkennt Spalten: Name, Menge, Preis, Versand, etc.</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
             <div className="flex items-center gap-3">
                <div className="bg-green-100 text-green-700 p-2 rounded-lg">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{generatedInvoices.length} Rechnungen generiert</h2>
                  <p className="text-slate-500 text-sm">Versandkosten können unten individuell angepasst werden.</p>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-200 px-3 py-1.5 rounded-lg text-sm">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-950">Rechnungsdatum:</span>
                  <input 
                    type="date"
                    value={customInvoiceDate}
                    onChange={e => handleGlobalDateChange(e.target.value)}
                    className="bg-white border border-blue-200 text-slate-800 text-xs rounded px-2 py-1 font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button onClick={() => setStep(1)} className="text-slate-500 hover:text-slate-700 text-sm bg-white px-4 py-2 border rounded-lg">
                  Neuer Import
                </button>
             </div>
          </div>

          {unmatchedNames.length > 0 && (
             <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-amber-800">Personen nicht gefunden</h3>
                        <p className="text-amber-700 text-sm mt-1">
                            Keine Stammdaten gefunden für:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {unmatchedNames.map(name => (
                                <span key={name} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium border border-amber-200">
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generatedInvoices.map((inv) => (
              <div key={inv.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <span className="font-bold text-slate-700 truncate">{inv.contact.firstName} {inv.contact.lastName}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap pl-2">Nr. {inv.invoiceNumber}</span>
                </div>
                <div className="p-4 flex-1">
                  <div className="flex justify-between text-xs text-slate-400 mb-2 uppercase font-semibold">
                     <span>Artikel</span>
                     <span>Preis</span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {inv.items.slice(0, 3).map((item, i) => (
                      <li key={i} className="flex justify-between text-slate-600">
                        <span className="truncate pr-2">{item.name}</span>
                        <span className="font-medium whitespace-nowrap">{item.totalPrice.toFixed(2)} €</span>
                      </li>
                    ))}
                    {inv.items.length > 3 && (
                        <li className="text-xs text-slate-400 italic text-center py-1 bg-slate-50 rounded">+ {inv.items.length - 3} weitere Positionen</li>
                    )}
                  </ul>
                  
                  {/* Editable Shipping Area */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center text-sm mb-2">
                         <span className="text-slate-500 flex items-center gap-1"><Edit2 className="w-3 h-3"/> Versand (€):</span>
                         <input 
                            type="number" 
                            step="0.01" 
                            value={inv.shippingCost}
                            onChange={(e) => updateInvoiceShipping(inv.id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right p-1 border rounded text-slate-700 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                         />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-xs">Gesamtbetrag:</span>
                        <span className="font-bold text-slate-900 text-lg">{inv.total.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-dashed border-slate-200 mt-2">
                        <span>Datum: {inv.date}</span>
                        <span className="text-blue-700 font-medium">Zahlungsziel: {inv.dueDate || calculateDueDate(inv.isoDate, 14)}</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
                   
                   <button
                      onClick={() => handleDownload(inv)}
                      className="flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-sm transition-colors font-medium decoration-0"
                   >
                     <Download className="w-4 h-4" /> PDF
                   </button>

                   <button 
                    onClick={() => openEmailPreview(inv)}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm transition-colors font-medium"
                   >
                     <Mail className="w-4 h-4" />
                     Senden
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        E-Mail Vorschau
                    </h3>
                    <button onClick={closeEmailPreview} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">Empfänger</label>
                            <input 
                                type="text" 
                                value={`${previewInvoice.contact.firstName} ${previewInvoice.contact.lastName} <${previewInvoice.contact.email}>`}
                                disabled 
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Betreff</label>
                            <input 
                                type="text" 
                                value={previewSubject}
                                onChange={(e) => setPreviewSubject(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nachricht</label>
                            <textarea 
                                rows={8}
                                value={previewMessage}
                                onChange={(e) => setPreviewMessage(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-sans"
                            />
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                            <Paperclip className="w-4 h-4" />
                            <span className="font-medium">Anhang:</span> Rechnung_{previewInvoice.invoiceNumber}.pdf
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                    <button 
                        onClick={closeEmailPreview}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                        disabled={isSending}
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={handleConfirmSend}
                        disabled={isSending}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Sende...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" /> Kostenpflichtig senden
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};