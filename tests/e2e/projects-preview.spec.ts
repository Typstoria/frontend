import { expect, test } from '@playwright/test';

const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const version = 'd'.repeat(64);
const project = (id: number) => ({
  id,
  title: `Проєкт ${id}`,
  currentRevisionId: id + 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-11-12T10:30:00Z',
  preview: { revisionId: id + 100, version },
});

test('loads private previews on demand and keeps blank pages when unavailable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};',
    }),
  );
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      json: {
        user,
        accessToken: '1.project-test-secret',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    }),
  );
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  const cards = [project(20), project(10)];
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: cards, nextCursor: null } }),
  );
  const nextVersion = 'e'.repeat(64);
  await page.route('**/api/projects/20', (route) =>
    route.fulfill({
      json: {
        ...project(20),
        title: 'Оновлений проєкт',
        preview: { revisionId: 120, version: nextVersion },
      },
    }),
  );
  let previewCalls = 0;
  await page.route('**/api/projects/*/preview?*', (route) => {
    previewCalls++;
    expect(route.request().headers().authorization).toBe('Bearer 1.project-test-secret');
    const requestedVersion = new URL(route.request().url()).searchParams.get('version');
    expect([version, nextVersion]).toContain(requestedVersion);
    if (route.request().url().includes('/projects/20/') && requestedVersion === version)
      return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUioAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });

  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  const cardsLocator = page.locator('.project-card');
  await expect(cardsLocator).toHaveCount(2);
  await expect.poll(() => previewCalls).toBe(2);
  await expect(page.locator('.project-preview')).toHaveCount(2);
  await expect(page.locator('.project-preview img')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('NOT_FOUND');

  const bounds = await Promise.all([
    cardsLocator.nth(0).boundingBox(),
    cardsLocator.nth(1).boundingBox(),
  ]);
  expect(bounds[0]).not.toBeNull();
  expect(bounds[1]).not.toBeNull();
  expect(Math.abs(bounds[0]!.y - bounds[1]!.y)).toBeLessThan(2);
  await cardsLocator.nth(0).getByRole('button', { name: 'Дії: Проєкт 20' }).click();
  await page.getByRole('button', { name: 'Перейменувати', exact: true }).click();
  await page.getByLabel('Назва', { exact: true }).fill('Оновлений проєкт');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.locator('.project-preview img')).toHaveCount(2);
  await expect.poll(() => previewCalls).toBe(3);
  await cardsLocator
    .nth(0)
    .getByRole('link', { name: /Оновлений проєкт/ })
    .click();
  await expect(page).toHaveURL(/\/projects\/20$/);
});
