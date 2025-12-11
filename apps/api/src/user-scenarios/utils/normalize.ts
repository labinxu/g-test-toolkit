export function sanitizeName(value: string | null | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'default';
  return (
    trimmed.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') ||
    'default'
  );
}

export function normalizePlatform(value?: string | null): string {
  const raw = (value || '').toString().trim().toLowerCase();
  return raw || 'gettr-web';
}

export function normalizeModule(value?: string | null): string {
  const raw = (value || '').toString().trim();
  if (!raw) return 'livestream';
  // 仅保留字母和数字
  const cleaned = raw.replace(/[^A-Za-z0-9]+/g, '');
  return cleaned || 'livestream';
}

export function parseSharedPreSteps(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function serializeSharedPreSteps(items?: string[] | null): string | null {
  if (!items || !items.length) return null;
  const normalized = items
    .map((s) => (s || '').toString().trim())
    .filter((s) => s.length > 0);
  if (!normalized.length) return null;
  return JSON.stringify(normalized);
}

export function getModuleNameForPlatform(
  platform: string | null | undefined,
): string {
  const key = normalizePlatform(platform);
  switch (key) {
    case 'gettr-web':
      return 'gettr-web-lib';
    case 'gettr-android':
      return 'gettr-android-lib';
    case 'gettr-mobile-web':
      return 'gettr-mobile-web-lib';
    case 'gettr-ios':
      return 'gettr-ios-lib';
    default:
      return `${key}-lib`;
  }
}
