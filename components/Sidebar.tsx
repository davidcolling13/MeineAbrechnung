import React from 'react';
import { Users, FileSpreadsheet, Award, FileText, LayoutDashboard, Mountain, Archive, Settings } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'contacts', label: 'Stammdaten', icon: Users },
    { id: 'bulk', label: 'Sammelabrechnung', icon: FileSpreadsheet },
    { id: 'certificates', label: 'Bescheinigungen', icon: Award },
    { id: 'invoices', label: 'Lehrgangsrechnungen', icon: FileText },
  ];

  const bottomItems = [
      { id: 'history', label: 'Archiv', icon: Archive },
      { id: 'settings', label: 'Einstellungen', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full text-white">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-green-600 p-2 rounded-lg">
             <Mountain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Alpinkader</span>
        </div>
        <p className="text-xs text-slate-400 pl-1">DAV Landesverband NRW</p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentPage === item.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
        
        <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System</p>
            {bottomItems.map((item) => (
            <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === item.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
            </button>
            ))}
        </div>
      </nav>
    </div>
  );
};