import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import type { Changes } from '../../src/modules/workspace/workspace-api';

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
  title: 'Файловий проєкт',
  currentRevisionId: 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-11-12T10:30:00Z',
};
const hash = 'b'.repeat(64);
type ServerFile = {
  fileId: number;
  path: string;
  content: string;
  contentKind: 'text';
  sha256: string;
  sizeBytes: number;
  mediaType: string;
};
type Server = {
  revisionId: number;
  mainFileId: number;
  nextFileId: number;
  files: ServerFile[];
};
const initialFiles = (): ServerFile[] => [
  {
    fileId: 10,
    path: 'main.typ',
    content: '# Початок\n',
    contentKind: 'text',
    sha256: hash,
    sizeBytes: 10,
    mediaType: 'text/plain; charset=utf-8',
  },
  {
    fileId: 11,
    path: 'notes.typ',
    content: 'Нотатки\n',
    contentKind: 'text',
    sha256: hash,
    sizeBytes: 14,
    mediaType: 'text/plain; charset=utf-8',
  },
];
const apiError = (code = 'INTERNAL_ERROR') => ({
  error: {
    code,
    message: 'private internal details',
    requestId: 'workspace-files-private-request',
  },
});

function snapshot(server: Server) {
  return {
    mainFileId: server.mainFileId,
    project: { ...project, currentRevisionId: server.revisionId },
    revision: {
      id: server.revisionId,
      number: server.revisionId - 99,
      parentRevisionId: server.revisionId === 100 ? null : server.revisionId - 1,
      createdAt: '2026-01-01T00:00:00Z',
      manifestHash: hash,
      commitSha: null,
      historySyncStatus: 'pending',
    },
    contextText: '',
    tree: server.files.map((file) => ({
      fileId: file.fileId,
      path: file.path,
      contentKind: file.contentKind,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      mediaType: file.mediaType,
    })),
  };
}

function apply(server: Server, body: Changes) {
  const createdFiles: { fileId: number; path: string }[] = [];
  for (const operation of body.operations) {
    if (operation.type === 'updateText') {
      const target = server.files.find((file) => file.fileId === operation.fileId);
      if (target) target.content = operation.content;
    } else if (operation.type === 'createFile') {
      const path = operation.path.normalize('NFC');
      const fileId = server.nextFileId++;
      server.files.push({
        fileId,
        path,
        content: operation.content,
        contentKind: 'text',
        sha256: hash,
        sizeBytes: new TextEncoder().encode(operation.content).length,
        mediaType: 'text/plain; charset=utf-8',
      });
      createdFiles.push({ fileId, path });
    } else if (operation.type === 'renameFile') {
      const target = server.files.find((file) => file.fileId === operation.fileId);
      if (target) target.path = operation.path.normalize('NFC');
    } else if (operation.type === 'deleteFile') {
      server.files = server.files.filter((file) => file.fileId !== operation.fileId);
    } else if (operation.type === 'setEntrypoint') {
      const target = server.files.find((file) => file.path === operation.path.normalize('NFC'));
      if (target) server.mainFileId = target.fileId;
    }
  }
  server.revisionId++;
  return {
    projectId: 1,
    revisionId: server.revisionId,
    mainFileId: server.mainFileId,
    createdFiles,
    revisionNumber: server.revisionId - 99,
    manifestHash: hash,
    historySyncStatus: 'pending',
  };
}

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
        accessToken: '1.workspace-files-secret',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    }),
  );
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
}

async function installApi(
  page: Page,
  hooks: {
    beforeSave?: (route: Route, body: Changes, server: Server, calls: number) => Promise<boolean>;
    beforeText?: (
      route: Route,
      fileId: number,
      revisionId: number,
      server: Server,
    ) => Promise<boolean>;
  } = {},
) {
  const server: Server = {
    revisionId: 100,
    mainFileId: 10,
    nextFileId: 12,
    files: initialFiles(),
  };
  const stateRevisionReads: number[] = [];
  const bodies: Changes[] = [];
  const keys: (string | undefined)[] = [];
  let postCalls = 0;
  let stateFailures = 0;
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project], nextCursor: null } }),
  );
  await page.route('**/api/projects/1/state**', async (route) => {
    const url = new URL(route.request().url());
    const requestedRevision = url.searchParams.get('revisionId');
    if (requestedRevision !== null) {
      stateRevisionReads.push(Number(requestedRevision));
      expect(Number(requestedRevision)).toBe(server.revisionId);
    }
    if (stateFailures > 0) {
      stateFailures--;
      await route.fulfill({ status: 503, json: apiError() });
      return;
    }
    await route.fulfill({ json: snapshot(server) });
  });
  await page.route('**/api/projects/1/files/*', async (route) => {
    const url = new URL(route.request().url());
    const fileId = Number(url.pathname.split('/').at(-1));
    const revisionId = Number(url.searchParams.get('revisionId'));
    expect(revisionId).toBe(server.revisionId);
    if (hooks.beforeText && (await hooks.beforeText(route, fileId, revisionId, server))) return;
    const file = server.files.find((entry) => entry.fileId === fileId);
    expect(file).toBeDefined();
    return route.fulfill({ json: { ...file, revisionId } });
  });
  await page.route('**/api/projects/1/changes', async (route) => {
    postCalls++;
    const body = route.request().postDataJSON() as Changes;
    bodies.push(structuredClone(body));
    keys.push(route.request().headers()['idempotency-key']);
    if (hooks.beforeSave && (await hooks.beforeSave(route, body, server, postCalls))) return;
    await route.fulfill({ json: apply(server, body) });
  });
  return {
    server,
    bodies,
    keys,
    stateRevisionReads,
    postCalls: () => postCalls,
    failNextStateRead: () => stateFailures++,
  };
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
  await showFiles(page);
  await expect(page.getByRole('button', { name: 'main.typ', exact: true })).toBeVisible();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  if (viewportWidth <= 720) {
    await page.getByRole('button', { name: 'Закрити файли' }).click();
    await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
  }
}

async function showFiles(page: Page) {
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  if (viewportWidth <= 720) {
    const toggle = page.getByRole('button', { name: /(?:Показати|Приховати) файли/ });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
}

async function hideFiles(page: Page) {
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  if (viewportWidth <= 720) {
    const close = page.getByRole('button', { name: 'Закрити файли' });
    if (await close.isVisible()) {
      await close.click();
      await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
    }
  }
}

async function openNewFileDialog(page: Page) {
  await showFiles(page);
  await page.getByRole('button', { name: 'Новий файл', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Новий файл', exact: true })).toBeVisible();
}

async function fileMenu(page: Page, path: string, action: string) {
  await page.getByRole('button', { name: `Дії з файлом: ${path}`, exact: true }).click();
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

const editor = (page: Page) => page.getByLabel('Вихідний текст', { exact: true });

test('creates a nested text file through the mobile files drawer and reloads it', async ({
  page,
}) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('chapters/chapter.typ');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await showFiles(page);
  await expect(
    page.getByRole('button', { name: 'chapters/chapter.typ', exact: true }),
  ).toBeVisible();
  expect(api.bodies).toHaveLength(1);
  expect(api.bodies[0]!.operations).toEqual([
    { type: 'createFile', path: 'chapters/chapter.typ', content: '' },
  ]);
  expect(api.keys[0]).toMatch(/^[\w-]+$/);
  expect(api.stateRevisionReads).toContain(101);
  await page.reload();
  await expect(page.getByRole('heading', { name: project.title, exact: true })).toBeVisible();
  await showFiles(page);
  await expect(
    page.getByRole('button', { name: 'chapters/chapter.typ', exact: true }),
  ).toBeVisible();
});

test('renames and moves a file while preserving its file ID and content', async ({ page }) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await showFiles(page);
  await page.getByRole('button', { name: 'notes.typ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
  await expect(editor(page)).toContainText('Нотатки');
  await fileMenu(page, 'notes.typ', 'Перейменувати файл');
  await page.getByLabel('Шлях файла', { exact: true }).fill('reference/notes.typ');
  await page.getByRole('button', { name: 'Перейменувати', exact: true }).click();
  await showFiles(page);
  await expect(
    page.getByRole('button', { name: 'reference/notes.typ', exact: true }),
  ).toBeVisible();
  expect(api.bodies[0]!.operations).toEqual([
    { type: 'renameFile', fileId: 11, path: 'reference/notes.typ' },
  ]);
  expect(api.server.files.find((file) => file.fileId === 11)?.content).toBe('Нотатки\n');
  expect(api.server.files.find((file) => file.fileId === 11)?.path).toBe('reference/notes.typ');
});

test('deletes a dirty main file and selects its replacement in one atomic batch', async ({
  page,
}) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await editor(page).fill('# Локальна зміна перед видаленням');
  await expect(page.getByRole('status')).toContainText('Незбережені зміни');
  await fileMenu(page, 'main.typ', 'Видалити файл');
  await expect(page.getByRole('heading', { name: 'Видалити файл?', exact: true })).toBeVisible();
  await page
    .getByLabel('Новий головний файл', { exact: true })
    .selectOption({ label: 'notes.typ' });
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await showFiles(page);
  await expect(page.getByRole('button', { name: 'main.typ', exact: true })).toHaveCount(0);
  expect(api.bodies).toHaveLength(1);
  expect(api.bodies[0]!.operations).toEqual([
    { type: 'deleteFile', fileId: 10 },
    { type: 'setEntrypoint', path: 'notes.typ' },
  ]);
  expect(api.server.mainFileId).toBe(11);
  await expect(
    page.getByRole('button', { name: 'Дії з файлом: notes.typ', exact: true }),
  ).toBeVisible();
});

test('locks delete confirmation while the replacement text is loading', async ({ page }) => {
  await installSession(page);
  let releaseText!: () => void;
  let signalTextRequested!: () => void;
  const waitingForText = new Promise<void>((resolve) => (releaseText = resolve));
  const textRequested = new Promise<void>((resolve) => (signalTextRequested = resolve));
  const api = await installApi(page, {
    beforeText: async (route, fileId, revisionId, server) => {
      if (fileId !== 11 || revisionId !== 101) return false;
      signalTextRequested();
      await waitingForText;
      const file = server.files.find((entry) => entry.fileId === fileId);
      expect(file).toBeDefined();
      await route.fulfill({ json: { ...file, revisionId } });
      return true;
    },
  });
  await openWorkspace(page);
  await fileMenu(page, 'main.typ', 'Видалити файл');
  await page
    .getByLabel('Новий головний файл', { exact: true })
    .selectOption({ label: 'notes.typ' });
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await textRequested;
  const dialog = page.getByRole('dialog', { name: 'Видалити файл?', exact: true });
  await expect(dialog.getByRole('button', { name: 'Зачекайте…', exact: true })).toBeDisabled();
  expect(api.postCalls()).toBe(1);
  releaseText();
  await expect(dialog).toHaveCount(0);
  expect(api.postCalls()).toBe(1);
  await expect(editor(page)).toContainText('Нотатки');
});

test('saves existing dirty text and a new file in the same batch', async ({ page }) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await editor(page).fill('# Зміна тексту');
  await expect(page.getByRole('status')).toContainText('Незбережені зміни');
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('appendix.typ');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  expect(api.bodies).toHaveLength(1);
  expect(api.bodies[0]!.operations).toEqual([
    { type: 'updateText', fileId: 10, content: '# Зміна тексту' },
    { type: 'createFile', path: 'appendix.typ', content: '' },
  ]);
  await showFiles(page);
  await expect(page.getByRole('button', { name: 'appendix.typ', exact: true })).toBeVisible();
});

test('retries a lost create response with the identical key and operation before applying its mapping', async ({
  page,
}) => {
  await installSession(page);
  let serverApplied = false;
  let previousResult: ReturnType<typeof apply> | null = null;
  const api = await installApi(page, {
    beforeSave: async (route, body, server, call) => {
      if (call === 1) {
        serverApplied = true;
        previousResult = apply(server, body);
        await route.abort();
        return true;
      }
      if (call === 2 && previousResult) {
        await route.fulfill({ json: previousResult });
        return true;
      }
      return false;
    },
  });
  await openWorkspace(page);
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('chapter.typ');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  const actionDialog = page.getByRole('dialog', { name: 'Новий файл', exact: true });
  await expect(actionDialog.getByRole('button', { name: 'Повторити', exact: true })).toBeVisible();
  expect(serverApplied).toBe(true);
  await actionDialog.getByRole('button', { name: 'Повторити', exact: true }).click();
  await showFiles(page);
  await expect(page.getByRole('button', { name: 'chapter.typ', exact: true })).toBeVisible();
  expect(api.postCalls()).toBe(2);
  expect(api.keys[1]).toBe(api.keys[0]);
  expect(api.bodies[1]).toEqual(api.bodies[0]);
  expect(api.server.files.filter((file) => file.path === 'chapter.typ')).toHaveLength(1);
});

test('refreshes the committed tree without issuing a second POST after a failed state read', async ({
  page,
}) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  api.failNextStateRead();
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('chapter.typ');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  const actionDialog = page.getByRole('dialog', { name: 'Новий файл', exact: true });
  await expect(actionDialog.getByRole('alert')).toContainText('Зміни збережено');
  await expect(actionDialog.getByRole('button', { name: 'Повторити', exact: true })).toBeVisible();
  expect(api.postCalls()).toBe(1);
  await actionDialog.getByRole('button', { name: 'Повторити', exact: true }).click();
  await showFiles(page);
  await expect(page.getByRole('button', { name: 'chapter.typ', exact: true })).toBeVisible();
  expect(api.postCalls()).toBe(1);
  expect(api.stateRevisionReads).toEqual([101, 101]);
});

test('does not replay a structural action after conflict unless the user checks it', async ({
  page,
}) => {
  await installSession(page);
  const api = await installApi(page, {
    beforeSave: async (route, _body, _server, call) => {
      if (call !== 1) return false;
      await route.fulfill({ status: 409, json: apiError('REVISION_CONFLICT') });
      return true;
    },
  });
  await openWorkspace(page);
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('chapter.typ');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  await page.getByRole('button', { name: 'Порівняти версії', exact: true }).click();
  const replay = page.getByLabel('Повторити дію: Створити chapter.typ', { exact: true });
  await expect(replay).toBeVisible();
  await expect(replay).not.toBeChecked();
  await page.getByRole('button', { name: 'Продовжити автозбереження', exact: true }).click();
  await expect(page.getByRole('heading', { name: project.title, exact: true })).toBeVisible();
  expect(api.postCalls()).toBe(1);
  expect(api.server.files.some((file) => file.path === 'chapter.typ')).toBe(false);
});

test('does not auto-retry a rejected file action after same-account reauthentication', async ({
  page,
}) => {
  await installSession(page);
  let expireSession = false;
  await page.unroute('**/api/auth/me');
  await page.route('**/api/auth/me', (route) => {
    if (!expireSession) return route.fulfill({ json: user });
    expireSession = false;
    return route.fulfill({ status: 401, json: apiError('UNAUTHENTICATED') });
  });
  const api = await installApi(page, {
    beforeSave: async (route, _body, _server, call) => {
      if (call !== 1) return false;
      await route.fulfill({ status: 429, json: apiError('RATE_LIMITED') });
      return true;
    },
  });
  await openWorkspace(page);
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('chapter.typ');
  await page.getByRole('button', { name: 'Створити', exact: true }).click();
  const actionDialog = page.getByRole('dialog', { name: 'Новий файл', exact: true });
  await expect(actionDialog.getByRole('alert')).toContainText('Забагато запитів');
  expect(api.postCalls()).toBe(1);
  expireSession = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=\/projects\/1/);
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(page.getByText('Створити chapter.typ', { exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  expect(api.postCalls()).toBe(1);
  expect(api.server.files.some((file) => file.path === 'chapter.typ')).toBe(false);
});

test('rejects a colliding path and prevents deleting the only main file', async ({ page }) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await openNewFileDialog(page);
  await page.getByLabel('Шлях файла', { exact: true }).fill('notes.typ');
  await expect(page.getByRole('button', { name: 'Створити', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(api.postCalls()).toBe(0);
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Новий файл', exact: true })).toHaveCount(0);
  await showFiles(page);
  await page.getByRole('button', { name: 'notes.typ', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
  await fileMenu(page, 'notes.typ', 'Видалити файл');
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  expect(api.postCalls()).toBe(1);
  expect(api.server.files.map((file) => file.path)).toEqual(['main.typ']);
  await showFiles(page);
  await hideFiles(page);
  await fileMenu(page, 'main.typ', 'Видалити файл');
  const deleteOnlyFile = page.getByRole('button', { name: 'Видалити', exact: true });
  if (await deleteOnlyFile.count()) await expect(deleteOnlyFile).toBeDisabled();
  else await expect(page.getByRole('dialog')).toContainText(/головн|єдин|останн/iu);
  expect(api.postCalls()).toBe(1);
});
