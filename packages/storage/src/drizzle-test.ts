import * as schema from './schema.js';
import { drizzle as drizzleSqlJs } from 'drizzle-orm/sql-js';

export type SqlJsConnection = ReturnType<typeof drizzleSqlJs>;
export type DatabaseConnection = SqlJsConnection;

export async function createInMemoryDatabase(): Promise<{
  db: SqlJsConnection;
  rawDb: import('sql.js').Database;
  close: () => void;
}> {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  rawDb.run('PRAGMA foreign_keys = ON');

  const db = drizzleSqlJs(rawDb, { schema });

  return {
    db,
    rawDb,
    close: () => rawDb.close(),
  };
}
