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
      totalAmount REAL,
      title TEXT,
      type TEXT,
      deliveryMethod TEXT DEFAULT 'download',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
  } catch (e) {
      console.error("Fehler bei Datenbank-Migration (Invoices):", e);
  }

  console.log("Datenbank erfolgreich initialisiert.");

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
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  type: z.enum(['Athlet', 'Trainer']),
  gender: z.enum(['male', 'female', 'other']).default('other')
});

const SettingsSchema = z.record(z.string(), z.any());

const InvoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string(),
  recipientName: z.string(),
  date: z.string(),
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
    res.status(500).json({ error: 'Datenbankfehler beim Laden der Kontakte.' });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const validation = ContactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
    }
    const { id, firstName, lastName, address, zip, city, email, type, gender } = validation.data;
    const finalId = id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO contacts (id, firstName, lastName, address, zip, city, email, type, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(finalId, firstName, lastName, address || '', zip || '', city || '', email || '', type, gender);
    res.json({ success: true, id: finalId, ...validation.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const validation = ContactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
    }
    const { firstName, lastName, address, zip, city, email, type, gender } = validation.data;
    const stmt = db.prepare(`
      UPDATE contacts 
      SET firstName = ?, lastName = ?, address = ?, zip = ?, city = ?, email = ?, type = ?, gender = ?
      WHERE id = ?
    `);
    const info = stmt.run(firstName, lastName, address || '', zip || '', city || '', email || '', type, gender, id);
    if (info.changes === 0) return res.status(404).json({ error: "Kontakt nicht gefunden" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Kontakt nicht gefunden" });
    res.json({ success: true });
  } catch (error) {
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- INVOICES API (HISTORY) ---
app.get('/api/invoices', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM invoices ORDER BY date DESC, createdAt DESC');
        const rows = stmt.all();
        res.json(rows);
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
        const { id, invoiceNumber, recipientName, date, totalAmount, title, type, deliveryMethod } = validation.data;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO invoices (id, invoiceNumber, recipientName, date, totalAmount, title, type, deliveryMethod)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const finalId = id || crypto.randomUUID();
        stmt.run(finalId, invoiceNumber, recipientName, date, totalAmount, title, type, deliveryMethod);
        res.json({ success: true, id: finalId });
    } catch (error) {
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
        const { invoiceNumber, recipientName, date, totalAmount, title, type, deliveryMethod } = validation.data;
        const stmt = db.prepare(`
            UPDATE invoices 
            SET invoiceNumber = ?, recipientName = ?, date = ?, totalAmount = ?, title = ?, type = ?, deliveryMethod = ?
            WHERE id = ?
        `);
        const info = stmt.run(invoiceNumber, recipientName, date, totalAmount, title, type, deliveryMethod, id);
        if (info.changes === 0) return res.status(404).json({ error: "Rechnung nicht gefunden" });
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- EMAIL API ---
app.post('/api/email/send', async (req, res) => {
    try {
        const validation = EmailSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.message });
        }

        const { to, subject, text, filename, pdfBase64 } = validation.data;

        // FETCH SETTINGS DYNAMICALLY FROM DB
        const settings = getSettingsFromDb();
        const smtpHost = settings.smtpHost || process.env.SMTP_HOST;
        
        if (!smtpHost) {
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
        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error("Fehler beim Senden der E-Mail:", error);
        res.status(500).json({ error: "Fehler beim Senden der E-Mail. " + error.message });
    }
});

// --- SERVE FRONTEND ---
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

// --- GRACEFUL SHUTDOWN ---
const shutdown = () => {
    console.log('Fahre Server herunter...');
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

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));