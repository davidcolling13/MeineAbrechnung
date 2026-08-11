import React from 'react';
import { Contact } from '../types';
import { FileSpreadsheet, Award, FileText, ArrowRight, Database, WifiOff } from 'lucide-react';

interface DashboardProps {
  contacts: Contact[];
  onNavigate: (page: any) => void;
  isOffline?: boolean;
  isLoading?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ contacts, onNavigate, isOffline = false, isLoading = false }) => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Willkommen zurück</h1>
          <p className="text-slate-500 mt-1">Verwalten Sie Ihre Kader-Abrechnungen und Dokumente.</p>
        </div>
        
        {/* Status Badge */}
        {isOffline ? (
             <div className="flex items-center gap-2 text-sm text-slate-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 shadow-sm">
                <WifiOff className="w-4 h-4 text-amber-600" />
                System Status: <span className="text-amber-700 font-medium">Offline Modus (Lokal)</span>
            </div>
        ) : (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-4 py-2 rounded-lg border shadow-sm">
                <Database className="w-4 h-4 text-green-600" />
                System Status: <span className="text-green-600 font-medium">DB Verbunden (Server)</span>
            </div>
        )}
      </div>

      {/* Quick Actions */}
      <h2 className="text-xl font-bold text-slate-900">Schnellzugriff</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div onClick={() => onNavigate('bulk')} className="group bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-xl shadow-lg text-white cursor-pointer hover:scale-[1.02] transition-transform">
          <FileSpreadsheet className="w-10 h-10 mb-4 opacity-80" />
          <h3 className="text-xl font-bold mb-2">Sammelbestellung</h3>
          <p className="text-indigo-100 text-sm mb-4">Excel-Import und automatische Rechnungsaufteilung.</p>
          <div className="flex items-center gap-2 font-medium group-hover:gap-3 transition-all">
            Starten <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        <div onClick={() => onNavigate('certificates')} className="group bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-xl shadow-lg text-white cursor-pointer hover:scale-[1.02] transition-transform">
          <Award className="w-10 h-10 mb-4 opacity-80" />
          <h3 className="text-xl font-bold mb-2">Bescheinigung</h3>
          <p className="text-emerald-100 text-sm mb-4">Lehrgangsteilnahme bestätigen und drucken.</p>
          <div className="flex items-center gap-2 font-medium group-hover:gap-3 transition-all">
            Erstellen <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        <div onClick={() => onNavigate('invoices')} className="group bg-gradient-to-br from-slate-600 to-slate-800 p-6 rounded-xl shadow-lg text-white cursor-pointer hover:scale-[1.02] transition-transform">
          <FileText className="w-10 h-10 mb-4 opacity-80" />
          <h3 className="text-xl font-bold mb-2">Lehrgangsrechnung</h3>
          <p className="text-slate-300 text-sm mb-4">Einzelrechnungen für Lehrgänge erstellen.</p>
          <div className="flex items-center gap-2 font-medium group-hover:gap-3 transition-all">
            Erstellen <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};