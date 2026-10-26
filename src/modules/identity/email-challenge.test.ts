import { describe, expect, it, vi } from 'vitest';
import { safeReturnTo, takeEmailChallenge } from './email-challenge';

describe('email challenge and return destination', () => {
  it('takes the token once and strips the fragment while preserving history state', () => {
    const token = 'a'.repeat(43);
    const location = { pathname: '/auth/verify-email', search: '', hash: `#token=${token}` };
    const history = { state: { position: 1 }, replaceState: vi.fn() };
    expect(takeEmailChallenge(location, history)).toBe(token);
    expect(history.replaceState).toHaveBeenCalledWith(history.state, '', '/auth/verify-email');
  });
  it('strips malformed fragments and rejects open redirects or credential URLs', () => {
    const history = { state: null, replaceState: vi.fn() };
    expect(
      takeEmailChallenge(
        { pathname: '/auth/reset-password', search: '', hash: '#token=bad' },
        history,
      ),
    ).toBeNull();
    for (const value of [
      'https://example.com',
      '//example.com',
      '/projects#token=secret',
      '/settings/account?token=secret',
      undefined,
    ])
      expect(safeReturnTo(value)).toBe('/projects');
    expect(safeReturnTo('/settings/account')).toBe('/settings/account');
  });
});
