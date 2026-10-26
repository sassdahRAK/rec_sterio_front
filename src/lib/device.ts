/**
 * A stable, random per-browser identifier. Passcodes can cap the number of
 * devices that redeem them, so the API needs something to count; this is a
 * local UUID, not a fingerprint.
 */
const DEVICE_STORAGE_KEY = 'recsterio.device_key';

export function deviceKey(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'device-unknown';
  }
}
