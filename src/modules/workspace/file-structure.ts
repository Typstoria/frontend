import type { Snapshot, StructureChange } from './workspace-api';
import { isMaterialChange } from './workspace-api';
import { filePathError, inFolder, normalizeFilePath, projectFolders } from './file-path';
import { matchesResourceType } from './resource-formats';

// Validate the complete final tree, including an entrypoint replacement in the same batch.
export function structureError(operations: readonly StructureChange[], snapshot: Snapshot): string {
  let files = snapshot.tree.map((file) => ({ ...file }));
  let directories = new Set(snapshot.directories ?? []);
  let mainId = snapshot.mainFileId;
  let mainPath: string | undefined;
  let temporaryId = -1;
  for (const operation of operations) {
    if (isMaterialChange(operation)) continue;
    if (operation.type === 'createFile' || operation.type === 'attachFile') {
      files.push({
        fileId: temporaryId--,
        path: normalizeFilePath(operation.path),
        contentKind: operation.type === 'createFile' ? 'text' : 'binary',
        sizeBytes: 0,
        sha256: '',
        mediaType: 'text/plain',
      });
    } else if (operation.type === 'createDirectory') {
      directories.add(normalizeFilePath(operation.path));
    } else if (operation.type === 'renameDirectory' || operation.type === 'deleteDirectory') {
      const path = normalizeFilePath(operation.path);
      const folders = projectFolders(files, [...directories]);
      if (!folders.includes(path)) return 'Цієї папки більше немає в проєкті.';
      const belongs = (candidate: string) => candidate === path || inFolder(candidate, path);
      if (operation.type === 'deleteDirectory') {
        files = files.filter((file) => !inFolder(file.path, path));
        directories = new Set([...directories].filter((directory) => !belongs(directory)));
      } else {
        const destination = normalizeFilePath(operation.newPath);
        if (destination === path) continue;
        if (inFolder(destination, path)) return 'Папку не можна перемістити в неї саму.';
        if (folders.includes(destination) || files.some((file) => file.path === destination))
          return 'У цій папці вже є файл або папка з такою назвою.';
        const move = (candidate: string) => destination + candidate.slice(path.length);
        for (const file of files) if (inFolder(file.path, path)) file.path = move(file.path);
        directories = new Set(
          [...directories].map((directory) => (belongs(directory) ? move(directory) : directory)),
        );
      }
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
  if (directories.size > 500) return 'У проєкті можна створити до 500 папок.';
  for (const directory of directories) {
    const error = filePathError(directory, []);
    if (error) return error;
    if (files.some((file) => file.path === directory || inFolder(directory, file.path)))
      return 'Шлях конфліктує з наявним файлом або папкою.';
  }
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
