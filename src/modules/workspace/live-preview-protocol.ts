export interface LivePreviewCompileRequest {
  type: 'compile';
  generation: number;
  entrypoint: string;
  changes: LivePreviewChange[];
}

export type LivePreviewRequest = LivePreviewCompileRequest;

export interface LivePreviewChange {
  path: string;
  content: string | Uint8Array | null;
}

export interface LivePreviewDiagnostic {
  path?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface LivePreviewCompiledResponse {
  type: 'compiled';
  generation: number;
  document: Uint8Array;
  diagnostics?: LivePreviewDiagnostic[];
}

export interface LivePreviewFailedResponse {
  type: 'failed';
  generation: number;
  reason: 'document' | 'unavailable';
  diagnostics?: LivePreviewDiagnostic[];
}

export type LivePreviewResponse = LivePreviewCompiledResponse | LivePreviewFailedResponse;
