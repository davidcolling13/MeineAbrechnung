import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { db } from '../services/db';
import { useToast } from '../components/Toast';
import { Save, RefreshCw, Server, ShieldCheck, Mail, Sliders, Activity, Hash, RefreshCcw } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { SystemLogsView } from '../components/SystemLogsView';

type SettingsTab = 'general' | 'logs';

export const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncingCounter, setIsSyncingCounter] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await db.getSettings();
            setSettings(data);
        } catch (e) {
            addToast("Fehler beim Laden der Einstellungen", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        try {
            await db.saveSettings(settings);
            addToast("Einstellungen erfolgreich gespeichert", "success");
        } catch (e) {
            addToast("Fehler beim Speichern", "error");
        }
    };

    const handleSyncCounter = async () => {
        setIsSyncingCounter(true);
        try {
            const res = await db.syncDocumentCounter();
            const updated = await db.getSettings();
            setSettings(updated);
            addToast(`Zähler erfolgreich synchronisiert: Nächste Belegnummer ist ${res.nextNumber}`, "success");
        } catch (e: any) {
            addToast(e.message || "Fehler beim Synchronisieren des Zählers", "error");
        } finally {
            setIsSyncingCounter(false);
        }
    };

    const getPreviewNumber = () => {
        if (!settings) return '';
        const year = new Date().getFullYear().toString();
        const prefix = settings.docNumberPrefix || '';
        const counter = settings.nextDocNumber || 1;
        const padLength = counter >= 1000 ? 4 : 3;
        const numStr = counter.toString().padStart(padLength, '0');
        return prefix ? `${prefix}${year}-${numStr}` : `${year}-${numStr}`;
    };

    if (isLoading || !settings) {
        return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Einstellungen</h1>
                    <p className="text-sm text-slate-500 mt-1">Konfiguration, Belegnummern, E-Mail-Server, Vorlagen und Systemprotokoll</p>
                </div>
                {activeTab === 'general' && (
                    <div className="flex gap-3">
                        <button onClick={loadSettings} title="Einstellungen neu laden" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><RefreshCw className="w-5 h-5"/></button>
                        <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium text-sm"><Save className="w-4 h-4"/> Speichern</button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'general'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                >
                    <Sliders className="w-4 h-4" />
                    Allgemein & Vorlagen
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'logs'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    Systemprotokoll (Logging)
                </button>
            </div>

            {activeTab === 'logs' ? (
                <SystemLogsView />
            ) : (
            <div className="grid gap-6">
                
                {/* Global Document Numbering */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                                <Hash className="w-5 h-5 text-blue-600" /> Globale fortlaufende Dokumentennummerierung
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Einheitliche Belegnummer für alle Dokumente (Sammelrechnungen, Lehrgangsrechnungen und Bescheinigungen)
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-800 self-start sm:self-auto">
                            <span>Vorschau nächste Beleg-Nr.:</span>
                            <span className="font-mono font-bold text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-200">{getPreviewNumber()}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Belegnummer-Präfix (optional)
                            </label>
                            <input 
                                type="text" 
                                placeholder="z.B. RE- oder leer lassen"
                                value={settings.docNumberPrefix || ''} 
                                onChange={e => setSettings({...settings, docNumberPrefix: e.target.value})}
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Wenn leer, wird das Format <code>JAHR-NUMMER</code> (z.B. <code>{new Date().getFullYear()}-001</code>) verwendet.
                            </p>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nächster Zählerstand
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    min="1"
                                    value={settings.nextDocNumber || 1} 
                                    onChange={e => setSettings({...settings, nextDocNumber: Math.max(1, parseInt(e.target.value) || 1)})}
                                    className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                                <button 
                                    type="button"
                                    onClick={handleSyncCounter}
                                    disabled={isSyncingCounter}
                                    title="Zählerstand mit vorhandenen Rechnungen und Dokumenten in der Datenbank synchronisieren"
                                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 ${isSyncingCounter ? 'animate-spin' : ''}`} />
                                    DB-Abgleich
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Manueller Start- oder Zählerstand. Bei jedem Dokumentenexport wird dieser Zähler automatisch fortgeschrieben.
                            </p>
                        </div>
                    </div>
                </div>

                {/* SMTP Settings */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                        <Server className="w-5 h-5 text-blue-600" /> E-Mail Server (SMTP) Konfiguration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">SMTP Host</label>
                            <input 
                                type="text" 
                                placeholder="z.B. smtp.strato.de"
                                value={settings.smtpHost || ''} 
                                onChange={e => setSettings({...settings, smtpHost: e.target.value})}
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                            <input 
                                type="text" 
                                placeholder="z.B. 465 oder 587"
                                value={settings.smtpPort || ''} 
                                onChange={e => setSettings({...settings, smtpPort: e.target.value})}
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Benutzername</label>
                            <input 
                                type="text" 
                                autoComplete="off"
                                value={settings.smtpUser || ''} 
                                onChange={e => setSettings({...settings, smtpUser: e.target.value})}
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label>
                            <input 
                                type="password" 
                                autoComplete="new-password"
                                value={settings.smtpPass || ''} 
                                onChange={e => setSettings({...settings, smtpPass: e.target.value})}
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="col-span-1">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Absender E-Mail</label>
                             <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="info@verein.de"
                                    value={settings.smtpFrom || ''} 
                                    onChange={e => setSettings({...settings, smtpFrom: e.target.value})}
                                    className="w-full rounded-lg border-slate-300 border pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                />
                             </div>
                        </div>
                        <div className="col-span-1 flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={settings.smtpSecure || false} 
                                    onChange={e => setSettings({...settings, smtpSecure: e.target.checked})}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 flex items-center gap-1">
                                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                                    SSL/TLS Verbindung erzwingen (meist Port 465)
                                </span>
                            </label>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 bg-slate-50 p-2 rounded">
                        Hinweis: Diese Daten werden lokal auf dem Server gespeichert. Stellen Sie sicher, dass der Server sicher konfiguriert ist.
                    </p>
                </div>

                {/* Invoice Text */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-2">Standardtext: Lehrgangsrechnungen</h3>
                    <p className="text-xs text-slate-500 mb-3">Platzhalter: {'{Titel}'}, {'{Ort}'}, {'{Datum}'}, {'{Gebühr}'}, {'{Frist}'}, {'{Belegnummer}'}</p>
                    <textarea 
                        rows={6} 
                        value={settings.invoiceText} 
                        onChange={e => setSettings({...settings, invoiceText: e.target.value})}
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Certificate Text */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-2">Standardtext: Bescheinigungen</h3>
                    <p className="text-xs text-slate-500 mb-3">Platzhalter: {'{Titel}'}, {'{Ort}'}, {'{Datum}'}, {'{Belegnummer}'}</p>
                    <textarea 
                        rows={4} 
                        value={settings.certificateText} 
                        onChange={e => setSettings({...settings, certificateText: e.target.value})}
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Bank Details / Payment Info */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-2">Bankverbindung & Zahlungsinfo (Sammelbestellung)</h3>
                    <textarea 
                        rows={4} 
                        value={settings.bankDetails} 
                        onChange={e => setSettings({...settings, bankDetails: e.target.value})}
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Sender Line */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-2">Absenderzeile (PDF Kopf)</h3>
                    <input 
                        type="text" 
                        value={settings.senderLine} 
                        onChange={e => setSettings({...settings, senderLine: e.target.value})}
                        className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Footer Info */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-2">Fußzeilen (PDF)</h3>
                    <div className="space-y-3">
                        {settings.footerInfo.map((line, idx) => (
                            <input 
                                key={idx}
                                type="text"
                                value={line}
                                onChange={e => {
                                    const newFooter = [...settings.footerInfo];
                                    newFooter[idx] = e.target.value;
                                    setSettings({...settings, footerInfo: newFooter});
                                }}
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder={`Zeile ${idx + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};
