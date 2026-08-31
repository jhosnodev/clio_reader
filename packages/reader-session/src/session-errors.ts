export class SessionNotOpenError extends Error {
  constructor() {
    super('No book is currently open');
    this.name = 'SessionNotOpenError';
  }
}

export class SessionAlreadyOpenError extends Error {
  constructor() {
    super('A book is already open. Close the current session first.');
    this.name = 'SessionAlreadyOpenError';
  }
}

export class SessionClosedError extends Error {
  constructor() {
    super('Session has been closed');
    this.name = 'SessionClosedError';
  }
}

export class ProgressSaveError extends Error {
  constructor(bookId: string, cause?: unknown) {
    super(`Failed to save progress for book ${bookId}`);
    this.name = 'ProgressSaveError';
    this.cause = cause;
  }
}
