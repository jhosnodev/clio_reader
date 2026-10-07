import type { Bookmark, Note, ReaderLocator } from '@clio-reader/domain';

type Annotation = Bookmark | Note;

export interface FilterOptions {
  readonly dateRange?: {
    readonly start?: number;
    readonly end?: number;
  };
}

export type SortField = 'date' | 'position' | 'label';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  readonly field: SortField;
  readonly order?: SortOrder;
}

function getProgression(locator: ReaderLocator): number {
  if ('progression' in locator && locator.progression !== undefined) {
    return locator.progression;
  }
  if ('positionOrder' in locator && locator.positionOrder !== undefined) {
    return locator.positionOrder;
  }
  if ('page' in locator && locator.page !== undefined) {
    return locator.page;
  }
  return 0;
}

function getAnnotationDate(annotation: Annotation): number {
  return annotation.createdAt;
}

export function filterByDateRange<T extends Annotation>(
  annotations: readonly T[],
  start?: number,
  end?: number,
): readonly T[] {
  return annotations.filter((annotation) => {
    const date = annotation.createdAt;
    if (start !== undefined && date < start) return false;
    if (end !== undefined && date > end) return false;
    return true;
  });
}

export function sortByDate<T extends Annotation>(
  annotations: readonly T[],
  order: SortOrder = 'asc',
): readonly T[] {
  return [...annotations].sort((a, b) => {
    const cmp = getAnnotationDate(a) - getAnnotationDate(b);
    return order === 'asc' ? cmp : -cmp;
  });
}

export function sortByPosition<T extends Annotation>(annotations: readonly T[]): readonly T[] {
  return [...annotations].sort((a, b) => {
    const aPos = getProgression(a.locator);
    const bPos = getProgression(b.locator);
    return aPos - bPos;
  });
}

export function sortByLabel(annotations: readonly Bookmark[]): readonly Bookmark[] {
  return [...annotations].sort((a, b) => {
    const aLabel = a.label;
    const bLabel = b.label;
    if (aLabel === undefined && bLabel === undefined) return 0;
    if (aLabel === undefined) return 1;
    if (bLabel === undefined) return -1;
    return aLabel.toLowerCase().localeCompare(bLabel.toLowerCase());
  });
}

export function applyFilter<T extends Annotation>(
  annotations: readonly T[],
  filter?: FilterOptions,
): readonly T[] {
  if (!filter) return annotations;
  if (!filter.dateRange) return annotations;

  return filterByDateRange(annotations, filter.dateRange.start, filter.dateRange.end);
}

export function applySort<T extends Annotation>(
  annotations: readonly T[],
  sort?: SortOptions,
): readonly T[] {
  if (!sort) return annotations;

  switch (sort.field) {
    case 'date':
      return sortByDate(annotations, sort.order);
    case 'position':
      return sortByPosition(annotations);
    case 'label': {
      const sorted = sortByLabel(annotations as unknown as Bookmark[]);
      return sorted as unknown as T[];
    }
    default:
      return annotations;
  }
}
