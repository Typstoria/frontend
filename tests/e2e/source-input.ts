import { expect, type Locator, type Page } from '@playwright/test';

export async function pauseAutosaveClock(page: Page) {
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 5_000);
}

export async function pasteSourceText(editor: Locator, text: string) {
  await expect(editor).toBeEditable();
  await editor.focus();
  await editor.evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    // Supply the data directly so the test uses CodeMirror's paste path across engines.
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: clipboardData });
    element.dispatchEvent(paste);
  }, text);
}

export async function replaceSourceText(editor: Locator, text: string) {
  await expect(editor).toBeEditable();
  await editor.press('ControlOrMeta+a');
  await pasteSourceText(editor, text);
  await expect(editor.locator('.cm-line')).toHaveText(text.split('\n'));
}
