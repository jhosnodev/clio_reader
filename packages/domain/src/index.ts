export type BookFormat = 'epub' | 'pdf' | 'cbz' | 'md';

export interface Book {
  readonly id: string;
  readonly title: string;
  readonly format: BookFormat;
  readonly uri: string;
  readonly addedAt: number;
}

export function createBook(input: Omit<Book, 'addedAt'> & { addedAt?: number }): Book {
  return {
    ...input,
    addedAt: input.addedAt ?? Date.now(),
  };
}
