import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { Compilation } from '../../src/modules/workspace/compilation-api';
import { installWorkspaceStartupMock } from './workspace-startup-fixture';

const date = '2026-11-12T10:30:00Z';
const hash = 'a'.repeat(64);
const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: date,
};
const file = {
  fileId: 10,
  path: 'main.typ',
  contentKind: 'text',
  sha256: hash,
  sizeBytes: 6,
  mediaType: 'text/plain',
};
const project = { id: 1, title: 'Дослідницький звіт', createdAt: date, updatedAt: date };
const expiresAt = () => new Date(Date.now() + 600_000).toISOString();
const job = (
  revisionId: number,
  status: Compilation['status'],
  extra: Partial<Compilation> = {},
): Compilation => ({
  id: 50,
  projectId: 1,
  revisionId,
  proposalId: null,
  candidateVersion: null,
  candidateSnapshotId: null,
  status,
  errorCode: null,
  inputManifestHash: hash,
  compilerFingerprint: status === 'queued' ? null : hash,
  isCurrent: true,
  artifactAvailable: status === 'succeeded',
  artifactExpiresAt: status === 'succeeded' ? expiresAt() : null,
  diagnostics: [],
  createdAt: date,
  startedAt: null,
  finishedAt: null,
  ...extra,
});

function pdfFixture(secondPageHeight = 170) {
  const stream = 'BT /F1 18 Tf 20 130 Td (Research report) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 160] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 180 ${secondPageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = ['0000000000 65535 f \n'];
  for (const [i, object] of objects.entries()) {
    offsets.push(`${String(pdf.length).padStart(10, '0')} 00000 n \n`);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n${offsets.join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function installWorkspace(page: Page, initialHead = 100) {
  await page.addInitScript(
    (session) => localStorage.setItem('typstoria.session', JSON.stringify(session)),
    {
      user,
      accessToken: '1.workspace-fe3',
      tokenType: 'Bearer',
      expiresAt: expiresAt(),
    },
  );
  const text = new Map([
    [100, 'Original'],
    [101, 'Current'],
  ]);
  const server = { head: initialHead, saveCount: 0 };
  function revision(id: number) {
    return {
      id,
      number: id - 99,
      parentRevisionId: id > 100 ? id - 1 : null,
      createdAt: date,
      commitSha: null,
      manifestHash: hash,
      historySyncStatus: 'pending',
    };
  }
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/projects/1/state**', (route) => {
    const revisionId = Number(
      new URL(route.request().url()).searchParams.get('revisionId') ?? server.head,
    );
    return route.fulfill({
      json: {
        project: { ...project, currentRevisionId: server.head },
        revision: revision(revisionId),
        mainFileId: 10,
        contextText: '',
        tree: [file],
      },
    });
  });
  await page.route('**/api/projects/1/files/10?*', (route) => {
    const revisionId = Number(new URL(route.request().url()).searchParams.get('revisionId'));
    return route.fulfill({ json: { ...file, revisionId, content: text.get(revisionId) } });
  });
  await page.route('**/api/projects/1/changes', (route) => {
    expect(route.request().postDataJSON().baseRevisionId).toBe(server.head);
    server.saveCount++;
    server.head++;
    text.set(server.head, route.request().postDataJSON().operations[0].content);
    return route.fulfill({
      status: 201,
      json: {
        projectId: 1,
        revisionId: server.head,
        revisionNumber: server.head - 99,
        mainFileId: 10,
        createdFiles: [],
        manifestHash: hash,
        historySyncStatus: 'pending',
      },
    });
  });
  await page.route('**/api/projects/1/revisions?*', (route) =>
    route.fulfill({
      json: {
        items: Array.from({ length: server.head - 99 }, (_, i) => {
          const id = server.head - i;
          return {
            ...revision(id),
            actorId: 1,
            projectId: 1,
            historyErrorCode: null,
            channel: 'web',
            operation: id === 100 ? 'create' : 'save',
            summary: '',
            isCurrent: id === server.head,
          };
        }),
        nextCursor: null,
      },
    }),
  );
  await page.route('**/api/projects/1/revisions/*/diff?*', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        fromRevisionId: Number(url.searchParams.get('against')),
        toRevisionId: Number(url.pathname.split('/').at(-2)),
        fromHistorySyncStatus: 'pending',
        toHistorySyncStatus: 'pending',
        files: [
          {
            fileId: 10,
            changes: ['modified'],
            before: file,
            after: file,
            patch: '--- a/main.typ\n+++ b/main.typ\n@@ -1 +1 @@\n-Original\n+Current\n',
            patchOmittedReason: null,
          },
        ],
        context: { changed: false, patch: null, patchOmittedReason: null },
        entrypoint: { changed: false, beforeFileId: 10, afterFileId: 10 },
      },
    });
  });
  await installWorkspaceStartupMock(page, initialHead);
  return { server, text };
}

function bearer(route: Route) {
  expect(route.request().headers().authorization).toBe('Bearer 1.workspace-fe3');
  expect(route.request().url()).not.toContain('workspace-fe3');
}

test('saves the draft before compiling and shows a protected, paginated PDF', async ({ page }) => {
  const { server } = await installWorkspace(page);
  const pdf = pdfFixture();
  const accepted: number[] = [];
  await page.route('**/api/projects/1/compilations', (route) => {
    bearer(route);
    const { revisionId } = route.request().postDataJSON();
    expect(revisionId).toBe(server.head);
    expect(server.saveCount).toBe(1);
    accepted.push(revisionId);
    return route.fulfill({ status: 202, json: job(revisionId, 'queued') });
  });
  await page.route('**/api/projects/1/compilations/50', (route) => {
    bearer(route);
    return route.fulfill({ json: job(101, 'succeeded') });
  });
  await page.route('**/api/projects/1/compilations/50/pdf', (route) => {
    bearer(route);
    return route.fulfill({ contentType: 'application/pdf', body: pdf });
  });
  await page.goto('/projects/1');
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  await editor.fill('New revision');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await page.getByRole('button', { name: 'Зберегти й скомпілювати' }).click();
  await expect(page.getByLabel('Текст сторінки')).toContainText('Research report');
  expect(accepted).toEqual([101]);
  await page.getByRole('button', { name: 'Наступна сторінка' }).click();
  await expect(page.getByRole('navigation', { name: 'Сторінки PDF' })).toContainText('2 / 2');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Завантажити PDF' }).click();
  expect(await readFile((await (await downloaded).path())!)).toEqual(pdf);
  const singlePanel = !(await editor.isVisible());
  if (singlePanel) await page.getByRole('button', { name: 'Редактор', exact: true }).click();
  await editor.fill('Unsaved edits');
  const result = page.getByRole('button', { name: 'Результат', exact: true });
  if ((await result.getAttribute('aria-pressed')) === 'false') await result.click();
  await expect(page.getByText(/PDF версії 2/)).toBeVisible();
  if (singlePanel)
    await expect(page.getByRole('navigation', { name: 'Сторінки PDF' })).toContainText('2 / 2');
});

test('preserves the PDF page and scroll position when switching to diagnostics', async ({
  page,
}) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'queued') }),
  );
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({
      json: job(100, 'succeeded', {
        diagnostics: [
          {
            fileId: 10,
            path: 'main.typ',
            severity: 'warning',
            message: 'Test warning',
            range: null,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture(700) }),
  );
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  const pagination = page.getByRole('navigation', { name: 'Сторінки PDF' });
  await page.getByRole('button', { name: 'Наступна сторінка' }).click();
  await expect(pagination).toContainText('2 / 2');
  await expect(page.getByLabel('Текст сторінки')).toContainText('Research report');
  const frame = page.locator('.pdf-page-frame');
  await frame.evaluate((element) => {
    element.scrollTop = 50;
  });
  await expect.poll(() => frame.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const scrollTop = await frame.evaluate((element) => element.scrollTop);
  await page.getByRole('button', { name: 'Діагностика (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Діагностика (1)', exact: true })).toBeFocused();
  await expect(page.getByText('Test warning', { exact: true })).toBeVisible();
  await expect(pagination).toBeHidden();
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeFocused();
  await expect(pagination).toContainText('2 / 2');
  await expect.poll(() => frame.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});

test('keeps warnings visible during a delayed PDF download and its retry', async ({ page }) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({
      status: 202,
      json: job(100, 'succeeded', {
        diagnostics: [
          {
            fileId: 10,
            path: 'main.typ',
            severity: 'warning',
            message: 'Test warning',
            range: null,
          },
        ],
      }),
    }),
  );
  let release!: () => void;
  let pending = new Promise<void>((resolve) => (release = resolve));
  let downloads = 0;
  await page.route('**/api/projects/1/compilations/50/pdf', async (route) => {
    const attempt = ++downloads;
    await pending;
    if (attempt === 1) await route.abort();
    else await route.fulfill({ contentType: 'application/pdf', body: pdfFixture() });
  });
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await page.getByRole('button', { name: 'Діагностика (1)', exact: true }).click();
  const warning = page.getByText('Test warning', { exact: true });
  await expect(warning).toBeVisible();
  await expect.poll(() => downloads).toBe(1);
  release();
  const retry = page.getByRole('button', { name: 'Повторити завантаження', exact: true });
  await expect(retry).toBeVisible();
  await expect(warning).toBeVisible();
  pending = new Promise<void>((resolve) => (release = resolve));
  await retry.click();
  await expect.poll(() => downloads).toBe(2);
  await expect(warning).toBeVisible();
  release();
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await expect(page.getByLabel('Текст сторінки')).toContainText('Research report');
  await page.getByRole('button', { name: 'Діагностика (1)', exact: true }).click();
  await expect(warning).toBeVisible();
});

test('opens diagnostics in the source and preserves the editor after a Typst error', async ({
  page,
}) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'queued') }),
  );
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({
      json: job(100, 'failed', {
        errorCode: 'TYPST_ERROR',
        diagnostics: [
          {
            fileId: 10,
            path: 'main.typ',
            severity: 'error',
            message: 'unclosed delimiter',
            range: null,
          },
        ],
      }),
    }),
  );
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await expect(page.getByText('unclosed delimiter')).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Діагностика (1)', exact: true }).click();
  await page
    .getByRole('region', { name: 'Результат компіляції' })
    .getByRole('button', { name: 'main.typ', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Вихідний текст' })).toContainText('Original');
  await expect(page.getByText('TYPST_ERROR')).toHaveCount(0);
});

test('retries an ambiguous restore with the same key and reloads cached source', async ({
  page,
}) => {
  const { server, text } = await installWorkspace(page, 101);
  const requests: { key: string; body: unknown }[] = [];
  await page.route('**/api/projects/1/restore', async (route) => {
    bearer(route);
    requests.push({
      key: route.request().headers()['idempotency-key']!,
      body: route.request().postDataJSON(),
    });
    if (requests.length === 1) {
      server.head = 102;
      text.set(102, 'Original');
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 201,
      json: {
        projectId: 1,
        revisionId: 102,
        revisionNumber: 3,
        restoredFromRevisionId: 100,
        mainFileId: 10,
        manifestHash: hash,
        historySyncStatus: 'pending',
      },
    });
  });
  await page.goto('/projects/1');
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  await expect(editor).toContainText('Current');
  await page.getByRole('link', { name: 'Історія версій' }).click();
  await expect(page).toHaveURL(/\/projects\/1\/history$/);
  await page.getByRole('button', { name: /^Версія 1/ }).click();
  await page.locator('summary').filter({ hasText: 'main.typ' }).click();
  await expect(page.getByText('+Current', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Файли версії', exact: true }).click();
  await page.getByRole('button', { name: /^main\.typ/ }).click();
  await expect(page.locator('.history-snapshot-text')).toHaveText('Original');
  const filesBack = page.getByRole('button', { name: '← Файли версії', exact: true });
  if (await filesBack.isVisible()) await filesBack.click();
  await page
    .getByRole('button', { name: /До порівняння/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Відновити версію', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Відновити', exact: true }).click();
  await page.getByRole('button', { name: 'Повторити відновлення' }).click();
  await expect(page.getByText('Створено версію 3.')).toBeVisible();
  expect(requests).toEqual([
    {
      key: expect.any(String),
      body: expect.objectContaining({ targetRevisionId: 100, expectedCurrentRevisionId: 101 }),
    },
    requests[0],
  ]);
  expect(requests[0]?.key).toBeTruthy();
  await page.getByRole('link', { name: 'Редактор', exact: true }).click();
  await expect(editor).toContainText('Original');
  expect(server.saveCount).toBe(0);
});

test('waits for an in-flight autosave and saves newer edits before compiling', async ({ page }) => {
  const { server, text } = await installWorkspace(page);
  let allowFirst!: () => void;
  const release = new Promise<void>((resolve) => {
    allowFirst = resolve;
  });
  await page.route('**/api/projects/1/changes', async (route) => {
    if (!server.saveCount) await release;
    await route.fallback();
  });
  await page.route('**/api/projects/1/compilations', (route) => {
    expect(route.request().postDataJSON().revisionId).toBe(102);
    expect(text.get(102)).toBe('Second edit');
    return route.fulfill({ status: 202, json: job(102, 'queued') });
  });
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({ json: job(102, 'failed') }),
  );
  await page.goto('/projects/1');
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  await editor.fill('First edit');
  const first = page.waitForRequest((request) => request.url().endsWith('/changes'));
  await editor.press('Control+s');
  await first;
  await editor.fill('Second edit');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await page.getByRole('button', { name: 'Зберегти й скомпілювати' }).click();
  allowFirst();
  await expect(
    page.getByText('Не вдалося скомпілювати документ. Спробуйте пізніше.'),
  ).toBeVisible();
  expect(server.saveCount).toBe(2);
});

test('refreshes on a concurrent restore conflict and asks for a new confirmation', async ({
  page,
}) => {
  const { server, text } = await installWorkspace(page, 101);
  const expectedHeads: number[] = [];
  await page.route('**/api/projects/1/restore', async (route) => {
    const { expectedCurrentRevisionId } = route.request().postDataJSON();
    expectedHeads.push(expectedCurrentRevisionId);
    if (expectedHeads.length === 1) {
      server.head = 102;
      text.set(102, 'Other tab');
      await route.fulfill({
        status: 409,
        json: { error: { code: 'REVISION_CONFLICT', message: 'Internal details' } },
      });
      return;
    }
    server.head = 103;
    text.set(103, 'Original');
    await route.fulfill({
      status: 201,
      json: {
        projectId: 1,
        revisionId: 103,
        revisionNumber: 4,
        restoredFromRevisionId: 100,
        mainFileId: 10,
        manifestHash: hash,
        historySyncStatus: 'pending',
      },
    });
  });
  await page.goto('/projects/1/history');
  const original = page.getByRole('button', { name: /^Версія 1/ });
  const restore = async () => {
    await original.click();
    await page.getByRole('button', { name: 'Відновити версію', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Відновити', exact: true }).click();
  };
  await restore();
  await expect(page.getByText(/З’явилася новіша версія/)).toBeVisible();
  expect(expectedHeads).toEqual([101]);
  await expect(page.getByText('Internal details')).toHaveCount(0);
  await restore();
  await expect(page.getByText('Створено версію 4.')).toBeVisible();
  expect(expectedHeads).toEqual([101, 102]);
});

test('compiles the selected saved revision and handles an expired PDF without downloading', async ({
  page,
}) => {
  const { server } = await installWorkspace(page);
  const accepted: number[] = [];
  let downloads = 0;
  await page.route('**/api/projects/1/compilations', (route) => {
    const { revisionId } = route.request().postDataJSON();
    accepted.push(revisionId);
    return route.fulfill({ status: 202, json: job(revisionId, 'queued') });
  });
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({
      json: job(100, 'succeeded', { artifactAvailable: false, artifactExpiresAt: date }),
    }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) => {
    downloads++;
    return route.abort();
  });
  await page.goto('/projects/1');
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  await editor.fill('Pending edit');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await page.getByRole('button', { name: 'Скомпілювати версію 1', exact: true }).click();
  await expect(
    page.getByText('PDF більше недоступний. Скомпілюйте документ ще раз.'),
  ).toBeVisible();
  expect(accepted).toEqual([100]);
  expect(downloads).toBe(0);
  await expect.poll(() => server.saveCount).toBe(1);
});
