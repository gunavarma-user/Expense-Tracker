import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Ensure data folder exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_PATH 
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(DATA_DIR, 'expense_analyzer.db');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for high performance & concurrency
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = ON;`);

/**
 * Run safe schema migrations.
 * Never drops tables or loses existing user data.
 */
export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      email_verified INTEGER DEFAULT 0,
      phone TEXT UNIQUE,
      phone_verified INTEGER DEFAULT 0,
      savings_password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      savings_unlocked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otps (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      purpose TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      attempts_left INTEGER DEFAULT 3,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      verified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      notes TEXT,
      is_sample INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS savings_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      last_attempt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_stx_user_date ON savings_transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_otps_target ON otps(target, purpose);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
  `);
}

// Initialize tables immediately on load
initializeDatabase();

/**
 * Type-safe query helpers for Node 22 DatabaseSync
 */
export function queryOne<T = any>(sql: string, ...params: any[]): T | undefined {
  return (db.prepare(sql) as any).get(...params) as T | undefined;
}

export function queryAll<T = any>(sql: string, ...params: any[]): T[] {
  return (db.prepare(sql) as any).all(...params) as T[];
}

export function execute(sql: string, ...params: any[]): any {
  return (db.prepare(sql) as any).run(...params);
}

/**
 * Creates a physical backup copy of the SQLite database.
 */
export function backupDatabase(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `expense_analyzer_backup_${timestamp}.db`;
  const backupFilePath = path.join(DATA_DIR, backupFileName);
  
  // Create safe checkpoint and copy file
  db.exec(`PRAGMA wal_checkpoint(TRUNCATE);`);
  fs.copyFileSync(DB_PATH, backupFilePath);
  
  return backupFilePath;
}
