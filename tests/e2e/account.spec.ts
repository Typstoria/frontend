import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
const user = {
  id: 1,
  name: 'Нестор',
  email: 'writer@example.com',
  emailVerified: true,
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const token = 'd'.repeat(43);
async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('original');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await page.getByRole('link', { name: 'Обліковий запис', exact: true }).click();
  await expect(page.getByText('Підтверджено', { exact: true })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};',
    }),
  );
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      json: {
        user,
        accessToken: '1.account-test',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  );
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
});

test('edits a name and prevents clearing, preserves input on failure, and leaves email read-only', async ({
  page,
}) => {
  let profile = { ...user } as Omit<typeof user, 'name'> & { name: string | null };
  let fail = true;
  await page.route('**/api/auth/me', (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().headers().authorization).toBe('Bearer 1.account-test');
      expect(Object.keys(route.request().postDataJSON())).toEqual(['name']);
      if (fail)
        return route.fulfill({
          status: 503,
          json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'private' } },
        });
      profile = { ...profile, name: route.request().postDataJSON().name };
    }
    return route.fulfill({ json: profile });
  });
  await signIn(page);
  await page.getByRole('button', { name: 'Редагувати ім’я', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ім’я', exact: true }).fill('  Оновлене ім’я 📝  ');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ім’я', exact: true })).toHaveValue(
    '  Оновлене ім’я 📝  ',
  );
  await expect(page).toHaveURL(/settings\/account$/);
  fail = false;
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Оновлене ім’я 📝', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Редагувати ім’я', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ім’я', exact: true }).fill('');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('від 1 до 80');
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Оновлене ім’я 📝', { exact: true })).toBeVisible();
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
});

test('keeps the session for wrong current password or network failure and ends it after a successful change', async ({
  page,
}) => {
  let attempt = 0;
  await page.route('**/api/auth/change-password', (route) => {
    attempt++;
    expect(route.request().postDataJSON()).toEqual({
      currentPassword: 'oldpass',
      newPassword: ' newpass ',
    });
    if (attempt === 1)
      return route.fulfill({
        status: 400,
        json: { error: { code: 'CURRENT_PASSWORD_INVALID', message: 'private' } },
      });
    if (attempt === 2) return route.abort();
    return route.fulfill({ status: 204 });
  });
  await signIn(page);
  await page.getByRole('button', { name: 'Змінити пароль', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByLabel('Поточний пароль', { exact: true }).fill('oldpass');
    await page.getByLabel('Новий пароль', { exact: true }).fill(' newpass ');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Змінити пароль', exact: true })
      .click();
    if (i < 2) {
      await expect(page.getByRole('alert')).toContainText(
        i === 0 ? 'Поточний пароль неправильний' : 'Не вдалося з’єднатися',
      );
      await expect(page).toHaveURL(/settings\/account$/);
      await expect(page.getByLabel('Поточний пароль', { exact: true })).toHaveValue('');
    }
  }
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
  await expect(
    page.getByText('Пароль змінено. Увійдіть з новим паролем.', { exact: true }),
  ).toBeVisible();
});

test('hides password actions on passwordless accounts and requests deletion only explicitly', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { ...user, hasPassword: false } }),
  );
  await page.route('**/api/auth/request-account-deletion', (route) => {
    requests++;
    return route.fulfill({ status: 202, json: { message: 'Accepted' } });
  });
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Змінити пароль', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Видалити акаунт', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(user.email);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Видалити акаунт', exact: true }).click();
  await page.getByRole('button', { name: 'Надіслати посилання', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Запит прийнято');
  await expect(page.getByRole('button', { name: 'Видалити акаунт', exact: true })).toBeDisabled();
  expect(requests).toBe(1);
});

test('scrubs the deletion token and requires a checkbox and explicit POST before deleting', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/auth/delete-account', (route) => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ token });
    return route.fulfill({ status: 204 });
  });
  await signIn(page);
  await page.goto(`/auth/delete-account#token=${token}`);
  await expect(page).toHaveURL(/auth\/delete-account$/);
  await expect(page.getByRole('button', { name: 'Видалити акаунт назавжди' })).toBeDisabled();
  expect(requests).toBe(0);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Видалити акаунт назавжди' }).click();
  await expect(page.getByRole('status')).toContainText('Акаунт і його проєкти видалено');
  expect(requests).toBe(1);
});

test('recovers an expired deletion link and keeps a network failure retryable', async ({
  page,
}) => {
  await page.goto('/auth/delete-account');
  await expect(page.getByRole('alert')).toContainText('Посилання недійсне');
  await page.route('**/api/auth/delete-account', (route) => route.abort());
  await page.goto(`/auth/delete-account#token=${token}`);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Видалити акаунт назавжди' }).click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося з’єднатися');
  await page.route('**/api/auth/delete-account', (route) =>
    route.fulfill({
      status: 400,
      json: { error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'private' } },
    }),
  );
  await page.getByRole('button', { name: 'Видалити акаунт назавжди' }).click();
  await expect(page.getByRole('alert')).toContainText('Посилання недійсне');
  await expect(page.getByRole('button', { name: 'Видалити акаунт назавжди' })).toHaveCount(0);
});

test('animates dialog entry and exit, restores focus, and respects reduced motion', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Редагувати ім’я', exact: true }).click();
  await expect(page.locator('.modal-enter-active')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('name-dialog.png'), fullPage: true });
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Редагувати ім’я', exact: true })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Редагувати ім’я', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
