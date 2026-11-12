import { describe, expect, it } from 'vitest';
import { parseProject, parseProjectCreated, parseProjectList, titleError } from './projects-api';

const project = {
  id: 5,
  title: 'Дипломна робота',
  currentRevisionId: 10,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
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
