import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import crypto from 'crypto';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for PDF uploads (base64)
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Verzeichnis erstellt: ${dataDir}`);
    } catch (e) {
        console.error("KRITISCHER FEHLER: Konnte Datenverzeichnis nicht erstellen.", e);
        process.exit(1);
    }
}

// Initialize SQLite Database
const dbPath = path.join(dataDir, 'database.sqlite');
let db;
let logEvent = () => {};
const MAX_LOG_ENTRIES = 500;

try {
  console.log(`Öffne Datenbank bei: ${dbPath}`);
  db = new Database(dbPath);
  
  // PERFORMANCE & INTEGRITY
  db.pragma('journal_mode = WAL'); 
  db.pragma('synchronous = NORMAL'); 
  db.pragma('foreign_keys = ON');

  // Create Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      address TEXT,
      zip TEXT,
      city TEXT,
      email TEXT,
      type TEXT CHECK(type IN ('Athlet', 'Trainer')),
      gender TEXT DEFAULT 'other'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT,
      recipientName TEXT,
      date TEXT,
      dueDate TEXT,
      totalAmount REAL,
      title TEXT,
      type TEXT,
      deliveryMethod TEXT DEFAULT 'download',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      level TEXT CHECK(level IN ('INFO', 'WARN', 'ERROR')) DEFAULT 'INFO',
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
  `);
  
  // MIGRATION: Check if gender column exists (for existing DBs), add if missing
  try {
    const tableInfo = db.prepare("PRAGMA table_info(contacts)").all();
    const hasGender = tableInfo.some(col => col.name === 'gender');
    if (!hasGender) {
        console.log("Migration: Füge Spalte 'gender' zur Tabelle 'contacts' hinzu...");
        db.prepare("ALTER TABLE contacts ADD COLUMN gender TEXT DEFAULT 'other'").run();
    }
  } catch (e) {
      console.error("Fehler bei Datenbank-Migration (Contacts):", e);
  }

  // MIGRATION: Check if deliveryMethod column exists in invoices
  try {
    const tableInfo = db.prepare("PRAGMA table_info(invoices)").all();
    const hasDeliveryMethod = tableInfo.some(col => col.name === 'deliveryMethod');
    if (!hasDeliveryMethod) {
        console.log("Migration: Füge Spalte 'deliveryMethod' zur Tabelle 'invoices' hinzu...");
        db.prepare("ALTER TABLE invoices ADD COLUMN deliveryMethod TEXT DEFAULT 'download'").run();
    }
    const hasDueDate = tableInfo.some(col => col.name === 'dueDate');
    if (!hasDueDate) {
        console.log("Migration: Füge Spalte 'dueDate' zur Tabelle 'invoices' hinzu...");
        db.prepare("ALTER TABLE invoices ADD COLUMN dueDate TEXT").run();
    }
  } catch (e) {
      console.error("Fehler bei Datenbank-Migration (Invoices):", e);
  }

  // Prepared statements for system_logs with rolling size limit
  const insertLogStmt = db.prepare(`
    INSERT INTO system_logs (level, source, message, details)
    VALUES (?, ?, ?, ?)
  `);
  const trimLogsStmt = db.prepare(`
    DELETE FROM system_logs 
    WHERE id NOT IN (
      SELECT id FROM system_logs ORDER BY id DESC LIMIT ?
    )
  `);

  logEvent = (level = 'INFO', source = 'Server', message = '', details = null) => {
    try {
      const safeLevel = ['INFO', 'WARN', 'ERROR'].includes(level) ? level : 'INFO';
      const truncatedMsg = String(message || '').substring(0, 500);
      let detailsStr = null;
      if (details !== null && details !== undefined) {
        if (typeof details === 'object') {
          try {
            detailsStr = JSON.stringify(details, null, 2);
          } catch (_) {
            detailsStr = String(details);
          }
        } else {
          detailsStr = String(details);
        }
        if (detailsStr.length > 4000) {
          detailsStr = detailsStr.substring(0, 4000) + '... [gekürzt]';
        }
      }

      insertLogStmt.run(safeLevel, String(source || 'System').substring(0, 50), truncatedMsg, detailsStr);
      trimLogsStmt.run(MAX_LOG_ENTRIES);
    } catch (err) {
      console.error("Fehler beim Schreiben in system_logs:", err);
    }
  };

  console.log("Datenbank erfolgreich initialisiert.");
  logEvent('INFO', 'Datenbank', 'SQLite-Datenbank erfolgreich initialisiert.');

} catch (err) {
  console.error("Fehler bei der Datenbank-Initialisierung:", err);
  process.exit(1);
}

// --- HELPER: Get Settings ---
const getSettingsFromDb = () => {
    try {
        const stmt = db.prepare('SELECT * FROM settings');
        const rows = stmt.all();
        return rows.reduce((acc, row) => {
            try {
                acc[row.key] = JSON.parse(row.value);
            } catch (e) {
                acc[row.key] = row.value;
            }
            return acc;
        }, {});
    } catch (e) {
        console.error("DB Settings Read Error", e);
        return {};
    }
};

// --- LOGO SERVING ---
app.get('/logo1.png', (req, res) => {
    const logoPath = path.join(dataDir, 'logo1.png');
    if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
    } else {
        res.status(404).send('Logo1 not found');
    }
});

app.get('/logo2.png', (req, res) => {
    const logoPath = path.join(dataDir, 'logo2.png');
    if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
    } else {
        res.status(404).send('Logo2 not found');
    }
});

app.get('/logo.png', (req, res) => {
    const logoPath = path.join(dataDir, 'logo1.png');
    if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
    } else {
        res.status(404).send('Logo not found');
    }
});

app.get('/favicon.jpg', (req, res) => {
    const iconPath = path.join(dataDir, 'favicon.jpg');
    if (fs.existsSync(iconPath)) {
        res.sendFile(iconPath);
    } else {
        res.status(404).send('Favicon not found');
    }
});

// --- VALIDATION SCHEMAS ---
const ContactSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'Vorname ist erforderlich'),
  lastName: z.string().min(1, 'Nachname ist erforderlich'),
  address: z.string().optional().nullable().default(''),
  zip: z.string().optional().nullable().default(''),
  city: z.string().optional().nullable().default(''),
  email: z.string().trim().email().optional().nullable().or(z.literal('')).default(''),
  type: z.enum(['Athlet', 'Trainer']),
  gender: z.enum(['male', 'female', 'other']).default('other')
});

const SettingsSchema = z.record(z.string(), z.any());

const InvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string(),
  recipientName: z.string(),
  date: z.string(),
  dueDate: z.string().optional(),
  totalAmount: z.number(),
  title: z.string(),
  type: z.enum(['Training', 'BulkOrder', 'Certificate']),
  deliveryMethod: z.enum(['email', 'download']).optional().default('download')
});

const EmailSchema = z.object({
    to: z.string().email(),
    subject: z.string(),
    text: z.string(),
    filename: z.string(),
    pdfBase64: z.string() // Expect base64 encoded PDF
});

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    try {
        const stmt = db.prepare('SELECT 1');
        stmt.get();
        res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// --- CONTACTS API ---
app.get('/api/contacts', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM contacts ORDER BY lastName ASC');
    const contacts = stmt.all();
    res.json(contacts);
  } catch (error) {
    console.error('Database Read Error:', error);
    logEvent('ERROR', 'Kontakte', 'Fehler beim Lesen der Kontakte: ' + error.message);
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Kontakte.' });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const validation = ContactSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logEvent('WARN', 'Kontakte', `Validierungsfehler beim Anlegen: ${errorMsg}`, req.body);
      return res.status(400).json({ error: errorMsg });
    }
    const { id, firstName, lastName, address, zip, city, email, type, gender } = validation.data;
    const finalId = id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO contacts (id, firstName, lastName, address, zip, city, email, type, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(finalId, firstName, lastName, address || '', zip || '', city || '', email || '', type, gender);
    logEvent('INFO', 'Kontakte', `Kontakt erfolgreich angelegt: ${firstName} ${lastName} (${type}) [ID: ${finalId}]`);
    res.json({ success: true, id: finalId, ...validation.data });
  } catch (error) {
    console.error("Fehler in POST /api/contacts:", error);
    logEvent('ERROR', 'Kontakte', `Fehler beim Anlegen eines Kontakts: ${error.message}`, {
      error: error.stack || error.message,
      payload: req.body
    });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const validation = ContactSchema.safeParse(req.body);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logEvent('WARN', 'Kontakte', `Validierungsfehler beim Bearbeiten von Kontakt (${id}): ${errorMsg}`, req.body);
      return res.status(400).json({ error: errorMsg });
    }
    const { firstName, lastName, address, zip, city, email, type, gender } = validation.data;
    const stmt = db.prepare(`
      UPDATE contacts 
      SET firstName = ?, lastName = ?, address = ?, zip = ?, city = ?, email = ?, type = ?, gender = ?
      WHERE id = ?
    `);
    const info = stmt.run(firstName, lastName, address || '', zip || '', city || '', email || '', type, gender, id);
    if (info.changes === 0) {
      logEvent('WARN', 'Kontakte', `Kontakt mit ID ${id} nicht in Datenbank gefunden.`);
      return res.status(404).json({ error: "Kontakt nicht gefunden" });
    }
    logEvent('INFO', 'Kontakte', `Kontakt aktualisiert: ${firstName} ${lastName} (ID: ${id})`);
    res.json({ success: true });
  } catch (error) {
    console.error("Fehler in PUT /api/contacts/:id:", error);
    logEvent('ERROR', 'Kontakte', `Fehler beim Aktualisieren von Kontakt (${req.params.id}): ${error.message}`, {
      error: error.stack || error.message,
      payload: req.body
    });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Kontakt nicht gefunden" });
    logEvent('INFO', 'Kontakte', `Kontakt gelöscht (ID: ${id})`);
    res.json({ success: true });
  } catch (error) {
    console.error("Fehler in DELETE /api/contacts/:id:", error);
    logEvent('ERROR', 'Kontakte', `Fehler beim Löschen von Kontakt (${req.params.id}): ${error.message}`, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// --- SETTINGS API ---
app.get('/api/settings', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM settings');
        const rows = stmt.all();
        const settings = rows.reduce((acc, row) => {
            try {
                acc[row.key] = JSON.parse(row.value);
            } catch (e) {
                acc[row.key] = row.value;
            }
            return acc;
        }, {});
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const validation = SettingsSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: "Ungültiges Format für Einstellungen" });
        }
        const settings = validation.data;
        const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        const updateTransaction = db.transaction((data) => {
            for (const [key, value] of Object.entries(data)) {
                const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                insert.run(key, stringValue);
            }
        });
        updateTransaction(settings);
        logEvent('INFO', 'Einstellungen', 'Einstellungen erfolgreich gespeichert.');
        res.json({ success: true });
    } catch (error) {
        logEvent('ERROR', 'Einstellungen', `Fehler beim Speichern der Einstellungen: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// --- INVOICES API (HISTORY) ---
app.get('/api/invoices', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM invoices ORDER BY date DESC, createdAt DESC');
        const rows = stmt.all();
        const enriched = rows.map(row => {
            if (!row.dueDate && row.date) {
                const parts = row.date.split('T')[0].split('-');
                if (parts.length === 3) {
                    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    d.setDate(d.getDate() + 14);
                    return {
                        ...row,
                        dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    };
                }
            }
            return row;
        });
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/invoices', (req, res) => {
    try {
        const validation = InvoiceSchema.safeParse(req.body);
        if (!validation.success) {
             return res.status(400).json({ error: validation.error.errors.map(e => e.message).join(', ') });
        }
        let { id, invoiceNumber, recipientName, date, dueDate, totalAmount, title, type, deliveryMethod } = validation.data;
        if (!dueDate && date) {
            const parts = date.split('T')[0].split('-');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                d.setDate(d.getDate() + 14);
                dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        }
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO invoices (id, invoiceNumber, recipientName, date, dueDate, totalAmount, title, type, deliveryMethod)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const finalId = id || crypto.randomUUID();
        stmt.run(finalId, invoiceNumber, recipientName, date, dueDate || null, totalAmount, title, type, deliveryMethod);
        logEvent('INFO', 'Rechnungen', `Dokument archiviert: ${invoiceNumber} für ${recipientName} (${type}, ${deliveryMethod || 'download'}, Fälligkeit: ${dueDate || '14 Tage'})`);
        res.json({ success: true, id: finalId });
    } catch (error) {
        logEvent('ERROR', 'Rechnungen', `Fehler beim Archivieren: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/invoices/:id', (req, res) => {
    try {
        const { id } = req.params;
        const validation = InvoiceSchema.safeParse(req.body);
        if (!validation.success) {
             return res.status(400).json({ error: validation.error.errors.map(e => e.message).join(', ') });
        }
        let { invoiceNumber, recipientName, date, dueDate, totalAmount, title, type, deliveryMethod } = validation.data;
        if (!dueDate && date) {
            const parts = date.split('T')[0].split('-');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                d.setDate(d.getDate() + 14);
                dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
        }
        const stmt = db.prepare(`
            UPDATE invoices 
            SET invoiceNumber = ?, recipientName = ?, date = ?, dueDate = ?, totalAmount = ?, title = ?, type = ?, deliveryMethod = ?
            WHERE id = ?
        `);
        const info = stmt.run(invoiceNumber, recipientName, date, dueDate || null, totalAmount, title, type, deliveryMethod, id);
        if (info.changes === 0) return res.status(404).json({ error: "Rechnung nicht gefunden" });
        logEvent('INFO', 'Rechnungen', `Dokument aktualisiert: ${invoiceNumber} (${id})`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/invoices/:id', (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM invoices WHERE id = ?');
        const info = stmt.run(id);
        if (info.changes === 0) return res.status(404).json({ error: "Rechnung nicht gefunden" });
        logEvent('INFO', 'Rechnungen', `Dokument gelöscht (ID: ${id})`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GLOBALE DOKUMENTENNUMMERIERUNG API ---
function getDocumentNumberingState() {
  const currentYear = new Date().getFullYear().toString();
  
  // 1. Höchste vergebene Belegnummer in der Invoices-Tabelle ermitteln
  const rows = db.prepare('SELECT invoiceNumber FROM invoices').all();
  let maxFound = 0;
  for (const row of rows) {
    if (!row.invoiceNumber) continue;
    // Format YYYY-XXX oder [Prefix-]YYYY-XXX
    const matchYear = row.invoiceNumber.match(/(\d{4})-(\d+)/);
    if (matchYear && matchYear[1] === currentYear) {
      const num = parseInt(matchYear[2], 10);
      if (!isNaN(num) && num > maxFound) maxFound = num;
    } else {
      const matchEnd = row.invoiceNumber.match(/(\d+)$/);
      if (matchEnd) {
        const num = parseInt(matchEnd[1], 10);
        if (!isNaN(num) && num > maxFound && num < 100000) maxFound = num;
      }
    }
  }

  // 2. Gespeicherte Zähler aus settings Tabelle lesen
  let configuredStart = 1;
  let prefix = '';
  try {
    const nextRow = db.prepare("SELECT value FROM settings WHERE key = 'nextDocNumber'").get();
    if (nextRow && nextRow.value !== undefined) {
      let val = nextRow.value;
      try { val = JSON.parse(val); } catch (e) {}
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) configuredStart = parsed;
    }
    const prefixRow = db.prepare("SELECT value FROM settings WHERE key = 'docNumberPrefix'").get();
    if (prefixRow && prefixRow.value !== undefined) {
      let pVal = prefixRow.value;
      try { pVal = JSON.parse(pVal); } catch (e) {}
      if (typeof pVal === 'string') prefix = pVal.trim();
    }
  } catch (e) {
    console.error("Fehler beim Lesen der Belegnummern-Einstellungen:", e);
  }

  const effectiveCounter = Math.max(maxFound + 1, configuredStart);
  return {
    currentYear,
    maxFound,
    configuredStart,
    effectiveCounter,
    prefix
  };
}

function formatDocumentNumber(counter, year, prefix = '') {
  const padLength = counter >= 1000 ? 4 : 3;
  const counterStr = counter.toString().padStart(padLength, '0');
  return prefix ? `${prefix}${year}-${counterStr}` : `${year}-${counterStr}`;
}

app.get('/api/documents/next-number', (req, res) => {
    try {
        const state = getDocumentNumberingState();
        const nextNumber = formatDocumentNumber(state.effectiveCounter, state.currentYear, state.prefix);
        res.json({
            nextNumber,
            counter: state.effectiveCounter,
            currentYear: state.currentYear,
            prefix: state.prefix,
            maxFound: state.maxFound
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/documents/allocate-numbers', (req, res) => {
    try {
        const count = Math.max(1, parseInt(req.body.count || 1, 10));
        const allocateTx = db.transaction(() => {
            const state = getDocumentNumberingState();
            const numbers = [];
            for (let i = 0; i < count; i++) {
                numbers.push(formatDocumentNumber(state.effectiveCounter + i, state.currentYear, state.prefix));
            }
            const nextCounter = state.effectiveCounter + count;
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('nextDocNumber', ?)").run(String(nextCounter));
            logEvent('INFO', 'Dokumente', `${count} globale fortlaufende Belegnummer(n) vergeben: ${numbers[0]}${count > 1 ? ' bis ' + numbers[numbers.length - 1] : ''}`);
            return { numbers, nextCounter };
        });
        const result = allocateTx();
        res.json(result);
    } catch (error) {
        logEvent('ERROR', 'Dokumente', `Fehler beim Zuweisen der Belegnummern: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/documents/sync-counter', (req, res) => {
    try {
        const state = getDocumentNumberingState();
        const nextCounter = state.maxFound + 1;
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('nextDocNumber', ?)").run(String(nextCounter));
        const nextNumber = formatDocumentNumber(nextCounter, state.currentYear, state.prefix);
        logEvent('INFO', 'Dokumente', `Belegnummern-Zähler auf ${nextCounter} (${nextNumber}) synchronisiert.`);
        res.json({ success: true, counter: nextCounter, nextNumber });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SYSTEM LOGS API ---
const LogSchema = z.object({
  level: z.enum(['INFO', 'WARN', 'ERROR']).default('INFO'),
  source: z.string().default('Client'),
  message: z.string().min(1),
  details: z.any().optional()
});

app.get('/api/logs', (req, res) => {
    try {
        const { level, source, search } = req.query;
        let limit = parseInt(req.query.limit, 10);
        if (isNaN(limit) || limit <= 0) limit = 200;
        if (limit > MAX_LOG_ENTRIES) limit = MAX_LOG_ENTRIES;

        let query = 'SELECT * FROM system_logs WHERE 1=1';
        const params = [];

        if (level && ['INFO', 'WARN', 'ERROR'].includes(level)) {
            query += ' AND level = ?';
            params.push(level);
        }
        if (source && typeof source === 'string' && source.trim() !== '') {
            query += ' AND source = ?';
            params.push(source.trim());
        }
        if (search && typeof search === 'string' && search.trim() !== '') {
            query += ' AND (message LIKE ? OR details LIKE ?)';
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        query += ' ORDER BY id DESC LIMIT ?';
        params.push(limit);

        const stmt = db.prepare(query);
        const logs = stmt.all(...params);

        const countStmt = db.prepare('SELECT COUNT(*) as count FROM system_logs');
        const countResult = countStmt.get();

        res.json({
            logs,
            totalCount: countResult?.count || 0,
            maxLimit: MAX_LOG_ENTRIES
        });
    } catch (error) {
        console.error("Fehler in GET /api/logs:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logs', (req, res) => {
    try {
        const validation = LogSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.message });
        }
        const { level, source, message, details } = validation.data;
        logEvent(level, source, message, details);
        res.json({ success: true });
    } catch (error) {
        console.error("Fehler in POST /api/logs:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/logs', (req, res) => {
    try {
        db.prepare('DELETE FROM system_logs').run();
        logEvent('INFO', 'System', 'Systemprotokoll wurde manuell geleert.');
        res.json({ success: true });
    } catch (error) {
        console.error("Fehler in DELETE /api/logs:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- EMAIL API ---
app.post('/api/email/send', async (req, res) => {
    try {
        const validation = EmailSchema.safeParse(req.body);
        if (!validation.success) {
            logEvent('WARN', 'E-Mail', 'Ungültige E-Mail-Anfragedaten: ' + validation.error.message);
            return res.status(400).json({ error: validation.error.message });
        }

        const { to, subject, text, filename, pdfBase64 } = validation.data;

        // FETCH SETTINGS DYNAMICALLY FROM DB
        const settings = getSettingsFromDb();
        const smtpHost = settings.smtpHost || process.env.SMTP_HOST;
        
        if (!smtpHost) {
            logEvent('ERROR', 'E-Mail', `E-Mail-Versand fehlgeschlagen an ${to}: Kein SMTP-Server konfiguriert.`);
            return res.status(400).json({ error: "Kein SMTP Server konfiguriert. Bitte in den Einstellungen eintragen." });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(settings.smtpPort || process.env.SMTP_PORT || '587'),
            secure: settings.smtpSecure === true, // true for 465, false for other ports
            auth: {
                user: settings.smtpUser || process.env.SMTP_USER,
                pass: settings.smtpPass || process.env.SMTP_PASS,
            },
        });

        // Clean base64 string if it contains the data URL prefix
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

        const mailOptions = {
            from: settings.smtpFrom || settings.smtpUser || process.env.SMTP_USER || 'noreply@alpinkader.nrw', // Sender address
            to: to,
            subject: subject,
            text: text,
            attachments: [
                {
                    filename: filename,
                    content: base64Data,
                    encoding: 'base64',
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("E-Mail gesendet: %s", info.messageId);
        logEvent('INFO', 'E-Mail', `E-Mail erfolgreich versendet an ${to} (Anhang: ${filename})`, {
            to,
            subject,
            smtpHost,
            messageId: info.messageId
        });
        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error("Fehler beim Senden der E-Mail:", error);
        logEvent('ERROR', 'E-Mail', `Fehler beim Senden der E-Mail an ${req.body?.to || 'unbekannt'}: ${error.message}`, {
            to: req.body?.to,
            subject: req.body?.subject,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: "Fehler beim Senden der E-Mail. " + error.message });
    }
});

// --- SERVE FRONTEND ---
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// --- GRACEFUL SHUTDOWN ---
const shutdown = () => {
    console.log('Fahre Server herunter...');
    logEvent('INFO', 'Server', 'Server wird heruntergefahren...');
    if (db) {
        try {
            console.log('Führe WAL Checkpoint aus...');
            db.pragma('wal_checkpoint(TRUNCATE)'); 
            db.close();
            console.log('Datenbankverbindung geschlossen.');
        } catch (e) {
            console.error('Fehler beim Schließen der Datenbank:', e);
        }
    }
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    logEvent('INFO', 'Server', `Server erfolgreich gestartet auf Port ${PORT}`);
});
