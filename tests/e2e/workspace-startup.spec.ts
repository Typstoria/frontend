import { expect, test, type Page } from '@playwright/test';
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

test('opens an accepted historical revision and labels the PDF revision', async ({ page }) => {
  let ensureCalls = 0;
  await installWorkspace(page, false);
  await installWorkspaceStartupMock(page, 98, 2);
  await page.route('**/api/projects/1/compilations/ensure', (route) => {
    ensureCalls++;
    return route.fulfill({ status: 500, json: {} });
  });
  await page.goto('/projects/1');
  await expect(page.getByRole('heading', { name: 'Startup project' })).toBeVisible();
  const result = page.getByRole('button', { name: 'Результат', exact: true });
  if ((await result.getAttribute('aria-pressed')) === 'false') await result.click();
  await expect(page.getByText('PDF версії 2.', { exact: false })).toBeVisible();
  expect(ensureCalls).toBe(0);
});

async function installWorkspace(page: Page, navigate = true, stateFailures = 0) {
  await page.addInitScript(
    (session) => localStorage.setItem('typstoria.session', JSON.stringify(session)),
    {
      user,
      accessToken: '1.workspace-startup',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
  );
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/projects/1/state**', (route) => {
    if (stateFailures > 0) {
      stateFailures--;
      return route.fulfill({
        status: 503,
        json: { error: { code: 'TEMPORARY', message: 'Unavailable' } },
      });
    }
    return route.fulfill({
      json: {
        project: {
          id: 1,
          title: 'Startup project',
          currentRevisionId: 100,
          createdAt: date,
          updatedAt: date,
        },
        revision: {
          id: 100,
          number: 1,
          parentRevisionId: null,
          createdAt: date,
          manifestHash: hash,
          commitSha: null,
          historySyncStatus: 'pending',
        },
        mainFileId: 10,
        contextText: '',
        tree: [
          {
            fileId: 10,
            path: 'main.typ',
            contentKind: 'text',
            sha256: hash,
            sizeBytes: 6,
            mediaType: 'text/plain',
          },
        ],
      },
    });
  });
  await page.route('**/api/projects/1/files/10?*', (route) =>
    route.fulfill({
      json: {
        fileId: 10,
        path: 'main.typ',
        revisionId: 100,
        contentKind: 'text',
        sha256: hash,
        sizeBytes: 6,
        mediaType: 'text/plain',
        content: 'Hello',
      },
    }),
  );
  if (navigate) {
    await page.goto('/projects/1');
    await expect(page.getByRole('heading', { name: 'Startup project' })).toBeVisible();
  }
}

test('ensures a current compilation only after latest explicitly reports no PDF', async ({
  page,
}) => {
  let ensureCalls = 0;
  const compilation = {
    id: 50,
    projectId: 1,
    revisionId: 100,
    proposalId: null,
    candidateVersion: null,
    candidateSnapshotId: null,
    status: 'queued',
    errorCode: null,
    inputManifestHash: hash,
    compilerFingerprint: null,
    isCurrent: true,
    artifactAvailable: false,
    artifactExpiresAt: null,
    diagnostics: [],
    createdAt: date,
    startedAt: null,
    finishedAt: null,
  };
  await page.route('**/api/projects/1/compilations/latest-pdf', (route) =>
    route.fulfill({ json: { job: null, revisionNumber: null } }),
  );
  await page.route('**/api/projects/1/compilations/ensure', (route) => {
    ensureCalls++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toBeNull();
    return route.fulfill({ json: { job: compilation, revisionNumber: 1 } });
  });
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({
      json: {
        ...compilation,
        status: 'succeeded',
        compilerFingerprint: hash,
        artifactAvailable: true,
        artifactExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({ status: 503, json: { error: { code: 'TEMPORARY', message: 'Unavailable' } } }),
  );
  await installWorkspace(page);

  await expect.poll(() => ensureCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Скомпілювати' })).toBeEnabled();
  const result = page.getByRole('button', { name: 'Результат', exact: true });
  if ((await result.getAttribute('aria-pressed')) === 'false') await result.click();
  await expect(page.getByRole('region', { name: 'Результат компіляції' })).toContainText(
    'Повторити завантаження',
  );
});

test('does not ensure after a latest-PDF outage and allows an explicit retry', async ({ page }) => {
  let latestCalls = 0;
  let ensureCalls = 0;
  await installWorkspace(page, false);
  await installWorkspaceStartupMock(page);
  const accepted = {
    id: 900,
    projectId: 1,
    revisionId: 100,
    proposalId: null,
    candidateVersion: null,
    candidateSnapshotId: null,
    status: 'succeeded',
    errorCode: null,
    inputManifestHash: hash,
    compilerFingerprint: hash,
    isCurrent: true,
    artifactAvailable: true,
    artifactExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    diagnostics: [],
    createdAt: date,
    startedAt: date,
    finishedAt: date,
  };
  await page.route('**/api/projects/1/compilations/latest-pdf', (route) => {
    latestCalls++;
    return latestCalls === 1
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'TEMPORARY', message: 'Unavailable' } },
        })
      : route.fulfill({ json: { job: accepted, revisionNumber: 1 } });
  });
  await page.route('**/api/projects/1/compilations/ensure', (route) => {
    ensureCalls++;
    return route.fulfill({ status: 202, json: { job: {}, revisionNumber: 1 } });
  });
  await page.goto('/projects/1');
  await expect(page.getByRole('heading', { name: 'Startup project' })).toBeVisible();
  const result = page.getByRole('button', { name: 'Результат', exact: true });
  if ((await result.getAttribute('aria-pressed')) === 'false') await result.click();
  await expect(page.getByRole('button', { name: 'Повторити', exact: true })).toBeVisible();
  await expect.poll(() => ensureCalls).toBe(0);
  await page.getByRole('button', { name: 'Повторити', exact: true }).click();
  await expect.poll(() => latestCalls).toBe(2);
  await expect.poll(() => ensureCalls).toBe(0);
  await expect(page.getByRole('region', { name: 'Перегляд PDF' })).toBeVisible();
});

test('starts initialization after a failed workspace load is retried successfully', async ({
  page,
}) => {
  let latestCalls = 0;
  let ensureCalls = 0;
  await installWorkspace(page, false, 1);
  await installWorkspaceStartupMock(page);
  await page.route('**/api/projects/1/compilations/latest-pdf', (route) => {
    latestCalls++;
    return route.fulfill({ json: { job: null, revisionNumber: null } });
  });
  await page.route('**/api/projects/1/compilations/ensure', (route) => {
    ensureCalls++;
    return route.fulfill({ status: 500, json: {} });
  });
  await page.goto('/projects/1');
  await expect(page.getByRole('button', { name: 'Повторити', exact: true })).toBeVisible();
  expect(latestCalls).toBe(0);
  await page.getByRole('button', { name: 'Повторити', exact: true }).click();
  await expect.poll(() => latestCalls).toBe(1);
  await expect.poll(() => ensureCalls).toBe(1);
});
