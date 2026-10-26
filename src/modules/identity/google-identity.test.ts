import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Response = { credential: string; state?: string };

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function sdkFixture() {
  let respond: (response: Response) => void = () => {};
  const states: string[] = [];
  const sdk = {
    initialize: vi.fn((options: { callback: (response: Response) => void }) => {
      respond = options.callback;
    }),
    renderButton: vi.fn((_element: HTMLElement, options: { state: string }) => {
      states.push(options.state);
    }),
    disableAutoSelect: vi.fn(),
  };
  vi.stubGlobal('window', { google: { accounts: { id: sdk } } });
  const element = { clientWidth: 300, replaceChildren: vi.fn() } as unknown as HTMLElement;
  return { sdk, states, element, respond: (response: Response) => respond(response) };
}

describe('Google button intent', () => {
  it('does not route a late sign-in result into a different linking button', async () => {
    const fixture = sdkFixture();
    const { renderGoogleButton } = await import('./google-identity');
    const login = vi.fn();
    const link = vi.fn();
    const disposeLogin = await renderGoogleButton(
      fixture.element,
      'test-client',
      login,
      () => true,
    );
    const first = fixture.states[0]!;
    disposeLogin();
    const disposeLink = await renderGoogleButton(fixture.element, 'test-client', link, () => true);
    const second = fixture.states[1]!;
    expect(first).not.toBe(second);
    fixture.respond({ credential: 'old-login-credential', state: first });
    fixture.respond({ credential: 'unidentified-credential' });
    expect(login).not.toHaveBeenCalled();
    expect(link).not.toHaveBeenCalled();
    fixture.respond({ credential: 'explicit-link-credential', state: second });
    expect(link).toHaveBeenCalledWith('explicit-link-credential');
    expect(fixture.sdk.initialize).toHaveBeenCalledTimes(1);
    disposeLink();
    fixture.respond({ credential: 'late-link-credential', state: second });
    expect(link).toHaveBeenCalledTimes(1);
  });

  it('does not render or register a button after its screen has closed', async () => {
    const fixture = sdkFixture();
    const { renderGoogleButton } = await import('./google-identity');
    await renderGoogleButton(fixture.element, 'test-client', vi.fn(), () => false);
    expect(fixture.sdk.initialize).not.toHaveBeenCalled();
    expect(fixture.sdk.renderButton).not.toHaveBeenCalled();
  });
});
