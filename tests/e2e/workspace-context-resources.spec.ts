import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import type { Changes } from '../../src/modules/workspace/workspace-api';
import { pauseAutosaveClock, replaceSourceText } from './source-input';
import { installWorkspaceStartupMock } from './workspace-startup-fixture';

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
  title: 'Контекст і ресурси',
  currentRevisionId: 100,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-11-12T10:30:00Z',
};
const hash = 'c'.repeat(64);
type ServerFile = {
  fileId: number;
  path: string;
  contentKind: 'text' | 'binary';
  sha256: string;
  sizeBytes: number;
  mediaType: string;
  content?: string;
  bytes?: Uint8Array;
};
type Upload = {
  uploadId: number;
  filename: string;
  mediaType: string;
  sha256: string;
  bytes: Uint8Array;
};
type CapturedUpload = { filename: string; mediaType: string; bytes: number[] };
type Server = {
  revisionId: number;
  mainFileId: number;
  contextText: string;
  nextFileId: number;
  nextUploadId: number;
  files: ServerFile[];
  uploads: Map<number, Upload>;
};
const apiError = (code = 'INTERNAL_ERROR') => ({
  error: {
    code,
    message: 'private internal details',
    requestId: 'workspace-context-private-request',
  },
});
const binary = (
  fileId: number,
  path: string,
  bytes: Uint8Array,
  mediaType: string,
): ServerFile => ({
  fileId,
  path,
  contentKind: 'binary',
  sha256: hash,
  sizeBytes: bytes.byteLength,
  mediaType,
  bytes,
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
    contextText: server.contextText,
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
    if (operation.type === 'updateContext') {
      server.contextText = operation.content;
    } else if (operation.type === 'updateText') {
      const target = server.files.find((file) => file.fileId === operation.fileId);
      if (target?.contentKind === 'text') {
        target.content = operation.content;
        target.sizeBytes = new TextEncoder().encode(operation.content).length;
      }
    } else if (operation.type === 'attachFile') {
      const upload = server.uploads.get(operation.uploadId);
      if (!upload) throw new Error(`Missing staged upload ${operation.uploadId}`);
      const fileId = server.nextFileId++;
      const file = binary(fileId, operation.path, upload.bytes, upload.mediaType);
      file.sha256 = upload.sha256;
      server.files.push(file);
      createdFiles.push({ fileId, path: operation.path });
    } else if (operation.type === 'replaceFile') {
      const upload = server.uploads.get(operation.uploadId);
      const target = server.files.find((file) => file.fileId === operation.fileId);
      if (!upload || !target) throw new Error('Missing resource for replacement');
      target.contentKind = 'binary';
      target.sha256 = upload.sha256;
      target.sizeBytes = upload.bytes.byteLength;
      target.mediaType = upload.mediaType;
      target.bytes = upload.bytes;
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
        accessToken: '1.workspace-context-secret',
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
  } = {},
) {
  const server: Server = {
    revisionId: 100,
    mainFileId: 10,
    contextText: 'Початковий контекст',
    nextFileId: 13,
    nextUploadId: 30,
    files: [
      {
        fileId: 10,
        path: 'main.typ',
        contentKind: 'text',
        sha256: hash,
        sizeBytes: 12,
        mediaType: 'text/plain; charset=utf-8',
        content: '# Початок\n',
      },
      {
        fileId: 11,
        path: 'notes.typ',
        contentKind: 'text',
        sha256: hash,
        sizeBytes: 14,
        mediaType: 'text/plain; charset=utf-8',
        content: 'Нотатки\n',
      },
      {
        fileId: 12,
        path: 'chapters/intro.typ',
        contentKind: 'text',
        sha256: hash,
        sizeBytes: 9,
        mediaType: 'text/plain; charset=utf-8',
        content: '# Розділ\n',
      },
    ],
    uploads: new Map(),
  };
  const bodies: Changes[] = [];
  const keys: (string | undefined)[] = [];
  const requestedRevisions: number[] = [];
  const revisions = new Map<number, Server>();
  function revisionAt(revisionId: number) {
    const revision = revisionId === server.revisionId ? server : revisions.get(revisionId);
    expect(revision, `Fixture revision ${revisionId}`).toBeDefined();
    return revision!;
  }
  const capturedUploads: CapturedUpload[] = [];
  await page.exposeFunction('captureResourceUpload', (upload: CapturedUpload) => {
    capturedUploads.push(upload);
  });
  await page.addInitScript(() => {
    const transport = window.fetch.bind(window);
    const browser = window as typeof window & {
      captureResourceUpload: (upload: CapturedUpload) => Promise<void>;
    };
    window.fetch = async (input, init) => {
      if (input === '/api/projects/1/uploads' && init?.body instanceof FormData) {
        const file = init.body.get('file');
        if (file instanceof File) {
          // Browser request interception can omit file bytes even though they are sent.
          await browser.captureResourceUpload({
            filename: file.name,
            mediaType: file.type,
            bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
          });
        }
      }
      return transport(input, init);
    };
  });
  let uploadCalls = 0;
  let postCalls = 0;
  let downloadCalls = 0;
  await installWorkspaceStartupMock(page, server.revisionId);
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project], nextCursor: null } }),
  );
  await page.route('**/api/projects/1/state**', (route) => {
    const revision = new URL(route.request().url()).searchParams.get('revisionId');
    if (revision === null) return route.fulfill({ json: snapshot(server) });
    requestedRevisions.push(Number(revision));
    return route.fulfill({ json: snapshot(revisionAt(Number(revision))) });
  });
  await page.route('**/api/projects/1/files/*/download**', (route) => {
    const url = new URL(route.request().url());
    const fileId = Number(url.pathname.split('/').at(-2));
    const revisionId = Number(url.searchParams.get('revisionId'));
    const file = revisionAt(revisionId).files.find((entry) => entry.fileId === fileId);
    expect(file?.contentKind).toBe('binary');
    expect(route.request().headers().authorization).toBe('Bearer 1.workspace-context-secret');
    expect(route.request().headers().accept).toBe('application/octet-stream');
    downloadCalls++;
    return route.fulfill({
      status: 200,
      contentType: file!.mediaType,
      body: Buffer.from(file!.bytes!),
    });
  });
  await page.route('**/api/projects/1/files/*', (route) => {
    const url = new URL(route.request().url());
    const fileId = Number(url.pathname.split('/').at(-1));
    const revisionId = Number(url.searchParams.get('revisionId'));
    const file = revisionAt(revisionId).files.find((entry) => entry.fileId === fileId);
    expect(file?.contentKind).toBe('text');
    return route.fulfill({ json: { ...file, revisionId } });
  });
  await page.route('**/api/projects/1/uploads', async (route) => {
    uploadCalls++;
    const headers = route.request().headers();
    expect(headers.authorization).toBe('Bearer 1.workspace-context-secret');
    expect(headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    const upload = capturedUploads.shift();
    expect(upload).toBeDefined();
    const { filename, mediaType } = upload!;
    const bytes = Buffer.from(upload!.bytes);
    const uploadId = server.nextUploadId++;
    const staged: Upload = { uploadId, filename, mediaType, sha256: hash, bytes };
    server.uploads.set(uploadId, staged);
    return route.fulfill({
      status: 201,
      json: {
        uploadId,
        filename,
        mediaType,
        sizeBytes: bytes.byteLength,
        sha256: hash,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        status: 'available',
      },
    });
  });
  await page.route('**/api/projects/1/changes', async (route) => {
    postCalls++;
    const body = route.request().postDataJSON() as Changes;
    bodies.push(structuredClone(body));
    keys.push(route.request().headers()['idempotency-key']);
    revisions.set(server.revisionId, structuredClone(server));
    if (hooks.beforeSave && (await hooks.beforeSave(route, body, server, postCalls))) return;
    await route.fulfill({ json: apply(server, body) });
  });
  return {
    server,
    bodies,
    keys,
    requestedRevisions,
    uploadCalls: () => uploadCalls,
    postCalls: () => postCalls,
    downloadCalls: () => downloadCalls,
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
}

async function openResources(page: Page) {
  const width = await page.evaluate(() => window.innerWidth);
  if (width <= 720) {
    const toggle = page.getByRole('button', { name: /(?:Показати|Приховати) файли/ });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
  await page.getByRole('button', { name: 'Додати до проєкту', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Завантажити файл', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Завантажити файл', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
}

async function attachPng(page: Page, name = 'diagram.png', directory = '') {
  const dialog = page.getByRole('dialog', { name: 'Завантажити файл', exact: true });
  const bytes = Buffer.from('fake-png-resource');
  await dialog.getByLabel('Вибрати файл', { exact: true }).setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: bytes,
  });
  await expect(dialog.getByLabel('Папка', { exact: true })).toHaveValue(directory);
  await expect(dialog.getByLabel('Назва файла', { exact: true })).toHaveValue(name);
  return bytes;
}

async function openFileActionMenu(page: Page, path: string, action: string) {
  const width = await page.evaluate(() => window.innerWidth);
  if (width <= 720) {
    const toggle = page.getByRole('button', { name: /(?:Показати|Приховати) файли/ });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await page.getByRole('button', { name: `Дії з файлом: ${path}`, exact: true }).click();
  } else {
    await page.getByRole('button', { name: path, exact: true }).click({ button: 'right' });
  }
  await page.getByRole('menuitem', { name: action, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
}

async function selectResource(page: Page, path: string) {
  const width = await page.evaluate(() => window.innerWidth);
  if (width <= 720) {
    const toggle = page.getByRole('button', { name: /(?:Показати|Приховати) файли/ });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
  await page.getByRole('button', { name: path, exact: true }).click();
  if (width <= 720)
    await expect(page.getByRole('dialog', { name: 'Файли', exact: true })).toHaveCount(0);
}

const sourceEditor = (page: Page) => page.getByLabel('Вихідний текст', { exact: true });

test('uploads a resource to the selected file parent with the browser filename by default', async ({
  page,
}) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await selectResource(page, 'chapters/intro.typ');
  await openResources(page);
  const dialog = page.getByRole('dialog', { name: 'Завантажити файл', exact: true });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const bytes = await attachPng(page, 'diagram.png', 'chapters');
  await dialog.evaluate((element) => {
    const messages: string[] = [];
    const observer = new MutationObserver(() => {
      const message = element.querySelector('#resource-error')?.textContent?.trim();
      if (message) messages.push(message);
    });
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    (window as Window & { __resourceValidationMessages?: string[] }).__resourceValidationMessages =
      messages;
  });
  await dialog.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const validationMessages = await page.evaluate(
    () =>
      (window as Window & { __resourceValidationMessages?: string[] }).__resourceValidationMessages,
  );
  expect(validationMessages).not.toContain('Файл із таким шляхом уже існує.');
  await expect.poll(() => api.postCalls()).toBe(1);
  expect(api.uploadCalls()).toBe(1);
  expect(api.bodies[0]!.operations).toEqual([
    { type: 'attachFile', path: 'chapters/diagram.png', uploadId: 30 },
  ]);
  expect(api.server.files.find((file) => file.path === 'chapters/diagram.png')?.bytes).toEqual(
    bytes,
  );
});

test('repeats an uncertain attachment with the same key and without staging the file again', async ({
  page,
}) => {
  await installSession(page);
  let accepted: ReturnType<typeof apply> | undefined;
  const api = await installApi(page, {
    beforeSave: async (route, body, server) => {
      if (accepted) await route.fulfill({ status: 201, json: accepted });
      else {
        accepted = apply(server, body);
        await route.abort();
      }
      return true;
    },
  });
  await openWorkspace(page);
  await openResources(page);
  await attachPng(page, 'diagram%0A.png');
  const dialog = page.getByRole('dialog', { name: 'Завантажити файл', exact: true });
  await dialog.getByRole('button', { name: 'Додати', exact: true }).click();
  await dialog.getByRole('button', { name: 'Повторити', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.uploadCalls()).toBe(1);
  expect(api.postCalls()).toBe(2);
  expect(api.keys[0]).toBeTruthy();
  expect(api.keys[1]).toBe(api.keys[0]);
  expect(api.bodies[1]).toEqual(api.bodies[0]);
  expect(api.server.files.filter((file) => file.path === 'diagram%0A.png')).toHaveLength(1);
});

test('saves project context with text and reloads the accepted context', async ({ page }) => {
  await installSession(page);
  const api = await installApi(page);
  await openWorkspace(page);
  await expect(sourceEditor(page)).toContainText('# Початок');
  const context = page.getByLabel('Контекст проєкту', { exact: true });
  await pauseAutosaveClock(page);
  try {
    await replaceSourceText(sourceEditor(page), '# Змінений документ');
    await page.getByRole('button', { name: 'Контекст', exact: true }).press('Enter');
    await context.fill('Домовленість: використовувати українську мову.');
    await context.press('ControlOrMeta+s');
    await expect.poll(() => api.bodies.length).toBe(1);
  } finally {
    await page.clock.resume();
  }
  await expect(page.locator('.editor-save-status')).toContainText('Збережено');
  expect(api.bodies).toHaveLength(1);
  expect(api.bodies[0]!.operations).toEqual([
    { type: 'updateText', fileId: 10, content: '# Змінений документ' },
    { type: 'updateContext', content: 'Домовленість: використовувати українську мову.' },
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Контекст', exact: true }).click();
  await expect(page.getByLabel('Контекст проєкту', { exact: true })).toHaveValue(
    'Домовленість: використовувати українську мову.',
  );
});

test('compares server context and requires an explicit merge before saving', async ({ page }) => {
  await installSession(page);
  const api = await installApi(page, {
    beforeSave: async (route, body, server, call) => {
      if (call !== 1 || !body.operations.some((operation) => operation.type === 'updateContext'))
        return false;
      server.contextText = 'Контекст від іншої вкладки';
      server.revisionId++;
      await route.fulfill({ status: 409, json: apiError('REVISION_CONFLICT') });
      return true;
    },
  });
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Контекст', exact: true }).click();
  await page.getByLabel('Контекст проєкту', { exact: true }).fill('Локальний контекст');
  await page
    .getByLabel('Контекст проєкту', { exact: true })
    .press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  await page.getByRole('button', { name: 'Порівняти версії', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Узгодження змін', exact: true })).toBeVisible();
  await expect(page.getByLabel('Серверний текст: Контекст проєкту', { exact: true })).toHaveValue(
    'Контекст від іншої вкладки',
  );
  await page
    .getByLabel('Об’єднаний текст: Контекст проєкту', { exact: true })
    .fill('Узгоджений контекст');
  await page.getByRole('button', { name: 'Продовжити автозбереження', exact: true }).click();
  await expect.poll(() => api.postCalls()).toBe(2);
  expect(api.bodies[1]!.baseRevisionId).toBe(101);
  expect(api.bodies[1]!.operations).toEqual([
    { type: 'updateContext', content: 'Узгоджений контекст' },
  ]);
  await expect(page.locator('.editor-save-status')).toContainText('Збережено');
  expect(api.server.contextText).toBe('Узгоджений контекст');
});

test('keeps an uploaded resource staged until conflict replay is chosen, then downloads and replaces it', async ({
  page,
}) => {
  await installSession(page);
  const api = await installApi(page, {
    beforeSave: async (route, _body, server, call) => {
      if (call !== 1) return false;
      server.contextText = 'Зовнішня зміна';
      server.revisionId++;
      await route.fulfill({ status: 409, json: apiError('REVISION_CONFLICT') });
      return true;
    },
  });
  await openWorkspace(page);
  const originalBytes = await (async () => {
    await openResources(page);
    return attachPng(page);
  })();
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Порівняти версії', exact: true })).toBeVisible();
  expect(api.uploadCalls()).toBe(1);
  expect(api.postCalls()).toBe(1);
  expect(api.server.files.some((file) => file.path === 'diagram.png')).toBe(false);
  await page.getByRole('button', { name: 'Порівняти версії', exact: true }).click();
  const replay = page.getByLabel('Повторити дію: Додати diagram.png', { exact: true });
  await expect(replay).toBeVisible();
  await expect(replay).not.toBeChecked();
  await replay.check();
  await page.getByRole('button', { name: 'Продовжити автозбереження', exact: true }).click();
  await expect.poll(() => api.postCalls()).toBe(2);
  expect(api.uploadCalls()).toBe(1);
  expect(api.bodies[1]!.operations).toEqual([
    { type: 'attachFile', path: 'diagram.png', uploadId: 30 },
  ]);
  expect(api.requestedRevisions).toContain(102);
  expect(api.server.files.find((file) => file.path === 'diagram.png')?.fileId).toBe(13);
  await selectResource(page, 'diagram.png');
  await expect(page.getByRole('button', { name: 'Скачати файл', exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачати файл', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('diagram.png');
  expect(api.downloadCalls()).toBe(1);
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(await readFile(path!)).toEqual(originalBytes);

  await selectResource(page, 'main.typ');
  await openFileActionMenu(page, 'diagram.png', 'Замінити файл');
  const replaceDialog = page.getByRole('dialog', { name: 'Замінити файл', exact: true });
  const replacementBytes = Buffer.from('replacement-image-bytes');
  await replaceDialog.getByLabel('Вибрати файл', { exact: true }).setInputFiles({
    name: 'replacement.png',
    mimeType: 'image/png',
    buffer: replacementBytes,
  });
  await replaceDialog.getByRole('button', { name: 'Замінити', exact: true }).click();
  await expect(replaceDialog).toHaveCount(0);
  await expect.poll(() => api.postCalls()).toBe(3);
  await expect(sourceEditor(page)).toBeVisible();
  expect(api.bodies[2]!.operations).toEqual([{ type: 'replaceFile', fileId: 13, uploadId: 31 }]);
  const replaced = api.server.files.find((file) => file.fileId === 13);
  expect(replaced?.path).toBe('diagram.png');
  expect(replaced?.bytes).toEqual(replacementBytes);
  expect(api.uploadCalls()).toBe(2);
});
