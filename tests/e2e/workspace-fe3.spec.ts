import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
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

function pdfFixture(
  secondPageHeight = 170,
  pageCount = 2,
  title = 'Research report',
  firstPageHeight = 700,
  drawing = '',
) {
  const stream = `BT /F1 18 Tf 20 130 Td (${title}) Tj ET ${drawing}`;
  const pageReferences = Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`);
  const fontId = pageCount + 3;
  const contentId = pageCount + 4;
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const height = index === 0 ? (pageCount === 1 ? 160 : firstPageHeight) : secondPageHeight;
    const width = index === 0 ? 200 : 180;
    return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageReferences.join(' ')}] /Count ${pageCount} >>`,
    ...pages,
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

async function scrollPageIntoView(frame: Locator, pageNumber: number) {
  const selector = `.pdf-page[data-page-number="${pageNumber}"]`;
  await frame.locator(selector).waitFor();
  await frame.evaluate((element, number) => {
    const target = element.querySelector<HTMLElement>(`.pdf-page[data-page-number="${number}"]`);
    if (!target) throw new Error(`PDF page ${number} is not rendered`);
    const pageTop = target.getBoundingClientRect().top - element.getBoundingClientRect().top;
    element.scrollTop += pageTop + Math.min(24, target.clientHeight / 10);
  }, pageNumber);
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

test('autosaves a draft before compiling and shows a protected, continuous PDF', async ({
  page,
}) => {
  const { server } = await installWorkspace(page);
  const pdf = pdfFixture(700);
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
  const compile = page.getByRole('button', { name: 'Скомпілювати', exact: true });
  await expect(compile).toBeDisabled();
  await expect.poll(() => accepted).toEqual([101]);
  const result = page.getByRole('button', { name: 'Лише PDF', exact: true });
  const split = page.getByRole('button', { name: 'Код і PDF', exact: true });
  const singlePanel = (await split.count()) === 0;
  if (singlePanel) {
    await expect(editor).toBeVisible();
    await result.click();
  }
  const frame = page.locator('.pdf-page-frame');
  const firstPage = page.locator('.pdf-page[data-page-number="1"]');
  const secondPage = page.locator('.pdf-page[data-page-number="2"]');
  await expect(firstPage.getByLabel('Текст сторінки', { exact: true })).toContainText(
    'Research report',
  );
  expect(accepted).toEqual([101]);
  await expect(page.getByRole('button', { name: 'Попередня сторінка' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Наступна сторінка' })).toHaveCount(0);
  const zoomValue = page.locator('.pdf-zoom-value');
  const initialZoom = await zoomValue.textContent();
  await page.getByRole('button', { name: 'Збільшити масштаб', exact: true }).click();
  await expect(zoomValue).not.toHaveText(initialZoom ?? '');
  await page.getByRole('button', { name: 'Зменшити масштаб', exact: true }).click();
  await expect(zoomValue).toHaveText(initialZoom ?? '');
  await page.getByRole('button', { name: 'За шириною', exact: true }).click();
  await scrollPageIntoView(frame, 2);
  await expect(secondPage.getByLabel('Текст сторінки', { exact: true })).toContainText(
    'Research report',
  );
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Завантажити PDF' }).click();
  expect(await readFile((await (await downloaded).path())!)).toEqual(pdf);
  if (singlePanel) await page.getByRole('button', { name: 'Лише код', exact: true }).click();
  await editor.fill('Unsaved edits');
  if ((await result.getAttribute('aria-pressed')) === 'false') await result.click();
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
});

test('renders only nearby pages when scrolling through a long PDF', async ({ page }) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'queued') }),
  );
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({ json: job(100, 'succeeded') }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture(700, 60) }),
  );
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  const frame = page.locator('.pdf-page-frame');
  const first = frame.locator('.pdf-page[data-page-number="1"]');
  const last = frame.locator('.pdf-page[data-page-number="60"]');
  await expect(first.getByLabel('Текст сторінки')).toContainText('Research report');
  expect(await frame.locator('.pdf-page').count()).toBeLessThan(8);
  await frame.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(last.getByLabel('Текст сторінки')).toContainText('Research report');
  await expect(first).toHaveCount(0);
  expect(await frame.locator('canvas:not(.pdf-detail-tile)').count()).toBeLessThan(8);
});

test('keeps a zoomed vector sharp and aligned after panning to another part of the page', async ({
  page,
}) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'queued') }),
  );
  await page.route('**/api/projects/1/compilations/50', (route) =>
    route.fulfill({ json: job(100, 'succeeded') }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      body: pdfFixture(700, 2, 'Detail sample', 1600, '1 0 0 rg 88 690 34 40 re f'),
    }),
  );
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  const frame = page.locator('.pdf-page-frame');
  const first = frame.locator('.pdf-page[data-page-number="1"]');
  await expect(first.getByLabel('Текст сторінки')).toContainText('Detail sample');
  const zoomIn = page.getByRole('button', { name: 'Збільшити масштаб', exact: true });
  for (let i = 0; i < 5 && (await zoomIn.isEnabled()); i++) await zoomIn.click();
  await expect(page.locator('.pdf-zoom-value')).toHaveText('400%');

  // The test mark sits far below the top of page one. Pan to it so only
  // the tiles near the new viewport can supply the expected red pixel.
  await first.evaluate((sheet) => {
    const panel = sheet.closest('.pdf-page-frame')!;
    const box = sheet.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    panel.scrollLeft += box.left - panelBox.left + box.width * (105 / 200) - panel.clientWidth / 2;
    panel.scrollTop += box.top - panelBox.top + box.height * (890 / 1600) - panel.clientHeight / 2;
  });
  await expect
    .poll(() =>
      first.evaluate((sheet) => {
        const pageBox = sheet.getBoundingClientRect();
        const markerX = pageBox.left + pageBox.width * (105 / 200);
        const markerY = pageBox.top + pageBox.height * (890 / 1600);
        const base = sheet.querySelector<HTMLCanvasElement>('canvas:not(.pdf-detail-tile)');
        const baseDensity = base ? base.width / Number.parseFloat(base.style.width) : 0;
        return Array.from(sheet.querySelectorAll<HTMLCanvasElement>('.pdf-detail-tile')).some(
          (tile) => {
            const box = tile.getBoundingClientRect();
            const density = tile.width / box.width;
            if (density <= baseDensity * 1.05 || tile.width > 768 || tile.height > 768)
              return false;
            if (
              markerX < box.left ||
              markerX >= box.right ||
              markerY < box.top ||
              markerY >= box.bottom
            )
              return false;
            const x = Math.floor((markerX - box.left) * density);
            const y = Math.floor((markerY - box.top) * density);
            const pixel = tile.getContext('2d')?.getImageData(x, y, 1, 1).data;
            return pixel && pixel[0]! > 230 && pixel[1]! < 25 && pixel[2]! < 25;
          },
        );
      }),
    )
    .toBe(true);
});

test('restores horizontal PDF position when returning to split view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installWorkspace(page);
  await page.goto('/projects/1');
  const frame = page.locator('.pdf-page-frame');
  const zoom = page.locator('.pdf-zoom-value');
  await expect(zoom).toBeVisible();
  const initial = await zoom.textContent();
  await frame.dispatchEvent('wheel', { deltaY: -70, ctrlKey: true });
  await expect(zoom).not.toHaveText(initial ?? '');
  await frame.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect.poll(() => frame.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const before = await frame.evaluate((element) => element.scrollLeft);
  const scale = await zoom.textContent();

  await page.getByRole('button', { name: 'Лише PDF', exact: true }).click();
  await expect.poll(() => frame.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.getByRole('button', { name: 'Код і PDF', exact: true }).click();
  await expect.poll(() => frame.evaluate((element) => element.scrollLeft)).toBeCloseTo(before, 0);
  await expect(zoom).toHaveText(scale ?? '');
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
  const frame = page.locator('.pdf-page-frame');
  const secondPage = page.locator('.pdf-page[data-page-number="2"]');
  await scrollPageIntoView(frame, 2);
  await expect(secondPage.getByLabel('Текст сторінки', { exact: true })).toContainText(
    'Research report',
  );
  await expect.poll(() => frame.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
  const scrollTop = await frame.evaluate((element) => element.scrollTop);
  const diagnosticsToggle = page.getByRole('button', { name: 'Діагностика (1)', exact: true });
  await diagnosticsToggle.click();
  await expect(diagnosticsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(diagnosticsToggle).toBeFocused();
  const diagnostics = page.getByRole('region', { name: 'Діагностика компіляції' });
  await expect(diagnostics).toBeVisible();
  await expect(page.getByText('Test warning', { exact: true })).toBeVisible();
  await expect(frame).toBeVisible();
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
  await expect.poll(() => frame.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});

test('resizes desktop panes with pointer and keyboard, restores sizes and resets the layout', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The file and split handles require desktop panes');
  await installWorkspace(page);
  await page.goto('/projects/1');
  const sidebar = page.getByRole('separator', { name: 'Змінити ширину панелі файлів' });
  const split = page.getByRole('separator', { name: 'Змінити співвідношення коду й PDF' });
  await expect(sidebar).toHaveAttribute('aria-valuenow', '240');
  const initialSplit = await split.getAttribute('aria-valuenow');
  const bounds = (await sidebar.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 50);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 64, bounds.y + 50, { steps: 4 });
  await page.mouse.up();
  await expect(sidebar).toHaveAttribute('aria-valuenow', '304');
  await expect
    .poll(() => page.locator('#workspace-files').evaluate((node) => node.clientWidth))
    .toBe(304);

  const beforeKeys = Number(await split.getAttribute('aria-valuenow'));
  await split.press('ArrowRight');
  await expect(split).toHaveAttribute('aria-valuenow', String(beforeKeys + 16));
  await split.press('Home');
  await expect(split).toHaveAttribute('aria-valuenow', '300');
  await page.reload();
  await expect(sidebar).toHaveAttribute('aria-valuenow', '304');
  await expect(split).toHaveAttribute('aria-valuenow', '300');

  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 900, height: viewport.height });
  await expect(split).toHaveCount(0);
  await page.setViewportSize(viewport);
  await expect(split).toHaveAttribute('aria-valuenow', '300');
  await page.getByRole('button', { name: 'Вигляд', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Скинути розкладку' }).click();
  await expect(sidebar).toHaveAttribute('aria-valuenow', '240');
  await expect(split).toHaveAttribute('aria-valuenow', initialSplit!);
});

test('restores PDF zoom, reading position, tab order and diagnostics height after reload', async ({
  page,
}) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations/latest-pdf', (route) =>
    route.fulfill({
      json: {
        revisionNumber: 1,
        job: job(100, 'succeeded', {
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
      },
    }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture(900, 3) }),
  );
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Контекст', exact: true }).click();
  const context = page.getByRole('tab', { name: 'Контекст', exact: true });
  await context.press('Alt+ArrowLeft');
  const preview = page.getByRole('button', { name: 'Лише PDF', exact: true });
  await preview.click();
  const diagnostics = page.getByRole('button', { name: 'Діагностика (1)', exact: true });
  await diagnostics.click();
  const diagnosticsResize = page.getByRole('separator', { name: 'Висота діагностики' });
  await diagnosticsResize.press('ArrowUp');
  const height = await diagnosticsResize.getAttribute('aria-valuenow');
  const frame = page.locator('.pdf-page-frame');
  const zoom = page.locator('.pdf-zoom-value');
  await page.getByRole('button', { name: 'Зменшити масштаб', exact: true }).click();
  const chosenZoom = await zoom.textContent();
  await scrollPageIntoView(frame, 2);
  const pageIndicator = page.locator('.pdf-page-indicator');
  await expect(pageIndicator).toHaveText('2 / 3');

  await page.reload();
  await expect(preview).toHaveAttribute('aria-pressed', 'true');
  await expect(pageIndicator).toHaveText('2 / 3');
  await expect(zoom).toHaveText(chosenZoom!);
  await diagnostics.click();
  await expect(diagnosticsResize).toHaveAttribute('aria-valuenow', height!);
  await page.getByRole('button', { name: 'Лише код', exact: true }).click();
  await expect(context).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab').first()).toHaveAccessibleName('Контекст');
});

test('keeps the reading point and zoom when replacing a PDF', async ({ page }) => {
  await installWorkspace(page);
  const pdfs = [
    pdfFixture(700),
    pdfFixture(850, 2, 'Replacement report', 820),
    pdfFixture(170, 1, 'Short report'),
  ];
  let starts = 0;
  await page.route('**/api/projects/1/compilations', (route) => {
    return route.fulfill({ status: 202, json: job(100, 'queued', { id: 50 + starts++ }) });
  });
  for (const [index, pdf] of pdfs.entries()) {
    const id = 50 + index;
    await page.route(`**/api/projects/1/compilations/${id}`, (route) =>
      route.fulfill({ json: job(100, 'succeeded', { id }) }),
    );
    await page.route(`**/api/projects/1/compilations/${id}/pdf`, (route) =>
      route.fulfill({ contentType: 'application/pdf', body: pdf }),
    );
  }
  await page.goto('/projects/1');
  const compile = page.getByRole('button', { name: 'Скомпілювати', exact: true });
  await compile.click();
  const frame = page.locator('.pdf-page-frame');
  const firstPage = frame.locator('.pdf-page[data-page-number="1"]');
  const secondPage = frame.locator('.pdf-page[data-page-number="2"]');
  const secondPageText = secondPage.getByLabel('Текст сторінки', { exact: true });
  await expect(firstPage.getByLabel('Текст сторінки')).toContainText('Research report');
  await page.getByRole('button', { name: 'Збільшити масштаб', exact: true }).click();
  const zoomValue = page.locator('.pdf-zoom-value');
  const zoom = await zoomValue.textContent();
  await scrollPageIntoView(frame, 2);
  const readFraction = () =>
    secondPage.evaluate((element) => {
      const panel = element.closest('.pdf-page-frame')!;
      return (
        (panel.getBoundingClientRect().top - element.getBoundingClientRect().top) /
        element.getBoundingClientRect().height
      );
    });
  const before = await readFraction();
  expect(before).toBeGreaterThan(0);

  await compile.click();
  await expect(secondPageText).toContainText('Replacement report');
  await expect(zoomValue).toHaveText(zoom ?? '');
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
  expect(await readFraction()).toBeCloseTo(before, 2);

  await compile.click();
  await expect(firstPage.getByLabel('Текст сторінки')).toContainText('Short report');
  await expect(secondPage).toHaveCount(0);
  await expect(zoomValue).toHaveText(zoom ?? '');
  await expect(page.locator('.pdf-page-indicator')).toHaveText('1 / 1');
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
  await expect(
    page.locator('.pdf-page[data-page-number="1"]').getByLabel('Текст сторінки', { exact: true }),
  ).toContainText('Research report');
  await expect(page.getByRole('button', { name: 'Діагностика (1)', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(warning).toBeVisible();

  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'succeeded', { id: 51 }) }),
  );
  await page.route('**/api/projects/1/compilations/51/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture() }),
  );
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Діагностика/ })).toHaveCount(0);
});

test('opens diagnostics in the source and preserves the editor after a Typst error', async ({
  page,
}) => {
  await installWorkspace(page);
  let releaseStatus!: () => void;
  const statusGate = new Promise<void>((resolve) => (releaseStatus = resolve));
  let statusSeen!: () => void;
  const statusStarted = new Promise<void>((resolve) => (statusSeen = resolve));
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'queued') }),
  );
  await page.route('**/api/projects/1/compilations/50', async (route) => {
    statusSeen();
    await statusGate;
    return route.fulfill({
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
    });
  });
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  await statusStarted;
  await page.getByRole('button', { name: 'Лише код', exact: true }).click();
  releaseStatus();
  await expect(page.getByText('unclosed delimiter')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Вихідний текст' })).toBeVisible();
  const diagnosticsToggle = page.getByRole('button', { name: 'Діагностика (1)', exact: true });
  await expect(diagnosticsToggle).toHaveAttribute('aria-expanded', 'true');
  const diagnostics = page.getByRole('region', { name: 'Діагностика компіляції' });
  await expect(diagnostics).toBeVisible();
  await page
    .getByRole('region', { name: 'Діагностика компіляції' })
    .getByRole('button', { name: 'main.typ', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Вихідний текст' })).toContainText('Original');
  await expect(page.getByText('TYPST_ERROR')).toHaveCount(0);
});

test('closes the history dialog with Escape and returns to the same PDF position', async ({
  page,
}) => {
  await installWorkspace(page);
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({ status: 202, json: job(100, 'succeeded') }),
  );
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture(700) }),
  );
  await page.goto('/projects/1');
  await page.getByRole('button', { name: 'Скомпілювати', exact: true }).click();
  const frame = page.locator('.pdf-page-frame');
  await expect(
    frame.locator('.pdf-page[data-page-number="1"]').getByLabel('Текст сторінки'),
  ).toContainText('Research report');
  await page.getByRole('button', { name: 'Збільшити масштаб', exact: true }).click();
  await scrollPageIntoView(frame, 2);
  const zoom = page.locator('.pdf-zoom-value');
  const scale = await zoom.textContent();
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
  const top = await frame.evaluate((element) => element.scrollTop);

  const trigger = page.getByRole('link', { name: 'Історія версій' });
  await trigger.click();
  await expect(page).toHaveURL(/\/projects\/1\/history$/);
  const history = page.getByRole('dialog', { name: 'Історія версій', exact: true });
  const close = history.getByRole('button', { name: 'Закрити історію' });
  await expect(close).toBeFocused();
  await expect(history.getByRole('button', { name: /^Версія 1/ })).toBeVisible();
  const geometry = await history.evaluate((dialog: HTMLElement) => ({
    modal: dialog.matches(':modal'),
    width: dialog.offsetWidth,
    viewport: innerWidth,
  }));
  expect(geometry.modal).toBe(true);
  if (geometry.viewport <= 720) expect(geometry.width).toBe(geometry.viewport);
  else expect(geometry.width).toBeGreaterThan(800);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(history).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(zoom).toHaveText(scale ?? '');
  await expect.poll(() => frame.evaluate((element) => element.scrollTop)).toBe(top);
  await expect(page.locator('.pdf-page-indicator')).toHaveText('2 / 2');
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
  const history = page.getByRole('dialog', { name: 'Історія версій', exact: true });
  await history.getByRole('button', { name: /^Версія 1/ }).click();
  const change = history.locator('summary').filter({ hasText: 'main.typ' });
  await expect(change).toBeVisible();
  await history.getByRole('button', { name: 'Відновити версію', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(change).toBeFocused();
  await change.click();
  await expect(history.getByText('+Current', { exact: true })).toBeVisible();
  await history.getByRole('button', { name: 'Файли версії', exact: true }).click();
  await history.getByRole('button', { name: /^main\.typ/ }).click();
  await expect(history.locator('.history-snapshot-text')).toHaveText('Original');
  const filesBack = history.getByRole('button', { name: '← Файли версії', exact: true });
  if (await filesBack.isVisible()) await filesBack.click();
  await history
    .getByRole('button', { name: /До порівняння/ })
    .filter({ visible: true })
    .first()
    .click();
  await history.getByRole('button', { name: 'Відновити версію', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Відновити версію?' })
    .getByRole('button', { name: 'Відновити', exact: true })
    .click();
  await history.getByRole('button', { name: 'Повторити відновлення' }).click();
  await expect(history.getByText('Створено версію 3.')).toBeVisible();
  expect(requests).toEqual([
    {
      key: expect.any(String),
      body: expect.objectContaining({ targetRevisionId: 100, expectedCurrentRevisionId: 101 }),
    },
    requests[0],
  ]);
  expect(requests[0]?.key).toBeTruthy();
  await history.getByRole('button', { name: 'Закрити історію' }).click();
  await expect(editor).toContainText('Original');
  expect(server.saveCount).toBe(0);
});

test('waits for an in-flight autosave and compiles the latest saved edit', async ({ page }) => {
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
  await expect(page.getByRole('button', { name: 'Скомпілювати', exact: true })).toBeDisabled();
  allowFirst();
  await expect(
    page.getByText('Не вдалося скомпілювати документ. Спробуйте пізніше.'),
  ).toBeVisible();
  expect(server.saveCount).toBe(2);
});

test('does not compile a saved revision twice when startup already picks it up', async ({
  page,
}) => {
  const { server } = await installWorkspace(page);
  let releaseLatest!: () => void;
  const latestGate = new Promise<void>((resolve) => (releaseLatest = resolve));
  let starts = 0;
  await page.route('**/api/projects/1/compilations/latest-pdf', async (route) => {
    await latestGate;
    await route.fulfill({ json: { job: null, revisionNumber: null } });
  });
  await page.route('**/api/projects/1/compilations/ensure', (route) => {
    expect(server.head).toBe(101);
    return route.fulfill({ json: { job: job(101, 'succeeded'), revisionNumber: 2 } });
  });
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture(700, 2, 'Saved on startup') }),
  );
  await page.route('**/api/projects/1/compilations', (route) => {
    starts++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/projects/1');
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  const saved = page.waitForResponse((response) => response.url().endsWith('/changes'));
  await editor.fill('Edited while finding the last PDF');
  await saved;
  releaseLatest();
  if (!(await page.locator('#workspace-output').isVisible()))
    await page.getByRole('button', { name: 'Лише PDF', exact: true }).click();
  await expect(
    page.locator('.pdf-page[data-page-number="1"]').getByLabel('Текст сторінки'),
  ).toContainText('Saved on startup');
  await expect(page.getByRole('button', { name: 'Скомпілювати', exact: true })).toBeEnabled();
  expect(starts).toBe(0);
});

test('coalesces saved revisions during an active compile and keeps the previous PDF on error', async ({
  page,
}) => {
  const { server, text } = await installWorkspace(page);
  const accepted: number[] = [];
  let releaseFirstStatus!: () => void;
  const firstStatusGate = new Promise<void>((resolve) => (releaseFirstStatus = resolve));
  let firstStatusSeen!: () => void;
  const firstStatusStarted = new Promise<void>((resolve) => (firstStatusSeen = resolve));
  await page.route('**/api/projects/1/compilations', (route) => {
    const { revisionId } = route.request().postDataJSON();
    accepted.push(revisionId);
    return route.fulfill({
      status: 202,
      json: job(revisionId, 'queued', { id: 49 + accepted.length }),
    });
  });
  await page.route('**/api/projects/1/compilations/50', async (route) => {
    firstStatusSeen();
    await firstStatusGate;
    return route.fulfill({ json: job(101, 'succeeded', { id: 50 }) });
  });
  await page.route('**/api/projects/1/compilations/50/pdf', (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      body: pdfFixture(700, 2, 'Compiled revision two'),
    }),
  );
  await page.route('**/api/projects/1/compilations/51', (route) =>
    route.fulfill({
      json: job(103, 'failed', {
        id: 51,
        errorCode: 'TYPST_ERROR',
        diagnostics: [
          {
            fileId: 10,
            path: 'main.typ',
            severity: 'error',
            message: 'latest revision failed',
            range: null,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/projects/1/compilations/52', (route) =>
    route.fulfill({
      json: job(104, 'succeeded', {
        id: 52,
        diagnostics: [
          {
            fileId: 10,
            path: 'main.typ',
            severity: 'warning',
            message: 'Remaining warning',
            range: null,
          },
        ],
      }),
    }),
  );
  await page.route('**/api/projects/1/compilations/52/pdf', (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      body: pdfFixture(700, 2, 'Corrected report'),
    }),
  );
  await page.goto('/projects/1');
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  await editor.fill('First saved edit');
  await firstStatusStarted;

  const saveNow = async (content: string, count: number) => {
    await editor.fill(content);
    const saved = page.waitForRequest((request) => request.url().endsWith('/changes'));
    await editor.press('Control+s');
    await saved;
    await expect.poll(() => server.saveCount).toBe(count);
  };
  await saveNow('Second saved edit', 2);
  await saveNow('Third saved edit', 3);
  expect(text.get(103)).toBe('Third saved edit');
  expect(accepted).toEqual([101]);

  if (!(await page.locator('#workspace-output').isVisible())) {
    await expect(editor).toBeVisible();
    await page.getByRole('button', { name: 'Лише PDF', exact: true }).click();
  }
  releaseFirstStatus();
  await expect(
    page.locator('.pdf-page[data-page-number="1"]').getByLabel('Текст сторінки'),
  ).toContainText('Compiled revision two');
  await expect.poll(() => accepted).toEqual([101, 103]);
  await expect(page.getByText('latest revision failed', { exact: true })).toBeVisible();
  await expect(page.getByText(/^PDF версії/)).toHaveCount(0);
  await expect(
    page.locator('.pdf-page[data-page-number="1"]').getByLabel('Текст сторінки'),
  ).toContainText('Compiled revision two');

  const diagnostics = page.getByRole('region', { name: 'Діагностика компіляції' });
  const diagnosticsToggle = page.getByRole('button', { name: 'Діагностика (1)' });
  await diagnosticsToggle.click();
  await expect(diagnostics).toBeHidden();
  await diagnosticsToggle.click();
  await diagnostics.getByRole('button', { name: 'main.typ', exact: true }).click();
  await expect(editor).toBeVisible();
  await saveNow('Corrected source', 4);
  if (!(await page.locator('#workspace-output').isVisible()))
    await page.getByRole('button', { name: 'Лише PDF', exact: true }).click();
  await expect(diagnosticsToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.locator('.pdf-page[data-page-number="1"]').getByLabel('Текст сторінки'),
  ).toContainText('Corrected report');
  expect(accepted).toEqual([101, 103, 104]);
  await diagnosticsToggle.click();
  await expect(diagnostics).toContainText('Remaining warning');
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
  const history = page.getByRole('dialog', { name: 'Історія версій', exact: true });
  await expect(history).toBeVisible();
  const original = page.getByRole('button', { name: /^Версія 1/ });
  const restore = async () => {
    await original.click();
    await page.getByRole('button', { name: 'Відновити версію', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Відновити версію?' })
      .getByRole('button', { name: 'Відновити', exact: true })
      .click();
  };
  await restore();
  await expect(page.getByText(/З’явилася новіша версія/)).toBeVisible();
  expect(expectedHeads).toEqual([101]);
  await expect(page.getByText('Internal details')).toHaveCount(0);
  await restore();
  await expect(page.getByText('Створено версію 4.')).toBeVisible();
  expect(expectedHeads).toEqual([101, 102]);
  await history.getByRole('button', { name: 'Закрити історію' }).click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  await expect(page.getByRole('link', { name: 'Історія версій' })).toBeFocused();
});

test('manually recompiles the clean current revision when its PDF has expired', async ({
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
  const compile = page.getByRole('button', { name: 'Скомпілювати', exact: true });
  await expect(compile).toBeEnabled();
  await compile.click();
  await expect(
    page.getByText('PDF більше недоступний. Скомпілюйте документ ще раз.'),
  ).toBeVisible();
  expect(accepted).toEqual([100]);
  expect(downloads).toBe(0);
  expect(server.saveCount).toBe(0);
});
