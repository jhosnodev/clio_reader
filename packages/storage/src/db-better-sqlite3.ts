import { drizzle as drizzleBetterSqlite3 } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';

export type BetterSqlite3Connection = ReturnType<typeof drizzleBetterSqlite3>;

export function createDatabase(dbPath: string): BetterSqlite3Connection {
  const sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzleBetterSqlite3(sqlite, { schema });
}
