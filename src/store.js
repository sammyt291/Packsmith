const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const defaults = { accounts: [], selectedAccountId: null, instances: [] };

class SqliteStore {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS credentials (account_id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, fetched_at INTEGER NOT NULL, value TEXT NOT NULL)');
    this.data = this.get('application', defaults);
  }
  get(key, fallback) { const row = this.db.prepare('SELECT value FROM state WHERE key=?').get(key); try { return row ? JSON.parse(row.value) : structuredClone(fallback); } catch { return structuredClone(fallback); } }
  save(next = this.data) { this.data = next; this.db.prepare('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('application', JSON.stringify(next)); return next; }
  setCredentials(id, value) { this.db.prepare('INSERT INTO credentials(account_id,value) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET value=excluded.value').run(id, JSON.stringify(value)); }
  credentials(id) { const row = this.db.prepare('SELECT value FROM credentials WHERE account_id=?').get(id); return row && JSON.parse(row.value); }
  cached(key, maxAge = 3600000) { const row = this.db.prepare('SELECT fetched_at,value FROM cache WHERE key=?').get(key); return row && Date.now() - row.fetched_at < maxAge ? JSON.parse(row.value) : null; }
  cache(key, value) { this.db.prepare('INSERT INTO cache(key,fetched_at,value) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET fetched_at=excluded.fetched_at,value=excluded.value').run(key, Date.now(), JSON.stringify(value)); return value; }
}

// Kept as an alias for integrations built against the initial API.
module.exports = { SqliteStore, JsonStore: SqliteStore, defaults };
