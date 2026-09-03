import type { ReaderPreferences, ReadingProgress } from '@clio-reader/domain';

export interface SessionRepository {
  getProgress(bookId: string): Promise<ReadingProgress | undefined>;
  saveProgress(progress: ReadingProgress): Promise<void>;
  getGlobalPreferences(): Promise<ReaderPreferences>;
  getBookPreferences(bookId: string): Promise<Partial<ReaderPreferences>>;
  saveBookPreferences(bookId: string, preferences: Partial<ReaderPreferences>): Promise<void>;
  saveGlobalPreferences(preferences: ReaderPreferences): Promise<void>;
}
