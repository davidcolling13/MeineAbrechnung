import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../services/db';
import { SystemLogEntry, LogLevel } from '../types';
import { useToast } from './Toast';
import { ConfirmationModal } from './ConfirmationModal';
import { 
  RefreshCw, 
  Trash2, 
  Download, 
  Copy, 
  Search, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  Check, 
  HardDrive,
  Activity,
  PlusCircle
} from 'lucide-react';
import { Skeleton } from './Skeleton';

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [maxLimit, setMaxLimit] = useState(500);

  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off

  // Expanded items state
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());

  // Modal & Copy
  const [showClearModal, setShowClearModal] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const { addToast } = useToast();

  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await db.getLogs({
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        search: searchQuery.trim() || undefined,
        limit: 200
      });
      setLogs(res.logs || []);
      setTotalCount(res.totalCount || 0);
      if (res.maxLimit) setMaxLimit(res.maxLimit);
    } catch (err: any) {
      console.error("Fehler beim Abrufen der Logs:", err);
      addToast(err?.message || "Fehler beim Laden des Systemprotokolls", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [levelFilter, sourceFilter, searchQuery, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchLogs(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchLogs]);

  // Unique sources for filter dropdown
  const availableSources = useMemo(() => {
    const defaultSources = ['Kontakte', 'E-Mail', 'Rechnungen', 'Einstellungen', 'Server', 'Datenbank', 'Client'];
    const dynamicSources = logs.map(l => l.source).filter(Boolean);
    return Array.from(new Set([...defaultSources, ...dynamicSources])).sort();
  }, [logs]);

  // Statistics
  const stats = useMemo(() => {
    let info = 0;
    let warn = 0;
    let error = 0;
    logs.forEach(l => {
      if (l.level === 'INFO') info++;
      else if (l.level === 'WARN') warn++;
      else if (l.level === 'ERROR') error++;
    });
    return { info, warn, error };
  }, [logs]);

  const toggleExpand = (id: number) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearLogs = async () => {
    try {
      await db.clearLogs();
      addToast("Systemprotokoll erfolgreich geleert", "success");
      setShowClearModal(false);
      fetchLogs();
    } catch (e: any) {
      addToast(e?.message || "Fehler beim Leeren des Protokolls", "error");
    }
  };

  const handleCreateTestLog = async () => {
    try {
      await db.logClientEvent('INFO', 'Test-Eintrag im Systemprotokoll generiert', {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        offlineStatus: db.isOfflineMode()
      });
      addToast("Test-Eintrag erstellt", "info");
      fetchLogs(true);
    } catch (e) {
      addToast("Fehler beim Erstellen des Test-Logs", "error");
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      addToast("Keine Protokolleinträge zum Exportieren vorhanden", "info");
      return;
    }
    const lines = logs.map(l => {
      const ts = new Date(l.timestamp).toLocaleString('de-DE');
      let line = `[${ts}] [${l.level}] [${l.source}] ${l.message}`;
      if (l.details) {
        line += `\n  Details: ${l.details.replace(/\n/g, '\n  ')}`;
      }
      return line;
    });

    const fileContent = `=== SYSTEMPROTOKOLL MEINEABRECHNUNG ===\nExportiert am: ${new Date().toLocaleString('de-DE')}\nGesamt: ${logs.length} Einträge\n\n` + lines.join('\n\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `systemprotokoll-${new Date().toISOString().slice(0, 10)}.log`;
    link.click();
    URL.revokeObjectURL(url);
    addToast("Protokoll als Datei exportiert", "success");
  };

  const handleCopyEntry = (entry: SystemLogEntry) => {
    const ts = new Date(entry.timestamp).toLocaleString('de-DE');
    const text = `[${ts}] [${entry.level}] [${entry.source}] ${entry.message}${entry.details ? `\nDetails: ${entry.details}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(entry.id);
    addToast("Eintrag in die Zwischenablage kopiert", "info");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (raw: string) => {
    try {
      const date = new Date(raw);
      if (isNaN(date.getTime())) return raw;
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return raw;
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3" /> FEHLER
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> WARNUNG
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Info className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Information Header & Size Management Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Systemprotokoll & Diagnose
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Erfasst Systemereignisse, Datenbankänderungen (z. B. Stammdaten-Anlage), E-Mail-Sendungen und Fehlermeldungen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchLogs(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Aktualisieren
            </button>

            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Protokoll als Textdatei herunterladen"
            >
              <Download className="w-3.5 h-3.5" />
              Exportieren
            </button>

            <button
              onClick={handleCreateTestLog}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              title="Test-Eintrag schreiben"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Test-Eintrag
            </button>

            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              title="Alle Protokolleinträge leeren"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Leeren
            </button>
          </div>
        </div>

        {/* Ring buffer notice */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              <strong>Automatischer Ringspeicher:</strong> Maximal {maxLimit} Einträge werden gespeichert. Ältere Einträge werden automatisch entfernt, um Speicher und Performance zu schonen.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-slate-700">{totalCount} von max. {maxLimit}</span>
            <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${totalCount > 400 ? 'bg-amber-500' : 'bg-blue-600'}`} 
                style={{ width: `${Math.min(100, (totalCount / maxLimit) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Suchbegriff eingeben (z.B. Kontakt, Fehler, ID)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Source Filter */}
          <div className="col-span-1">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Alle Quellen ({availableSources.length})</option>
              {availableSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Auto-Refresh Toggle */}
          <div className="col-span-1">
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>Auto-Aktualisierung: Aus</option>
              <option value={3}>Auto-Aktualisierung: alle 3 Sek.</option>
              <option value={10}>Auto-Aktualisierung: alle 10 Sek.</option>
              <option value={30}>Auto-Aktualisierung: alle 30 Sek.</option>
            </select>
          </div>
        </div>

        {/* Level Quick Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
            <span className="text-xs text-slate-500 mr-1">Filter:</span>
            <button
              onClick={() => setLevelFilter('ALL')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                levelFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Alle ({logs.length})
            </button>
            <button
              onClick={() => setLevelFilter('ERROR')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors flex items-center gap-1 ${
                levelFilter === 'ERROR'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              Fehler ({stats.error})
            </button>
            <button
              onClick={() => setLevelFilter('WARN')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors flex items-center gap-1 ${
                levelFilter === 'WARN'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Warnungen ({stats.warn})
            </button>
            <button
              onClick={() => setLevelFilter('INFO')}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors flex items-center gap-1 ${
                levelFilter === 'INFO'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Info className="w-3 h-3" />
              Info ({stats.info})
            </button>
          </div>

          <div className="text-xs text-slate-400">
            Zeige {logs.length} Einträge
          </div>
        </div>
      </div>

      {/* Log Entries List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-800">Keine Protokolleinträge vorhanden</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || levelFilter !== 'ALL' || sourceFilter !== 'ALL'
                ? "Für die gewählten Filter wurden keine Einträge gefunden. Setzen Sie die Filter zurück."
                : "Das Protokoll ist derzeit leer. Neue Aktionen und Systemereignisse werden hier erfasst."}
            </p>
            {(searchQuery || levelFilter !== 'ALL' || sourceFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setLevelFilter('ALL');
                  setSourceFilter('ALL');
                }}
                className="mt-4 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium rounded-lg"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((entry) => {
              const isExpanded = expandedLogIds.has(entry.id);
              const hasDetails = Boolean(entry.details);

              return (
                <div 
                  key={entry.id} 
                  className={`p-4 transition-colors hover:bg-slate-50/80 ${
                    entry.level === 'ERROR' ? 'bg-red-50/20' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Expand / collapse trigger if details exist */}
                      {hasDetails ? (
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="p-1 -ml-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/50 mt-0.5"
                          title={isExpanded ? "Details ausblenden" : "Details einblenden"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4 mt-0.5 inline-block" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {getLevelBadge(entry.level)}
                          
                          <span className="inline-block px-2 py-0.5 text-xs font-mono font-medium rounded bg-slate-100 text-slate-700">
                            {entry.source}
                          </span>

                          <span className="text-xs text-slate-400 font-mono">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>

                        <div className="text-sm font-medium text-slate-900 break-words leading-snug">
                          {entry.message}
                        </div>

                        {/* Collapsible Details */}
                        {hasDetails && isExpanded && (
                          <div className="mt-3 bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
                            <div className="flex justify-between items-center mb-1 text-slate-400 border-b border-slate-800 pb-1">
                              <span>Zusatzdetails / Stacktrace</span>
                              <button
                                onClick={() => {
                                  if (entry.details) {
                                    navigator.clipboard.writeText(entry.details);
                                    addToast("Details kopiert", "info");
                                  }
                                }}
                                className="text-slate-400 hover:text-white flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Kopieren
                              </button>
                            </div>
                            <pre className="whitespace-pre-wrap">{entry.details}</pre>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0 sm:self-start">
                      {hasDetails && (
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded font-medium"
                        >
                          {isExpanded ? 'Details verbergen' : 'Details'}
                        </button>
                      )}

                      <button
                        onClick={() => handleCopyEntry(entry)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        title="Eintrag kopieren"
                      >
                        {copiedId === entry.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearModal}
        title="Systemprotokoll leeren?"
        message="Möchten Sie wirklich alle bisherigen Protokolleinträge unwiderruflich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden."
        confirmLabel="Protokoll leeren"
        isDangerous={true}
        onConfirm={handleClearLogs}
        onCancel={() => setShowClearModal(false)}
      />
    </div>
  );
};
