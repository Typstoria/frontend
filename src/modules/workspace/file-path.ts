import type { Snapshot } from './workspace-api';

type File = Snapshot['tree'][number];

export function parentFolder(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
}

export function inFolder(path: string, directory: string): boolean {
  return path.startsWith(`${directory}/`);
}

export function projectFolders(
  files: readonly File[],
  directories: readonly string[] = [],
): string[] {
  const folders = new Set<string>();
  for (const path of [...directories, ...files.map((file) => parentFolder(file.path))]) {
    let folder = normalizeFilePath(path);
    while (folder && !folders.has(folder)) {
      folders.add(folder);
      folder = parentFolder(folder);
    }
  }
  return [...folders].sort((left, right) => left.localeCompare(right));
}

export function fileNameError(fileName: string, directory = false): string {
  if (!fileName.trim()) return directory ? 'Вкажіть назву папки.' : 'Вкажіть назву файла.';
  if (fileName.includes('/') || fileName.includes('\\')) return 'Введіть лише назву, без шляху.';
  return '';
}

export function filePathInFolder(directory: string, fileName: string): string {
  const normalizedDirectory = normalizeFilePath(directory);
  const normalizedFileName = normalizeFilePath(fileName);
  return normalizedDirectory ? `${normalizedDirectory}/${normalizedFileName}` : normalizedFileName;
}

export function normalizeFilePath(path: string): string {
  return path.normalize('NFC');
}

function validUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function hasControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0)!;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

export function filePathError(path: string, files: readonly File[], excludeId?: number): string {
  if (!validUnicode(path)) return 'Шлях містить некоректний символ Unicode.';
  const normalized = normalizeFilePath(path);
  if (!normalized || normalized.startsWith('/') || normalized.endsWith('/'))
    return 'Вкажіть відносний шлях до файла.';

  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('\\') ||
        segment.includes(':') ||
        hasControl(segment) ||
        /^\.git$/iu.test(segment) ||
        /^\.typstoria$/iu.test(segment),
    )
  )
    return 'Шлях містить заборонений сегмент або символ.';

  const encoder = new TextEncoder();
  if (segments.some((segment) => encoder.encode(segment).length > 255))
    return 'Назва кожного сегмента шляху має бути не довшою за 255 байтів UTF-8.';
  if (encoder.encode(normalized).length > 1024)
    return 'Шлях файла має бути не довшим за 1024 байти UTF-8.';

  for (const file of files) {
    if (file.fileId === excludeId) continue;
    const existing = normalizeFilePath(file.path);
    if (existing === normalized) return 'Файл із таким шляхом уже існує.';
    if (existing.startsWith(`${normalized}/`) || normalized.startsWith(`${existing}/`))
      return 'Шлях конфліктує з наявним файлом або каталогом.';
  }
  return '';
}
