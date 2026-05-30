import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const dbPath = process.env.DATABASE_URL || 'verdict.db';
  const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(__dirname, '..', dbPath);

  logger.info(`Connecting to SQLite database at: ${resolvedPath}`);

  try {
    db = await open({
      filename: resolvedPath,
      driver: sqlite3.Database,
    });

    // Enable foreign keys
    await db.get('PRAGMA foreign_keys = ON');

    // Initialize tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS verdict_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        verdict TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        evidence TEXT NOT NULL,
        conflicts TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS source_reliability (
        source_name TEXT PRIMARY KEY,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        avg_latency_ms INTEGER DEFAULT 0
      );
    `);

    logger.success('Database initialized successfully with verdict_cache and source_reliability tables');
    return db;
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}
