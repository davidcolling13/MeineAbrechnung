import React, { useState } from 'react';
import { Contact, ContactType, Gender, SortField, SortDirection } from '../types';
import { Plus, Search, Edit2, Trash2, X, Save, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TableRowSkeleton } from '../components/Skeleton';
import { ContactSchema } from '../schemas';

// Wir nutzen ein lokales Objekt für die Klassen, um das JSX sauber zu halten (ähnlich wie CSS Modules),
// aber nutzen Tailwind-Klassen, da CSS-Dateien in dieser Umgebung nicht importiert werden können.
const styles = {
  container: "space-y-6",
  header: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4",
  title: "text-2xl font-bold text-slate-900",
  addButton: "flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
  searchWrapper: "relative",
  searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5",
  searchInput: "w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm disabled:bg-slate-50",
  tableCard: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
  tableWrapper: "overflow-x-auto",
  table: "w-full text-left text-sm",
  thead: "bg-slate-50 border-b border-slate-200",
  th: "px-6 py-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors select-none",
  thContent: "flex items-center gap-1",
  tr: "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0",
  td: "px-6 py-4 text-slate-500",
  tdMain: "px-6 py-4 font-medium text-slate-900",
  actionsCell: "px-6 py-4 text-right",
  actionButtons: "flex items-center justify-end gap-2",
  iconBtn: "p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors",
  deleteBtn: "p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors",
  badge: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
  badgeTrainer: "bg-orange-100 text-orange-800",
  badgeAthlet: "bg-blue-100 text-blue-800",
  modalOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4",
  modalContent: "bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in",
  modalHeader: "flex items-center justify-between p-6 border-b border-slate-100",
  closeBtn: "text-slate-400 hover:text-slate-600",
  form: "p-6 space-y-4",
  formRow: "grid grid-cols-2 gap-4",
  formGroup: "space-y-1",
  formGroup1_3: "col-span-1 space-y-1",
  formGroup2_3: "col-span-2 space-y-1",
  formGrid3: "grid grid-cols-3 gap-4",
  label: "block text-sm font-medium text-slate-700",
  input: "w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none",
  select: "w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none",
  modalFooter: "pt-4 flex justify-end gap-3",
  cancelBtn: "px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
};

interface ContactsProps {
  contacts: Contact[];
  onAdd: (c: Contact) => Promise<void>;
  onUpdate: (c: Contact) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export const Contacts: React.FC<ContactsProps> = ({ contacts, onAdd, onUpdate, onDelete, isLoading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const { addToast } = useToast();

  const [formData, setFormData] = useState<Omit<Contact, 'id'>>({
    firstName: '',
    lastName: '',
    address: '',
    zip: '',
    city: '',
    email: '',
    type: 'Athlet',
    gender: 'other'
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDirection('asc');
    }
  };

  const sortedAndFilteredContacts = React.useMemo(() => {
    let result = contacts.filter(c => 
        c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
        let valA = a[sortField].toLowerCase();
        let valB = b[sortField].toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
  }, [contacts, searchTerm, sortField, sortDirection]);

  const handleOpenModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        firstName: contact.firstName,
        lastName: contact.lastName,
        address: contact.address,
        zip: contact.zip,
        city: contact.city,
        email: contact.email,
        type: contact.type,
        gender: contact.gender || 'other'
      });
    } else {
      setEditingContact(null);
      setFormData({ firstName: '', lastName: '', address: '', zip: '', city: '', email: '', type: 'Athlet', gender: 'other' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-Side Validation with Zod
    const validation = ContactSchema.safeParse(formData);
    if (!validation.success) {
        const errorMsg = validation.error.issues[0].message;
        addToast(errorMsg, 'error');
        return;
    }

    try {
        if (editingContact) {
            await onUpdate({ ...formData, id: editingContact.id });
            addToast('Kontakt erfolgreich aktualisiert', 'success');
        } else {
            // Standardisierte UUID-Generierung für bessere Datenintegrität
            const newId = crypto.randomUUID();
            await onAdd({ ...formData, id: newId });
            addToast('Kontakt erfolgreich angelegt', 'success');
        }
        setIsModalOpen(false);
    } catch (err) {
        addToast('Fehler beim Speichern des Kontakts', 'error');
        console.error(err);
    }
  };

  const handleDeleteConfirm = async () => {
      if (!deleteId) return;
      try {
          await onDelete(deleteId);
          addToast('Kontakt erfolgreich gelöscht', 'success');
      } catch (err) {
          addToast('Fehler beim Löschen des Kontakts', 'error');
          console.error(err);
      } finally {
          setDeleteId(null);
      }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <div className="w-4 h-4" />;
      return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const GenderIcon = ({ gender }: { gender: Gender }) => {
      if (gender === 'male') return <span title="Männlich" className="text-blue-500 font-bold">M</span>;
      if (gender === 'female') return <span title="Weiblich" className="text-pink-500 font-bold">W</span>;
      return <span title="Divers/Andere" className="text-slate-400 font-bold">D</span>;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Stammdatenverwaltung</h1>
        <button 
          onClick={() => handleOpenModal()} 
          className={styles.addButton}
          disabled={isLoading}
        >
          <Plus className="w-4 h-4" /> Kontakt anlegen
        </button>
      </div>

      <div className={styles.searchWrapper}>
        <Search className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Suchen nach Name oder E-Mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          disabled={isLoading}
        />
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th} onClick={() => handleSort('lastName')}>
                    <div className={styles.thContent}>Name <SortIcon field="lastName"/></div>
                </th>
                <th className={styles.th}>
                    <div className={styles.thContent}>Gen.</div>
                </th>
                <th className={styles.th} onClick={() => handleSort('type')}>
                    <div className={styles.thContent}>Kategorie <SortIcon field="type"/></div>
                </th>
                <th className={styles.th} onClick={() => handleSort('city')}>
                    <div className={styles.thContent}>Adresse <SortIcon field="city"/></div>
                </th>
                <th className={styles.th}>E-Mail</th>
                <th className={`${styles.th} ${styles.actionsCell}`}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                  <>
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                  </>
              ) : sortedAndFilteredContacts.length > 0 ? sortedAndFilteredContacts.map((contact) => (
                <tr key={contact.id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tdMain}`}>{contact.lastName}, {contact.firstName}</td>
                  <td className={styles.td}><GenderIcon gender={contact.gender} /></td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${contact.type === 'Trainer' ? styles.badgeTrainer : styles.badgeAthlet}`}>
                      {contact.type}
                    </span>
                  </td>
                  <td className={styles.td}>{contact.address}, {contact.zip} {contact.city}</td>
                  <td className={styles.td}>{contact.email}</td>
                  <td className={`${styles.td} ${styles.actionsCell}`}>
                    <div className={styles.actionButtons}>
                      <button onClick={() => handleOpenModal(contact)} className={styles.iconBtn}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(contact.id)} className={styles.deleteBtn}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className={styles.td} style={{ textAlign: 'center', padding: '3rem' }}>
                    Keine Kontakte gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>{editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</h2>
              <button onClick={() => setIsModalOpen(false)} className={styles.closeBtn}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Vorname</label>
                  <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nachname</label>
                  <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className={styles.input} />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Kategorie</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as ContactType})} className={styles.select}>
                        <option value="Athlet">Athlet</option>
                        <option value="Trainer">Trainer</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Geschlecht (Anrede)</label>
                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as Gender})} className={styles.select}>
                        <option value="male">Männlich (Lieber)</option>
                        <option value="female">Weiblich (Liebe)</option>
                        <option value="other">Divers (Hallo)</option>
                    </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Anschrift</label>
                <input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={styles.input} />
              </div>

              <div className={styles.formGrid3}>
                <div className={styles.formGroup1_3}>
                  <label className={styles.label}>PLZ</label>
                  <input required type="text" value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} className={styles.input} />
                </div>
                <div className={styles.formGroup2_3}>
                  <label className={styles.label}>Stadt</label>
                  <input required type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className={styles.input} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>E-Mail</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={styles.input} />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsModalOpen(false)} className={styles.cancelBtn}>Abbrechen</button>
                <button type="submit" className={styles.addButton}>
                  <Save className="w-4 h-4" /> Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmationModal 
        isOpen={!!deleteId}
        title="Kontakt löschen"
        message="Möchten Sie diesen Kontakt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        isDangerous={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};