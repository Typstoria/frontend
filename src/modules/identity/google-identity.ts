interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string; state?: string }) => void;
    auto_select: boolean;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: 'standard';
      theme: string;
      size: string;
      width: number;
      locale: string;
      text: string;
      state: string;
    },
  ): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let sdkPromise: Promise<GoogleIdentity> | null = null;
let initializedClientId: string | null = null;
const handlers = new Map<string, (credential: string) => void>();

function loadSdk(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google.accounts.id);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => fail(), 10_000);
    function fail() {
      clearTimeout(timeout);
      script.remove();
      sdkPromise = null;
      reject(new Error('Google Identity Services unavailable'));
    }
    script.src = 'https://accounts.google.com/gsi/client?hl=uk';
    script.async = true;
    script.referrerPolicy = import.meta.env.DEV
      ? 'no-referrer-when-downgrade'
      : 'strict-origin-when-cross-origin';
    script.onload = () => {
      clearTimeout(timeout);
      if (window.google) resolve(window.google.accounts.id);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return sdkPromise;
}

export async function renderGoogleButton(
  element: HTMLElement,
  clientId: string,
  handler: (credential: string) => void,
  isActive: () => boolean,
) {
  const sdk = await loadSdk();
  if (!isActive()) return () => {};
  if (!initializedClientId) {
    sdk.initialize({
      client_id: clientId,
      auto_select: false,
      callback: ({ credential, state }) => {
        if (state && typeof credential === 'string' && credential)
          handlers.get(state)?.(credential);
      },
    });
    initializedClientId = clientId;
  }
  if (initializedClientId !== clientId) throw new Error('Google Client ID changed');
  const state = crypto.randomUUID();
  handlers.set(state, handler);
  try {
    sdk.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: Math.max(200, Math.min(400, element.clientWidth)),
      locale: 'uk',
      text: 'continue_with',
      state,
    });
  } catch (error) {
    handlers.delete(state);
    throw error;
  }
  return () => {
    handlers.delete(state);
    element.replaceChildren();
  };
}

export function disableGoogleAutoSelect() {
  window.google?.accounts.id.disableAutoSelect();
}
