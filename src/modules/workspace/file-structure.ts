import type { Snapshot, StructureChange } from './workspace-api';
import { filePathError, normalizeFilePath } from './file-path';
import { matchesResourceType } from './resource-formats';

// Validate the complete final tree, including an entrypoint replacement in the same batch.
export function structureError(operations: readonly StructureChange[], snapshot: Snapshot): string {
  const files = snapshot.tree.map((file) => ({ ...file }));
  let mainId = snapshot.mainFileId;
  let mainPath: string | undefined;
  let temporaryId = -1;
  for (const operation of operations) {
    if (operation.type === 'createFile' || operation.type === 'attachFile') {
      files.push({
        fileId: temporaryId--,
        path: normalizeFilePath(operation.path),
        contentKind: operation.type === 'createFile' ? 'text' : 'binary',
        sizeBytes: 0,
        sha256: '',
        mediaType: 'text/plain',
      });
    } else if (operation.type === 'setEntrypoint') mainPath = normalizeFilePath(operation.path);
    else {
      const index = files.findIndex((file) => file.fileId === operation.fileId);
      if (index < 0) return 'Файл більше недоступний. Перевірте актуальний список файлів.';
      if (operation.type === 'deleteFile') files.splice(index, 1);
      else if (operation.type === 'renameFile') {
        const file = files[index]!;
        if (file.contentKind === 'binary' && !matchesResourceType(operation.path, file.mediaType))
          return 'Розширення шляху має відповідати формату ресурсу.';
        file.path = normalizeFilePath(operation.path);
      } else if (files[index]!.contentKind !== 'binary') return 'Виберіть ресурс для заміни.';
    }
  }
  if (files.length > 500) return 'У проєкті може бути не більше 500 файлів.';
  for (const file of files) {
    const error = filePathError(file.path, files, file.fileId);
    if (error) return error;
  }
  if (mainPath !== undefined) mainId = files.find((file) => file.path === mainPath)?.fileId ?? 0;
  const main = files.find((file) => file.fileId === mainId);
  if (!main || main.contentKind !== 'text' || !main.path.endsWith('.typ'))
    return 'Виберіть наявний текстовий файл .typ як головний.';
  return '';
}
