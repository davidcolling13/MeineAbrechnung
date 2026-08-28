import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { BulkOrders } from './pages/BulkOrders';
import { Certificates } from './pages/Certificates';
import { TrainingInvoices } from './pages/TrainingInvoices';
import { Settings } from './pages/Settings';
import { InvoiceHistory } from './pages/InvoiceHistory';
import { Contact } from './types';
import { db } from './services/db';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ToastProvider } from './components/Toast';

type Page = 'dashboard' | 'contacts' | 'bulk' | 'certificates' | 'invoices' | 'settings' | 'history';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        setError(null);
        await db.init();
        setIsOfflineMode(db.isOfflineMode());
        await refreshContacts();
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Kritischer Fehler beim Starten der Anwendung.");
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  const refreshContacts = async () => {
    setIsDataLoading(true);
    try {
      const data = await db.getAllContacts();
      setContacts(data);
    } catch (e) {
      console.error("Failed to refresh contacts", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  const addContact = async (contact: Contact) => {
    await db.addContact(contact);
    await refreshContacts();
  };

  const updateContact = async (updatedContact: Contact) => {
    await db.updateContact(updatedContact);
    await refreshContacts();
  };

  const deleteContact = async (id: string) => {
    await db.deleteContact(id);
    await refreshContacts();
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard contacts={contacts} onNavigate={setCurrentPage} isOffline={isOfflineMode} isLoading={isLoading || isDataLoading} />;
      case 'contacts':
        return <Contacts contacts={contacts} onAdd={addContact} onUpdate={updateContact} onDelete={deleteContact} isLoading={isLoading || isDataLoading} />;
      case 'bulk':
        return <BulkOrders contacts={contacts} />;
      case 'certificates':
        return <Certificates contacts={contacts} />;
      case 'invoices':
        return <TrainingInvoices contacts={contacts} />;
      case 'settings':
        return <Settings />;
      case 'history':
        return <InvoiceHistory />;
      default:
        return <Dashboard contacts={contacts} onNavigate={setCurrentPage} isOffline={isOfflineMode} isLoading={isLoading || isDataLoading} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium">Lade Anwendung...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-md w-full text-center">
          <div className="bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Systemfehler</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;