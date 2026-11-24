import { ApiError } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { isDiagnostic } from '../workspace/compilation-diagnostics';
import { parseMaterialDiffs, parseMaterials, type Material } from '../workspace/material-metadata';
import { validId } from '../workspace/workspace-api';

export type Proposal = components['schemas']['ProposalDto'];
export type ProposalList = components['schemas']['ProposalListDto'];
export type ProposalCandidate = components['schemas']['ProposalCandidateDto'];
type Operation = ProposalCandidate['operations'][number];
export type AnnotationOperation = Extract<
  Operation,
  { type: 'createAnnotation' | 'resolveAnnotation' }
>;
type Annotation = components['schemas']['AnnotationDto'];
export type ReviewAnnotation = Pick<Annotation, 'id' | 'version' | 'anchor' | 'body' | 'status'>;
export type ProposalTextFile = components['schemas']['ProposalTextFileDto'];
export type ProposalDiff = Omit<
  components['schemas']['ProposalDiffDto'],
  'annotationOperations'
> & {
  annotationOperations: AnnotationOperation[];
};
export type ProposalValidation = components['schemas']['ProposalValidationDto'];
export type ProposalAccepted = components['schemas']['ProposalAcceptedDto'];
export type AcceptProposalInput = components['schemas']['AcceptProposalDto'];
export type RebaseProposalInput = {
  expectedProposalVersion: number;
  baseRevisionId: number;
  operations: Operation[];
  summary?: string;
};

type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;
type RecordValue = Record<string, unknown>;

const record = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null;
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fileOperations: ReadonlySet<string> = new Set([
  'createFile',
  'updateText',
  'renameFile',
  'deleteFile',
  'setEntrypoint',
  'updateContext',
  'attachFile',
  'replaceFile',
  'createDirectory',
  'renameDirectory',
  'deleteDirectory',
]);

function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

function isAnchor(value: unknown): value is Annotation['anchor'] {
  return (
    record(value) &&
    validId(value.fileId) &&
    typeof value.start === 'number' &&
    Number.isSafeInteger(value.start) &&
    value.start >= 0 &&
    typeof value.end === 'number' &&
    Number.isSafeInteger(value.end) &&
    value.end <= 1048576 &&
    typeof value.quote === 'string' &&
    value.quote.length > 0 &&
    value.end - value.start === value.quote.length &&
    typeof value.prefix === 'string' &&
    typeof value.suffix === 'string'
  );
}

function isAnnotationOperation(value: unknown): value is AnnotationOperation {
  if (!record(value)) return false;
  if (value.type === 'createAnnotation')
    return isAnchor(value.anchor) && typeof value.body === 'string' && value.body.length > 0;
  return (
    value.type === 'resolveAnnotation' &&
    validId(value.annotationId) &&
    validId(value.expectedAnnotationVersion)
  );
}

function isOperation(value: unknown): boolean {
  if (!record(value) || typeof value.type !== 'string') return false;
  if (fileOperations.has(value.type)) return true;
  if (value.type === 'removeMaterial') return validId(value.materialId);
  if (value.type === 'attachMaterial' || value.type === 'replaceMaterial')
    return (
      validId(value.versionId) &&
      (value.type === 'attachMaterial' || validId(value.materialId)) &&
      (value.name === undefined || (typeof value.name === 'string' && value.name.trim().length > 0))
    );
  return isAnnotationOperation(value);
}

function parseProposal(value: unknown, projectId: number, proposalId?: number): Proposal {
  if (
    !record(value) ||
    !validId(value.id) ||
    (proposalId !== undefined && value.id !== proposalId) ||
    value.projectId !== projectId ||
    !validId(value.creatorId) ||
    !['draft', 'accepted', 'rejected', 'expired'].includes(String(value.status)) ||
    !validId(value.baseRevisionId) ||
    !validId(value.candidateSnapshotId) ||
    !(value.acceptedRevisionId === null || validId(value.acceptedRevisionId)) ||
    !(value.latestValidationId === null || validId(value.latestValidationId)) ||
    !['web', 'mcp'].includes(String(value.channel)) ||
    !validId(value.version) ||
    !hash(value.candidateManifestHash) ||
    typeof value.summary !== 'string' ||
    typeof value.isStale !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    invalid();
  return value as Proposal;
}

function parseValidation(
  value: unknown,
  proposalId: number,
  validationId?: number,
): ProposalValidation {
  if (
    !record(value) ||
    !validId(value.id) ||
    (validationId !== undefined && value.id !== validationId) ||
    value.proposalId !== proposalId ||
    ![
      'not_required',
      'queued',
      'running',
      'succeeded',
      'compile_failed',
      'validation_failed',
    ].includes(String(value.status)) ||
    !(value.compileJobId === null || validId(value.compileJobId)) ||
    !(value.errorCode === null || typeof value.errorCode === 'string') ||
    !validId(value.candidateVersion) ||
    !hash(value.candidateManifestHash) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Array.isArray(value.diagnostics) ||
    !value.diagnostics.every(isDiagnostic)
  )
    invalid();
  return value as ProposalValidation;
}

function parseFile(value: unknown): ProposalCandidate['tree'][number] {
  if (
    !record(value) ||
    !validId(value.fileId) ||
    typeof value.path !== 'string' ||
    !value.path ||
    !['text', 'binary'].includes(String(value.contentKind)) ||
    !hash(value.sha256) ||
    !Number.isSafeInteger(value.sizeBytes) ||
    Number(value.sizeBytes) < 0 ||
    typeof value.mediaType !== 'string'
  )
    invalid();
  return value as ProposalCandidate['tree'][number];
}

function parseCandidate(
  value: unknown,
  proposalId: number,
  candidateVersion?: number,
): ProposalCandidate {
  if (!record(value)) invalid();
  const directories = value.directories === undefined ? [] : value.directories;
  if (
    value.proposalId !== proposalId ||
    !validId(value.baseRevisionId) ||
    !validId(value.candidateSnapshotId) ||
    !validId(value.mainFileId) ||
    !validId(value.candidateVersion) ||
    (candidateVersion !== undefined && value.candidateVersion !== candidateVersion) ||
    !hash(value.candidateManifestHash) ||
    typeof value.contextText !== 'string' ||
    !Array.isArray(value.tree) ||
    !Array.isArray(directories) ||
    directories.some((path) => typeof path !== 'string' || path.length === 0) ||
    !Array.isArray(value.operations) ||
    !value.operations.every(isOperation)
  )
    invalid();
  const tree = value.tree.map(parseFile);
  if (
    new Set(tree.map((file) => file.fileId)).size !== tree.length ||
    new Set(tree.map((file) => file.path)).size !== tree.length ||
    new Set(directories).size !== directories.length ||
    !tree.some((file) => file.fileId === value.mainFileId && file.contentKind === 'text')
  )
    invalid();
  return {
    ...value,
    tree,
    directories,
    materials: parseMaterials(value.materials),
  } as ProposalCandidate;
}

function parseDiff(value: unknown, proposalId: number, candidateVersion?: number): ProposalDiff {
  if (!record(value)) invalid();
  const directories =
    value.directories === undefined ? { added: [], deleted: [] } : value.directories;
  const annotationOperations =
    value.annotationOperations === undefined ? [] : value.annotationOperations;
  if (
    value.proposalId !== proposalId ||
    !validId(value.baseRevisionId) ||
    !validId(value.candidateVersion) ||
    (candidateVersion !== undefined && value.candidateVersion !== candidateVersion) ||
    !hash(value.candidateManifestHash) ||
    !Array.isArray(value.files) ||
    !Array.isArray(annotationOperations) ||
    !annotationOperations.every(isAnnotationOperation) ||
    !record(directories) ||
    !Array.isArray(directories.added) ||
    !Array.isArray(directories.deleted) ||
    [...directories.added, ...directories.deleted].some((path) => typeof path !== 'string') ||
    !record(value.context) ||
    typeof value.context.changed !== 'boolean' ||
    !(value.context.patch === null || typeof value.context.patch === 'string') ||
    !(
      value.context.patchOmittedReason === null ||
      typeof value.context.patchOmittedReason === 'string'
    ) ||
    !record(value.entrypoint) ||
    typeof value.entrypoint.changed !== 'boolean' ||
    !validId(value.entrypoint.beforeFileId) ||
    !validId(value.entrypoint.afterFileId)
  )
    invalid();
  for (const file of value.files) {
    if (
      !record(file) ||
      !validId(file.fileId) ||
      !Array.isArray(file.changes) ||
      file.changes.some(
        (change) => !['added', 'deleted', 'modified', 'renamed'].includes(String(change)),
      ) ||
      !(file.patch === null || typeof file.patch === 'string') ||
      !(file.patchOmittedReason === null || typeof file.patchOmittedReason === 'string')
    )
      invalid();
    for (const side of [file.before, file.after]) {
      if (side !== null && parseFile(side).fileId !== file.fileId) invalid();
    }
  }
  return {
    ...value,
    directories,
    materials: parseMaterialDiffs(value.materials),
    annotationOperations,
  } as ProposalDiff;
}

function validateIds(...ids: number[]): void {
  if (!ids.every(validId)) throw new Error('Invalid proposal ID');
}

export function createReviewApi(request: Request) {
  return {
    async list(projectId: number, cursor: number | undefined, signal: AbortSignal) {
      validateIds(projectId);
      if (cursor !== undefined) validateIds(cursor);
      const value = await request(`/projects/${projectId}/proposals`, {
        query: { limit: 30, ...(cursor === undefined ? {} : { cursor }) },
        signal,
      });
      if (
        !record(value) ||
        !Array.isArray(value.items) ||
        !(value.nextCursor === null || validId(value.nextCursor))
      )
        invalid();
      const items = value.items.map((item: unknown) => parseProposal(item, projectId));
      if (new Set(items.map((item) => item.id)).size !== items.length) invalid();
      return { items, nextCursor: value.nextCursor as number | null };
    },
    async get(projectId: number, proposalId: number, signal: AbortSignal) {
      validateIds(projectId, proposalId);
      return parseProposal(
        await request(`/projects/${projectId}/proposals/${proposalId}`, { signal }),
        projectId,
        proposalId,
      );
    },
    async diff(
      projectId: number,
      proposalId: number,
      candidateVersion: number | undefined,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposalId);
      if (candidateVersion !== undefined) validateIds(candidateVersion);
      return parseDiff(
        await request(`/projects/${projectId}/proposals/${proposalId}/diff`, {
          ...(candidateVersion === undefined ? {} : { query: { candidateVersion } }),
          signal,
        }),
        proposalId,
        candidateVersion,
      );
    },
    async candidate(
      projectId: number,
      proposalId: number,
      candidateVersion: number | undefined,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposalId);
      if (candidateVersion !== undefined) validateIds(candidateVersion);
      return parseCandidate(
        await request(`/projects/${projectId}/proposals/${proposalId}/candidate`, {
          ...(candidateVersion === undefined ? {} : { query: { candidateVersion } }),
          signal,
        }),
        proposalId,
        candidateVersion,
      );
    },
    async text(
      projectId: number,
      proposalId: number,
      fileId: number,
      candidateVersion: number | undefined,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposalId, fileId);
      if (candidateVersion !== undefined) validateIds(candidateVersion);
      const value = await request(
        `/projects/${projectId}/proposals/${proposalId}/files/${fileId}`,
        {
          ...(candidateVersion === undefined ? {} : { query: { candidateVersion } }),
          signal,
        },
      );
      if (
        !record(value) ||
        value.fileId !== fileId ||
        value.contentKind !== 'text' ||
        !validId(value.candidateVersion) ||
        (candidateVersion !== undefined && value.candidateVersion !== candidateVersion) ||
        typeof value.path !== 'string' ||
        !hash(value.sha256) ||
        typeof value.content !== 'string'
      )
        invalid();
      return value as ProposalTextFile;
    },
    async download(
      projectId: number,
      proposalId: number,
      fileId: number,
      candidateVersion: number | undefined,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposalId, fileId);
      if (candidateVersion !== undefined) validateIds(candidateVersion);
      const blob = await request(
        `/projects/${projectId}/proposals/${proposalId}/files/${fileId}/download`,
        {
          ...(candidateVersion === undefined ? {} : { query: { candidateVersion } }),
          responseType: 'blob',
          signal,
        },
      );
      if (!(blob instanceof Blob)) invalid();
      return blob;
    },
    async downloadMaterial(
      projectId: number,
      proposal: Proposal,
      material: Material,
      side: 'before' | 'after',
      signal: AbortSignal,
    ) {
      validateIds(
        projectId,
        proposal.id,
        proposal.version,
        proposal.baseRevisionId,
        material.materialId,
      );
      const base = `/projects/${projectId}`;
      const path = `/materials/${material.materialId}/download`;
      const blob = await request(
        side === 'after' ? `${base}/proposals/${proposal.id}${path}` : `${base}${path}`,
        {
          query:
            side === 'after'
              ? { version: proposal.version }
              : { revisionId: proposal.baseRevisionId },
          responseType: 'blob',
          signal,
        },
      );
      if (!(blob instanceof Blob) || blob.size !== material.sizeBytes) invalid();
      return blob;
    },
    async annotations(projectId: number, revisionId: number, ids: number[], signal: AbortSignal) {
      validateIds(projectId, revisionId, ...ids);
      const pending = new Set(ids);
      const annotations = new Map<number, ReviewAnnotation>();
      let cursor: number | null = null;
      while (pending.size && !signal.aborted) {
        const page: unknown = await request(`/projects/${projectId}/annotations`, {
          query: { revisionId, limit: 100, ...(cursor === null ? {} : { cursor }) },
          signal,
        });
        if (
          !record(page) ||
          !Array.isArray(page.items) ||
          !(
            page.nextCursor === null ||
            (validId(page.nextCursor) && (cursor === null || page.nextCursor < cursor))
          )
        )
          invalid();
        for (const item of page.items) {
          if (!record(item) || !validId(item.id)) invalid();
          if (!pending.delete(item.id)) continue;
          if (
            item.projectId !== projectId ||
            item.viewedRevisionId !== revisionId ||
            !validId(item.version) ||
            !isAnchor(item.anchor) ||
            typeof item.body !== 'string' ||
            (item.status !== 'active' && item.status !== 'resolved')
          )
            invalid();
          annotations.set(item.id, {
            id: item.id,
            version: item.version,
            anchor: item.anchor,
            body: item.body,
            status: item.status,
          });
        }
        cursor = page.nextCursor;
        if (cursor === null) break;
      }
      return annotations;
    },
    async validate(projectId: number, proposal: Proposal, signal: AbortSignal) {
      validateIds(projectId, proposal.id, proposal.version);
      const result = parseValidation(
        await request(`/projects/${projectId}/proposals/${proposal.id}/validate`, {
          method: 'POST',
          body: { expectedProposalVersion: proposal.version },
          signal,
        }),
        proposal.id,
      );
      if (
        result.candidateVersion !== proposal.version ||
        result.candidateManifestHash !== proposal.candidateManifestHash
      )
        invalid();
      return result;
    },
    async validation(
      projectId: number,
      proposalId: number,
      validationId: number,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposalId, validationId);
      return parseValidation(
        await request(
          `/projects/${projectId}/proposals/${proposalId}/validations/${validationId}`,
          { signal },
        ),
        proposalId,
        validationId,
      );
    },
    async pdf(projectId: number, compileJobId: number, signal: AbortSignal) {
      validateIds(projectId, compileJobId);
      const blob = await request(`/projects/${projectId}/compilations/${compileJobId}/pdf`, {
        responseType: 'blob',
        signal,
      });
      if (!(blob instanceof Blob) || (blob.type && blob.type !== 'application/pdf')) invalid();
      return blob;
    },
    async accept(
      projectId: number,
      proposal: Proposal,
      validation: ProposalValidation,
      acknowledgeCompileFailure: boolean,
      key: string,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposal.id, proposal.version, proposal.baseRevisionId, validation.id);
      if (
        validation.proposalId !== proposal.id ||
        validation.candidateVersion !== proposal.version ||
        validation.candidateManifestHash !== proposal.candidateManifestHash ||
        !['not_required', 'succeeded', 'compile_failed'].includes(validation.status) ||
        (validation.status === 'compile_failed' && !acknowledgeCompileFailure) ||
        (validation.status !== 'compile_failed' && acknowledgeCompileFailure) ||
        proposal.status !== 'draft' ||
        proposal.isStale ||
        !/^[A-Za-z0-9._~-]{1,128}$/.test(key)
      )
        throw new Error('Proposal is not ready to accept');
      const value = await request(`/projects/${projectId}/proposals/${proposal.id}/accept`, {
        method: 'POST',
        body: {
          expectedProposalVersion: proposal.version,
          baseRevisionId: proposal.baseRevisionId,
          validationId: validation.id,
          candidateManifestHash: proposal.candidateManifestHash,
          acknowledgeCompileFailure,
        },
        idempotencyKey: key,
        signal,
      });
      if (
        !record(value) ||
        value.proposalId !== proposal.id ||
        value.projectId !== projectId ||
        !validId(value.revisionId) ||
        !validId(value.revisionNumber) ||
        !validId(value.mainFileId) ||
        value.manifestHash !== proposal.candidateManifestHash ||
        !['pending', 'ready', 'failed'].includes(String(value.historySyncStatus))
      )
        invalid();
      return value as ProposalAccepted;
    },
    async reject(projectId: number, proposal: Proposal, signal: AbortSignal) {
      validateIds(projectId, proposal.id, proposal.version);
      if (proposal.status !== 'draft') throw new Error('Proposal cannot be rejected');
      const rejected = parseProposal(
        await request(`/projects/${projectId}/proposals/${proposal.id}/reject`, {
          method: 'POST',
          body: { expectedProposalVersion: proposal.version },
          signal,
        }),
        projectId,
        proposal.id,
      );
      if (
        rejected.status !== 'rejected' ||
        rejected.version !== proposal.version ||
        rejected.candidateManifestHash !== proposal.candidateManifestHash
      )
        invalid();
      return rejected;
    },
    async rebase(
      projectId: number,
      proposal: Proposal,
      input: RebaseProposalInput,
      signal: AbortSignal,
    ) {
      validateIds(projectId, proposal.id, proposal.version, input.baseRevisionId);
      if (proposal.status !== 'draft') throw new Error('Proposal cannot be rebased');
      const value = parseProposal(
        await request(`/projects/${projectId}/proposals/${proposal.id}/rebase`, {
          method: 'POST',
          body: input,
          signal,
        }),
        projectId,
        proposal.id,
      );
      if (value.baseRevisionId !== input.baseRevisionId || value.version <= proposal.version)
        invalid();
      return value;
    },
  };
}

export type ReviewApi = ReturnType<typeof createReviewApi>;
