export const SHARED_TEMPLATE_PATH = '/templates/shared';

export function shareToken(fragment: string) {
  const token = fragment.slice(1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
