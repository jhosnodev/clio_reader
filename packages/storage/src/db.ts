import { drizzle as drizzleBetterSqlite3 } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleSqlJs } from 'drizzle-orm/sql-js';
import Database from 'better-sqlite3';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as schema from './schema';

export type BetterSqlite3Connection = ReturnType<typeof drizzleBetterSqlite3>;
export type SqlJsConnection = ReturnType<typeof drizzleSqlJs>;
export type DatabaseConnection = BetterSqlite3Connection | SqlJsConnection;

export function createDatabase(dbPath: string): BetterSqlite3Connection {
  const sqlite = new Database(dbPath);
  
  // Enable WAL mode for better performance
  sqlite.pragma('journal_mode = WAL');
  
  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');
  
  return drizzleBetterSqlite3(sqlite, { schema });
}

export async function createInMemoryDatabase(): Promise<{
  db: SqlJsConnection;
  rawDb: SqlJsDatabase;
  close: () => void;
}> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  
  // Enable foreign keys
  rawDb.run('PRAGMA foreign_keys = ON');
  
  const db = drizzleSqlJs(rawDb, { schema });
  
  return {
    db,
    rawDb,
    close: () => rawDb.close(),
  };
}
