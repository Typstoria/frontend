import { test, expect, type Page } from '@playwright/test';
import type { Changes } from '../../src/modules/workspace/workspace-api';
import type { Annotation } from '../../src/modules/workspace/annotation-api';
import type { Material } from '../../src/modules/workspace/material-metadata';
import { installWorkspaceStartupMock } from './workspace-startup-fixture';

const date = '2026-11-12T10:30:00Z';
const sha256 = 'a'.repeat(64);
const source = 'Початок\r\n😀 Умова\r\nКінець';
const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: date,
};

async function workspace(page: Page, failInitialLoad = false) {
  let revisionId = 100;
  let uploads = 20;
  let uploadCount = 0;
  const mutationKeys: string[] = [];
  const operations: Changes['operations'] = [];
  const materials: Material[] = [];
  let items: Annotation[] = [];
  const stageSizes = new Map([
    [20, 6],
    [21, 7],
  ]);
  const priorResults = new Map<string, unknown>();
  const state = { failedFirstComment: false, lostFirstMaterial: false };
  const file = {
    fileId: 10,
    path: 'main.typ',
    contentKind: 'text',
    sha256,
    sizeBytes: Buffer.byteLength(source),
    mediaType: 'text/plain',
  };
  await page.addInitScript(
    (session) => localStorage.setItem('typstoria.session', JSON.stringify(session)),
    {
      user,
      accessToken: '1.workspace-user',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
  );
  await installWorkspaceStartupMock(page);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  let failNextLoad = failInitialLoad;
  await page.route('**/api/projects/1/state**', (route) => {
    if (failNextLoad) {
      failNextLoad = false;
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'STORAGE_UNAVAILABLE',
            message: 'internal stack',
            requestId: 'private-request-42',
          },
        },
      });
    }
    return route.fulfill({
      json: {
        project: {
          id: 1,
          title: 'Матеріали і коментарі',
          currentRevisionId: revisionId,
          createdAt: date,
          updatedAt: date,
        },
        revision: {
          id: revisionId,
          number: revisionId - 99,
          parentRevisionId: revisionId === 100 ? null : revisionId - 1,
          createdAt: date,
          manifestHash: sha256,
          commitSha: null,
          historySyncStatus: 'ready',
        },
        mainFileId: 10,
        contextText: '',
        directories: [],
        materials,
        tree: [file],
      },
    });
  });
  await page.route('**/api/projects/1/files/10?*', (route) =>
    route.fulfill({ json: { ...file, content: source, revisionId } }),
  );
  await page.route('**/api/projects/1/material-versions', (route) => {
    expect(route.request().postData()).toContain('filename="material.txt"');
    uploadCount++;
    const versionId = uploads++;
    return route.fulfill({
      status: 201,
      json: {
        versionId,
        filename: 'material.txt',
        sha256,
        sizeBytes: stageSizes.get(versionId),
        mediaType: 'text/plain',
        status: 'pending',
        errorCode: null,
        parserFingerprint: null,
        createdAt: date,
      },
    });
  });
  await page.route('**/api/projects/1/materials/20?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('revisionId')).toBe(String(revisionId));
    const current = materials[0]!;
    return route.fulfill({
      json: {
        ...current,
        revisionId,
        filename: 'material.txt',
        status: 'ready',
        errorCode: null,
        parserFingerprint: sha256,
        createdAt: date,
        chunks:
          params.get('offset') === '8'
            ? [{ index: 8, text: 'Джерело для вступу', line: 18 }]
            : [{ index: 0, text: 'Джерело для вступу', line: 2 }],
        nextOffset: null,
      },
    });
  });
  await page.route('**/api/projects/1/materials/20/download?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('revisionId')).toBe(String(revisionId));
    return route.fulfill({ contentType: 'application/octet-stream', body: 'source' });
  });
  await page.route('**/api/projects/1/materials/search', (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ query: 'вступу', revisionId });
    return route.fulfill({
      json: {
        revisionId,
        matches: [{ ...materials[0], index: 8, text: 'Джерело для вступу', line: 18 }],
        nextCursor: null,
      },
    });
  });
  await page.route('**/api/projects/1/annotations?*', (route) => {
    expect(Number(new URL(route.request().url()).searchParams.get('revisionId'))).toBe(revisionId);
    return route.fulfill({ json: { nextCursor: null, items } });
  });
  await page.route('**/api/projects/1/annotations/7', (route) => {
    const item = items[0]!;
    const body = route.request().postDataJSON();
    expect(body.expectedAnnotationVersion).toBe(item.version);
    if (route.request().method() === 'DELETE') {
      items = [];
      return route.fulfill({ status: 204 });
    }
    const version = item.version + 1;
    items = [
      {
        ...item,
        ...(body.status === undefined ? { body: body.body } : { status: body.status }),
        version,
      },
    ];
    return route.fulfill({ json: { id: 7, version } });
  });
  await page.route('**/api/projects/1/changes', (route) => {
    const key = route.request().headers()['idempotency-key']!;
    mutationKeys.push(key);
    const prior = priorResults.get(key);
    if (prior) return route.fulfill({ json: prior, status: 201 });
    const { baseRevisionId, operations: changes } = route.request().postDataJSON() as Changes;
    expect(baseRevisionId).toBe(revisionId);
    expect(changes).toHaveLength(1);
    const operation = changes[0]!;
    operations.push(operation);
    if (operation.type === 'createAnnotation') {
      const { anchor, body } = operation;
      expect(anchor).toEqual({
        fileId: file.fileId,
        start: 9,
        end: 17,
        quote: '😀 Умова',
        prefix: 'Початок\r\n',
        suffix: '\r\nКінець',
      });
      items = [
        {
          id: 7,
          version: 1,
          projectId: 1,
          revisionId,
          viewedRevisionId: revisionId,
          fileId: file.fileId,
          anchor,
          body,
          status: 'active',
          creatorId: 1,
          channel: 'web',
          createdAt: date,
          position: { state: 'attached', start: anchor.start, end: anchor.end },
        },
      ];
    } else {
      revisionId++;
      if (operation.type === 'attachMaterial' || operation.type === 'replaceMaterial') {
        const material = {
          materialId:
            operation.type === 'attachMaterial' ? operation.versionId : operation.materialId,
          versionId: operation.versionId,
          name: operation.name!,
          sizeBytes: stageSizes.get(operation.versionId)!,
          sha256,
          mediaType: 'text/plain',
        };
        materials.splice(0, materials.length, material);
      } else if (operation.type === 'removeMaterial') {
        materials.splice(0, materials.length);
      }
    }
    const result = {
      projectId: 1,
      revisionId,
      revisionNumber: revisionId - 99,
      mainFileId: file.fileId,
      manifestHash: sha256,
      createdFiles: [],
      historySyncStatus: 'ready',
    };
    priorResults.set(key, result);
    if (state.failedFirstComment && operation.type === 'createAnnotation')
      return route.abort('connectionreset');
    if (state.lostFirstMaterial && operation.type === 'attachMaterial')
      return route.abort('connectionreset');
    return route.fulfill({ json: result, status: 201 });
  });
  await page.goto('/projects/1');
  if (!failInitialLoad)
    await expect(page.getByRole('textbox', { name: 'Вихідний текст' })).toContainText('Умова');
  return { operations, mutationKeys, state, materials, getUploadCount: () => uploadCount };
}

test('shows a recoverable page error when opening the project fails', async ({
  page,
}, testInfo) => {
  await workspace(page, true);
  await expect(page.getByRole('alert')).toContainText('Не вдалося відкрити проєкт');
  await expect(page.locator('body')).not.toContainText(/internal stack|private-request-42/u);
  await expect(page.getByRole('link', { name: 'До проєктів' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
  await page.screenshot({ path: testInfo.outputPath('project-load-error.png') });
  await page.getByRole('button', { name: 'Повторити', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Вихідний текст' })).toContainText('Умова');
  await expect(page.getByRole('heading', { name: 'Матеріали і коментарі' })).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('manages versioned materials without compiling the project', async ({ page }, testInfo) => {
  const { operations, mutationKeys, state, getUploadCount } = await workspace(page);
  let compiles = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/compilations')) compiles++;
  });
  await page.getByRole('button', { name: 'Контекст', exact: true }).click();
  await page.getByRole('button', { name: 'Додати матеріал', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Додати матеріал' });
  const choose = add.getByRole('button', { name: 'Вибрати файл', exact: true });
  await expect(choose).toBeFocused();
  await expect(add.getByRole('button', { name: 'Додати', exact: true })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('material-upload-empty.png'),
    animations: 'disabled',
  });
  const [picker] = await Promise.all([page.waitForEvent('filechooser'), choose.press('Enter')]);
  await picker.setFiles({
    name: 'x'.repeat(150) + '.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('invalid'),
  });
  await expect(add.getByRole('alert')).toContainText('Виберіть TXT');
  await expect(add.getByRole('button', { name: 'Додати', exact: true })).toBeDisabled();
  expect(await add.evaluate((dialog) => dialog.scrollWidth)).toBeLessThanOrEqual(
    await add.evaluate((dialog) => dialog.clientWidth),
  );
  await add.getByLabel('Файл матеріалу', { exact: true }).setInputFiles({
    name: 'Джерела.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('source'),
  });
  await expect(add.getByRole('status')).toContainText('Джерела.txt');
  await expect(add.getByRole('alert')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('material-upload-selected.png'),
    animations: 'disabled',
  });
  state.lostFirstMaterial = true;
  await add.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(add).toBeHidden();
  await page.getByRole('button', { name: 'Повторити збереження' }).click();
  await expect(page.getByRole('button', { name: 'Джерела.txt', exact: true })).toBeVisible();
  expect(mutationKeys[0]).toBe(mutationKeys[1]);
  await page.getByRole('button', { name: 'Джерела.txt', exact: true }).click();
  const material = page.getByRole('dialog', { name: 'Джерела.txt' });
  await expect(material.getByText('Рядок 2')).toBeVisible();
  await expect(material.getByText('Джерело для вступу')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('material-preview.png') });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    material.getByRole('button', { name: 'Завантажити оригінал' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Джерела.txt');
  await material.getByRole('button', { name: 'Закрити', exact: true }).click();
  await expect(material).toBeHidden();
  const searchbox = page.getByRole('searchbox', { name: 'Пошук у матеріалах' });
  await searchbox.fill('вст');
  await searchbox.fill('вступу');
  await expect(page.getByRole('list', { name: 'Результати пошуку' })).toContainText(
    'Джерело для вступу',
  );
  await page
    .getByRole('list', { name: 'Результати пошуку' })
    .getByRole('button', { name: 'Джерела.txt' })
    .click();
  await expect(material.getByText('Рядок 18')).toBeVisible();
  await material.getByRole('button', { name: 'Закрити', exact: true }).click();
  await expect(material).toBeHidden();
  await page.getByRole('button', { name: 'До всіх матеріалів' }).click();
  await page.getByRole('button', { name: 'Замінити матеріал Джерела.txt' }).click();
  const replace = page.getByRole('dialog', { name: 'Замінити матеріал' });
  await replace.getByLabel('Файл матеріалу', { exact: true }).setInputFiles({
    name: 'Нова версія.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('updated'),
  });
  await replace.getByRole('button', { name: 'Замінити', exact: true }).click();
  await page.getByRole('button', { name: 'Вилучити матеріал Нова версія.txt' }).click();
  await page
    .getByRole('dialog', { name: 'Вилучити матеріал?' })
    .getByRole('button', { name: 'Вилучити' })
    .click();
  await expect(page.getByText('Матеріалів поки немає.')).toBeVisible();
  expect(operations.map((operation) => operation.type)).toEqual([
    'attachMaterial',
    'replaceMaterial',
    'removeMaterial',
  ]);
  expect(getUploadCount()).toBe(2);
  expect(compiles).toBe(0);
});

test('refreshes pending PDF extraction automatically and explains an unavailable parser', async ({
  page,
}) => {
  const { materials } = await workspace(page);
  const pdf = {
    materialId: 20,
    versionId: 20,
    name: 'Джерело.pdf',
    sha256,
    sizeBytes: 6,
    mediaType: 'application/pdf',
  };
  materials.push(pdf);
  let calls = 0;
  await page.route('**/api/projects/1/materials/20?*', (route) => {
    const pending = calls++ === 0;
    return route.fulfill({
      json: {
        ...pdf,
        filename: pdf.name,
        revisionId: 100,
        createdAt: date,
        status: pending ? 'pending' : 'failed',
        errorCode: pending ? null : 'PARSER_UNAVAILABLE',
        parserFingerprint: null,
        chunks: [],
        nextOffset: null,
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Контекст', exact: true }).click();
  await page.getByRole('button', { name: pdf.name, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: pdf.name });
  await expect(dialog.getByRole('status')).toHaveText('Витягуємо текст…');
  await expect(dialog.getByRole('button', { name: 'Перевірити стан' })).toHaveCount(0);
  await expect(dialog.getByRole('status')).toHaveText('Витяг тексту для цього файла недоступний.', {
    timeout: 8_000,
  });
  await expect(dialog.getByRole('button', { name: 'Завантажити оригінал' })).toBeEnabled();
});

test('comments on a UTF-16 selection, retries the same mutation and returns to the quote', async ({
  page,
}, testInfo) => {
  const { state, mutationKeys, operations } = await workspace(page);
  const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
  await editor.press('Control+Home');
  await editor.press('ArrowDown');
  await editor.press('Home');
  await editor.press('Shift+End');
  await page.getByRole('button', { name: 'Додати коментар до виділення' }).click();
  const comments = page.locator('.workspace-comments');
  const input = comments.getByRole('textbox', { name: 'Новий коментар' });
  await expect(input).toBeFocused();
  await expect(comments.getByLabel('Статус коментарів')).toHaveCount(0);
  if (testInfo.project.name === 'chromium') {
    const preview = page.getByRole('region', { name: 'Результат компіляції' });
    await expect(preview).toBeVisible();
    await page.getByRole('button', { name: 'Лише PDF', exact: true }).click();
    await expect(preview).toBeVisible();
    await expect(input).toBeVisible();
    await expect(editor).toBeHidden();
    await page.getByRole('button', { name: 'Код і PDF', exact: true }).click();
    await expect(preview).toBeVisible();
    await expect(editor).toBeVisible();
    await expect(input).toBeVisible();
  }
  await page.screenshot({
    path: testInfo.outputPath('comments-composer.png'),
    animations: 'disabled',
  });
  await input.fill('Потрібно уточнити умову.');
  state.failedFirstComment = true;
  await comments.getByRole('button', { name: 'Додати коментар', exact: true }).click();
  await expect(comments.getByRole('alert')).toContainText('Збереження не підтверджено.');
  await comments.getByRole('button', { name: 'Повторити збереження' }).click();
  await expect(comments.getByText('Потрібно уточнити умову.')).toBeVisible();
  expect(mutationKeys[0]).toBe(mutationKeys[1]);
  expect(operations).toHaveLength(1);
  const marker = page.getByRole('button', { name: 'Відкрити коментарі до рядка 2' });
  await expect(marker).toHaveCount(0);
  await comments.getByRole('button', { name: 'Закрити коментарі' }).click();
  await expect(marker).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('comment-gutter.png') });
  await marker.click();
  await expect(marker).toHaveCount(0);
  await expect(comments.getByRole('listitem')).toHaveClass(/comment-selected/u);
  await expect(comments.getByRole('listitem')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('comments.png') });
  await comments.getByRole('button', { name: '😀 Умова' }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('😀 Умова');
  if (!(await comments.isVisible()))
    await page.getByRole('button', { name: 'Коментарі', exact: true }).click();
  const card = comments.getByRole('listitem');
  const menu = card.locator('details');
  await menu.locator('summary').click();
  const reanchor = menu.getByRole('button', { name: 'Переприв’язати до виділення' });
  await expect(reanchor).toBeVisible();
  expect(
    await reanchor.evaluate((button) => {
      const popup = button.parentElement!.getBoundingClientRect();
      const cardBounds = button.closest('li')!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      const label = range.getBoundingClientRect();
      return (
        popup.left >= cardBounds.left &&
        popup.right <= cardBounds.right &&
        label.left >= popup.left &&
        label.right <= popup.right
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('comments-menu.png') });
  await comments.getByRole('button', { name: 'Позначити вирішеним' }).click();
  await expect(comments.getByText('Немає відкритих коментарів.')).toBeVisible();
  await comments.getByRole('button', { name: 'Закрити коментарі' }).click();
  await expect(marker).toHaveCount(0);
  await page.getByRole('button', { name: 'Коментарі', exact: true }).click();
  await expect(comments.getByText('Немає відкритих коментарів.')).toBeVisible();
  await comments.getByLabel('Статус коментарів').selectOption('resolved');
  await expect(comments.getByRole('button', { name: 'Відкрити знову' })).toBeVisible();
  await comments.getByRole('button', { name: 'Відкрити знову' }).click();
  await comments.getByLabel('Статус коментарів').selectOption('active');
  await expect(comments.getByText('Потрібно уточнити умову.')).toBeVisible();
});

test('aligns comment cards with source lines as the editor scrolls', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Comments use a separate full-screen view on mobile.',
  );
  await workspace(page);
  const lines = Array.from({ length: 100 }, (_, index) => `Рядок ${index + 1}`);
  const content = lines.join('\n');
  await page.route('**/api/projects/1/files/10?*', (route) =>
    route.fulfill({
      json: {
        fileId: 10,
        path: 'main.typ',
        contentKind: 'text',
        sha256,
        sizeBytes: Buffer.byteLength(content),
        mediaType: 'text/plain',
        content,
        revisionId: 100,
      },
    }),
  );
  const notes = [35, 12].map((line, index): Annotation => {
    const quote = lines[line - 1]!;
    const start = lines.slice(0, line - 1).join('\n').length + 1;
    const end = start + quote.length;
    return {
      id: index + 1,
      version: 1,
      projectId: 1,
      revisionId: 100,
      viewedRevisionId: 100,
      fileId: 10,
      anchor: { fileId: 10, start, end, quote, prefix: '', suffix: '' },
      body: `Примітка до рядка ${line}`,
      status: 'active',
      creatorId: 1,
      channel: 'web',
      createdAt: date,
      position: { state: 'attached', start, end },
    };
  });
  await page.route('**/api/projects/1/annotations?*', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    return route.fulfill({
      json: cursor ? { items: [notes[0]], nextCursor: null } : { items: [notes[1]], nextCursor: 2 },
    });
  });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Вихідний текст' })).toContainText('Рядок 12');
  const rowMarker = page.getByRole('button', { name: 'Відкрити коментарі до рядка 12' });
  const line12 = page.locator('.cm-lineNumbers .cm-gutterElement').getByText('12', { exact: true });
  await expect(rowMarker).toBeVisible();
  const markerBounds = (await rowMarker.boundingBox())!;
  const lineBounds = (await line12.boundingBox())!;
  expect(markerBounds.x + markerBounds.width).toBeLessThanOrEqual(lineBounds.x);
  expect(markerBounds.height).toBeLessThanOrEqual(lineBounds.height + 1);
  expect(
    Math.abs(markerBounds.y + markerBounds.height / 2 - lineBounds.y - lineBounds.height / 2),
  ).toBeLessThan(3);
  await page.getByRole('button', { name: 'Коментарі', exact: true }).click();
  const comments = page.locator('.workspace-comments');
  const cards = comments.getByRole('listitem');
  const code = await page.locator('#workspace-source').boundingBox();
  const rail = await comments.boundingBox();
  const pdf = await page.locator('#workspace-output').boundingBox();
  expect(Math.abs(code!.x + code!.width - rail!.x)).toBeLessThan(3);
  expect(rail!.x + rail!.width).toBeLessThan(pdf!.x);
  await expect(cards.first()).toContainText('Примітка до рядка 12');
  await expect(cards.first().getByRole('button', { name: 'Позначити вирішеним' })).toBeVisible();
  const options = cards.first().locator('summary');
  const edit = cards.first().getByRole('button', { name: 'Редагувати' });
  await options.click();
  await expect(edit).toBeVisible();
  await edit.focus();
  await page.keyboard.press('Escape');
  await expect(edit).toBeHidden();
  await expect(options).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mark = document.querySelector('[data-annotation-id="2"]');
        const card = document.querySelector('[data-comment-card="2"]');
        return mark && card
          ? Math.abs(mark.getBoundingClientRect().top - card.getBoundingClientRect().top)
          : Infinity;
      }),
    )
    .toBeLessThan(15);
  await page.locator('.cm-scroller').evaluate((element) => {
    element.scrollTop = 320;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mark = document.querySelector('[data-annotation-id="1"]');
        const card = document.querySelector('[data-comment-card="1"]');
        return mark && card
          ? Math.abs(mark.getBoundingClientRect().top - card.getBoundingClientRect().top)
          : Infinity;
      }),
    )
    .toBeLessThan(15);
  await page.locator('[data-annotation-id="1"]').click();
  await expect(page.locator('[data-annotation-id="1"]')).toHaveClass(/cm-annotation-current/u);
  await expect(cards.last()).toHaveClass(/comment-selected/u);
  await page.screenshot({
    path: testInfo.outputPath('anchored-comments.png'),
    animations: 'disabled',
  });
  await comments.getByRole('button', { name: 'Закрити коментарі' }).click();
  await page.getByRole('button', { name: 'Відкрити коментарі до рядка 35' }).click();
  await expect(cards.last()).toHaveClass(/comment-selected/u);
});
