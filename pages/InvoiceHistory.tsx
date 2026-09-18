import React, { useState, useEffect, useMemo } from 'react';
import { InvoiceRecord } from '../types';
import { db } from '../services/db';
import { TableRowSkeleton } from '../components/Skeleton';
import { FileText, Search, Edit2, Check, X, Trash2, Award, Mail, Download, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { calculateDueDate, calculateDueDateISO, formatDateDE } from '../utils/formatting';

type SortKey = 'date' | 'recipientName' | 'invoiceNumber' | 'totalAmount';
type FilterType = 'All' | 'Training' | 'BulkOrder' | 'Certificate';
type FilterMethod = 'All' | 'email' | 'download';

export const InvoiceHistory: React.FC = () => {
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();

    // Filters & Sorting
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDesc, setSortDesc] = useState(true);
    const [filterType, setFilterType] = useState<FilterType>('All');
    const [filterMethod, setFilterMethod] = useState<FilterMethod>('All');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<InvoiceRecord | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await db.getInvoices();
            setInvoices(data);
        } catch (e) {
            console.error(e);
            addToast('Fehler beim Laden der Rechnungen', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
            setSortDesc(true); // Default to desc (newest first / highest amount)
        }
    };

    const sortedAndFilteredInvoices = useMemo(() => {
        let result = invoices.filter(inv => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                inv.recipientName.toLowerCase().includes(searchLower) ||
                inv.invoiceNumber.toLowerCase().includes(searchLower) ||
                inv.title.toLowerCase().includes(searchLower);
            
            const matchesType = filterType === 'All' || inv.type === filterType;
            const matchesMethod = filterMethod === 'All' || (inv.deliveryMethod || 'download') === filterMethod;

            return matchesSearch && matchesType && matchesMethod;
        });

        result.sort((a, b) => {
            let valA: any = a[sortKey];
            let valB: any = b[sortKey];

            if (sortKey === 'date') {
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortDesc ? 1 : -1;
            if (valA > valB) return sortDesc ? -1 : 1;
            return 0;
        });

        return result;
    }, [invoices, searchTerm, sortKey, sortDesc, filterType, filterMethod]);

    const handleEditStart = (inv: InvoiceRecord) => {
        setEditingId(inv.id);
        setEditForm({ ...inv });
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditForm(null);
    };

    const handleEditSave = async () => {
        if (!editForm) return;
        try {
            await db.updateInvoice(editForm);
            setInvoices(prev => prev.map(inv => inv.id === editForm.id ? editForm : inv));
            setEditingId(null);
            setEditForm(null);
            addToast('Eintrag aktualisiert', 'success');
        } catch (e) {
            console.error(e);
            addToast('Fehler beim Speichern', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await db.deleteInvoice(deleteId);
            setInvoices(prev => prev.filter(inv => inv.id !== deleteId));
            setDeleteId(null);
            addToast('Eintrag gelöscht', 'success');
        } catch (e) {
            addToast('Fehler beim Löschen', 'error');
        }
    };

    const getTypeLabel = (type: string) => {
        switch(type) {
            case 'Training': return 'Lehrgang';
            case 'BulkOrder': return 'Bestellung';
            case 'Certificate': return 'Bescheinigung';
            default: return type;
        }
    };

    const getTypeStyle = (type: string) => {
        switch(type) {
            case 'Training': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'BulkOrder': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'Certificate': return 'bg-green-50 text-green-700 border-green-200';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const SortIcon = ({ colKey }: { colKey: SortKey }) => {
        if (sortKey !== colKey) return <div className="w-4 h-4" />;
        return sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />;
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Archiv</h1>

            {/* Toolbar: Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Suchen nach Name, Nummer oder Titel..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                <div className="flex gap-4">
                    <div className="relative">
                        <select 
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as FilterType)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-100"
                        >
                            <option value="All">Alle Typen</option>
                            <option value="BulkOrder">Bestellung</option>
                            <option value="Training">Lehrgang</option>
                            <option value="Certificate">Bescheinigung</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select 
                            value={filterMethod}
                            onChange={(e) => setFilterMethod(e.target.value as FilterMethod)}
                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-slate-100"
                        >
                            <option value="All">Alle Wege</option>
                            <option value="email">E-Mail Versand</option>
                            <option value="download">Manueller Download</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th 
                                    className="px-6 py-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none w-[120px]"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-1">Datum <SortIcon colKey="date"/></div>
                                </th>
                                <th 
                                    className="px-6 py-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none w-[120px]"
                                    onClick={() => handleSort('invoiceNumber')}
                                >
                                    <div className="flex items-center gap-1">Nr. <SortIcon colKey="invoiceNumber"/></div>
                                </th>
                                <th 
                                    className="px-6 py-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => handleSort('recipientName')}
                                >
                                    <div className="flex items-center gap-1">Empfänger <SortIcon colKey="recipientName"/></div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-700 w-full">
                                    Titel / Verwendungszweck
                                </th>
                                <th 
                                    className="px-6 py-4 font-semibold text-slate-700 text-right cursor-pointer hover:bg-slate-100 select-none w-[120px]"
                                    onClick={() => handleSort('totalAmount')}
                                >
                                    <div className="flex items-center justify-end gap-1">Betrag <SortIcon colKey="totalAmount"/></div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-700 w-[140px]">Typ</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-center w-[100px]">Versand</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right w-[100px]">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <>
                                    <TableRowSkeleton />
                                    <TableRowSkeleton />
                                    <TableRowSkeleton />
                                </>
                            ) : sortedAndFilteredInvoices.length > 0 ? (
                                sortedAndFilteredInvoices.map(inv => {
                                    const isEditing = editingId === inv.id;
                                    const method = inv.deliveryMethod || 'download';
                                    
                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                            {/* Date */}
                                            <td className="px-6 py-4 text-slate-600">
                                                {isEditing && editForm ? (
                                                    <div className="space-y-1">
                                                        <input 
                                                            type="date" 
                                                            value={editForm.date} 
                                                            onChange={e => {
                                                                const newDate = e.target.value;
                                                                const newDue = calculateDueDateISO(newDate, 14);
                                                                setEditForm({...editForm, date: newDate, dueDate: newDue});
                                                            }}
                                                            className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                                                        />
                                                        <div className="text-[10px] text-slate-400">
                                                            Ziel: {editForm.dueDate ? formatDateDE(editForm.dueDate) : calculateDueDate(editForm.date, 14)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div>{formatDateDE(inv.date)}</div>
                                                        {inv.type !== 'Certificate' && (
                                                            <div className="text-xs text-blue-600 font-medium" title="Zahlungsziel: 14 Tage ab Rechnungsdatum">
                                                                Ziel: {inv.dueDate ? formatDateDE(inv.dueDate) : calculateDueDate(inv.date, 14)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Invoice Number */}
                                            <td className="px-6 py-4 font-mono text-slate-600">
                                                {inv.invoiceNumber}
                                            </td>

                                            {/* Recipient */}
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {isEditing && editForm ? (
                                                    <input 
                                                        type="text" 
                                                        value={editForm.recipientName} 
                                                        onChange={e => setEditForm({...editForm, recipientName: e.target.value})}
                                                        className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    inv.recipientName
                                                )}
                                            </td>

                                            {/* Title */}
                                            <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={inv.title}>
                                                {isEditing && editForm ? (
                                                    <input 
                                                        type="text" 
                                                        value={editForm.title} 
                                                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                                                        className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    inv.title
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td className="px-6 py-4 text-right font-medium">
                                                {isEditing && editForm ? (
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={editForm.totalAmount} 
                                                        onChange={e => setEditForm({...editForm, totalAmount: parseFloat(e.target.value)})}
                                                        className="w-full px-2 py-1 border rounded text-right focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    inv.type === 'Certificate' ? (
                                                        <span className="text-slate-300">-</span>
                                                    ) : (
                                                        `${inv.totalAmount.toFixed(2)} €`
                                                    )
                                                )}
                                            </td>

                                            {/* Type */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeStyle(inv.type)}`}>
                                                    {inv.type === 'Certificate' ? <Award className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                                    {getTypeLabel(inv.type)}
                                                </span>
                                            </td>

                                            {/* Method (Sent/Printed) */}
                                            <td className="px-6 py-4 text-center">
                                                {method === 'email' ? (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600" title="Per E-Mail versendet">
                                                        <Mail className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500" title="Heruntergeladen / Gedruckt">
                                                        <Download className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <button onClick={handleEditSave} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Speichern">
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={handleEditCancel} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Abbrechen">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleEditStart(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Bearbeiten">
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => setDeleteId(inv.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Löschen">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">Keine Einträge gefunden.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmationModal 
                isOpen={!!deleteId}
                title="Eintrag löschen"
                message="Möchten Sie diesen Eintrag wirklich aus dem Archiv löschen?"
                confirmLabel="Löschen"
                isDangerous={true}
                onConfirm={handleDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
};