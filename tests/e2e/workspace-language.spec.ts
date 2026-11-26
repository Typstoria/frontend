import { expect, test, type Page } from '@playwright/test';
import { replaceSourceText } from './source-input';
import { installWorkspaceStartupMock } from './workspace-startup-fixture';

const date = '2026-11-12T10:30:00Z';
const hash = 'a'.repeat(64);
const sessionId = '11111111-2222-4333-8444-555555555555';
const uri = (fileId: number) => `typstoria://editor/${sessionId}/files/${fileId}`;
const user = {
  id: 1,
  name: null,
  email: 'editor@example.test',
  emailVerified: true,
  hasPassword: true,
  createdAt: date,
};
const metadata = (fileId: number, path: string) => ({
  fileId,
  path,
  contentKind: 'text',
  sha256: hash,
  sizeBytes: 24,
  mediaType: 'text/plain',
});
const files = [metadata(10, 'main.typ'), metadata(11, 'defs.typ')];
const saved = 'Початок';
const definitions = '= Визначення\n#let rgb = 1\n#let other = 2';
const point = (line: number, character: number) => ({ line, character });
const range = (line: number, from: number, to: number) => ({
  start: point(line, from),
  end: point(line, to),
});

async function installEditor(page: Page, available = true) {
  await page.addInitScript(
    (session) => localStorage.setItem('typstoria.session', JSON.stringify(session)),
    {
      user,
      tokenType: 'Bearer',
      accessToken: '1.language-test',
      expiresAt: '2099-01-01T00:00:00Z',
    },
  );
  await installWorkspaceStartupMock(page);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/editor/availability', (route) => route.fulfill({ json: { available } }));
  await page.route('**/api/projects/1/state**', (route) =>
    route.fulfill({
      json: {
        project: {
          id: 1,
          title: 'Редактор Typst',
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
          historySyncStatus: 'ready',
          commitSha: null,
        },
        mainFileId: 10,
        tree: files,
        contextText: '',
      },
    }),
  );
  await page.route('**/api/projects/1/files/*?*', (route) => {
    const fileId = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    const file = files.find((item) => item.fileId === fileId);
    return route.fulfill({
      json: { ...file, content: fileId === 10 ? saved : definitions, revisionId: 100 },
    });
  });

  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route('**/api/projects/1/changes', async (route) => {
    await saveGate;
    await route
      .fulfill({ status: 503, json: { error: { code: 'TEST_SAVE_HELD' } } })
      .catch(() => {});
  });
  let sessionCount = 0;
  const buffers = new Map<number, { content: string; version: number }>();
  await page.route('**/api/projects/1/editor-sessions', (route) => {
    sessionCount++;
    expect(route.request().postDataJSON()).toEqual({ revisionId: 100 });
    buffers.set(10, { content: saved, version: 1 });
    buffers.set(11, { content: definitions, version: 1 });
    return route.fulfill({
      json: {
        id: sessionId,
        projectId: 1,
        revisionId: 100,
        files: files.map((file) => ({ ...file, uri: uri(file.fileId), documentVersion: 1 })),
      },
    });
  });
  await page.route('**/api/editor-sessions/*/files/*', (route) => {
    const fileId = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    const { content, expectedDocumentVersion } = route.request().postDataJSON();
    expect(expectedDocumentVersion).toBe(buffers.get(fileId)?.version);
    const documentVersion = expectedDocumentVersion + 1;
    buffers.set(fileId, { content, version: documentVersion });
    return route.fulfill({ json: { fileId, documentVersion } });
  });
  await page.route('**/api/editor-sessions/*', (route) => route.fulfill({ status: 204 }));
  return { buffers, releaseSave, sessionCount: () => sessionCount };
}

async function languageCommand(page: Page, mobile: boolean, name: string) {
  await page.getByRole('button', { name: mobile ? 'Меню' : 'Файл', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

test('completes an unsaved buffer, formats it, and opens a project definition', async ({
  page,
}, info) => {
  const installed = await installEditor(page);
  const mobile = info.project.name === 'mobile';
  let formatted = false;
  await page.route('**/api/editor-sessions/*/query', (route) => {
    const { fileId, documentVersion, method, position } = route.request().postDataJSON();
    const buffer = installed.buffers.get(fileId);
    expect(buffer?.version).toBe(documentVersion);
    let result: unknown;
    if (method === 'completion') {
      expect(buffer?.content).toBe('#rg');
      expect(position).toEqual(point(0, 3));
      result = {
        isIncomplete: false,
        items: [
          {
            label: 'rgb',
            detail: 'Колір',
            kind: 3,
            insertTextFormat: 2,
            textEdit: { range: range(0, 1, 3), newText: 'rgb(${1:1},${2:2},${3:3})' },
            additionalTextEdits: [{ range: range(0, 0, 0), newText: '#import "defs.typ": *\n' }],
          },
        ],
      };
    } else if (method === 'formatting') {
      expect(buffer?.content).toBe('#import "defs.typ": *\n#rgb(1,2,3)');
      expect(position).toBeUndefined();
      formatted = true;
      result = [{ range: range(1, 0, 11), newText: '#rgb(1, 2, 3)' }];
    } else {
      expect(method).toBe('definition');
      expect(formatted).toBe(true);
      expect(buffer?.content).toBe('#import "defs.typ": *\n#rgb(1, 2, 3)');
      result = [
        { uri: 'file:///example.typ', range: range(0, 0, 1) },
        { targetUri: uri(11), targetSelectionRange: range(1, 5, 8) },
        { uri: uri(11), range: range(2, 5, 10) },
      ];
    }
    return route.fulfill({ json: { revisionId: 100, fileId, documentVersion, result } });
  });

  try {
    await page.goto('/projects/1');
    const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
    await editor.press('ControlOrMeta+a');
    await editor.pressSequentially('#rg');
    await editor.press('End');
    const option = page.getByRole('option', { name: /rgb/ });
    await expect(option).toBeVisible();
    expect(
      await option.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const minHeight = matchMedia('(max-width: 720px)').matches ? 44 : 32;
        return rect.left >= 0 && rect.right <= window.innerWidth + 1 && rect.height >= minHeight;
      }),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('completion.png'), animations: 'disabled' });
    if (mobile) await option.tap();
    else await editor.press('Enter');

    await expect(editor).toContainText('#rgb(1,2,3)');
    await expect(editor).toContainText('#import "defs.typ": *');
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('1');
    await editor.press('Tab');
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('2');
    await languageCommand(page, mobile, 'Форматувати файл');
    await expect(editor).toContainText('#rgb(1, 2, 3)');
    await expect(page.getByText('Файл відформатовано.')).toBeVisible();

    await languageCommand(page, mobile, 'Перейти до визначення');
    const dialog = page.getByRole('dialog', { name: 'Визначення' });
    await expect(dialog.getByRole('button', { name: 'defs.typ Рядок 2' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /example/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('definitions.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: 'defs.typ Рядок 2' }).click();
    await expect(dialog).toBeHidden();
    await expect(editor).toBeFocused();
    await expect(editor).toContainText('#let rgb = 1');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const selection = window.getSelection();
          const line = selection?.anchorNode?.parentElement?.closest('.cm-line');
          if (!line || !selection) return null;
          const range = document.createRange();
          range.setStart(line, 0);
          range.setEnd(selection.anchorNode!, selection.anchorOffset);
          return range.toString();
        }),
      )
      .toBe('#let ');
    expect(installed.sessionCount()).toBe(1);
  } finally {
    installed.releaseSave();
  }
});

test('drops formatting when the buffer changes before the reply', async ({ page }, info) => {
  const installed = await installEditor(page);
  let releaseFormatting!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseFormatting = resolve;
  });
  await page.route('**/api/editor-sessions/*/query', async (route) => {
    const { fileId, documentVersion, method } = route.request().postDataJSON();
    expect(method).toBe('formatting');
    await gate;
    await route.fulfill({
      json: {
        revisionId: 100,
        fileId,
        documentVersion,
        result: [{ range: range(0, 0, saved.length), newText: 'Стара правка' }],
      },
    });
  });
  try {
    await page.goto('/projects/1');
    const editor = page.getByRole('textbox', { name: 'Вихідний текст' });
    const query = page.waitForRequest('**/api/editor-sessions/*/query');
    await languageCommand(page, info.project.name === 'mobile', 'Форматувати файл');
    await query;
    await replaceSourceText(editor, 'Новий текст');
    const response = page.waitForResponse('**/api/editor-sessions/*/query');
    releaseFormatting();
    await response;
    await expect(editor).toHaveText('Новий текст');
    await expect(page.getByText('Файл відформатовано.')).toHaveCount(0);
  } finally {
    releaseFormatting();
    installed.releaseSave();
  }
});

test('keeps Typst tools out of the menu when the service is unavailable', async ({
  page,
}, info) => {
  const installed = await installEditor(page, false);
  try {
    const availability = page.waitForResponse('**/api/editor/availability');
    await page.goto('/projects/1');
    await availability;
    await page
      .getByRole('button', { name: info.project.name === 'mobile' ? 'Меню' : 'Файл', exact: true })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Створити файл', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Форматувати файл' })).toHaveCount(0);
    expect(installed.sessionCount()).toBe(0);
  } finally {
    installed.releaseSave();
  }
});
