import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const token = 'a'.repeat(43);
const loginResponse = () => ({
  user,
  accessToken: '1.browser-test-secret',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
});

test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google={accounts:{id:{initialize(options){this.callback=options.callback},renderButton(element,options){const button=document.createElement('button');button.textContent='Продовжити через Google';button.type='button';button.onclick=()=>this.callback({credential:'signed-google-test-token',state:options.state});element.append(button)},disableAutoSelect(){}}}};`,
    }),
  );
});

async function signIn(page: Page) {
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: loginResponse() }));
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
}

test('protects private routes, signs in without persistence, and requires login after reload', async ({
  page,
}) => {
  await page.goto('/settings/account');
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
  await signIn(page);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await page.context().cookies()).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
});

test('handles login errors, email verification guidance and resend cooldown', async ({ page }) => {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: 'EMAIL_NOT_VERIFIED', requestId: 'request-123', message: 'Unverified' },
      },
    }),
  );
  let resends = 0;
  await page.route('**/api/auth/resend-verification', (route) => {
    resends++;
    return route.fulfill({ status: 202, json: { message: 'Accepted' } });
  });
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Підтвердьте електронну пошту');
  await page.getByRole('button', { name: 'Надіслати лист підтвердження' }).click();
  await page.getByRole('button', { name: 'Надіслати нове посилання' }).click();
  await expect(page.getByRole('button', { name: 'Надіслати нове посилання' })).toBeDisabled();
  expect(resends).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('registers with the actual password policy and generic response', async ({ page }) => {
  let body: unknown;
  await page.route('**/api/auth/register', (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: { message: 'Accepted' } });
  });
  await page.goto('/auth/register');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill(' abcd ');
  await page.getByRole('button', { name: 'Зареєструватися', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Якщо адреса доступна' })).toBeVisible();
  expect(body).toEqual({ email: user.email, password: ' abcd ' });
  await expect(page.getByRole('button', { name: 'Надіслати нове посилання' })).toBeDisabled();
});

test('removes a verification token without consuming it before explicit confirmation', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/auth/verify-email', (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ token });
    return route.fulfill({ json: { message: 'Confirmed' } });
  });
  await page.goto(`/auth/verify-email#token=${token}`);
  await expect(page).toHaveURL(/\/auth\/verify-email$/);
  await expect(page.getByRole('button', { name: 'Підтвердити пошту', exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Підтвердити пошту', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Пошту підтверджено' })).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole('link', { name: 'Перейти до входу' }).click();
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
});

test('resets password without logging in and recovers an invalid challenge', async ({ page }) => {
  await page.route('**/api/auth/reset-password', (route) =>
    route.fulfill({ json: { message: 'Changed' } }),
  );
  await page.goto(`/auth/reset-password#token=${token}`);
  await expect(page).toHaveURL(/\/auth\/reset-password$/);
  await page.getByLabel('Новий пароль', { exact: true }).fill('new-password');
  await page.getByRole('button', { name: 'Зберегти пароль' }).click();
  await expect(page.getByRole('heading', { name: 'Пароль змінено' })).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
  await page.route('**/api/auth/verify-email', (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Invalid', requestId: 'challenge-1' },
      },
    }),
  );
  await page.goto(`/auth/verify-email#token=${token}`);
  await page.getByRole('button', { name: 'Підтвердити пошту', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Посилання недійсне');
  await expect(page.getByLabel('Електронна пошта', { exact: true })).toBeVisible();
});

test('requests password recovery with a generic response and cooldown', async ({ page }) => {
  await page.route('**/api/auth/forgot-password', (route) =>
    route.fulfill({ status: 202, json: { message: 'Accepted' } }),
  );
  await page.goto('/auth/forgot-password');
  await page.getByLabel('Електронна пошта', { exact: true }).fill('unknown@example.com');
  await page.getByRole('button', { name: 'Надіслати посилання', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Якщо для цієї адреси' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Надіслати посилання', exact: true }),
  ).toBeDisabled();
});

test('refreshes profile with Bearer and explicitly links Google', async ({ page }) => {
  let linked = false;
  await page.route('**/api/auth/me', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer 1.browser-test-secret');
    return route.fulfill({ json: user });
  });
  await page.route('**/api/auth/google/link', (route) => {
    linked = true;
    expect(route.request().headers().authorization).toBe('Bearer 1.browser-test-secret');
    expect(route.request().postDataJSON()).toEqual({ idToken: 'signed-google-test-token' });
    return route.fulfill({ json: { message: 'Linked' } });
  });
  await signIn(page);
  await page.getByRole('link', { name: `Обліковий запис: ${user.email}` }).click();
  await expect(page.getByRole('heading', { name: 'Обліковий запис', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Продовжити через Google' }).click();
  await expect(page.getByRole('status')).toContainText('Google-акаунт прив’язано');
  expect(linked).toBe(true);
});

test('Google sign-in handles linking conflicts without auto-linking', async ({ page }) => {
  await page.route('**/api/auth/google', (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
          requestId: 'google-1',
          message: 'Link required',
        },
      },
    }),
  );
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Продовжити через Google' }).click();
  await expect(page.getByRole('alert')).toContainText('Увійдіть з паролем');
  await page.route('**/api/auth/google', (route) => route.fulfill({ json: loginResponse() }));
  await page.getByRole('button', { name: 'Продовжити через Google' }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
});

test('handles private 401 and an incomplete logout without leaking the session', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHENTICATED', requestId: 'me-1', message: 'Expired' } },
    }),
  );
  await signIn(page);
  await page.getByRole('link', { name: `Обліковий запис: ${user.email}` }).click();
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
  await signIn(page);
  await page.route('**/api/auth/logout', (route) => route.abort());
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося підтвердити вихід');
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
});

test('keeps auth screens responsive and supports keyboard and password visibility', async ({
  page,
}, testInfo) => {
  for (const path of [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/verify-email',
    '/auth/reset-password',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('/auth/login');
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Показати пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Приховати пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByLabel('Електронна пошта', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Пароль', { exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('auth.png'), fullPage: true });
});

test('keeps the document previews public and shows a missing-route page', async ({ page }) => {
  await page.goto('/preview/workspace');
  await page.getByRole('button', { name: 'Перегляд PDF', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Основні компоненти' })).toBeVisible();
  await page.getByRole('link', { name: 'ШІ-пропозиції', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Прийняти пропозицію' })).toBeDisabled();
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeVisible();
});

test('successfully revokes logout with 204 and redirects when the session expires', async ({
  page,
}) => {
  let revoked = false;
  await page.route('**/api/auth/logout', (route) => {
    revoked = route.request().headers().authorization === 'Bearer 1.browser-test-secret';
    return route.fulfill({ status: 204 });
  });
  await signIn(page);
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
  expect(revoked).toBe(true);
  await page.clock.install();
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      json: { ...loginResponse(), expiresAt: new Date(Date.now() + 1000).toISOString() },
    }),
  );
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
  await page.clock.fastForward(2000);
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
});

test('can return from email resend to password login during cooldown', async ({ page }) => {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: 'EMAIL_NOT_VERIFIED', message: 'Unverified' } },
    }),
  );
  await page.route('**/api/auth/resend-verification', (route) =>
    route.fulfill({ status: 202, json: { message: 'Accepted' } }),
  );
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await page.getByRole('button', { name: 'Надіслати лист підтвердження' }).click();
  await page.getByRole('button', { name: 'Надіслати нове посилання' }).click();
  await expect(page.getByRole('button', { name: 'Надіслати нове посилання' })).toBeDisabled();
  await page.getByRole('button', { name: 'Повернутися до входу' }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Увійти', exact: true })).toBeEnabled();
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: loginResponse() }));
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
});

test('checks server revocation when returning to the tab', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHENTICATED', message: 'Revoked' } },
    }),
  );
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
});

test('sends the localhost referrer required by Google Identity Services', async ({ page }) => {
  const sdkRequest = page.waitForRequest((request) =>
    request.url().startsWith('https://accounts.google.com/gsi/client'),
  );
  await page.goto('/auth/login');
  const request = await sdkRequest;
  expect(new URL(request.headers().referer!).origin).toBe('http://localhost:5174');
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
    'content',
    'no-referrer-when-downgrade',
  );
});
