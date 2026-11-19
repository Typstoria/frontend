const textUploadExtensions = new Set([
  'typ',
  'txt',
  'md',
  'csv',
  'tsv',
  'json',
  'yaml',
  'yml',
  'toml',
  'bib',
]);

export const textUploadAccept = [...textUploadExtensions]
  .map((extension) => `.${extension}`)
  .join(',');
export const maxTextUploadBytes = 1024 * 1024;

export function isTextUpload(file: Pick<File, 'name'>): boolean {
  const separator = file.name.lastIndexOf('.');
  return separator >= 0 && textUploadExtensions.has(file.name.slice(separator + 1).toLowerCase());
}

export async function readTextUpload(file: File): Promise<string> {
  if (!isTextUpload(file)) throw new Error('Виберіть текстовий файл підтримуваного типу.');
  if (file.size > maxTextUploadBytes)
    throw new Error('Текстовий файл має бути не більшим за 1 МіБ.');

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new Error('Не вдалося прочитати текстовий файл.');
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('Текстовий файл має бути в кодуванні UTF-8.');
  }
  if (text.includes('\0')) throw new Error('Текстовий файл не може містити нульові символи.');
  return text;
}
