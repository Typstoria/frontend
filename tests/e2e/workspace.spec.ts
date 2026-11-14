import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import type { Changes } from '../../src/modules/workspace/workspace-api';
import { readFile } from 'node:fs/promises';

const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const project = {
  id: 1,
  title: 'Курсова робота',
  currentRevisionId: 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-11-12T10:30:00Z',
};
const hash = 'a'.repeat(64);
const file = (fileId: number, path: string) => ({
  fileId,
  path,
  contentKind: 'text',
  sha256: hash,
  sizeBytes: 0,
  mediaType: 'text/plain; charset=utf-8',
});
const snapshot = (
  revisionId = 100,
  title = project.title,
  tree = [file(10, 'main.typ'), file(11, 'notes.typ')],
) => ({
  mainFileId: 10,
  project: { ...project, title, currentRevisionId: revisionId },
  revision: {
    id: revisionId,
    number: revisionId - 99,
    parentRevisionId: revisionId === 100 ? null : revisionId - 1,
    createdAt: '2026-01-01T00:00:00Z',
    manifestHash: hash,
    commitSha: null,
    historySyncStatus: 'pending',
  },
  contextText: '',
  tree,
});
const textResponse = (fileId: number, path: string, content: string, revisionId = 100) => ({
  ...file(fileId, path),
  revisionId,
  content,
});
const saved = (revisionId: number) => ({
  projectId: 1,
  revisionId,
  mainFileId: 10,
  createdFiles: [],
  revisionNumber: revisionId - 99,
  manifestHash: hash,
  historySyncStatus: 'pending',
});
const apiError = (code = 'INTERNAL_ERROR') => ({
  error: { code, message: 'private internal details', requestId: 'workspace-private-request' },
});

async function installSession(page: Page) {
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
        accessToken: '1.workspace-test-secret',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    }),
  );
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
}

async function openWorkspace(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
  await page.getByRole('link', { name: project.title, exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(page.getByRole('heading', { name: project.title, exact: true })).toBeVisible();
}

async function installWorkspaceApi(
  page: Page,
  opts: {
    getSnapshot?: () => ReturnType<typeof snapshot>;
    getText?: (fileId: number, revisionId: number) => string;
    save?: (route: Route, body: Changes, call: number) => Promise<void> | void;
  } = {},
) {
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project], nextCursor: null } }),
  );
  await page.route('**/api/projects/1/state**', (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer .+/);
    return route.fulfill({ json: opts.getSnapshot?.() ?? snapshot() });
  });
  await page.route('**/api/projects/1/files/*', (route) => {
    const url = new URL(route.request().url());
    const fileId = Number(url.pathname.split('/').at(-1));
    const revisionId = Number(url.searchParams.get('revisionId'));
    expect([10, 11]).toContain(fileId);
    expect(revisionId).toBeGreaterThan(0);
    return route.fulfill({
      json: textResponse(
        fileId,
        fileId === 10 ? 'main.typ' : 'notes.typ',
        opts.getText?.(fileId, revisionId) ?? (fileId === 10 ? '# Початок\n' : 'Нотатки\n'),
        revisionId,
      ),
    });
  });
  let calls = 0;
  await page.route('**/api/projects/1/changes', async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    await opts.save?.(route, body, calls);
    if (!opts.save) await route.fulfill({ json: saved(100 + calls) });
  });
  return { saveCalls: () => calls };
}

async function selectFile(page: Page, path: string) {
  const file = page.getByRole('button', { name: path, exact: true });
  if (!(await file.isVisible()))
    await page.getByRole('button', { name: 'Показати файли', exact: true }).click();
  await file.click();
  await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toBeHidden();
}

async function sourceEditor(page: Page) {
  const editor = page.getByLabel('Вихідний текст', { exact: true });
  await expect(editor).toBeVisible();
  return editor;
}

test('opens a private project from its list and reloads accepted Unicode text with undo', async ({
  page,
}) => {
  await installSession(page);
  let accepted = '# Початок\n';
  await installWorkspaceApi(page, {
    getText: (fileId) => (fileId === 10 ? accepted : 'Нотатки\n'),
    save: async (route, body, call) => {
      expect(body.baseRevisionId).toBe(call === 1 ? 100 : 101);
      const update = body.operations.find((operation) => operation.type === 'updateText');
      expect(update?.type).toBe('updateText');
      if (update?.type === 'updateText') accepted = update.content;
      await route.fulfill({ json: saved(100 + call) });
    },
  });
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await expect(editor).toContainText('# Початок');
  const edited = '# Початок\n🙂 Український текст';
  await editor.fill(edited);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await expect(page.getByRole('status')).toContainText('Незбережені зміни');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(editor).toContainText('# Початок');
  await editor.fill(edited);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  await expect(page.getByRole('status')).toContainText('Збережено');
  await page.reload();
  await expect(await sourceEditor(page)).toContainText('🙂 Український текст');
  await expect(page.locator('body')).not.toContainText('workspace-private-request');
});

test('saves one immutable batch while later edits and file switching wait for the next revision', async ({
  page,
}) => {
  await installSession(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => (release = resolve));
  const batches: Changes[] = [];
  let active = 0;
  let maxActive = 0;
  await installWorkspaceApi(page, {
    save: async (route, body, call) => {
      active++;
      maxActive = Math.max(maxActive, active);
      batches.push(structuredClone(body));
      if (call === 1) await delayed;
      active--;
      await route.fulfill({ json: saved(100 + call) });
    },
  });
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.fill('# batch one');
  await expect.poll(() => batches.length).toBe(1);
  await editor.fill('# batch one\n# batch two');
  await selectFile(page, 'notes.typ');
  await expect(page.getByLabel('Вихідний текст', { exact: true })).toContainText('Нотатки');
  await selectFile(page, 'main.typ');
  await expect(page.getByLabel('Вихідний текст', { exact: true }).locator('.cm-line')).toHaveText([
    '# batch one',
    '# batch two',
  ]);
  await selectFile(page, 'notes.typ');
  release();
  await expect.poll(() => batches.length).toBe(2);
  expect(maxActive).toBe(1);
  expect(batches[0]!.baseRevisionId).toBe(100);
  expect(batches[0]!.operations).toEqual([
    { type: 'updateText', fileId: 10, content: '# batch one' },
  ]);
  expect(batches[1]!.baseRevisionId).toBe(101);
  expect(batches[1]!.operations).toEqual([
    { type: 'updateText', fileId: 10, content: '# batch one\n# batch two' },
  ]);
});

test('indents selected lines without replacing text and lets keyboard focus leave the editor', async ({
  page,
}) => {
  await installSession(page);
  await installWorkspaceApi(page);
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.fill('Перший рядок 🙂\nДругий рядок');
  await editor.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
  await editor.press('Tab');
  const lines = () => editor.locator('.cm-line').allTextContents();
  await expect.poll(lines).toEqual(['  Перший рядок 🙂', '  Другий рядок']);
  await expect(editor).toBeFocused();
  await editor.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect.poll(lines).toEqual(['Перший рядок 🙂', 'Другий рядок']);
  await editor.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z');
  await expect.poll(lines).toEqual(['  Перший рядок 🙂', '  Другий рядок']);
  await editor.press('Shift+Tab');
  await expect.poll(lines).toEqual(['Перший рядок 🙂', 'Другий рядок']);
  await expect(editor).toBeFocused();
  await editor.press('Escape');
  await editor.press('Tab');
  await expect(editor).not.toBeFocused();
});

test('pauses autosave during IME composition and schedules it after composition ends', async ({
  page,
}) => {
  await installSession(page);
  const { saveCalls } = await installWorkspaceApi(page);
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.fill('# Текст для введення');
  await editor.dispatchEvent('compositionstart');
  await page.waitForTimeout(1100);
  expect(saveCalls()).toBe(0);
  await editor.dispatchEvent('compositionend');
  await expect.poll(() => saveCalls()).toBe(1);
  await expect(page.getByRole('status')).toContainText('Збережено');
});

test('keeps long documents inside the editor viewport on short and narrow screens', async ({
  page,
}) => {
  await installSession(page);
  await installWorkspaceApi(page, {
    getText: () =>
      Array.from({ length: 800 }, (_, i) => `Рядок ${i + 1}: український текст 🙂`).join('\n'),
  });
  await openWorkspace(page);
  await sourceEditor(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 600 },
    { width: 390, height: 500 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    const scroller = page.locator('.editor-source .cm-scroller');
    const box = await scroller.boundingBox();
    const headerBudget = viewport.width <= 720 ? 205 : 160;
    expect(box!.y).toBeLessThanOrEqual(headerBudget);
    expect(box!.height).toBeGreaterThan(viewport.height - headerBudget - 10);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    ).toEqual(viewport);
    await scroller.evaluate((element) => {
      element.scrollTop = 500;
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test('restores the cursor, undo and viewport when returning to a file', async ({ page }) => {
  await installSession(page);
  await installWorkspaceApi(page, {
    getText: (fileId) =>
      fileId === 10
        ? Array.from({ length: 150 }, (_, i) => `Рядок ${i + 1}`).join('\n')
        : 'Нотатки',
  });
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End');
  await page.keyboard.insertText(' marker');
  const scroller = page.locator('.editor-source .cm-scroller');
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
  const previousTop = await scroller.evaluate((element) => element.scrollTop);
  await selectFile(page, 'notes.typ');
  await expect(editor).toContainText('Нотатки');
  await selectFile(page, 'main.typ');
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(previousTop - 100);
  await editor.focus();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(editor).not.toContainText('marker');
});

test('opens a focused mobile file drawer with folders and handles selection, Escape and resizing', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await installSession(page);
  await installWorkspaceApi(page, {
    getSnapshot: () =>
      snapshot(100, project.title, [
        file(10, 'main.typ'),
        file(11, 'chapters/intro.typ'),
        { ...file(12, 'assets/logo.png'), contentKind: 'binary' },
      ]),
  });
  await page.route('**/api/projects/1/files/11?*', (route) =>
    route.fulfill({ json: textResponse(11, 'chapters/intro.typ', '= Вступ', 100) }),
  );
  let binaryReads = 0;
  page.on('request', (request) => {
    if (request.url().includes('/files/12')) binaryReads++;
  });
  await openWorkspace(page);
  const toggle = page.getByRole('button', { name: 'Показати файли', exact: true });
  await expect(page.getByRole('button', { name: 'main.typ', exact: true })).toBeHidden();
  await toggle.click();
  const drawer = page.getByRole('dialog', { name: 'Файли', exact: true });
  await expect(drawer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Закрити файли', exact: true })).toBeFocused();
  await drawer.locator('button').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Закрити файли', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  const folder = drawer.getByRole('button', { name: 'chapters', exact: true });
  await folder.click();
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await expect(
    drawer.getByRole('button', { name: 'chapters/intro.typ', exact: true }),
  ).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await toggle.click();
  await expect(drawer.getByRole('button', { name: 'chapters', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await drawer.getByRole('button', { name: 'chapters', exact: true }).click();
  await expect
    .poll(() => drawer.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('1');
  await page.screenshot({ path: testInfo.outputPath('files-drawer.png'), fullPage: true });
  await selectFile(page, 'chapters/intro.typ');
  await expect(await sourceEditor(page)).toContainText('= Вступ');
  await expect(toggle).toBeFocused();
  await selectFile(page, 'assets/logo.png');
  await expect(
    page.getByText('Цей файл не містить редагованого тексту.', { exact: true }),
  ).toBeVisible();
  expect(binaryReads).toBe(0);
  await toggle.click();
  await page.setViewportSize({ width: 900, height: 600 });
  await expect(drawer).toBeHidden();
  await expect(
    page.getByRole('complementary', { name: 'Файли проєкту', exact: true }),
  ).toBeVisible();
  await selectFile(page, 'main.typ');
  await expect(await sourceEditor(page)).toContainText('# Початок');
});

test('retries an unknown save outcome with the same key and immutable payload', async ({
  page,
}) => {
  await installSession(page);
  const attempts: { key: string | undefined; body: Changes }[] = [];
  await installWorkspaceApi(page, {
    save: async (route, body, call) => {
      attempts.push({
        key: route.request().headers()['idempotency-key'],
        body: structuredClone(body),
      });
      if (call === 1) return route.abort();
      await route.fulfill({ json: saved(101) });
    },
  });
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.fill('# первісна спроба');
  await expect(
    page.getByRole('button', { name: 'Повторити збереження', exact: true }),
  ).toBeVisible();
  await editor.fill('# новіший текст');
  const retryResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/projects/1/changes'),
  );
  await page.getByRole('button', { name: 'Повторити збереження', exact: true }).click();
  await retryResponse;
  expect(attempts).toHaveLength(2);
  expect(attempts[0]!.key).toMatch(/^[\w-]+$/);
  expect(attempts[1]!.key).toBe(attempts[0]!.key);
  expect(attempts[1]!.body).toEqual(attempts[0]!.body);
  await expect.poll(() => attempts.length).toBe(3);
  expect(attempts[2]!.body.operations[0]!.type).toBe('updateText');
  if (attempts[2]!.body.operations[0]!.type === 'updateText') {
    expect(attempts[2]!.body.operations[0]!.content).toBe('# новіший текст');
  }
  await expect(page.getByRole('status')).toContainText('Збережено');
});

test('requires explicit conflict comparison and applies a reviewed merge', async ({
  page,
}, testInfo) => {
  await installSession(page);
  let expireSession = false;
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', (route) => {
    if (!expireSession) return route.fulfill({ json: user });
    expireSession = false;
    return route.fulfill({ status: 401, json: apiError('UNAUTHENTICATED') });
  });
  let stateReads = 0;
  const batches: Changes[] = [];
  await installWorkspaceApi(page, {
    getSnapshot: () => {
      stateReads++;
      return stateReads === 1 ? snapshot() : snapshot(101);
    },
    getText: (fileId, revisionId) =>
      revisionId === 100 && fileId === 10 ? '# База\n' : '# Серверний текст\n',
    save: async (route, body, call) => {
      batches.push(structuredClone(body));
      if (call === 1) return route.fulfill({ status: 409, json: apiError('REVISION_CONFLICT') });
      await route.fulfill({ status: 503, json: apiError() });
    },
  });
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.fill('# Локальний текст\n');
  await expect(page.getByRole('button', { name: 'Порівняти версії', exact: true })).toBeVisible();
  expect(batches).toHaveLength(1);
  await page.getByRole('button', { name: 'Порівняти версії', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Узгодження змін', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('conflict.png'), fullPage: true });
  await page.getByText('Початкові версії', { exact: true }).click();
  await expect(page.getByLabel('Базовий текст: main.typ', { exact: true })).toHaveValue('# База\n');
  await expect(page.getByLabel('Серверний текст: main.typ', { exact: true })).toHaveValue(
    '# Серверний текст\n',
  );
  await page.getByLabel('Об’єднаний текст: main.typ', { exact: true }).fill('# Ручне об’єднання\n');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Завантажити копію', exact: true }).first().click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const copy = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
    files: { path: string; content: string }[];
  };
  expect(copy.files).toContainEqual({ path: 'main.typ', content: '# Ручне об’єднання\n' });
  expireSession = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=\/projects\/1/);
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(page.getByLabel('Об’єднаний текст: main.typ', { exact: true })).toHaveValue(
    '# Ручне об’єднання\n',
  );
  await page.getByRole('button', { name: 'Продовжити автозбереження', exact: true }).click();
  await expect.poll(() => batches.length).toBe(2);
  expect(batches[1]!.baseRevisionId).toBe(101);
  expect(batches[1]!.operations[0]!.type).toBe('updateText');
  if (batches[1]!.operations[0]!.type === 'updateText') {
    expect(batches[1]!.operations[0]!.content).toBe('# Ручне об’єднання\n');
  }
});

test('clears a dirty draft when reauthentication switches to another account', async ({ page }) => {
  await installSession(page);
  const otherUser = { ...user, id: 2, email: 'other@example.com' };
  let accountTwo = false;
  let expireSession = false;
  let authenticatedUser = user;
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', (route) => {
    if (!expireSession) return route.fulfill({ json: authenticatedUser });
    expireSession = false;
    return route.fulfill({ status: 401, json: apiError('UNAUTHENTICATED') });
  });
  await installWorkspaceApi(page, {
    getSnapshot: () => (accountTwo ? snapshot(200, 'Інший обліковий запис') : snapshot()),
    getText: (fileId) =>
      accountTwo
        ? fileId === 10
          ? '# Текст іншого акаунта\n'
          : 'Інші нотатки\n'
        : fileId === 10
          ? '# Початок\n'
          : 'Нотатки\n',
    save: async (route) => route.fulfill({ status: 503, json: apiError() }),
  });
  await openWorkspace(page);
  const editor = await sourceEditor(page);
  await editor.fill('# Не втратити цей текст');
  expireSession = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=\/projects\/1/);
  authenticatedUser = otherUser;
  accountTwo = true;
  await page.unroute('**/api/auth/login');
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      json: {
        user: otherUser,
        accessToken: '2.other-account-secret',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    }),
  );
  await page.getByLabel('Електронна пошта', { exact: true }).fill(otherUser.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(
    page.getByRole('heading', { name: 'Інший обліковий запис', exact: true }),
  ).toBeVisible();
  await expect(await sourceEditor(page)).toContainText('# Текст іншого акаунта');
  await expect(page.locator('body')).not.toContainText('# Не втратити цей текст');
  await expect(page.locator('body')).not.toContainText('private internal details');
});

test('restores a dirty draft after the same account signs in again', async ({ page }) => {
  await installSession(page);
  let expireSession = false;
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', (route) => {
    if (!expireSession) return route.fulfill({ json: user });
    expireSession = false;
    return route.fulfill({ status: 401, json: apiError('UNAUTHENTICATED') });
  });
  await installWorkspaceApi(page, {
    save: async (route) => route.fulfill({ status: 503, json: apiError() }),
  });
  await openWorkspace(page);
  await (await sourceEditor(page)).fill('# Чернетка того самого акаунта');
  expireSession = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=\/projects\/1/);
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(await sourceEditor(page)).toContainText('# Чернетка того самого акаунта');
});

test('guards dirty route and logout exits with native confirmation', async ({ page }) => {
  await installSession(page);
  let logoutCalls = 0;
  await page.route('**/api/auth/logout', (route) => {
    logoutCalls++;
    return route.fulfill({ status: 204 });
  });
  await installWorkspaceApi(page, {
    save: async (route) => route.fulfill({ status: 503, json: apiError() }),
  });
  await openWorkspace(page);
  await (await sourceEditor(page)).fill('# Незбережена правка');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Проєкти', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  expect(logoutCalls).toBe(0);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(logoutCalls).toBe(1);
});

test('shows a sanitized missing-project state and keeps the workspace within desktop and mobile widths', async ({
  page,
}) => {
  await installSession(page);
  let release!: () => void;
  let requested!: () => void;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  const arrived = new Promise<void>((resolve) => (requested = resolve));
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project], nextCursor: null } }),
  );
  await page.route('**/api/projects/1/state**', async (route) => {
    requested();
    await waiting;
    await route.fulfill({ status: 404, json: apiError('NOT_FOUND') });
  });
  await page.goto('/auth/login');
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ваші проєкти' })).toBeVisible();
  await page.getByRole('link', { name: project.title, exact: true }).click();
  await arrived;
  await expect(page.getByRole('status')).toContainText('Завантаження проєкту');
  release();
  await expect(page.getByRole('alert')).toContainText('Проєкт або файл недоступний');
  await expect(page.locator('body')).not.toContainText('workspace-private-request');
  await expect(page.locator('body')).not.toContainText('private internal details');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
