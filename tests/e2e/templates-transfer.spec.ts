import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { installWorkspaceStartupMock } from './workspace-startup-fixture';

const date = '2026-11-12T10:30:00Z';
const sha256 = 'a'.repeat(64);
const token = 's'.repeat(43);
const code = '= Hello';
const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  hasPassword: true,
  createdAt: date,
};
const login = {
  user,
  accessToken: '1.template-test',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};
const created = {
  projectId: 50,
  revisionId: 150,
  mainFileId: 100,
  revisionNumber: 1,
  manifestHash: sha256,
  historySyncStatus: 'pending',
};
const template = {
  id: 2,
  title: 'Мій звіт',
  description: 'Шаблон навчального звіту',
  includeContext: true,
  sizeBytes: 2048,
  createdAt: date,
};
const file = {
  path: 'main.typ',
  contentKind: 'text',
  mediaType: 'text/plain',
  sizeBytes: code.length,
  sha256,
};
const preview = {
  title: template.title,
  description: template.description,
  includeContext: true,
  entrypoint: file.path,
  contextText: 'Вимоги кафедри',
  files: [file],
  directories: ['figures'],
  materials: [
    {
      index: 0,
      name: 'Методичка',
      filename: 'guide.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 2048,
      sha256,
    },
  ],
};
const apiError = (code: string, details?: object) => ({
  error: { code, details, message: 'private diagnostic', requestId: 'private-request' },
});
const zip = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');

function coverSource(title: string) {
  return Buffer.from(
    zipSync(
      {
        '.typstoria/transfer.json': strToU8(JSON.stringify({ entrypoint: 'main.typ' })),
        'main.typ': strToU8(`= ${title}

Документ Typst
`),
      },
      { level: 0 },
    ),
  );
}

function workspaceState(projectId: number, revisionId: number, title: string) {
  return {
    project: {
      id: projectId,
      title,
      currentRevisionId: revisionId,
      createdAt: date,
      updatedAt: date,
    },
    revision: {
      id: revisionId,
      number: 1,
      parentRevisionId: null,
      createdAt: date,
      manifestHash: sha256,
      commitSha: null,
      historySyncStatus: 'ready',
    },
    mainFileId: 10,
    contextText: '',
    directories: [],
    materials: [],
    tree: [{ ...file, fileId: 10 }],
  };
}

async function enterAsOwner(page: Page) {
  await page.addInitScript((session) => {
    localStorage.setItem('typstoria.session', JSON.stringify(session));
  }, login);
}
async function signIn(page: Page) {
  await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
}
async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 2)).toBe(
      true,
    );
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};',
    }),
  );
  await page.route('**/api/auth/login', (route) => route.fulfill({ json: login }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/projects/50/state', (route) =>
    route.fulfill({ json: workspaceState(50, 150, 'Новий проєкт') }),
  );
  await page.route('**/api/projects/50/files/10?*', (route) =>
    route.fulfill({ json: { ...file, fileId: 10, revisionId: 150, content: code } }),
  );
  await page.route('**/api/projects/50/annotations?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/projects/50/compilations/latest-pdf', (route) =>
    route.fulfill({ json: { job: null, revisionNumber: null } }),
  );
  await page.route('**/api/projects/50/compilations/ensure', (route) =>
    route.fulfill({ status: 503, json: apiError('COMPILE_UNAVAILABLE') }),
  );
  await page.route('**/api/projects?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
});

test('previews a system template and reuses the copy key after an unknown result', async ({
  page,
}, info) => {
  await enterAsOwner(page);
  await page.route('**/api/templates/system', (route) =>
    route.fulfill({
      json: [
        { key: 'blank', title: 'Порожній документ', description: 'Мінімальний документ Typst.' },
        { key: 'article', title: 'Стаття', description: 'Стаття з окремим файлом вступу.' },
        { key: 'report', title: 'Звіт', description: 'Звіт із титульною сторінкою та змістом.' },
      ],
    }),
  );
  await page.route('**/api/templates/system/article', (route) =>
    route.fulfill({
      json: {
        ...preview,
        title: 'Стаття',
        description: 'Стаття з окремим файлом вступу.',
        includeContext: false,
        directories: [],
        materials: [],
        contextText: '',
      },
    }),
  );
  await page.route('**/api/templates/system/*/cover-source', (route) => {
    const key = new URL(route.request().url()).pathname.split('/').at(-2);
    return route.fulfill({
      contentType: 'application/zip',
      body: coverSource(
        key === 'article' ? 'Назва статті' : key === 'report' ? 'Звіт' : 'Новий документ',
      ),
    });
  });
  let key: string | undefined;
  await page.route('**/api/templates/system/article/copy', (route) => {
    const currentKey = route.request().headers()['idempotency-key'];
    expect(currentKey).toBeTruthy();
    expect(route.request().postDataJSON()).toEqual({ title: 'Моя стаття' });
    if (!key) {
      key = currentKey;
      return route.fulfill({ status: 503, json: apiError('UNAVAILABLE') });
    }
    expect(currentKey).toBe(key);
    return route.fulfill({ status: 201, json: created });
  });
  await page.goto('/projects');
  await checkLayout(page);
  await page.getByRole('link', { name: 'Шаблони', exact: true }).click();
  const article = page.getByRole('link', { name: /Стаття/ });
  await expect(article).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Головна навігація' })
      .getByRole('link', { name: 'Шаблони' }),
  ).toBeVisible();
  await expect(page.locator('.template-card .template-cover img')).toHaveCount(3, {
    timeout: 20_000,
  });
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath('catalog.png') });
  await article.click();
  await expect(page.getByText('Головний файл')).toBeVisible();
  await expect(page.getByText('Контекст і матеріали')).toHaveCount(0);
  await page.getByRole('button', { name: 'Створити проєкт', exact: true }).click();
  await checkLayout(page);
  await page.getByLabel('Назва проєкту').fill('Моя стаття');
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Створити проєкт' });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Повторіть спробу');
  await expect(page.getByRole('dialog')).not.toContainText('private-request');
  await submit.click();
  await expect(page).toHaveURL(/\/projects\/50$/);
});

test('manages owned shares, downloads the ZIP and deletes the template', async ({ page }, info) => {
  await enterAsOwner(page);
  let owned = [template];
  let revokedAt: string | null = null;
  let shared = false;
  const shareUrl = `https://typstoria.example/templates/shared#${token}`;
  await page.route('**/api/templates?*', (route) =>
    route.fulfill({ json: { items: owned, nextCursor: null } }),
  );
  await page.route('**/api/templates/2', (route) => {
    if (route.request().method() === 'DELETE') {
      owned = [];
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: preview });
  });
  await page.route('**/api/templates/2/cover-source', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer 1.template-test');
    return route.fulfill({ contentType: 'application/zip', body: coverSource('Мій звіт') });
  });
  await page.route('**/api/templates/2/download', (route) =>
    route.fulfill({ contentType: 'application/zip', body: zip }),
  );
  await page.route('**/api/templates/2/file?path=main.typ', (route) =>
    route.fulfill({ contentType: 'application/octet-stream', body: code }),
  );
  const metadata = () => ({
    id: 3,
    createdAt: date,
    expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
    revokedAt,
  });
  await page.route('**/api/templates/2/shares?*', (route) =>
    route.fulfill({ json: { items: shared ? [metadata()] : [], nextCursor: null } }),
  );
  await page.route('**/api/templates/2/shares', (route) => {
    expect(route.request().postDataJSON()).toEqual({ expiresInDays: 7 });
    shared = true;
    return route.fulfill({ json: { ...metadata(), token, shareUrl } });
  });
  await page.route('**/api/templates/2/shares/3', (route) => {
    expect(route.request().method()).toBe('DELETE');
    revokedAt = date;
    return route.fulfill({ status: 204 });
  });
  await page.goto('/templates?tab=owned');
  await expect(page.locator('.template-card .template-cover img')).toHaveCount(1, {
    timeout: 20_000,
  });
  const card = page.locator('.template-card');
  const grid = page.locator('.template-cards');
  expect((await card.boundingBox())!.width).toBeLessThan((await grid.boundingBox())!.width * 0.6);
  const image = card.locator('img');
  const coverFrame = card.locator('.template-cover');
  expect((await image.boundingBox())!.height).toBeLessThan(
    (await coverFrame.boundingBox())!.height,
  );
  await page.screenshot({ path: info.outputPath('owned.png') });
  await page.getByRole('link', { name: /Мій звіт/ }).click();
  await expect(page.getByRole('heading', { name: 'Мій звіт' })).toBeVisible();
  await page.getByRole('button', { name: /main.typ/ }).click();
  await expect(page.getByText(code)).toBeVisible();
  await page.getByText('Текст контексту').click();
  await expect(page.getByText('Вимоги кафедри')).toBeVisible();
  await expect(page.getByText('Методичка')).toBeVisible();
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath('detail.png') });
  const download = page.waitForEvent('download');
  const downloadButton = page.getByRole('button', { name: 'Завантажити ZIP' });
  const shareButton = page.getByRole('button', { name: 'Поширити' });
  for (const button of [downloadButton, shareButton]) {
    await expect(button.locator('svg')).toBeVisible();
    await expect(button).toHaveText('');
    expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  }
  await downloadButton.click();
  expect((await download).suggestedFilename()).toBe('Мій звіт.zip');
  await shareButton.click();
  await expect(page.getByText('Посилань ще немає.')).toBeVisible();
  await page.getByRole('button', { name: 'Створити посилання' }).click();
  await expect(page.getByLabel('Нове посилання')).toHaveValue(shareUrl);
  await expect(page.getByRole('button', { name: /Відкликати посилання/ })).toBeEnabled();
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath('sharing.png') });
  await page.getByRole('button', { name: /Відкликати посилання/ }).click();
  await expect(page.getByText('Посилання відкликано.')).toBeVisible();
  await expect(page.getByLabel('Нове посилання')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Поширити' })).toBeFocused();
  await page.getByRole('button', { name: 'Видалити шаблон…' }).click();
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();
  await expect(page.getByText('Шаблон видалено.')).toBeVisible();
  await expect(page.getByText('Власних шаблонів ще немає')).toBeVisible();
});

test('opens a shared snapshot publicly and resumes after sign-in without forwarding the token', async ({
  page,
}) => {
  let valid = true;
  await page.route('**/api/template-shares/preview', (route) => {
    expect(route.request().headers()['x-template-share']).toBe(token);
    expect(route.request().headers().authorization).toBeUndefined();
    return valid
      ? route.fulfill({ json: preview })
      : route.fulfill({ status: 404, json: apiError('NOT_FOUND') });
  });
  await page.route('**/api/template-shares/cover-source', (route) => {
    expect(route.request().headers()['x-template-share']).toBe(token);
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({ contentType: 'application/zip', body: coverSource('Спільний звіт') });
  });
  await page.route('**/api/template-shares/copy', (route) => {
    expect(route.request().headers()['x-template-share']).toBe(token);
    expect(route.request().headers().authorization).toBe('Bearer 1.template-test');
    return route.fulfill({ status: 201, json: created });
  });
  await page.goto(`/templates/shared#${token}`);
  await expect(page.getByText('Методичка')).toBeVisible();
  await expect(page.locator('.template-cover-detail img')).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Увійти, щоб створити проєкт' }).click();
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
  expect(page.url()).not.toContain(token);
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/templates/shared#${token}$`));
  await page.getByRole('button', { name: 'Створити проєкт' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Створити проєкт' }).click();
  await expect(page).toHaveURL(/\/projects\/50$/);
  valid = false;
  await page.goto(`/templates/shared#${token}`);
  await expect(page.getByText('Попросіть автора надіслати активне посилання.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Створити проєкт' })).toHaveCount(0);
});

test('selects an entrypoint when importing a ZIP with several Typst files', async ({
  page,
}, info) => {
  await enterAsOwner(page);
  let firstKey: string | undefined;
  await page.route('**/api/projects/import', (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    const key = request.headers()['idempotency-key'];
    expect(key).toBeTruthy();
    expect(body).toContain('filename="Archive.zip"');
    if (!body.includes('name="entrypoint"')) {
      firstKey = key;
      return route.fulfill({
        status: 422,
        json: apiError('ENTRYPOINT_REQUIRED', { candidates: ['a.typ', 'sections/b.typ'] }),
      });
    }
    expect(key).not.toBe(firstKey);
    expect(body).toContain('sections/b.typ');
    return route.fulfill({ status: 201, json: created });
  });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Імпорт ZIP' }).click();
  await page
    .getByLabel('ZIP-архів')
    .setInputFiles({ name: 'Archive.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByLabel('Назва проєкту')).toHaveValue('Archive');
  await page.getByRole('button', { name: 'Імпортувати', exact: true }).click();
  const entrypoint = page.getByLabel('Головний файл Typst');
  await expect(entrypoint).toBeFocused();
  await entrypoint.selectOption('sections/b.typ');
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath('import.png') });
  await page.getByRole('button', { name: 'Імпортувати', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/50$/);
});

test('creates a template and exports ZIP from the saved workspace revision', async ({
  page,
}, info) => {
  await enterAsOwner(page);
  await installWorkspaceStartupMock(page);
  await page.route('**/api/projects/1/state**', (route) =>
    route.fulfill({ json: workspaceState(1, 100, 'Звіт') }),
  );
  await page.route('**/api/projects/1/files/10?*', (route) =>
    route.fulfill({
      json: {
        ...file,
        fileId: 10,
        revisionId: 100,
        content: code,
      },
    }),
  );
  await page.route('**/api/projects/1/template-versions', (route) => {
    expect(route.request().postDataJSON()).toEqual({
      title: 'Звіт',
      description: '',
      revisionId: 100,
      includeContext: false,
      includeAnnotations: true,
    });
    return route.fulfill({ json: template });
  });
  await page.route('**/api/projects/1/export?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('revisionId')).toBe('100');
    expect(query.get('profile')).toBe('project');
    expect(query.get('includeAnnotations')).toBe('true');
    return route.fulfill({ contentType: 'application/zip', body: zip });
  });
  await page.goto('/projects/1');
  const mobile = info.project.name === 'mobile';
  const menu = page.getByRole('button', { name: mobile ? 'Меню' : 'Проєкт', exact: true });
  await menu.click();
  await page.getByRole('menuitem', { name: 'Зберегти як шаблон…' }).click();
  await expect(page.getByText('Збережена версія 1')).toBeVisible();
  await expect(page.getByLabel('Додати контекст і матеріали')).not.toBeChecked();
  await expect(page.getByLabel('Додати коментарі')).not.toBeChecked();
  await page.getByLabel('Додати коментарі').check();
  await page.getByRole('button', { name: 'Зберегти шаблон' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(
    'Шаблон «Мій звіт» збережено.',
  );
  await page.getByRole('button', { name: 'Готово' }).click();
  await menu.click();
  await page.getByRole('menuitem', { name: 'Експортувати ZIP…' }).click();
  await expect(page.getByRole('radio', { name: 'Файли документа' })).toBeChecked();
  await page.getByRole('radio', { name: 'Копія проєкту' }).check();
  await expect(page.getByText('Файли, контекст, матеріали й коментарі.')).toBeVisible();
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath('export.png') });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Завантажити ZIP' }).click();
  expect((await download).suggestedFilename()).toBe('Звіт.zip');
});
