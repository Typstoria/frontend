import { expect, test } from '@playwright/test';

test('navigates through the scaffold without calling the backend', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
  await page.getByRole('link', { name: /Переглянути макет редактора/ }).click();
  await expect(page.getByRole('heading', { name: 'Архітектура системи', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Файли −' }).click();
  await expect(page.getByRole('complementary', { name: 'Файли', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'ШІ-пропозиції', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Прийняти пропозицію' })).toBeDisabled();
  await page.getByRole('link', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Вхід до Typstoria' })).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test('supports a direct route and a narrow viewport without page overflow', async ({ page }) => {
  await page.goto('/preview/workspace');
  await page.getByRole('button', { name: 'Перегляд PDF', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Основні компоненти' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/missing');
  await expect(page.getByRole('heading', { name: 'Сторінку не знайдено' })).toBeVisible();
});
