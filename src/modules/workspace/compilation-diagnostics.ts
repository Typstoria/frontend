import type { components } from '../../shared/api/schema';
import { validId } from './workspace-api';

export type Diagnostic = components['schemas']['CompileDiagnosticDto'];
type Position = components['schemas']['DiagnosticPositionDto'];

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const coordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function isPosition(value: unknown): value is Position {
  return record(value) && coordinate(value.line) && coordinate(value.character);
}

function isRange(value: unknown) {
  if (!record(value) || !isPosition(value.start) || !isPosition(value.end)) return false;
  const { start, end } = value;
  return end.line > start.line || (end.line === start.line && end.character >= start.character);
}

export function isDiagnostic(value: unknown): value is Diagnostic {
  return (
    record(value) &&
    (value.fileId === null || validId(value.fileId)) &&
    (value.path === null || typeof value.path === 'string') &&
    (value.severity === 'error' || value.severity === 'warning') &&
    typeof value.message === 'string' &&
    (value.range === null || isRange(value.range))
  );
}

export function diagnosticSource({ path, range }: Diagnostic) {
  if (!range) return path;
  const { line, character } = range.start;
  return path ? `${path}:${line + 1}:${character + 1}` : null;
}
