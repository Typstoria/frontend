import { afterEach, expect, it, vi } from 'vitest';
import { openPdfTab } from './pdf-tab';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('keeps an isolated PDF tab URL alive until that tab closes', () => {
  vi.useFakeTimers();
  const tab = { opener: {}, location: { replace: vi.fn() }, closed: false, close: vi.fn() };
  vi.stubGlobal('window', { open: vi.fn(() => tab), setInterval, clearInterval });
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-pdf');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const pdf = new Blob(['%PDF-'], { type: 'application/pdf' });
  expect(openPdfTab(pdf)).toBe(true);
  expect(tab.opener).toBeNull();
  expect(create).toHaveBeenCalledWith(pdf);
  expect(tab.location.replace).toHaveBeenCalledWith('blob:private-pdf');
  vi.advanceTimersByTime(2000);
  expect(revoke).not.toHaveBeenCalled();
  tab.closed = true;
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:private-pdf');
});

it('reports a blocked popup without allocating an object URL', () => {
  vi.stubGlobal('window', { open: vi.fn(() => null) });
  const create = vi.spyOn(URL, 'createObjectURL');
  expect(openPdfTab(new Blob())).toBe(false);
  expect(create).not.toHaveBeenCalled();
});

it('cleans up a tab when navigation fails', () => {
  const tab = {
    opener: {},
    location: {
      replace: () => {
        throw new Error('closed');
      },
    },
    close: vi.fn(),
  };
  vi.stubGlobal('window', { open: vi.fn(() => tab) });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-pdf');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  expect(openPdfTab(new Blob())).toBe(false);
  expect(revoke).toHaveBeenCalledWith('blob:private-pdf');
  expect(tab.close).toHaveBeenCalledOnce();
});
