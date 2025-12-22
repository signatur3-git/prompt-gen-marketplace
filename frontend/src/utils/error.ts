export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  // Some libraries throw arbitrary objects.
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
