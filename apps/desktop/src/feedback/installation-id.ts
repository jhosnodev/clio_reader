const STORAGE_KEY = 'clio-installation-id';

export function getInstallationId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
