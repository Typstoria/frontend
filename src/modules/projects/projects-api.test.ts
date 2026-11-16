import { describe, expect, it, vi } from 'vitest';
import {
  createProjectsApi,
  parseProject,
  parseProjectCreated,
  parseProjectList,
  titleError,
} from './projects-api';

const project = {
  id: 5,
  title: 'Дипломна робота',
  currentRevisionId: 10,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  preview: null,
};

describe('project response boundary', () => {
  it('rejects malformed metadata instead of displaying partial records', () => {
    expect(parseProject({ ...project, storageKey: 'private' })).toEqual(project);
    for (const patch of [
      { id: '5' },
      { id: 2147483648 },
      { title: '' },
      { currentRevisionId: null },
      { updatedAt: 'yesterday' },
    ])
      expect(() => parseProject({ ...project, ...patch })).toThrow();
  });

  it('accepts a nullable preview and rejects malformed preview metadata', () => {
    const preview = { revisionId: 14, version: 'b'.repeat(64) };
    expect(parseProject({ ...project, preview })).toEqual({ ...project, preview });
    expect(parseProject({ ...project, preview: null }).preview).toBeNull();
    expect(parseProject({ ...project, preview: undefined }).preview).toBeNull();
    for (const invalidPreview of [
      {},
      { revisionId: 0, version: 'b'.repeat(64) },
      { revisionId: 14, version: 'B'.repeat(64) },
      { revisionId: 14, version: 'b'.repeat(63) },
    ])
      expect(() => parseProject({ ...project, preview: invalidPreview })).toThrow();
  });

  it('requests previews through the authenticated blob transport with the current hash', async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], {
      type: 'image/png',
    });
    const request = vi.fn().mockResolvedValue(png);
    const api = createProjectsApi(request);
    const signal = new AbortController().signal;
    await expect(api.preview(5, 'c'.repeat(64), signal)).resolves.toBe(png);
    expect(request).toHaveBeenCalledWith('/projects/5/preview', {
      query: { version: 'c'.repeat(64) },
      responseType: 'blob',
      signal,
    });
  });

  it('rejects repeated or non-progressing pagination cursors', () => {
    expect(parseProjectList({ items: [project], nextCursor: 5 }, 6).items).toEqual([project]);
    expect(parseProjectList({ items: [], nextCursor: null }, 5).items).toEqual([]);
    for (const page of [
      { items: [project, project], nextCursor: 5 },
      { items: [project], nextCursor: 6 },
      { items: [], nextCursor: 5 },
      { items: [project], nextCursor: null },
    ])
      expect(() => parseProjectList(page, 5)).toThrow();
  });

  it('checks create metadata before using the returned project ID', () => {
    const created = {
      projectId: 5,
      revisionId: 10,
      mainFileId: 3,
      revisionNumber: 1,
      manifestHash: 'a'.repeat(64),
      historySyncStatus: 'pending',
    };
    expect(parseProjectCreated(created)).toEqual(created);
    expect(() => parseProjectCreated({ ...created, projectId: '../auth/me' })).toThrow();
    expect(() => parseProjectCreated({ ...created, manifestHash: '' })).toThrow();
  });

  it('matches trimmed title limits including Unicode code points', () => {
    expect(titleError('  Назва  ')).toBe('');
    expect(titleError('📝'.repeat(200))).toBe('');
    expect(titleError('📝'.repeat(201))).not.toBe('');
    expect(titleError(' \n ')).not.toBe('');
    expect(titleError('текст\tтекст')).not.toBe('');
  });
});
