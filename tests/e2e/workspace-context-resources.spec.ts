import { readFile } from 'node:fs/promises';
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
    nextFileId: 12,
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
    ],
    uploads: new Map(),
  };
  const bodies: Changes[] = [];
  const keys: (string | undefined)[] = [];
  const requestedRevisions: number[] = [];
  let uploadCalls = 0;
  let postCalls = 0;
  let downloadCalls = 0;
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [project], nextCursor: null } }),
  );
  await page.route('**/api/projects/1/state**', (route) => {
    const revision = new URL(route.request().url()).searchParams.get('revisionId');
    if (revision !== null) {
      requestedRevisions.push(Number(revision));
      expect(Number(revision)).toBe(server.revisionId);
    }
    return route.fulfill({ json: snapshot(server) });
  });
  await page.route('**/api/projects/1/files/*/download**', (route) => {
    const url = new URL(route.request().url());
    const fileId = Number(url.pathname.split('/').at(-2));
    const revisionId = Number(url.searchParams.get('revisionId'));
    const file = server.files.find((entry) => entry.fileId === fileId);
    expect(file?.contentKind).toBe('binary');
    expect(revisionId).toBe(server.revisionId);
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
    const file = server.files.find((entry) => entry.fileId === fileId);
    expect(file?.contentKind).toBe('text');
    expect(revisionId).toBe(server.revisionId);
    return route.fulfill({ json: { ...file, revisionId } });
  });
  await page.route('**/api/projects/1/uploads', async (route) => {
    uploadCalls++;
    const headers = route.request().headers();
    expect(headers.authorization).toBe('Bearer 1.workspace-context-secret');
    expect(headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    const raw = route.request().postDataBuffer()?.toString('latin1') ?? '';
    const filename = /filename="([^"]+)"/.exec(raw)?.[1];
    expect(filename).toBeTruthy();
    const blob = raw.split('\r\n\r\n').at(-1)?.split('\r\n--').at(0) ?? '';
    const bytes = Buffer.from(blob, 'latin1');
    const mediaType = filename!.endsWith('.png') ? 'image/png' : 'application/pdf';
    const uploadId = server.nextUploadId++;
    const staged: Upload = { uploadId, filename: filename!, mediaType, sha256: hash, bytes };
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
  await page.getByRole('button', { name: 'Додати ресурс', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Додати ресурс', exact: true })).toBeVisible();
}

async function attachPng(page: Page, name = 'diagram.png') {
  const dialog = page.getByRole('dialog', { name: 'Додати ресурс', exact: true });
  const bytes = Buffer.from('fake-png-resource');
  await dialog.getByLabel('Вибрати файл', { exact: true }).setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: bytes,
  });
  await expect(dialog.getByLabel('Шлях у проєкті', { exact: true })).toHaveValue(name);
  return bytes;
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
  const dialog = page.getByRole('dialog', { name: 'Додати ресурс', exact: true });
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
  await sourceEditor(page).fill('# Змінений документ');
  await page.getByRole('button', { name: 'Контекст', exact: true }).click();
  const context = page.getByLabel('Контекст проєкту', { exact: true });
  await context.fill('Домовленість: використовувати українську мову.');
  await context.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
  await expect(page.getByRole('status')).toContainText('Збережено');
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
  await expect(page.getByRole('status')).toContainText('Збережено');
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
  expect(api.server.files.find((file) => file.path === 'diagram.png')?.fileId).toBe(12);
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

  await page.getByRole('button', { name: 'Дії з файлом: diagram.png', exact: true }).click();
  await page.getByRole('button', { name: 'Замінити ресурс', exact: true }).click();
  const replaceDialog = page.getByRole('dialog', { name: 'Замінити ресурс', exact: true });
  const replacementBytes = Buffer.from('replacement-image-bytes');
  await replaceDialog.getByLabel('Вибрати файл', { exact: true }).setInputFiles({
    name: 'replacement.png',
    mimeType: 'image/png',
    buffer: replacementBytes,
  });
  await replaceDialog.getByRole('button', { name: 'Замінити', exact: true }).click();
  await expect(replaceDialog).toHaveCount(0);
  await expect.poll(() => api.postCalls()).toBe(3);
  await expect(
    page.getByRole('button', { name: 'Дії з файлом: diagram.png', exact: true }),
  ).toBeVisible();
  expect(api.bodies[2]!.operations).toEqual([{ type: 'replaceFile', fileId: 12, uploadId: 31 }]);
  const replaced = api.server.files.find((file) => file.fileId === 12);
  expect(replaced?.path).toBe('diagram.png');
  expect(replaced?.bytes).toEqual(replacementBytes);
  expect(api.uploadCalls()).toBe(2);
});
