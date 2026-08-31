export class AnnotationValidationError extends Error {
  readonly field: string | undefined;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AnnotationValidationError';
    this.field = field;
  }
}

export class AnnotationNotFoundError extends Error {
  constructor(id: string) {
    super(`Annotation not found: ${id}`);
    this.name = 'AnnotationNotFoundError';
  }
}

export class DuplicateLocatorError extends Error {
  constructor(locator: string) {
    super(`Annotation already exists at locator: ${locator}`);
    this.name = 'DuplicateLocatorError';
  }
}