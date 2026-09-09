export type { FilterOptions, SortField, SortOrder, SortOptions } from './annotation-filter.js';
export type { AnnotationExportData } from './annotation-export.js';
export type { CreateBookmarkOptions, ListBookmarksOptions } from './bookmark-manager.js';
export type { CreateNoteOptions, ListNotesOptions } from './note-manager.js';

export {
  AnnotationValidationError,
  AnnotationNotFoundError,
  DuplicateLocatorError,
} from './errors.js';

export {
  validateBookmarkInput,
  validateBookmark,
  validateNoteInput,
  validateNote,
  validateBookmarkForExport,
  validateNoteForExport,
  throwIfInvalid,
} from './annotation-validator.js';

export {
  filterByDateRange,
  sortByDate,
  sortByPosition,
  sortByLabel,
  applyFilter,
  applySort,
} from './annotation-filter.js';

export {
  createBookmarkManaged,
  listBookmarksManaged,
  removeBookmarkManaged,
  getBookmarkById,
  hasBookmarkAtLocator,
  locatorsEqual,
} from './bookmark-manager.js';

export {
  createNoteManaged,
  listNotesManaged,
  updateNoteManaged,
  removeNoteManaged,
  searchNotes,
  hasNoteAtLocator,
} from './note-manager.js';

export { exportAnnotations, importAnnotations } from './annotation-export.js';
