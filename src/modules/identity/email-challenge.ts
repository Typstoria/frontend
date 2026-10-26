export function takeEmailChallenge(
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  history: Pick<History, 'replaceState' | 'state'>,
): string | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('token');
  if (location.hash)
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function safeReturnTo(value: unknown): string {
  // Only known private destinations. Never forward credentials, fragments or external URLs.
  return value === '/settings/account' ? value : '/projects';
}

let pending: { path: string; token: string | null } | null = null;

export function captureInitialChallenge() {
  if (['/auth/verify-email', '/auth/reset-password'].includes(window.location.pathname)) {
    pending = {
      path: window.location.pathname,
      token: takeEmailChallenge(window.location, window.history),
    };
  }
}

export function consumeChallenge(path: string): string | null {
  const token = pending?.path === path ? pending.token : null;
  pending = null;
  return token;
}
