import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ==================== BOOKS ====================
export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author'),
  format: text('format').notNull(), // 'epub' | 'pdf' | 'cbz' | 'md'
  uri: text('uri').notNull(),
  fileHash: text('file_hash'),
  addedAt: integer('added_at').notNull(),
  lastOpenedAt: integer('last_opened_at'),
  readingStatus: text('reading_status'), // 'unread' | 'opened' | 'reading'
  language: text('language'),
  status: text('status').notNull().default('available'), // 'available' | 'missing'
  rank: real('rank'),
  coverImage: text('cover_image'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at'),
});

// ==================== READING PROGRESS ====================
export const readingProgress = sqliteTable('reading_progress', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id, { onDelete: 'cascade' }),
  locatorFormat: text('locator_format').notNull(),
  locatorData: text('locator_data').notNull(),
  percent: real('percent').notNull().default(0),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

// ==================== READER PREFERENCES (GLOBAL) ====================
export const readerPreferences = sqliteTable('reader_preferences', {
  id: integer('id').primaryKey().default(1),
  theme: text('theme').notNull().default('light'),
  backgroundColor: text('background_color').notNull().default('#ffffff'),
  foregroundColor: text('foreground_color').notNull().default('#1f2937'),
  accentColor: text('accent_color').notNull().default('#2563eb'),
  fontFamily: text('font_family').notNull().default('system'),
  fontScale: real('font_scale').notNull().default(1),
  lineHeight: real('line_height').notNull().default(1.5),
  margin: text('margin').notNull().default('comfortable'),
  readingDirection: text('reading_direction').notNull().default('ltr'),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

// ==================== BOOK PREFERENCES (PER-BOOK OVERRIDE) ====================
export const bookPreferences = sqliteTable('book_preferences', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id, { onDelete: 'cascade' }),
  theme: text('theme'),
  backgroundColor: text('background_color'),
  foregroundColor: text('foreground_color'),
  accentColor: text('accent_color'),
  fontFamily: text('font_family'),
  fontScale: real('font_scale'),
  lineHeight: real('line_height'),
  margin: text('margin'),
  readingDirection: text('reading_direction'),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
});

// ==================== BOOKMARKS ====================
export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  locatorFormat: text('locator_format').notNull(),
  locatorData: text('locator_data').notNull(),
  label: text('label'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at'),
});

// ==================== NOTES ====================
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  locatorFormat: text('locator_format').notNull(),
  locatorData: text('locator_data').notNull(),
  selectedText: text('selected_text'),
  body: text('body').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at'),
});

// ==================== HIGHLIGHTS ====================
export const highlights = sqliteTable('highlights', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  locatorFormat: text('locator_format').notNull(),
  locatorStart: text('locator_start').notNull(),
  locatorEnd: text('locator_end').notNull(),
  selectedText: text('selected_text'),
  color: text('color').notNull().default('#ffff00'),
  style: text('style').notNull().default('highlight'), // 'highlight' | 'underline'
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at'),
});

// ==================== USER SETTINGS ====================
export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey().default(1),
  paletteId: text('palette_id').notNull().default('clio-3'),
  mode: text('mode').notNull().default('dark'), // 'dark' | 'light'
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch())`),
});
