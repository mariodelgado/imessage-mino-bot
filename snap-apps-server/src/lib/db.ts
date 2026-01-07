/**
 * Database layer for Renewable Fuels Monitor
 * Uses SQLite for persistent storage and delta tracking
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database file location
const DB_PATH = path.join(process.cwd(), "renewable-fuels.db");
const SCHEMA_PATH = path.join(process.cwd(), "src/lib/schema.sql");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initDatabase();
  }
  return db;
}

function initDatabase() {
  if (!db) return;

  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);

  // Seed sources if empty
  const count = db.prepare("SELECT COUNT(*) as count FROM sources").get() as { count: number };
  if (count.count === 0) {
    seedSources();
  }
}

function seedSources() {
  if (!db) return;

  const sources = [
    { id: "iscc", name: "ISCC (International Sustainability & Carbon Certification)", url: "https://www.iscc-system.org/certification/iscc-eu/", type: "certification", region: "EU" },
    { id: "eu-lex-red", name: "EUR-Lex: Renewable Energy Directive", url: "https://eur-lex.europa.eu/", type: "legislation", region: "EU" },
    { id: "eu-lex-biofuels", name: "EUR-Lex: Biofuels & Transport", url: "https://eur-lex.europa.eu/", type: "legislation", region: "EU" },
    { id: "eu-lex-sustainability", name: "EUR-Lex: Sustainability Criteria", url: "https://eur-lex.europa.eu/", type: "legislation", region: "EU" },
    { id: "sweden", name: "Swedish Energy Agency", url: "https://www.energimyndigheten.se/", type: "agency", region: "Sweden" },
    { id: "germany", name: "BMUV (German Environment Ministry)", url: "https://www.bmuv.de/", type: "agency", region: "Germany" },
    { id: "norway", name: "Norwegian Environment Agency", url: "https://www.miljodirektoratet.no/", type: "agency", region: "Norway" },
    { id: "netherlands", name: "NEa (Dutch Emissions Authority)", url: "https://www.emissieautoriteit.nl/", type: "agency", region: "Netherlands" },
    { id: "uk", name: "UK Department for Transport", url: "https://www.gov.uk/government/organisations/department-for-transport", type: "agency", region: "UK" },
  ];

  const insert = db.prepare("INSERT INTO sources (id, name, url, type, region) VALUES (?, ?, ?, ?, ?)");
  for (const s of sources) {
    insert.run(s.id, s.name, s.url, s.type, s.region);
  }
}

// Types
export interface ScrapedDocument {
  id: string;
  source_id: string;
  url: string;
  title: string;
  summary?: string;
  doc_type?: string;
  content_hash: string;
  metadata?: Record<string, unknown>;
}

export interface Delta {
  type: "new" | "changed" | "unchanged";
  document: ScrapedDocument;
  previous?: ScrapedDocument;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
  region: string;
}

// Document operations
export function upsertDocument(doc: ScrapedDocument): Delta {
  const db = getDb();

  const existing = db.prepare("SELECT * FROM documents WHERE url = ?").get(doc.url) as ScrapedDocument | undefined;

  if (!existing) {
    // NEW document
    db.prepare(`
      INSERT INTO documents (id, source_id, url, title, summary, doc_type, content_hash, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(doc.id, doc.source_id, doc.url, doc.title, doc.summary || null, doc.doc_type || null, doc.content_hash, JSON.stringify(doc.metadata || {}));

    // Save initial version
    db.prepare(`
      INSERT INTO document_versions (document_id, content_hash, summary)
      VALUES (?, ?, ?)
    `).run(doc.id, doc.content_hash, doc.summary || null);

    return { type: "new", document: doc };
  }

  if (existing.content_hash !== doc.content_hash) {
    // CHANGED document
    db.prepare(`
      UPDATE documents
      SET content_hash = ?, summary = ?, last_changed_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(doc.content_hash, doc.summary || null, existing.id);

    // Save new version
    db.prepare(`
      INSERT INTO document_versions (document_id, content_hash, summary)
      VALUES (?, ?, ?)
    `).run(existing.id, doc.content_hash, doc.summary || null);

    return { type: "changed", document: doc, previous: existing };
  }

  // UNCHANGED - just update last_seen
  db.prepare("UPDATE documents SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(existing.id);
  return { type: "unchanged", document: doc };
}

export function markRemovedDocuments(sourceId: string, currentUrls: string[]): number {
  const db = getDb();

  if (currentUrls.length === 0) return 0;

  const placeholders = currentUrls.map(() => "?").join(",");
  const result = db.prepare(`
    UPDATE documents SET status = 'removed'
    WHERE source_id = ? AND url NOT IN (${placeholders}) AND status = 'active'
  `).run(sourceId, ...currentUrls);

  return result.changes;
}

export function logScrape(
  sourceId: string,
  found: number,
  newCount: number,
  changed: number,
  removed: number,
  duration: number,
  status: string,
  error?: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO scrape_logs (source_id, documents_found, documents_new, documents_changed, documents_removed, duration_ms, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sourceId, found, newCount, changed, removed, duration, status, error || null);
}

// Query helpers
export function getSources(): Source[] {
  return getDb().prepare("SELECT * FROM sources").all() as Source[];
}

export function getSource(id: string): Source | undefined {
  return getDb().prepare("SELECT * FROM sources WHERE id = ?").get(id) as Source | undefined;
}

export function getDocumentCount(): number {
  const result = getDb().prepare("SELECT COUNT(*) as count FROM documents WHERE status = 'active'").get() as { count: number };
  return result.count;
}

export function getLastScrapeTime(): string | null {
  const result = getDb().prepare("SELECT MAX(scraped_at) as last FROM scrape_logs").get() as { last: string | null };
  return result.last;
}
