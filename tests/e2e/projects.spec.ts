import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const project = (id: number, title = `Проєкт ${id}`) => ({
  id,
  title,
  currentRevisionId: id + 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-11-12T10:30:00Z',
});
const created = {
  projectId: 50,
  revisionId: 150,
  mainFileId: 100,
  revisionNumber: 1,
  manifestHash: 'a'.repeat(64),
  historySyncStatus: 'pending',
};
const error = (code = 'INTERNAL_ERROR') => ({
  error: { code, message: 'internal stack trace details', requestId: 'private-request-123' },
});
const rows = (page: Page) => page.locator('.project-card');

async function signIn(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
}
async function action(page: Page, title: string, name: 'Перейменувати' | 'Видалити') {
  await page.getByRole('button', { name: `Дії: ${title}`, exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
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
  await page.route('**/api/projects**', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer 1.project-test-secret');
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
});

test('distinguishes a loading failure from an empty list and retries', async ({ page }) => {
  let fail = true;
  await page.route('**/api/projects?*', (route) =>
    fail
      ? route.fulfill({ status: 503, json: error() })
      : route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await signIn(page);
  await expect(page.getByRole('alert')).toContainText('Не вдалося завантажити проєкти');
  await expect(page.getByText('Проєктів ще немає', { exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('private-request-123');
  await expect(page.locator('body')).not.toContainText('internal stack');
  fail = false;
  await page.getByRole('button', { name: 'Повторити', exact: true }).click();
  await expect(page.getByText('Проєктів ще немає', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('shows accessible skeleton cards while the project list is loading', async ({ page }) => {
  let releaseResponse!: () => void;
  let requestArrived!: () => void;
  const pendingResponse = new Promise<void>((resolve) => (releaseResponse = resolve));
  const requestStarted = new Promise<void>((resolve) => (requestArrived = resolve));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/projects?*', async (route) => {
    requestArrived();
    await pendingResponse;
    await route.fulfill({
      json: { items: [project(11, 'Завантажений проєкт')], nextCursor: null },
    });
  });

  await signIn(page);
  await requestStarted;
  const skeletons = page.locator('.project-card-skeleton');
  await expect(skeletons).toHaveCount(8);
  await expect(page.getByRole('status')).toHaveText('Завантаження проєктів…');
  await expect(page.getByText('Проєктів ще немає', { exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      skeletons
        .first()
        .locator('.project-skeleton-shimmer')
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe('none');

  releaseResponse();
  await expect(skeletons).toHaveCount(0);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Завантажений проєкт');
});

test('searches server results as the query changes and clear restores the full list', async ({
  page,
}) => {
  const allProjects = [project(12, 'Курсова робота'), project(10, 'Конспект')];
  await page.route('**/api/projects?*', (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search');
    return route.fulfill({
      json: {
        items: search ? [project(20, 'Фізика & математика')] : allProjects,
        nextCursor: null,
      },
    });
  });
  await signIn(page);
  await expect(rows(page)).toHaveCount(2);
  const search = page.getByRole('searchbox', { name: 'Пошук проєктів' });
  await search.fill('  фізика &  ');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Фізика & математика');
  await expect(rows(page)).not.toContainText('Курсова робота');
  await search.fill('');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('Курсова робота');
});

test('keeps current cards visible until the debounced search response arrives', async ({
  page,
}) => {
  let releaseSearch!: () => void;
  let searchRequestStarted!: () => void;
  const pendingSearchResponse = new Promise<void>((resolve) => (releaseSearch = resolve));
  const searchStarted = new Promise<void>((resolve) => (searchRequestStarted = resolve));
  const currentProjects = [project(12, 'Курсова робота'), project(10, 'Конспект')];
  await page.route('**/api/projects?*', async (route) => {
    const search = new URL(route.request().url()).searchParams.get('search');
    if (search) {
      searchRequestStarted();
      await pendingSearchResponse;
      await route.fulfill({
        json: { items: [project(20, 'Фізика & математика')], nextCursor: null },
      });
      return;
    }
    await route.fulfill({ json: { items: currentProjects, nextCursor: null } });
  });

  await signIn(page);
  await expect(rows(page)).toHaveCount(2);
  const search = page.getByRole('searchbox', { name: 'Пошук проєктів' });
  await search.fill('фізика');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('Курсова робота');

  await searchStarted;
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).last()).toContainText('Конспект');
  await expect(rows(page).first()).not.toContainText('Фізика & математика');

  releaseSearch();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Фізика & математика');
});

test('does not let an older search response replace the latest query', async ({ page }) => {
  let releaseOld!: () => void;
  let oldRequestArrived!: () => void;
  const oldRequest = new Promise<void>((resolve) => (oldRequestArrived = resolve));
  await page.route('**/api/projects?*', async (route) => {
    const search = new URL(route.request().url()).searchParams.get('search');
    if (search === 'старий') {
      oldRequestArrived();
      await new Promise<void>((resolve) => (releaseOld = resolve));
      await route
        .fulfill({ json: { items: [project(18, 'Старий результат')], nextCursor: null } })
        .catch(() => {});
      return;
    }
    const items = search === 'новий' ? [project(19, 'Новий результат')] : [];
    await route.fulfill({ json: { items, nextCursor: null } });
  });
  await signIn(page);
  const search = page.getByRole('searchbox', { name: 'Пошук проєктів' });
  await search.fill('старий');
  await oldRequest;
  await search.fill('новий');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Новий результат');
  releaseOld();
  await page.waitForTimeout(50);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Новий результат');
});

test('creates, renames and deletes projects with validation and explicit confirmation', async ({
  page,
}) => {
  let items = [project(10, 'Курсова робота')];
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items, nextCursor: null } }),
  );
  await page.route('**/api/projects', (route) => {
    expect(route.request().postDataJSON()).toEqual({ title: 'Дипломна робота' });
    expect(route.request().headers()['idempotency-key']).toMatch(/^[\w-]+$/);
    items = [project(50, 'Дипломна робота'), ...items];
    return route.fulfill({ status: 201, json: created });
  });
  await page.route('**/api/projects/50', (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({ title: 'Нова назва' });
      items[0] = project(50, 'Нова назва');
    }
    if (method === 'DELETE') {
      items = items.filter((item) => item.id !== 50);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: items[0] });
  });
  await signIn(page);
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Новий проєкт', exact: true }).click();
  await expect(page.getByLabel('Назва', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('від 1 до 200');
  await page.getByLabel('Назва', { exact: true }).fill('я'.repeat(201));
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Назва', { exact: true }).fill('  Дипломна робота  ');
  await page.getByLabel('Назва', { exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('Дипломна робота');
  await action(page, 'Дипломна робота', 'Перейменувати');
  await page.getByLabel('Назва', { exact: true }).fill('Нова назва');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Нова назва', exact: true })).toBeVisible();
  await action(page, 'Нова назва', 'Видалити');
  await expect(page.getByRole('dialog')).toContainText('Нова назва');
  await expect(page.getByRole('button', { name: 'Скасувати', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Новий проєкт', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Обліковий запис', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Обліковий запис', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Проєкти', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
});

test('opens a project from its full row and keeps row actions separate', async ({ page }) => {
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project(10, 'Курсова робота')], nextCursor: null } }),
  );
  await signIn(page);

  const projectLink = page.getByRole('link', { name: /Курсова робота/ });
  await projectLink.getByText('12 лист. 2026 р., 12:30').click();
  await expect(page).toHaveURL(/\/projects\/10$/);
  await page.goBack();
  await expect(projectLink).toBeVisible();

  const linkBounds = await projectLink.boundingBox();
  expect(linkBounds).not.toBeNull();
  await page.mouse.click(
    linkBounds!.x + linkBounds!.width - 8,
    linkBounds!.y + linkBounds!.height / 2,
  );
  await expect(page).toHaveURL(/\/projects\/10$/);
  await page.goBack();

  await page.getByRole('button', { name: 'Новий проєкт', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(projectLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projects\/10$/);
  await page.goBack();

  await page.getByRole('button', { name: 'Дії: Курсова робота', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole('button', { name: 'Перейменувати', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/projects$/);
});

test('keeps loaded pages after a pagination failure and retries the same cursor', async ({
  page,
}) => {
  let fail = true;
  const cursors: (string | null)[] = [];
  await page.route('**/api/projects?*', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('limit')).toBe('20');
    cursors.push(url.searchParams.get('cursor'));
    if (!url.searchParams.has('cursor'))
      return route.fulfill({
        json: {
          items: Array.from({ length: 20 }, (_, index) => project(30 - index)),
          nextCursor: 11,
        },
      });
    return fail
      ? route.fulfill({ status: 503, json: error() })
      : route.fulfill({ json: { items: [project(10)], nextCursor: null } });
  });
  await signIn(page);
  await expect(rows(page)).toHaveCount(20);
  await page.getByRole('button', { name: 'Завантажити ще' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(rows(page)).toHaveCount(20);
  fail = false;
  await page.getByRole('button', { name: 'Повторити', exact: true }).click();
  await expect(rows(page)).toHaveCount(21);
  expect(cursors).toEqual([null, '11', '11']);
  await expect(page.getByRole('button', { name: 'Завантажити ще' })).toHaveCount(0);
});

test('reuses the create key after lost responses, failed metadata reads and dialog reopening', async ({
  page,
}) => {
  const keys: string[] = [];
  let metadataFails = true;
  await page.route('**/api/projects', (route) => {
    keys.push(route.request().headers()['idempotency-key']!);
    if (keys.length === 1) return route.abort();
    return route.fulfill({ status: 201, json: created });
  });
  await page.route('**/api/projects/50', (route) =>
    metadataFails
      ? route.fulfill({ status: 503, json: error() })
      : route.fulfill({ json: project(50, 'Диплом') }),
  );
  await signIn(page);
  await page.getByRole('button', { name: 'Новий проєкт', exact: true }).click();
  await page.getByLabel('Назва', { exact: true }).fill('Диплом');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося підтвердити створення');
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await page.getByRole('button', { name: 'Новий проєкт', exact: true }).click();
  await expect(page.getByLabel('Назва', { exact: true })).toHaveValue('Диплом');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  metadataFails = false;
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(1);
});

test('preserves a failed rename and handles a project removed in another tab', async ({ page }) => {
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project(10)], nextCursor: null } }),
  );
  let status = 503;
  await page.route('**/api/projects/10', (route) =>
    route.fulfill({ status, json: error(status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR') }),
  );
  await signIn(page);
  await action(page, 'Проєкт 10', 'Перейменувати');
  await page.getByLabel('Назва', { exact: true }).fill('Важлива назва');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося зберегти назву');
  await expect(page.getByLabel('Назва', { exact: true })).toHaveValue('Важлива назва');
  status = 404;
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Проєкт більше недоступний');
  await page.getByRole('button', { name: 'Закрити', exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Новий проєкт', exact: true })).toBeFocused();
});

test('does not delete on cancellation and treats a repeated delete as completed', async ({
  page,
}) => {
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project(10)], nextCursor: null } }),
  );
  let calls = 0;
  await page.route('**/api/projects/10', (route) => {
    calls++;
    return route.fulfill({ status: calls === 1 ? 503 : 404, json: error() });
  });
  await signIn(page);
  await action(page, 'Проєкт 10', 'Видалити');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls).toBe(0);
  await expect(page.getByRole('button', { name: 'Дії: Проєкт 10', exact: true })).toBeFocused();
  await action(page, 'Проєкт 10', 'Видалити');
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося підтвердити видалення');
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(0);
  expect(calls).toBe(2);
});

test('prevents concurrent submits and closing an in-flight create', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route('**/api/projects', async (route) => {
    calls++;
    await pending;
    return route.fulfill({ status: 201, json: created });
  });
  await page.route('**/api/projects/50', (route) => route.fulfill({ json: project(50) }));
  await signIn(page);
  await page.getByRole('button', { name: 'Новий проєкт', exact: true }).click();
  await page.getByLabel('Назва', { exact: true }).fill('Проєкт');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Зачекайте…' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Скасувати', exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls).toBe(1);
});

test('ends the session on a projects authorization failure and clears private rows', async ({
  page,
}) => {
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project(10)], nextCursor: null } }),
  );
  await signIn(page);
  await expect(rows(page)).toHaveCount(1);
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ status: 401, json: error('UNAUTHENTICATED') }),
  );
  await page.getByRole('link', { name: 'Обліковий запис', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Обліковий запис', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Проєкти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Увійти в Typstoria' })).toBeVisible();
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await signIn(page);
  await expect(page.getByText('Проєктів ще немає', { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([1, 0]);
});

test('keeps long titles, action menus and dialogs within desktop and mobile screens', async ({
  page,
}, testInfo) => {
  const longTitle = 'Довга назва документа '.repeat(9);
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({
      json: {
        items: [
          project(10, 'Дипломна робота'),
          project(9, 'Конспект лекцій'),
          project(8, longTitle),
        ],
        nextCursor: null,
      },
    }),
  );
  await signIn(page);
  await expect(rows(page)).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('projects.png'), fullPage: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: `Дії: ${longTitle}`, exact: true }).click();
    const bounds = await page
      .getByRole('group', { name: `Дії: ${longTitle}`, exact: true })
      .boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Новий проєкт', exact: true }).click();
    const modal = page.getByRole('dialog');
    const box = await modal.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Shift+Tab');
    await expect(modal.getByRole('button', { name: 'Створити', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Новий проєкт', exact: true })).toBeFocused();
  }
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );
  await action(page, 'Дипломна робота', 'Видалити');
  await page.screenshot({ path: testInfo.outputPath('delete-dialog.png'), fullPage: true });
});
