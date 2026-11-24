import { ApiError } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';

export type Material = components['schemas']['MaterialMetadataDto'];
export type MaterialDiff = components['schemas']['MaterialDiffDto'];

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const id = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647;

function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

function isMaterial(value: unknown): value is Material {
  return (
    record(value) &&
    id(value.materialId) &&
    id(value.versionId) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    typeof value.sizeBytes === 'number' &&
    Number.isSafeInteger(value.sizeBytes) &&
    value.sizeBytes >= 0 &&
    typeof value.mediaType === 'string'
  );
}

export function parseMaterials(value: unknown): Material[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every(isMaterial) ||
    new Set(value.map((item) => item.materialId)).size !== value.length
  )
    invalid();
  return value;
}

function isMaterialDiff(value: unknown): value is MaterialDiff {
  if (!record(value) || !id(value.materialId)) return false;
  const { before, after, change, materialId } = value;
  const hasBefore = isMaterial(before) && before.materialId === materialId;
  const hasAfter = isMaterial(after) && after.materialId === materialId;
  switch (change) {
    case 'added':
      return before === null && hasAfter;
    case 'deleted':
      return hasBefore && after === null;
    case 'replaced':
      return hasBefore && hasAfter && before.versionId !== after.versionId;
    case 'renamed':
      return (
        hasBefore && hasAfter && before.versionId === after.versionId && before.name !== after.name
      );
    default:
      return false;
  }
}

export function parseMaterialDiffs(value: unknown): MaterialDiff[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every(isMaterialDiff) ||
    new Set(value.map((item) => item.materialId)).size !== value.length
  )
    invalid();
  return value;
}
