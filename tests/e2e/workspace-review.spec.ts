import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installWorkspaceStartupMock, pdfFixture } from './workspace-startup-fixture';

const now = '2026-11-19T09:00:00.000Z';
const hash = 'b'.repeat(64);
const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: now,
};
const project = {
  id: 1,
  title: 'Курсова робота',
  currentRevisionId: 100,
  createdAt: now,
  updatedAt: now,
};
const acceptedRevision = {
  id: 100,
  number: 1,
  parentRevisionId: null as number | null,
  createdAt: now,
  manifestHash: 'a'.repeat(64),
  commitSha: null,
  historySyncStatus: 'ready',
};
const proposal = {
  id: 44,
  projectId: 1,
  creatorId: 2,
  channel: 'mcp',
  status: 'draft',
  version: 3,
  baseRevisionId: 100,
  candidateSnapshotId: 203,
  candidateManifestHash: hash,
  summary: 'Уточнити вступ',
  isStale: false,
  acceptedRevisionId: null,
  latestValidationId: null,
  createdAt: now,
  expiresAt: '2026-11-26T09:00:00.000Z',
};
const file = {
  fileId: 10,
  path: 'main.typ',
  contentKind: 'text',
  sha256: hash,
  sizeBytes: 60,
  mediaType: 'text/plain; charset=utf-8',
};
const candidate = {
  proposalId: proposal.id,
  candidateVersion: proposal.version,
  baseRevisionId: proposal.baseRevisionId,
  candidateSnapshotId: proposal.candidateSnapshotId,
  candidateManifestHash: proposal.candidateManifestHash,
  mainFileId: file.fileId,
  contextText: '',
  tree: [file],
  directories: [],
  operations: [{ type: 'updateText', fileId: file.fileId, content: '= Вступ\n\nОновлений текст.' }],
};
const diff = {
  proposalId: proposal.id,
  baseRevisionId: proposal.baseRevisionId,
  candidateVersion: proposal.version,
  candidateManifestHash: proposal.candidateManifestHash,
  files: [
    {
      fileId: file.fileId,
      changes: ['modified'],
      before: file,
      after: file,
      patch: '@@ -1 +1,3 @@\n-= Вступ\n+= Вступ\n+\n+Оновлений текст.',
      patchOmittedReason: null,
    },
  ],
  directories: { added: [], deleted: [] },
  context: { changed: false, patch: null, patchOmittedReason: null },
  entrypoint: { changed: false, beforeFileId: 10, afterFileId: 10 },
};

type ValidationStatus = 'succeeded' | 'compile_failed';

async function installSession(page: Page) {
  await page.addInitScript(
    (session) => localStorage.setItem('typstoria.session', JSON.stringify(session)),
    {
      user,
      accessToken: '1.review-test-secret',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  );
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/projects/1/state**', (route) => {
    const isBase = new URL(route.request().url()).searchParams.get('revisionId') === '100';
    return route.fulfill({
      json: {
        project,
        revision:
          isBase && rebaseMode
            ? { ...acceptedRevision, id: 100, parentRevisionId: null, number: 1 }
            : acceptedRevision,
        mainFileId: 10,
        contextText: '',
        tree: [rebaseMode === 'overlap' && !isBase ? { ...file, sha256: 'c'.repeat(64) } : file],
        directories: [],
      },
    });
  });
  await page.route('**/api/projects/1/files/10**', (route) =>
    route.fulfill({
      json: {
        ...file,
        revisionId: acceptedRevision.id,
        content:
          acceptedRevision.id === 100
            ? '= Вступ\n\nПочатковий текст.'
            : '= Вступ\n\nОновлений текст.',
      },
    }),
  );
  await installWorkspaceStartupMock(page);
  await page.route('**/api/projects/1/compilations/81/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture() }),
  );
  await page.route('**/api/projects/1/proposals**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (method === 'GET' && path.endsWith('/proposals')) {
      return route.fulfill({ json: { items: [proposal], nextCursor: null } });
    }
    if (method === 'GET' && path.endsWith('/proposals/44')) {
      return route.fulfill({ json: proposal });
    }
    if (method === 'GET' && path.endsWith('/proposals/44/candidate')) {
      expect(url.searchParams.get('candidateVersion')).toBe(String(proposal.version));
      return route.fulfill({ json: candidate });
    }
    if (method === 'GET' && path.endsWith('/proposals/44/diff')) {
      expect(url.searchParams.get('candidateVersion')).toBe(String(proposal.version));
      return route.fulfill({ json: diff });
    }
    if (method === 'GET' && path.endsWith('/proposals/44/files/10')) {
      expect(url.searchParams.get('candidateVersion')).toBe(String(proposal.version));
      return route.fulfill({
        json: {
          ...file,
          candidateVersion: proposal.version,
          content: '= Вступ\n\nОновлений текст.',
        },
      });
    }
    if (method === 'POST' && path.endsWith('/proposals/44/validate')) {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ expectedProposalVersion: proposal.version });
      return route.fulfill({
        status: 202,
        json: {
          id: 61,
          proposalId: proposal.id,
          candidateVersion: proposal.version,
          candidateManifestHash: hash,
          status: validationStatus,
          compileJobId: 81,
          errorCode: validationStatus === 'compile_failed' ? 'TYPST_ERROR' : null,
          diagnostics:
            validationStatus === 'compile_failed'
              ? [
                  {
                    fileId: 10,
                    path: 'main.typ',
                    severity: 'error',
                    message: 'Незакриті дужки',
                    range: null,
                  },
                ]
              : [],
          createdAt: now,
        },
      });
    }
    if (method === 'GET' && path.endsWith('/proposals/44/validations/61')) {
      return route.fulfill({
        json: {
          id: 61,
          proposalId: proposal.id,
          candidateVersion: proposal.version,
          candidateManifestHash: hash,
          status: validationStatus,
          compileJobId: 81,
          errorCode: validationStatus === 'compile_failed' ? 'TYPST_ERROR' : null,
          diagnostics:
            validationStatus === 'compile_failed'
              ? [
                  {
                    fileId: 10,
                    path: 'main.typ',
                    severity: 'error',
                    message: 'Незакриті дужки',
                    range: null,
                  },
                ]
              : [],
          createdAt: now,
        },
      });
    }
    if (method === 'POST' && path.endsWith('/proposals/44/accept')) {
      acceptCalls++;
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({
        baseRevisionId: 100,
        expectedProposalVersion: 3,
        candidateManifestHash: hash,
        validationId: 61,
        acknowledgeCompileFailure: validationStatus === 'compile_failed',
      });
      const key = route.request().headers()['idempotency-key'];
      expect(key).toBeTruthy();
      acceptKeys.push(key!);
      if (loseAcceptResponse && acceptCalls === 1) {
        // Apply the mutation while simulating a lost response after commit.
        acceptedRevision.id = 101;
        acceptedRevision.number = 2;
        acceptedRevision.parentRevisionId = 100;
        project.currentRevisionId = 101;
        return route.abort('connectionreset');
      }
      acceptedRevision.id = 101;
      acceptedRevision.number = 2;
      acceptedRevision.parentRevisionId = 100;
      project.currentRevisionId = 101;
      return route.fulfill({
        status: 201,
        json: {
          projectId: 1,
          revisionId: 101,
          revisionNumber: 2,
          mainFileId: 10,
          manifestHash: hash,
          historySyncStatus: 'pending',
          proposalId: 44,
        },
      });
    }
    if (method === 'POST' && path.endsWith('/proposals/44/reject')) {
      rejectCalls++;
      expect(route.request().postDataJSON()).toEqual({ expectedProposalVersion: 3 });
      return route.fulfill({ json: { ...proposal, status: 'rejected' } });
    }
    if (method === 'POST' && path.endsWith('/proposals/44/rebase')) {
      rebaseCalls++;
      expect(route.request().postDataJSON()).toEqual({
        baseRevisionId: 101,
        expectedProposalVersion: 3,
        operations: candidate.operations,
        summary: proposal.summary,
      });
      proposal.version = candidate.candidateVersion = diff.candidateVersion = 4;
      proposal.baseRevisionId = candidate.baseRevisionId = diff.baseRevisionId = 101;
      proposal.isStale = false;
      return route.fulfill({ json: proposal });
    }
    throw new Error(`Unexpected review request ${method} ${path}`);
  });
  await page.route('**/api/projects/1', (route) => route.fulfill({ json: project }));
}

let validationStatus: ValidationStatus = 'succeeded';
let acceptCalls = 0;
let rejectCalls = 0;
let loseAcceptResponse = false;
let acceptKeys: string[] = [];
let rebaseMode: 'clean' | 'overlap' | null = null;
let rebaseCalls = 0;

test.beforeEach(() => {
  validationStatus = 'succeeded';
  acceptCalls = 0;
  rejectCalls = 0;
  loseAcceptResponse = false;
  acceptKeys = [];
  rebaseMode = null;
  rebaseCalls = 0;
  proposal.version = candidate.candidateVersion = diff.candidateVersion = 3;
  proposal.baseRevisionId = candidate.baseRevisionId = diff.baseRevisionId = 100;
  proposal.isStale = false;
  acceptedRevision.id = 100;
  acceptedRevision.number = 1;
  acceptedRevision.parentRevisionId = null;
  project.currentRevisionId = 100;
});

async function openReview(page: Page) {
  await installSession(page);
  await page.goto('/projects/1');
  await expect(page.getByRole('heading', { name: project.title })).toBeVisible();
  const desktopMenu = page.getByRole('navigation', { name: 'Меню робочого простору' });
  if (await desktopMenu.isVisible()) {
    await desktopMenu.getByRole('button', { name: 'Проєкт', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Меню', exact: true }).click();
  }
  await page.getByRole('menuitem', { name: 'ШІ-пропозиції', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'ШІ-пропозиції' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: new RegExp(proposal.summary) }).click();
  await expect(dialog.getByText('Оновлений текст.')).toBeVisible();
}

test('reviews and accepts the exact validated proposal from desktop and mobile', async ({
  page,
}, testInfo) => {
  await openReview(page);
  await page.screenshot({ path: testInfo.outputPath('review-selected.png') });
  await page.getByRole('button', { name: 'Перевірити', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Перевірку пройдено' })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'ШІ-пропозиції' });
  await dialog.getByRole('button', { name: 'Переглянути PDF' }).click();
  await expect(dialog.getByLabel('Поточна сторінка')).toHaveText('1 / 1');
  await dialog.getByRole('button', { name: 'Закрити PDF' }).click();
  await page.getByRole('button', { name: 'Прийняти пропозицію', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Пропозицію прийнято. Версія 2.' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Закрити пропозиції' }).click();
  await expect(page.getByLabel('Вихідний текст')).toContainText('Оновлений текст.');
  expect(acceptCalls).toBe(1);
});

test('requires explicit acknowledgement for a Typst error', async ({ page }) => {
  validationStatus = 'compile_failed';
  await openReview(page);
  await page.getByRole('button', { name: 'Перевірити', exact: true }).click();
  await expect(page.getByText('Незакриті дужки')).toBeVisible();
  await page.getByRole('button', { name: 'Прийняти пропозицію', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Я розумію/i })).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Прийняти попри помилку', exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /Я розумію/i }).check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Пропозицію прийнято. Версія 2.' }),
  ).toBeVisible();
  expect(acceptCalls).toBe(1);
  expect(rejectCalls).toBe(0);
});

test('retries an unconfirmed acceptance with the same key', async ({ page }) => {
  loseAcceptResponse = true;
  await openReview(page);
  await page.getByRole('button', { name: 'Перевірити', exact: true }).click();
  const accept = page.getByRole('button', { name: 'Прийняти пропозицію', exact: true });
  await accept.click();
  await expect(page.getByRole('alert')).toContainText('Не вдалося підтвердити прийняття.');
  await accept.click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Пропозицію прийнято. Версія 2.' }),
  ).toBeVisible();
  expect(acceptKeys).toEqual([acceptKeys[0], acceptKeys[0]]);
});

test('rejects a draft after confirmation', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Відхилити', exact: true }).click();
  await page.getByRole('button', { name: 'Відхилити пропозицію', exact: true }).click();
  await expect(page.getByText('Відхилено · Зовнішній ШІ')).toBeVisible();
  expect(rejectCalls).toBe(1);
  expect(acceptCalls).toBe(0);
});

for (const mode of ['clean', 'overlap'] as const) {
  test(`checks stale proposal changes before rebase (${mode})`, async ({ page }) => {
    rebaseMode = mode;
    proposal.isStale = true;
    project.currentRevisionId = acceptedRevision.id = 101;
    acceptedRevision.number = 2;
    acceptedRevision.parentRevisionId = 100;
    await openReview(page);
    await expect(page.getByRole('button', { name: 'Прийняти пропозицію' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Оновити базу', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Оновити базову версію?' })
      .getByRole('button', { name: 'Оновити базу', exact: true })
      .click();
    if (mode === 'clean') {
      await expect(page.getByText('Базову версію оновлено.', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Перевірити', exact: true })).toBeVisible();
      expect(rebaseCalls).toBe(1);
    } else {
      await expect(page.getByRole('alert')).toContainText('Зміни можуть перетинатися.');
      expect(rebaseCalls).toBe(0);
    }
  });
}
