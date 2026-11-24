/** Generated TypeScript types from backend OpenAPI. Run npm run api:types; do not edit manually. */
export interface paths {
  '/api/integrations/github/install-url': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Start a web-session-bound GitHub App installation/authorization flow. */
    get: operations['GithubController_start'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/integrations/github/connect': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Complete OAuth and prove this GitHub user can access the selected installation. OAuth codes/states are one-use. */
    post: operations['GithubController_connect'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/integrations/github': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read connection metadata. Tokens and app keys are never returned. */
    get: operations['GithubController_get'];
    put?: never;
    post?: never;
    /** Disconnect locally and stop future backups; existing GitHub history is retained. */
    delete: operations['GithubController_disconnect'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/integrations/github/repositories': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List repositories for which both the installation and the connected user permit writes. */
    get: operations['GithubController_repositories'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/integrations/github/webhook': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** GitHub App webhook. Requires HMAC SHA-256 over the exact raw JSON bytes; no browser credentials. */
    post: operations['GithubWebhookController_webhook'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/backup/contents': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Preview files, materials and annotation count before enabling backup. */
    get: operations['BackupController_contents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/backup': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read the current backup series and last successfully published commit. */
    get: operations['BackupController_get'];
    /** Enable/configure an explicit repository ID and new typstoria/* branch. Existing branches are never adopted. */
    put: operations['BackupController_configure'];
    post?: never;
    /** Disable future writes while retaining configuration and remote history. */
    delete: operations['BackupController_disable'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/backup/runs': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['BackupController_list'];
    put?: never;
    /** Queue a selected accepted revision within this backup series; repeated calls with unchanged contents return the same run. The worker also discovers accepted revisions automatically. */
    post: operations['BackupController_createRun'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/backup/runs/{runId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['BackupController_run'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/backup/runs/{runId}/retry': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Explicitly retry a failed/conflicted run after resolving access or remote-branch conflicts. This never force-pushes. */
    post: operations['BackupController_retry'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/changes': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Atomically save text, uploaded resources, paths, entrypoint and context as one accepted revision. */
    post: operations['ProjectsController_save'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List active projects owned by the current user, newest IDs first. */
    get: operations['ProjectsController_list'];
    put?: never;
    /** Create a private project with an empty main.typ and accepted revision 1. */
    post: operations['ProjectsController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read metadata of an owned project. */
    get: operations['ProjectsController_get'];
    put?: never;
    post?: never;
    /** Soft-delete an owned project and immediately block subsequent access. */
    delete: operations['ProjectsController_delete'];
    options?: never;
    head?: never;
    /** Rename an owned project. The last completed rename wins. */
    patch: operations['ProjectsController_rename'];
    trace?: never;
  };
  '/api/projects/{projectId}/state': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read the current accepted revision, file tree, entrypoint and context. */
    get: operations['ProjectsController_state'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/files/{fileId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read a text file from an owned project's accepted revision. */
    get: operations['ProjectsController_readFile'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** First page of the latest successful accepted document, outside the project tree. */
    get: operations['ProjectResourcesController_preview'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/uploads': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Stage one resource for 24 hours without changing the current document revision. */
    post: operations['ProjectResourcesController_upload'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/uploads/{uploadId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read the status of a project-bound staged or attached upload. */
    get: operations['ProjectResourcesController_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/files/{fileId}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download a file from the current or selected accepted revision as an attachment. */
    get: operations['ProjectResourcesController_download'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Stream bounded project.changed hints. Refetch REST state on reset; reconnect with Last-Event-ID for recent replay. */
    get: operations['ProjectEventsController_open'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/annotations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List annotations with derived positions in the current or selected revision. No content is changed. */
    get: operations['AnnotationsController_list'];
    put?: never;
    /** Create a web annotation on an exact UTF-16 text selection; does not create a document revision. */
    post: operations['AnnotationsController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/annotations/{annotationId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Permanently delete an annotation after checking its version. Historical file revisions remain unchanged. */
    delete: operations['AnnotationsController_remove'];
    options?: never;
    head?: never;
    /** Edit body/status or explicitly reanchor. Reanchor requires revisionId and anchor together. */
    patch: operations['AnnotationsController_update'];
    trace?: never;
  };
  '/api/storage/usage': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Owner-wide persisted storage/history usage; duplicate file bytes count once. */
    get: operations['StorageController_usage'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Register an account and send a confirmation email. Always returns a generic response. */
    post: operations['IdentityController_register'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Sign in after confirming your email and receive one Bearer access token. */
    post: operations['IdentityController_login'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Return the current account, including its email confirmation status. */
    get: operations['IdentityController_me'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** Edit the current user's display name. Email and Google identity remain unchanged. */
    patch: operations['IdentityController_updateProfile'];
    trace?: never;
  };
  '/api/auth/change-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Change a password after checking the current one. All sessions are revoked. */
    post: operations['IdentityController_changePassword'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/request-account-deletion': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Send an account deletion link to the current verified email. No deletion occurs yet. */
    post: operations['IdentityController_requestDeletion'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/delete-account': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Permanently delete an account after an explicit confirmation with its single-use email token. */
    post: operations['IdentityController_deleteAccount'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Revoke the current Bearer access token. */
    post: operations['IdentityController_logout'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/resend-verification': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Request another confirmation email. Does not disclose whether an account exists. */
    post: operations['IdentityController_resend'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/verify-email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Confirm the email using a single-use token from the email. Sign in again afterwards. */
    post: operations['IdentityController_verify'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/forgot-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Request a password reset email. Does not disclose whether an account exists. */
    post: operations['IdentityController_forgot'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/reset-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Set a new password using a single-use token. All existing sessions are revoked. */
    post: operations['IdentityController_reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/google': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Sign in or register using a Google Identity Services credential. Returns a Typstoria token. */
    post: operations['GoogleAuthController_login'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/auth/google/link': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Link a matching Google account after signing in to a verified Typstoria account. */
    post: operations['GoogleAuthController_link'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/import': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Validate the entire ZIP in staging, then atomically create revision 1. Restores portable annotations when included. */
    post: operations['TransferController_import'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/export': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Export immutable source/resources; profile=project includes context/materials and supports opting in to annotations. Compilation outputs and private history are excluded. */
    get: operations['TransferController_export'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor/availability': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Whether the source editor tools are configured on this API instance. */
    get: operations['EditorController_availability'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/editor-sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Start an isolated, ephemeral workspace at an accepted revision. Draft text is never saved automatically. */
    post: operations['EditorController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/outline': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Syntax outline at an immutable accepted revision, including partial symbols for invalid source. */
    get: operations['EditorController_outline'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Inspect current workspace metadata and document versions. */
    get: operations['EditorController_get'];
    put?: never;
    post?: never;
    /** Stop the native process, delete the workspace and expire its private previews. */
    delete: operations['EditorController_remove'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}/ticket': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Mint a one-use 30-second WebSocket ticket; send protocols typstoria.editor.v1 and ticket.<secret>. */
    post: operations['EditorController_ticket'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}/files/{fileId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** Replace one unsaved text buffer using optimistic documentVersion. File paths/tree changes use ordinary project changes. */
    patch: operations['EditorController_update'];
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}/query': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Run completion/hover/definition/formatting/outline/diagnostics on exactly this document version. Formatting returns edits. */
    post: operations['EditorController_query'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}/previews': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Queue an exact unsaved-draft preview through the ordinary sandboxed compiler and global admission limits. */
    post: operations['EditorController_preview'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}/previews/{jobId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Poll preview and compare captured document versions with the current workspace. */
    get: operations['EditorController_previewResult'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/editor-sessions/{sessionId}/previews/{jobId}/pdf': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download a private draft PDF; it is never the accepted revision's authoritative PDF. */
    get: operations['EditorController_pdf'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/compilations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Queue compilation of one immutable accepted revision; poll the returned job ID. */
    post: operations['CompilationsController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/compilations/latest-pdf': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Most recent unexpired PDF of an accepted document, never a proposal preview. */
    get: operations['CompilationsController_latestPdf'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/compilations/ensure': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Open the last PDF, reuse current work, or queue the current saved revision. */
    post: operations['CompilationsController_ensure'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/compilations/{jobId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read status, diagnostics and whether this revision is still current. */
    get: operations['CompilationsController_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/compilations/{jobId}/pdf': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download the unexpired PDF of a successful job after checking project ownership. */
    get: operations['CompilationsController_pdf'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/compiler/catalog': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List available sealed packages/fonts without exposing host paths or asset bytes. Embedded/project fonts remain available. */
    get: operations['CompilerCatalogController_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/system': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List immutable built-in templates. No account required. */
    get: operations['SystemTemplatesController_systems'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/system/{key}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Preview a built-in template. */
    get: operations['SystemTemplatesController_system'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/system/{key}/cover-source': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Create an independent revision-1 project from a built-in template. */
    get: operations['SystemTemplatesController_coverSource'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/system/{key}/copy': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['SystemTemplatesController_copySystem'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/template-versions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Freeze the selected accepted revision into an independent template version. Context/materials are excluded unless includeContext=true. */
    post: operations['TemplatesController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List the owner's immutable template versions. */
    get: operations['TemplatesController_list'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Inspect an owned template version. IDs belong to templates, not source projects. */
    get: operations['TemplatesController_get'];
    put?: never;
    post?: never;
    /** Delete the template version and revoke all its shares. Existing independent copies remain available. */
    delete: operations['TemplatesController_remove'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}/cover-source': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Document-only source for rendering an owned template cover. */
    get: operations['TemplatesController_coverSource'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download an owned template as a portable archive. */
    get: operations['TemplatesController_download'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}/file': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read one file's original bytes for template preview; never renders HTML/SVG inline. */
    get: operations['TemplatesController_file'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}/copy': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Copy this immutable version into a new private project with new IDs, blobs scoped to the recipient and revision 1. */
    post: operations['TemplatesController_copy'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}/shares': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List share metadata without secrets. */
    get: operations['TemplatesController_shares'];
    put?: never;
    /** Create an expiring read/copy capability. The returned secret is shown once and stored only as a hash. */
    post: operations['TemplatesController_share'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/templates/{templateId}/shares/{shareId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Revoke a share immediately; repeated revocation succeeds. */
    delete: operations['TemplatesController_revoke'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/template-shares/preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Preview only the fixed shared template. Does not expose its owner's project or account IDs. */
    get: operations['SharedTemplatesController_preview'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/template-shares/cover-source': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Document-only source for rendering a shared template cover. */
    get: operations['SharedTemplatesController_coverSource'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/template-shares/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download only the fixed shared template. Revoked/expired/invalid secrets all return 404. */
    get: operations['SharedTemplatesController_download'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/template-shares/file': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read one file from the shared fixed snapshot. */
    get: operations['SharedTemplatesController_file'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/template-shares/copy': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Authenticated web-only copy. Revocation is rechecked under a lock before committing the new project. */
    post: operations['SharedTemplatesController_copy'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/material-versions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Stage a context material and queue extraction. Attach its versionId via changes/proposal; upload does not change the document. */
    post: operations['ContextController_upload'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/material-versions/{versionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Poll extraction: pending/running/ready/failed. Failure never prevents downloading original bytes. */
    get: operations['ContextController_status'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/materials': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List immutable material references at an accepted revision; excluded from the Typst compile root. */
    get: operations['ContextController_list'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/materials/{materialId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read extracted chunks with page/sheet/row/line provenance. Pin revisionId while paging. */
    get: operations['ContextController_read'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/materials/{materialId}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download original material bytes at a selected accepted revision. */
    get: operations['ContextController_download'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/materials/search': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Literal case-sensitive search across extracted materials; use nextCursor.materialId/offset and revisionId to continue. */
    post: operations['ContextController_search'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/materials/{materialId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Inspect extracted material text in an immutable proposal candidate before accepting it. */
    get: operations['ContextController_candidate'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/materials/{materialId}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Download original context bytes from an immutable proposal candidate for review. */
    get: operations['ContextController_candidateDownload'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/access/oauth': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Return the public MCP address when OAuth is configured. */
    get: operations['AccessController_availability'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/access/connections': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List authorized OAuth clients and their granted projects and scopes. */
    get: operations['AccessController_connections'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/access/connections/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Revoke an OAuth connection, including all access and refresh tokens. */
    delete: operations['AccessController_revokeConnection'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/revisions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List accepted revisions, newest first, with their current Git projection status. */
    get: operations['HistoryController_list'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/revisions/{revisionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Read accepted revision metadata without depending on a running Git worker. */
    get: operations['HistoryController_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/revisions/{revisionId}/diff': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Compare two immutable snapshots by stable file ID; text patches are bounded. */
    get: operations['HistoryController_diff'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/restore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Restore files, entrypoint and context as a new accepted revision with optimistic concurrency. */
    post: operations['HistoryController_restore'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/history/retry': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Retry failed Git projection attempts without changing the document or ready commits. */
    post: operations['HistoryController_retry'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Список пропозицій проєкту
     * @description Новіші ID першими; nextCursor передається як cursor наступної сторінки. isStale означає, що основний документ уже змінився відносно бази пропозиції.
     */
    get: operations['ProposalsController_list'];
    put?: never;
    /**
     * Створити пропозицію змін без зміни основного документа
     * @description Візьміть baseRevisionId та fileId з /state. Operations мають той самий формат, що /changes. Зберігається окремий незмінний candidate; пропозиція діє 7 днів. Далі перегляньте /candidate і /diff, виконайте /validate та /accept або /reject. До 50 активних пропозицій на проєкт.
     */
    post: operations['ProposalsController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Стан і поточна версія пропозиції
     * @description version потрібна як expectedProposalVersion. candidateManifestHash фіксує точний стан для прийняття. latestValidationId стосується лише поточної candidate version; acceptedRevisionId заповнюється після прийняття.
     */
    get: operations['ProposalsController_get'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /**
     * Замінити набір змін і створити нову candidate version
     * @description Передайте expectedProposalVersion, operations і необов’язковий summary. Весь operations застосовується заново до початкової baseRevisionId, а не до попереднього candidate. Стара validation не підходить новій версії. Максимум 100 версій.
     */
    patch: operations['ProposalsController_update'];
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/rebase': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Перебудувати пропозицію на актуальній ревізії
     * @description Прочитайте свіжий /state, узгодьте зміни й передайте нову baseRevisionId, expectedProposalVersion та повний operations. Автоматичного merge немає. Створюється нова candidate version, яку потрібно перевірити заново.
     */
    post: operations['ProposalsController_rebase'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/candidate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Дерево файлів, entrypoint і контекст пропозиції
     * @description Без candidateVersion читається остання версія. ID candidateSnapshotId не можна передавати замість revisionId в accepted-document endpoints.
     */
    get: operations['ProposalsController_state'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/files/{fileId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Текст файла із candidate, включно з новими файлами */
    get: operations['ProposalsController_file'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/files/{fileId}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Скачати текстовий або бінарний файл із candidate */
    get: operations['ProposalsController_download'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/diff': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Diff від базової ревізії до candidate
     * @description files містить зміни всіх файлів, context — окремого контексту, entrypoint — головного файла. Ліміти текстових patches такі самі, як у revision diff.
     */
    get: operations['ProposalsController_diff'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/validate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Перевірити точну версію пропозиції та створити preview PDF
     * @description Передайте expectedProposalVersion. Для зміни файлів/entrypoint повертається compileJobId: опитуйте /validations/{validationId}, а PDF завантажуйте через /compilations/{compileJobId}/pdf. Для context-only/no-op результат not_required і job не створюється. Основний документ не змінюється.
     */
    post: operations['ProposalsController_validate'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/validations/{validationId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Результат перевірки: pending робота, PDF або Typst diagnostics
     * @description queued/running — зачекайте; succeeded/not_required — можна приймати; compile_failed — Typst error, потрібне явне підтвердження; validation_failed — infrastructure/timeout/limits, прийняття заборонене.
     */
    get: operations['ProposalsController_validation'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/accept': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Прийняти перевірену пропозицію як нову ревізію
     * @description Лише вебсесія власника. Передайте baseRevisionId, expectedProposalVersion, validationId та candidateManifestHash саме переглянутого стану. Якщо база змінилася — 409 REVISION_CONFLICT. acknowledgeCompileFailure=true дозволяє лише явно прийняти фактичний TYPST_ERROR; інші збої та неперевірені зміни не пропускає. No-op не створює зайвої ревізії. Повтор ключа з тим самим payload повертає той самий результат.
     */
    post: operations['ProposalsController_accept'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/projects/{projectId}/proposals/{proposalId}/reject': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Відхилити поточну версію пропозиції
     * @description Лише вебсесія власника. Передайте expectedProposalVersion. Основний документ та його історія залишаються без змін; закриту пропозицію більше не можна редагувати чи прийняти.
     */
    post: operations['ProposalsController_reject'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health/live': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Check whether the API process is running. */
    get: operations['HealthController_live'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health/ready': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Check whether PostgreSQL is reachable. */
    get: operations['HealthController_ready'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    GithubStartDto: {
      installUrl: string;
      authorizeUrl: string;
      state: string;
      expiresAt: string;
    };
    ConnectGithubDto: {
      /**
       * @description GitHub installation ID as a decimal string
       * @example 12345678
       */
      installationId: string;
      code: string;
      state: string;
    };
    GithubConnectionDto: {
      installationId: string | null;
      login: string | null;
      configured: boolean;
      connected: boolean;
    };
    Object: Record<string, never>;
    GithubRepositoryDto: {
      id: string;
      name: string;
      private: boolean;
    };
    GithubRepositoriesDto: {
      nextPage: number | null;
      items: components['schemas']['GithubRepositoryDto'][];
    };
    BackupContentsDto: {
      revisionId: number;
      includeContext: boolean;
      includeAnnotations: boolean;
      entrypoint: string;
      files: string[];
      materials: string[];
      annotationCount: number;
      sizeBytes: number;
    };
    ConfigureBackupDto: {
      /** @default false */
      includeAnnotations: boolean;
      expectedVersion?: number;
      repositoryId: string;
      branch: string;
      /** @default false */
      includeContext: Record<string, never>;
      /** @default false */
      acknowledgePublicRepository: Record<string, never>;
      /** @default true */
      enabled: Record<string, never>;
    };
    BackupTargetDto: {
      lastCommitSha: string | null;
      projectId: number;
      repositoryId: string;
      repositoryName: string;
      repositoryPrivate: boolean;
      branch: string;
      includeContext: boolean;
      includeAnnotations: boolean;
      enabled: boolean;
      version: number;
      lastSyncedRevisionNumber: number;
    };
    CreateBackupRunDto: {
      revisionId?: number;
    };
    BackupRunDto: {
      /** @enum {string} */
      status: 'queued' | 'running' | 'succeeded' | 'failed' | 'conflict' | 'cancelled';
      commitSha: string | null;
      errorCode: string | null;
      commitUrl: string | null;
      finishedAt: string | null;
      id: number;
      projectId: number;
      revisionId: number;
      revisionNumber: number;
      targetVersion: number;
      repositoryName: string;
      branch: string;
      includeContext: boolean;
      includeAnnotations: boolean;
      attempts: number;
      createdAt: string;
    };
    BackupRunListDto: {
      nextCursor: number | null;
      items: components['schemas']['BackupRunDto'][];
    };
    ErrorBodyDto: {
      details?: {
        [key: string]: unknown;
      };
      /** @example RESOURCE_NOT_FOUND */
      code: string;
      /** @example Resource not found */
      message: string;
      /** @example f095b371-20ea-4e2f-99f3-e4c724161491 */
      requestId: string;
    };
    ErrorResponseDto: {
      error: components['schemas']['ErrorBodyDto'];
    };
    AttachMaterialDto: {
      /**
       * Format: int32
       * @example 1
       */
      versionId: number;
      name?: string;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'attachMaterial';
    };
    ReplaceMaterialDto: {
      /**
       * Format: int32
       * @example 1
       */
      versionId: number;
      name?: string;
      /**
       * Format: int32
       * @example 1
       */
      materialId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'replaceMaterial';
    };
    RemoveMaterialDto: {
      /**
       * Format: int32
       * @example 1
       */
      materialId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'removeMaterial';
    };
    TextAnchorDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /** @description Zero-based UTF-16 offset into the full file text. */
      start: number;
      /** @description Exclusive UTF-16 offset. Must match quote exactly. */
      end: number;
      quote: string;
      /** @default  */
      prefix: string;
      /** @default  */
      suffix: string;
    };
    CreateAnnotationOperationDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'createAnnotation';
      anchor: components['schemas']['TextAnchorDto'];
      body: string;
    };
    ResolveAnnotationOperationDto: {
      /**
       * Format: int32
       * @example 1
       */
      annotationId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'resolveAnnotation';
      expectedAnnotationVersion: number;
    };
    CreateDirectoryDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'createDirectory';
      path: string;
    };
    RenameDirectoryDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'renameDirectory';
      path: string;
      newPath: string;
    };
    DeleteDirectoryDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'deleteDirectory';
      path: string;
    };
    AttachFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      uploadId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'attachFile';
      path: string;
    };
    ReplaceFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * Format: int32
       * @example 1
       */
      uploadId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'replaceFile';
    };
    CreateTextFileDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'createFile';
      path: string;
      content: string;
    };
    UpdateTextDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'updateText';
      content: string;
    };
    RenameFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'renameFile';
      path: string;
    };
    DeleteFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'deleteFile';
    };
    SetEntrypointDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'setEntrypoint';
      /** @description Path in the final tree, including a file created in this batch. */
      path: string;
    };
    UpdateContextDto: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      type: 'updateContext';
      content: string;
    };
    ProjectChangesDto: {
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * @description Optional summary recorded with the accepted revision.
       * @example Оновлено вступ документа
       */
      summary?: string;
      operations: (
        | components['schemas']['AttachMaterialDto']
        | components['schemas']['ReplaceMaterialDto']
        | components['schemas']['RemoveMaterialDto']
        | components['schemas']['CreateAnnotationOperationDto']
        | components['schemas']['ResolveAnnotationOperationDto']
        | components['schemas']['CreateDirectoryDto']
        | components['schemas']['RenameDirectoryDto']
        | components['schemas']['DeleteDirectoryDto']
        | components['schemas']['AttachFileDto']
        | components['schemas']['ReplaceFileDto']
        | components['schemas']['CreateTextFileDto']
        | components['schemas']['UpdateTextDto']
        | components['schemas']['RenameFileDto']
        | components['schemas']['DeleteFileDto']
        | components['schemas']['SetEntrypointDto']
        | components['schemas']['UpdateContextDto']
      )[];
    };
    CreatedProjectFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      path: string;
    };
    ProjectChangesResultDto: {
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      mainFileId: number;
      createdFiles: components['schemas']['CreatedProjectFileDto'][];
      revisionNumber: number;
      manifestHash: string;
      /**
       * @description Git processing is asynchronous; query revision history for its current status.
       * @enum {string}
       */
      historySyncStatus: 'pending' | 'ready' | 'failed';
    };
    CreateProjectDto: {
      /**
       * @description Project title; surrounding whitespace is removed.
       * @example Дипломна робота
       */
      title: string;
    };
    ProjectCreatedDto: {
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      mainFileId: number;
      revisionNumber: number;
      manifestHash: string;
      /**
       * @description Git processing is asynchronous; query revision history for its current status.
       * @enum {string}
       */
      historySyncStatus: 'pending' | 'ready' | 'failed';
    };
    ProjectPreviewDto: {
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      version: string;
    };
    ProjectDto: {
      preview?: components['schemas']['ProjectPreviewDto'] | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      currentRevisionId: number;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
      title: string;
    };
    ProjectListDto: {
      /**
       * Format: int32
       * @description Pass as cursor to fetch the next page; null means there are no more results.
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['ProjectDto'][];
    };
    RenameProjectDto: {
      /**
       * @description Project title; surrounding whitespace is removed.
       * @example Дипломна робота
       */
      title: string;
    };
    ProjectRevisionDto: {
      /** @enum {string} */
      historySyncStatus: 'pending' | 'ready' | 'failed';
      commitSha: string | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      parentRevisionId: number | null;
      /** Format: date-time */
      createdAt: string;
      number: number;
      manifestHash: string;
    };
    MaterialMetadataDto: {
      /**
       * Format: int32
       * @example 1
       */
      materialId: number;
      /**
       * Format: int32
       * @example 1
       */
      versionId: number;
      name: string;
      sha256: string;
      sizeBytes: number;
      mediaType: string;
    };
    ProjectFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      path: string;
      /** @enum {string} */
      contentKind: 'binary' | 'text';
      sha256: string;
      sizeBytes: number;
      mediaType: string;
    };
    ProjectStateDto: {
      /**
       * Format: int32
       * @example 1
       */
      mainFileId: number;
      project: components['schemas']['ProjectDto'];
      revision: components['schemas']['ProjectRevisionDto'];
      contextText: string;
      materials: components['schemas']['MaterialMetadataDto'][];
      tree: components['schemas']['ProjectFileDto'][];
      directories: string[];
    };
    ProjectTextFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /** @description UTF-8 source content. The initial main.typ is empty. */
      content: string;
      path: string;
      /** @enum {string} */
      contentKind: 'binary' | 'text';
      sha256: string;
      sizeBytes: number;
      mediaType: string;
    };
    ProjectUploadDto: {
      /**
       * Format: int32
       * @example 1
       */
      uploadId: number;
      /** @example logo.png */
      filename: string;
      /** @example image/png */
      mediaType: string;
      /** @example 68 */
      sizeBytes: number;
      /** @example aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa */
      sha256: string;
      /** Format: date-time */
      expiresAt: string;
      /** @enum {string} */
      status: 'available' | 'expired';
    };
    AnnotationPositionDto: {
      /** @enum {string} */
      state: 'attached' | 'outdated' | 'orphaned';
      start: number | null;
      end: number | null;
    };
    AnnotationDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * Format: int32
       * @example 1
       */
      viewedRevisionId: number;
      anchor: components['schemas']['TextAnchorDto'];
      /** Format: date-time */
      createdAt: string;
      body: string;
      /** @enum {string} */
      status: 'active' | 'resolved';
      version: number;
      creatorId: number;
      /** @enum {string} */
      channel: 'web' | 'mcp';
      position: components['schemas']['AnnotationPositionDto'];
    };
    AnnotationListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['AnnotationDto'][];
    };
    CreateAnnotationDto: {
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      anchor: components['schemas']['TextAnchorDto'];
      body: string;
    };
    AnnotationMutationDto: Record<string, never>;
    UpdateAnnotationDto: {
      body?: string;
      /** @enum {string} */
      status?: 'active' | 'resolved';
      anchor?: components['schemas']['TextAnchorDto'];
      /**
       * Format: int32
       * @example 1
       */
      revisionId?: number;
      expectedAnnotationVersion: number;
    };
    AnnotationVersionDto: Record<string, never>;
    OwnerUsageDto: {
      usedBytes: number;
      maxBytes: number;
      blobs: number;
      maxBlobs: number;
      snapshots: number;
      maxSnapshots: number;
      revisions: number;
      maxRevisions: number;
      compilations: number;
      maxCompilations: number;
    };
    CredentialsDto: {
      /**
       * Format: email
       * @example user@example.com
       */
      email: string;
      /**
       * Format: password
       * @example DemoPassword123!
       */
      password: string;
    };
    MessageDto: {
      message: string;
    };
    LoginDto: {
      /**
       * Format: email
       * @example user@example.com
       */
      email: string;
      /**
       * Format: password
       * @example DemoPassword123!
       */
      password: string;
    };
    UserDto: {
      name: string | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /** Format: date-time */
      createdAt: string;
      email: string;
      emailVerified: boolean;
    };
    LoginResponseDto: {
      /** Format: date-time */
      expiresAt: string;
      accessToken: string;
      /** @enum {string} */
      tokenType: 'Bearer';
      user: components['schemas']['UserDto'];
    };
    AccountDto: {
      name: string | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /** Format: date-time */
      createdAt: string;
      email: string;
      emailVerified: boolean;
      /** @description Whether the account has a password. Does not expose provider identities. */
      hasPassword: boolean;
    };
    UpdateProfileDto: {
      /** @description Non-empty display name. Email and authentication providers are not editable. */
      name: string;
    };
    ChangePasswordDto: {
      /** Format: password */
      currentPassword: string;
      /** Format: password */
      newPassword: string;
    };
    TokenDto: {
      /**
       * @description Example format only. Paste the actual single-use token from the confirmation or password-reset email.
       * @example AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
       */
      token: string;
    };
    EmailDto: {
      /**
       * Format: email
       * @example user@example.com
       */
      email: string;
    };
    ResetPasswordDto: {
      /**
       * @description Example format only. Paste the actual single-use token from the confirmation or password-reset email.
       * @example AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
       */
      token: string;
      /**
       * Format: password
       * @example DemoPassword123!
       */
      password: string;
    };
    GoogleCredentialDto: {
      /**
       * @description Replace this placeholder with the real Google Identity Services credential.
       * @example paste-google-id-token-from-browser
       */
      idToken: string;
    };
    EditorAvailabilityDto: Record<string, never>;
    CreateEditorSessionDto: {
      /**
       * Format: int32
       * @description Omit to read the current accepted revision.
       * @example 1
       */
      revisionId?: number;
    };
    EditorFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      path: string;
      /** @enum {string} */
      contentKind: 'binary' | 'text';
      sha256: string;
      sizeBytes: number;
      mediaType: string;
      uri: string;
      documentVersion: number;
    };
    EditorSessionDto: {
      id: string;
      projectId: number;
      revisionId: number;
      mainFileId: number;
      files: components['schemas']['EditorFileDto'][];
      webSocketPath: string;
      ticket: string;
      ticketExpiresAt: string;
      expiresAt: string;
    };
    SourceOutlineDto: Record<string, never>;
    EditorMetadataDto: {
      id: string;
      projectId: number;
      revisionId: number;
      mainFileId: number;
      files: components['schemas']['EditorFileDto'][];
      expiresAt: string;
    };
    EditorTicketDto: {
      ticket: string;
      expiresAt: string;
    };
    UpdateEditorFileDto: {
      expectedDocumentVersion: number;
      content: string;
    };
    EditorUpdatedDto: {
      fileId: number;
      documentVersion: number;
    };
    EditorPositionDto: {
      line: number;
      character: number;
    };
    EditorQueryDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /** @enum {string} */
      method: 'completion' | 'hover' | 'definition' | 'formatting' | 'outline' | 'diagnostics';
      position?: components['schemas']['EditorPositionDto'];
      documentVersion: number;
    };
    EditorResultDto: {
      result: {
        [key: string]: unknown;
      } | null;
      revisionId: number;
      fileId: number;
      documentVersion: number;
    };
    DiagnosticPositionDto: {
      line: number;
      character: number;
    };
    DiagnosticRangeDto: {
      start: components['schemas']['DiagnosticPositionDto'];
      end: components['schemas']['DiagnosticPositionDto'];
    };
    CompileDiagnosticDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number | null;
      /** @example main.typ */
      path: string | null;
      /** @example unclosed delimiter */
      message: string;
      /** @description Zero-based UTF-16 point. start=end because CLI does not provide an end span; null for unknown source locations. */
      range: components['schemas']['DiagnosticRangeDto'] | null;
      /** @enum {string} */
      severity: 'error' | 'warning';
    };
    DraftPreviewDto: {
      editorSessionId?: string;
      documentVersions?: {
        [key: string]: number;
      } | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @description Accepted revision ID; null for proposal previews.
       * @example 1
       */
      revisionId: number | null;
      /**
       * Format: int32
       * @example 1
       */
      proposalId: number | null;
      candidateVersion: number | null;
      /**
       * Format: int32
       * @example 1
       */
      candidateSnapshotId: number | null;
      /** @enum {string} */
      status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out' | 'cancelled';
      /** @enum {string|null} */
      errorCode:
        | 'STORAGE_UNAVAILABLE'
        | 'WORKER_LOST'
        | 'ACCESS_REVOKED'
        | 'TYPST_ERROR'
        | 'DEPENDENCY_UNAVAILABLE'
        | 'RUNNER_UNAVAILABLE'
        | 'STORAGE_QUOTA_EXCEEDED'
        | 'OUTPUT_LIMIT'
        | 'RESOURCE_LIMIT'
        | 'INTERNAL_ERROR'
        | null;
      /** @example aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa */
      inputManifestHash: string;
      /** @example bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb */
      compilerFingerprint: string | null;
      /** Format: date-time */
      artifactExpiresAt: string | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      startedAt: string | null;
      /** Format: date-time */
      finishedAt: string | null;
      isCurrent: boolean;
      artifactAvailable: boolean;
      diagnostics: components['schemas']['CompileDiagnosticDto'][];
    };
    CreateCompilationDto: {
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
    };
    CompilationDto: {
      editorSessionId?: string;
      documentVersions?: {
        [key: string]: number;
      } | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @description Accepted revision ID; null for proposal previews.
       * @example 1
       */
      revisionId: number | null;
      /**
       * Format: int32
       * @example 1
       */
      proposalId: number | null;
      candidateVersion: number | null;
      /**
       * Format: int32
       * @example 1
       */
      candidateSnapshotId: number | null;
      /** @enum {string} */
      status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out' | 'cancelled';
      /** @enum {string|null} */
      errorCode:
        | 'STORAGE_UNAVAILABLE'
        | 'WORKER_LOST'
        | 'ACCESS_REVOKED'
        | 'TYPST_ERROR'
        | 'DEPENDENCY_UNAVAILABLE'
        | 'RUNNER_UNAVAILABLE'
        | 'STORAGE_QUOTA_EXCEEDED'
        | 'OUTPUT_LIMIT'
        | 'RESOURCE_LIMIT'
        | 'INTERNAL_ERROR'
        | null;
      /** @example aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa */
      inputManifestHash: string;
      /** @example bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb */
      compilerFingerprint: string | null;
      /** Format: date-time */
      artifactExpiresAt: string | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      startedAt: string | null;
      /** Format: date-time */
      finishedAt: string | null;
      isCurrent: boolean;
      artifactAvailable: boolean;
      diagnostics: components['schemas']['CompileDiagnosticDto'][];
    };
    WorkspaceCompilationDto: {
      job: components['schemas']['CompilationDto'] | null;
      revisionNumber: number | null;
    };
    CatalogPackageDto: {
      namespace: string;
      name: string;
      version: string;
      import: string;
    };
    CatalogFontDto: {
      name: string;
      sha256: string;
      sizeBytes: number;
    };
    CompilerCatalogDto: {
      configured: boolean;
      sha256: string;
      packages: components['schemas']['CatalogPackageDto'][];
      fonts: components['schemas']['CatalogFontDto'][];
    };
    SystemTemplateDto: {
      key: string;
      title: string;
      description: string;
    };
    TemplateFileDto: {
      path: string;
      /** @enum {string} */
      contentKind: 'binary' | 'text';
      mediaType: string;
      sizeBytes: number;
      sha256: string;
    };
    TemplateMaterialDto: {
      index: number;
      name: string;
      filename: string;
      mediaType: string;
      sizeBytes: number;
      sha256: string;
    };
    TemplatePreviewDto: {
      directories: string[];
      title: string;
      description: string;
      includeContext: boolean;
      entrypoint: string;
      contextText: string;
      annotationCount: number;
      files: components['schemas']['TemplateFileDto'][];
      materials: components['schemas']['TemplateMaterialDto'][];
    };
    CopyTemplateDto: {
      title?: string;
    };
    CreateTemplateDto: {
      /**
       * @description Project title; surrounding whitespace is removed.
       * @example Дипломна робота
       */
      title: string;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /** @default false */
      includeAnnotations: boolean;
      description?: string;
      /** @default false */
      includeContext: Record<string, never>;
    };
    TemplateDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      title: string;
      description: string;
      includeContext: boolean;
      sizeBytes: number;
      createdAt: string;
    };
    TemplateListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['TemplateDto'][];
    };
    CreateTemplateShareDto: {
      /** @default 7 */
      expiresInDays: Record<string, never>;
    };
    CreatedTemplateShareDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      revokedAt: string | null;
      token: string;
      shareUrl: string;
      expiresAt: string;
      createdAt: string;
    };
    TemplateShareDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      revokedAt: string | null;
      expiresAt: string;
      createdAt: string;
    };
    TemplateShareListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['TemplateShareDto'][];
    };
    MaterialVersionDto: {
      /** @enum {string} */
      status: 'pending' | 'running' | 'ready' | 'failed';
      errorCode: string | null;
      parserFingerprint: string | null;
      versionId: number;
      filename: string;
      sha256: string;
      sizeBytes: number;
      mediaType: string;
      createdAt: string;
    };
    MaterialListDto: {
      revisionId: number;
      items: components['schemas']['MaterialMetadataDto'][];
    };
    MaterialChunkDto: {
      page?: number;
      sheet?: string;
      row?: number;
      line?: number;
      index: number;
      text: string;
    };
    MaterialReadDto: {
      /** @enum {string} */
      status: 'pending' | 'running' | 'ready' | 'failed';
      errorCode: string | null;
      parserFingerprint: string | null;
      nextOffset: number | null;
      materialId: number;
      revisionId: number;
      name: string;
      chunks: components['schemas']['MaterialChunkDto'][];
      versionId: number;
      filename: string;
      sha256: string;
      sizeBytes: number;
      mediaType: string;
      createdAt: string;
    };
    SearchMaterialsDto: {
      /**
       * Format: int32
       * @description Omit to read the current accepted revision.
       * @example 1
       */
      revisionId?: number;
      /** @description Continue from this material ID and chunk index (nextCursor). Use offset=0 for a new material. */
      materialId?: number;
      /** @default 20 */
      limit: Record<string, never>;
      query: string;
      /** @default 0 */
      offset: Record<string, never>;
    };
    MaterialSearchCursorDto: {
      materialId: number;
      offset: number;
    };
    MaterialSearchMatchDto: {
      page?: number;
      sheet?: string;
      row?: number;
      line?: number;
      index: number;
      text: string;
      materialId: number;
      versionId: number;
      sha256: string;
      name: string;
    };
    MaterialSearchDto: {
      nextCursor: components['schemas']['MaterialSearchCursorDto'] | null;
      revisionId: number;
      matches: components['schemas']['MaterialSearchMatchDto'][];
    };
    CandidateMaterialReadDto: {
      /** @enum {string} */
      status: 'pending' | 'running' | 'ready' | 'failed';
      errorCode: string | null;
      parserFingerprint: string | null;
      nextOffset: number | null;
      versionId: number;
      filename: string;
      sha256: string;
      sizeBytes: number;
      mediaType: string;
      createdAt: string;
      materialId: number;
      name: string;
      chunks: components['schemas']['MaterialChunkDto'][];
      proposalId: number;
      candidateVersion: number;
      baseRevisionId: number;
    };
    OAuthAvailabilityDto: {
      /** Format: uri */
      url: string | null;
      enabled: boolean;
    };
    ConnectionProjectDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      title: string;
    };
    AccessGrantDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      scopes: (
        | 'annotations:read'
        | 'projects:read'
        | 'documents:read'
        | 'context:read'
        | 'history:read'
        | 'changes:read'
        | 'changes:propose'
        | 'uploads:stage'
        | 'compile:run'
        | 'compile:read'
      )[];
      projectIds: number[];
      clientId: string | null;
      /** @enum {string} */
      status: 'active' | 'expired' | 'revoked';
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      expiresAt: string;
      /** Format: date-time */
      revokedAt: string | null;
      name: string;
      projects: components['schemas']['ConnectionProjectDto'][];
    };
    AccessGrantListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['AccessGrantDto'][];
    };
    RevisionDetailsDto: {
      /** @enum {string} */
      historySyncStatus: 'pending' | 'ready' | 'failed';
      commitSha: string | null;
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      parentRevisionId: number | null;
      /** Format: date-time */
      createdAt: string;
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      actorId: number;
      /** @enum {string|null} */
      historyErrorCode:
        | 'STORAGE_UNAVAILABLE'
        | 'GIT_UNAVAILABLE'
        | 'GIT_DIVERGED'
        | 'WORKER_LOST'
        | 'MANIFEST_MISMATCH'
        | null;
      /** @enum {string} */
      channel: 'web' | 'mcp';
      operation: string;
      summary: string;
      isCurrent: boolean;
      number: number;
      manifestHash: string;
    };
    RevisionListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['RevisionDetailsDto'][];
    };
    MaterialDiffDto: {
      /** @enum {string} */
      change: 'added' | 'deleted' | 'replaced' | 'renamed';
      before: components['schemas']['MaterialMetadataDto'] | null;
      after: components['schemas']['MaterialMetadataDto'] | null;
      materialId: number;
    };
    FileDiffDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      /**
       * @example [
       *       "renamed",
       *       "modified"
       *     ]
       */
      changes: ('deleted' | 'renamed' | 'modified' | 'added')[];
      before: components['schemas']['ProjectFileDto'] | null;
      after: components['schemas']['ProjectFileDto'] | null;
      patch: string | null;
      /** @enum {string|null} */
      patchOmittedReason: 'BINARY' | 'TEXT_TOO_LARGE' | 'PATCH_LIMIT' | 'COMPUTATION_LIMIT' | null;
    };
    DirectoryDiffDto: {
      added: string[];
      deleted: string[];
    };
    ContextDiffDto: {
      patch: string | null;
      /** @enum {string|null} */
      patchOmittedReason: 'TEXT_TOO_LARGE' | 'BINARY' | 'PATCH_LIMIT' | 'COMPUTATION_LIMIT' | null;
      changed: boolean;
    };
    EntrypointDiffDto: {
      /**
       * Format: int32
       * @example 1
       */
      beforeFileId: number;
      /**
       * Format: int32
       * @example 1
       */
      afterFileId: number;
      changed: boolean;
    };
    RevisionDiffDto: {
      /**
       * Format: int32
       * @example 1
       */
      fromRevisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      toRevisionId: number;
      /** @enum {string} */
      fromHistorySyncStatus: 'pending' | 'ready' | 'failed';
      /** @enum {string} */
      toHistorySyncStatus: 'pending' | 'ready' | 'failed';
      materials: components['schemas']['MaterialDiffDto'][];
      files: components['schemas']['FileDiffDto'][];
      directories: components['schemas']['DirectoryDiffDto'];
      context: components['schemas']['ContextDiffDto'];
      entrypoint: components['schemas']['EntrypointDiffDto'];
    };
    RestoreRevisionDto: {
      /**
       * Format: int32
       * @example 1
       */
      targetRevisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      expectedCurrentRevisionId: number;
      /** @example Відновлено попередній стан документа */
      summary?: string;
    };
    RestoredRevisionDto: {
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      mainFileId: number;
      /**
       * Format: int32
       * @example 1
       */
      restoredFromRevisionId: number;
      revisionNumber: number;
      manifestHash: string;
      /**
       * @description Git processing is asynchronous; query revision history for its current status.
       * @enum {string}
       */
      historySyncStatus: 'pending' | 'ready' | 'failed';
    };
    HistoryRetryDto: {
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      resetCount: number;
    };
    CreateProposalDto: {
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * @description Optional summary recorded with the accepted revision.
       * @example Оновлено вступ документа
       */
      summary?: string;
      operations: (
        | components['schemas']['AttachMaterialDto']
        | components['schemas']['ReplaceMaterialDto']
        | components['schemas']['RemoveMaterialDto']
        | components['schemas']['CreateAnnotationOperationDto']
        | components['schemas']['ResolveAnnotationOperationDto']
        | components['schemas']['CreateDirectoryDto']
        | components['schemas']['RenameDirectoryDto']
        | components['schemas']['DeleteDirectoryDto']
        | components['schemas']['AttachFileDto']
        | components['schemas']['ReplaceFileDto']
        | components['schemas']['CreateTextFileDto']
        | components['schemas']['UpdateTextDto']
        | components['schemas']['RenameFileDto']
        | components['schemas']['DeleteFileDto']
        | components['schemas']['SetEntrypointDto']
        | components['schemas']['UpdateContextDto']
      )[];
    };
    ProposalDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      creatorId: number;
      /** @enum {string} */
      status: 'draft' | 'accepted' | 'rejected' | 'expired';
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      candidateSnapshotId: number;
      /**
       * Format: int32
       * @example 1
       */
      acceptedRevisionId: number | null;
      /**
       * Format: int32
       * @example 1
       */
      latestValidationId: number | null;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      expiresAt: string;
      /** @enum {string} */
      channel: 'web' | 'mcp';
      version: number;
      candidateManifestHash: string;
      summary: string;
      /** @description The main document no longer matches this candidate's base. Rebase before acceptance. */
      isStale: boolean;
    };
    ProposalListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['ProposalDto'][];
    };
    UpdateProposalDto: {
      /**
       * @description Optional summary recorded with the accepted revision.
       * @example Оновлено вступ документа
       */
      summary?: string;
      operations: (
        | components['schemas']['AttachMaterialDto']
        | components['schemas']['ReplaceMaterialDto']
        | components['schemas']['RemoveMaterialDto']
        | components['schemas']['CreateAnnotationOperationDto']
        | components['schemas']['ResolveAnnotationOperationDto']
        | components['schemas']['CreateDirectoryDto']
        | components['schemas']['RenameDirectoryDto']
        | components['schemas']['DeleteDirectoryDto']
        | components['schemas']['AttachFileDto']
        | components['schemas']['ReplaceFileDto']
        | components['schemas']['CreateTextFileDto']
        | components['schemas']['UpdateTextDto']
        | components['schemas']['RenameFileDto']
        | components['schemas']['DeleteFileDto']
        | components['schemas']['SetEntrypointDto']
        | components['schemas']['UpdateContextDto']
      )[];
      /** @example 1 */
      expectedProposalVersion: number;
    };
    RebaseProposalDto: {
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * @description Optional summary recorded with the accepted revision.
       * @example Оновлено вступ документа
       */
      summary?: string;
      operations: (
        | components['schemas']['AttachMaterialDto']
        | components['schemas']['ReplaceMaterialDto']
        | components['schemas']['RemoveMaterialDto']
        | components['schemas']['CreateAnnotationOperationDto']
        | components['schemas']['ResolveAnnotationOperationDto']
        | components['schemas']['CreateDirectoryDto']
        | components['schemas']['RenameDirectoryDto']
        | components['schemas']['DeleteDirectoryDto']
        | components['schemas']['AttachFileDto']
        | components['schemas']['ReplaceFileDto']
        | components['schemas']['CreateTextFileDto']
        | components['schemas']['UpdateTextDto']
        | components['schemas']['RenameFileDto']
        | components['schemas']['DeleteFileDto']
        | components['schemas']['SetEntrypointDto']
        | components['schemas']['UpdateContextDto']
      )[];
      /** @example 1 */
      expectedProposalVersion: number;
    };
    ProposalCandidateDto: {
      operations: (
        | components['schemas']['AttachMaterialDto']
        | components['schemas']['ReplaceMaterialDto']
        | components['schemas']['RemoveMaterialDto']
        | components['schemas']['CreateAnnotationOperationDto']
        | components['schemas']['ResolveAnnotationOperationDto']
        | components['schemas']['CreateDirectoryDto']
        | components['schemas']['RenameDirectoryDto']
        | components['schemas']['DeleteDirectoryDto']
        | components['schemas']['AttachFileDto']
        | components['schemas']['ReplaceFileDto']
        | components['schemas']['CreateTextFileDto']
        | components['schemas']['UpdateTextDto']
        | components['schemas']['RenameFileDto']
        | components['schemas']['DeleteFileDto']
        | components['schemas']['SetEntrypointDto']
        | components['schemas']['UpdateContextDto']
      )[];
      /**
       * Format: int32
       * @example 1
       */
      proposalId: number;
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      candidateSnapshotId: number;
      /**
       * Format: int32
       * @example 1
       */
      mainFileId: number;
      candidateVersion: number;
      candidateManifestHash: string;
      contextText: string;
      materials: components['schemas']['MaterialMetadataDto'][];
      tree: components['schemas']['ProjectFileDto'][];
      directories: string[];
    };
    ProposalTextFileDto: {
      /**
       * Format: int32
       * @example 1
       */
      fileId: number;
      path: string;
      /** @enum {string} */
      contentKind: 'binary' | 'text';
      sha256: string;
      sizeBytes: number;
      mediaType: string;
      candidateVersion: number;
      content: string;
    };
    ProposalDiffDto: {
      files: components['schemas']['FileDiffDto'][];
      materials: components['schemas']['MaterialDiffDto'][];
      directories: components['schemas']['DirectoryDiffDto'];
      context: components['schemas']['ContextDiffDto'];
      entrypoint: components['schemas']['EntrypointDiffDto'];
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      proposalId: number;
      /** @description Annotation operations reviewed and applied only on acceptance. */
      annotationOperations: Record<string, never>[];
      candidateVersion: number;
      candidateManifestHash: string;
    };
    ProposalVersionDto: {
      /**
       * @description Version returned by GET proposal; protects against overwriting a newer candidate.
       * @example 1
       */
      expectedProposalVersion: number;
    };
    ProposalValidationDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      /**
       * Format: int32
       * @example 1
       */
      proposalId: number;
      /** @enum {string} */
      status:
        | 'not_required'
        | 'queued'
        | 'running'
        | 'succeeded'
        | 'compile_failed'
        | 'validation_failed';
      /**
       * Format: int32
       * @example 1
       */
      compileJobId: number | null;
      errorCode: string | null;
      /** Format: date-time */
      createdAt: string;
      candidateVersion: number;
      candidateManifestHash: string;
      diagnostics: components['schemas']['CompileDiagnosticDto'][];
    };
    AcceptProposalDto: {
      /**
       * @description Version returned by GET proposal; protects against overwriting a newer candidate.
       * @example 1
       */
      expectedProposalVersion: number;
      /**
       * Format: int32
       * @example 1
       */
      baseRevisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      validationId: number;
      /**
       * @description Copy from the candidate being reviewed; accepting a different hash is forbidden.
       * @example aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
       */
      candidateManifestHash: string;
      /**
       * @description Only acknowledges an actual Typst error; never bypasses missing validation or infrastructure failure.
       * @default false
       */
      acknowledgeCompileFailure: boolean;
    };
    ProposalAcceptedDto: {
      /**
       * Format: int32
       * @example 1
       */
      projectId: number;
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
      /**
       * Format: int32
       * @example 1
       */
      mainFileId: number;
      /**
       * Format: int32
       * @example 1
       */
      proposalId: number;
      revisionNumber: number;
      manifestHash: string;
      /**
       * @description Git processing is asynchronous; query revision history for its current status.
       * @enum {string}
       */
      historySyncStatus: 'pending' | 'ready' | 'failed';
    };
    LiveHealthDto: {
      /** Format: date-time */
      timestamp: string;
      /**
       * @description API process status.
       * @enum {string}
       */
      status: 'ok';
    };
    DatabaseCheckDto: {
      /**
       * @description PostgreSQL connection status.
       * @enum {string}
       */
      database: 'up';
    };
    ReadyHealthDto: {
      /** Format: date-time */
      timestamp: string;
      /**
       * @description API process status.
       * @enum {string}
       */
      status: 'ok';
      checks: components['schemas']['DatabaseCheckDto'];
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  GithubController_start: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['GithubStartDto'];
        };
      };
    };
  };
  GithubController_connect: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ConnectGithubDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['GithubConnectionDto'];
        };
      };
    };
  };
  GithubController_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['GithubConnectionDto'];
        };
      };
    };
  };
  GithubController_disconnect: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  GithubController_repositories: {
    parameters: {
      query: {
        page: components['schemas']['Object'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['GithubRepositoriesDto'];
        };
      };
    };
  };
  GithubWebhookController_webhook: {
    parameters: {
      query?: never;
      header: {
        'X-GitHub-Event': string;
        'X-Hub-Signature-256': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  BackupController_contents: {
    parameters: {
      query?: {
        includeContext?: boolean;
        includeAnnotations?: boolean;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupContentsDto'];
        };
      };
    };
  };
  BackupController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
    };
  };
  BackupController_configure: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ConfigureBackupDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupTargetDto'];
        };
      };
    };
  };
  BackupController_disable: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  BackupController_list: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupRunListDto'];
        };
      };
    };
  };
  BackupController_createRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateBackupRunDto'];
      };
    };
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupRunDto'];
        };
      };
    };
  };
  BackupController_run: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupRunDto'];
        };
      };
    };
  };
  BackupController_retry: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['BackupRunDto'];
        };
      };
    };
  };
  ProjectsController_save: {
    parameters: {
      query?: never;
      header: {
        'Idempotency-Key': string;
      };
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ProjectChangesDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectChangesResultDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      /** @description REVISION_CONFLICT or IDEMPOTENCY_CONFLICT. Keep the local draft and reload state. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      /** @description Invalid paths, file references or final entrypoint/tree. */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_list: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectListDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_create: {
    parameters: {
      query?: never;
      header: {
        /** @description Scoped to the current web session. Reuse with the same title returns the original result. */
        'Idempotency-Key': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateProjectDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectCreatedDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      /** @description The project from an earlier request has been deleted. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      /** @description IDEMPOTENCY_CONFLICT: this key was used with another title. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      /** @description STORAGE_UNAVAILABLE: no project was created. */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Project marked as deleted. Physical cleanup is deferred. */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_rename: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RenameProjectDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_state: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectStateDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectsController_readFile: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        fileId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectTextFileDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectResourcesController_preview: {
    parameters: {
      query?: {
        version?: string;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'image/png': string;
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectResourcesController_upload: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': {
          /**
           * Format: binary
           * @description PNG/JPEG/GIF/WebP/PDF/TTF/OTF/WOFF/WOFF2; up to 10 MiB.
           */
          file: string;
        };
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectUploadDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectResourcesController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        uploadId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectUploadDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectResourcesController_download: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        fileId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/octet-stream': string;
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProjectEventsController_open: {
    parameters: {
      query?: never;
      header?: {
        'Last-Event-ID'?: string;
      };
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/event-stream': string;
        };
      };
    };
  };
  AnnotationsController_list: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AnnotationListDto'];
        };
      };
      /** @description Project, revision, annotation or selected file is not accessible. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description ANNOTATION_VERSION_CONFLICT: reload before editing. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AnnotationsController_create: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateAnnotationDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AnnotationMutationDto'];
        };
      };
      /** @description Project, revision, annotation or selected file is not accessible. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description ANNOTATION_VERSION_CONFLICT: reload before editing. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AnnotationsController_remove: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        annotationId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['AnnotationVersionDto'];
      };
    };
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Project, revision, annotation or selected file is not accessible. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description ANNOTATION_VERSION_CONFLICT: reload before editing. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AnnotationsController_update: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        annotationId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateAnnotationDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AnnotationMutationDto'];
        };
      };
      /** @description Project, revision, annotation or selected file is not accessible. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description ANNOTATION_VERSION_CONFLICT: reload before editing. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  StorageController_usage: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['OwnerUsageDto'];
        };
      };
    };
  };
  IdentityController_register: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CredentialsDto'];
      };
    };
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['LoginDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['LoginResponseDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      /** @description EMAIL_NOT_VERIFIED: confirm your email before signing in. */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_me: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AccountDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_updateProfile: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateProfileDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AccountDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_changePassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ChangePasswordDto'];
      };
    };
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_requestDeletion: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_deleteAccount: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['TokenDto'];
      };
    };
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_logout: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_resend: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['EmailDto'];
      };
    };
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_verify: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['TokenDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_forgot: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['EmailDto'];
      };
    };
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  IdentityController_reset: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ResetPasswordDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  GoogleAuthController_login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['GoogleCredentialDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['LoginResponseDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  GoogleAuthController_link: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['GoogleCredentialDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      415: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  TransferController_import: {
    parameters: {
      query?: never;
      header: {
        'Idempotency-Key': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': {
          /** Format: binary */
          file: string;
          title: string;
          /** @description Required for a manifest-free archive with multiple .typ files */
          entrypoint?: string;
        };
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectCreatedDto'];
        };
      };
    };
  };
  TransferController_export: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
        profile?: 'document' | 'project';
        includeAnnotations?: boolean;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/zip': string;
        };
      };
    };
  };
  EditorController_availability: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EditorAvailabilityDto'];
        };
      };
    };
  };
  EditorController_create: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateEditorSessionDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EditorSessionDto'];
        };
      };
    };
  };
  EditorController_outline: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SourceOutlineDto'];
        };
      };
    };
  };
  EditorController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EditorMetadataDto'];
        };
      };
    };
  };
  EditorController_remove: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  EditorController_ticket: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EditorTicketDto'];
        };
      };
    };
  };
  EditorController_update: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
        fileId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateEditorFileDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EditorUpdatedDto'];
        };
      };
    };
  };
  EditorController_query: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['EditorQueryDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['EditorResultDto'];
        };
      };
    };
  };
  EditorController_preview: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DraftPreviewDto'];
        };
      };
    };
  };
  EditorController_previewResult: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
        jobId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['DraftPreviewDto'];
        };
      };
    };
  };
  EditorController_pdf: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sessionId: string;
        jobId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/pdf': string;
        };
      };
    };
  };
  CompilationsController_create: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateCompilationDto'];
      };
    };
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CompilationDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  CompilationsController_latestPdf: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['WorkspaceCompilationDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  CompilationsController_ensure: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['WorkspaceCompilationDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  CompilationsController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        jobId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CompilationDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  CompilationsController_pdf: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        jobId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/pdf': string;
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  CompilerCatalogController_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CompilerCatalogDto'];
        };
      };
    };
  };
  SystemTemplatesController_systems: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['SystemTemplateDto'][];
        };
      };
    };
  };
  SystemTemplatesController_system: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        key: 'blank' | 'article' | 'report';
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['TemplatePreviewDto'];
        };
      };
    };
  };
  SystemTemplatesController_coverSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        key: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/zip': string;
        };
      };
    };
  };
  SystemTemplatesController_copySystem: {
    parameters: {
      query?: never;
      header: {
        'Idempotency-Key': string;
      };
      path: {
        key: 'blank' | 'article' | 'report';
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CopyTemplateDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectCreatedDto'];
        };
      };
    };
  };
  TemplatesController_create: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateTemplateDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['TemplateDto'];
        };
      };
    };
  };
  TemplatesController_list: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['TemplateListDto'];
        };
      };
    };
  };
  TemplatesController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['TemplatePreviewDto'];
        };
      };
    };
  };
  TemplatesController_remove: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  TemplatesController_coverSource: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/zip': string;
        };
      };
    };
  };
  TemplatesController_download: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/zip': string;
        };
      };
    };
  };
  TemplatesController_file: {
    parameters: {
      query: {
        path: string;
      };
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/octet-stream': string;
        };
      };
    };
  };
  TemplatesController_copy: {
    parameters: {
      query?: never;
      header: {
        'Idempotency-Key': string;
      };
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CopyTemplateDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectCreatedDto'];
        };
      };
    };
  };
  TemplatesController_shares: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['TemplateShareListDto'];
        };
      };
    };
  };
  TemplatesController_share: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        templateId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateTemplateShareDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CreatedTemplateShareDto'];
        };
      };
    };
  };
  TemplatesController_revoke: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        shareId: number;
        templateId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  SharedTemplatesController_preview: {
    parameters: {
      query?: never;
      header: {
        /** @description Secret from the share URL fragment; never send it as a query parameter. */
        'X-Template-Share': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['TemplatePreviewDto'];
        };
      };
    };
  };
  SharedTemplatesController_coverSource: {
    parameters: {
      query?: never;
      header: {
        /** @description Secret from the share URL fragment; never send it as a query parameter. */
        'X-Template-Share': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/zip': string;
        };
      };
    };
  };
  SharedTemplatesController_download: {
    parameters: {
      query?: never;
      header: {
        /** @description Secret from the share URL fragment; never send it as a query parameter. */
        'X-Template-Share': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/zip': string;
        };
      };
    };
  };
  SharedTemplatesController_file: {
    parameters: {
      query: {
        path: string;
      };
      header: {
        /** @description Secret from the share URL fragment; never send it as a query parameter. */
        'X-Template-Share': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/octet-stream': string;
        };
      };
    };
  };
  SharedTemplatesController_copy: {
    parameters: {
      query?: never;
      header: {
        /** @description Secret from the share URL fragment; never send it as a query parameter. */
        'X-Template-Share': string;
        'Idempotency-Key': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CopyTemplateDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProjectCreatedDto'];
        };
      };
    };
  };
  ContextController_upload: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': {
          /** Format: binary */
          file: string;
        };
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MaterialVersionDto'];
        };
      };
    };
  };
  ContextController_status: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        versionId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MaterialVersionDto'];
        };
      };
    };
  };
  ContextController_list: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MaterialListDto'];
        };
      };
    };
  };
  ContextController_read: {
    parameters: {
      query: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
        offset: components['schemas']['Object'];
        limit: components['schemas']['Object'];
      };
      header?: never;
      path: {
        materialId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MaterialReadDto'];
        };
      };
    };
  };
  ContextController_download: {
    parameters: {
      query?: {
        /** @description Omit to read the current accepted revision. */
        revisionId?: number;
      };
      header?: never;
      path: {
        materialId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ContextController_search: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['SearchMaterialsDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MaterialSearchDto'];
        };
      };
    };
  };
  ContextController_candidate: {
    parameters: {
      query: {
        version?: number;
        offset: components['schemas']['Object'];
        limit: components['schemas']['Object'];
      };
      header?: never;
      path: {
        materialId: number;
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CandidateMaterialReadDto'];
        };
      };
    };
  };
  ContextController_candidateDownload: {
    parameters: {
      query: {
        version?: number;
        offset: components['schemas']['Object'];
        limit: components['schemas']['Object'];
      };
      header?: never;
      path: {
        materialId: number;
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AccessController_availability: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['OAuthAvailabilityDto'];
        };
      };
    };
  };
  AccessController_connections: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['AccessGrantListDto'];
        };
      };
    };
  };
  AccessController_revokeConnection: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  HistoryController_list: {
    parameters: {
      query?: {
        /** @description Revision number cursor, exclusive; ordered by number descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RevisionListDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  HistoryController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        revisionId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RevisionDetailsDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  HistoryController_diff: {
    parameters: {
      query: {
        /** @description Compare this source revision against the revision in the route. */
        against: number;
      };
      header?: never;
      path: {
        revisionId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RevisionDiffDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  HistoryController_restore: {
    parameters: {
      query?: never;
      header: {
        'Idempotency-Key': string;
      };
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RestoreRevisionDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestoredRevisionDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  HistoryController_retry: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['HistoryRetryDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_list: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
        /** @description Optional case-insensitive title substring; surrounding whitespace is ignored. */
        search?: string;
      };
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalListDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_create: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreateProposalDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_update: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['UpdateProposalDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_rebase: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RebaseProposalDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_state: {
    parameters: {
      query?: {
        /** @description Omit to read the latest candidate; older immutable versions remain readable. */
        candidateVersion?: number;
      };
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalCandidateDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_file: {
    parameters: {
      query?: {
        /** @description Omit to read the latest candidate; older immutable versions remain readable. */
        candidateVersion?: number;
      };
      header?: never;
      path: {
        fileId: number;
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalTextFileDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_download: {
    parameters: {
      query?: {
        /** @description Omit to read the latest candidate; older immutable versions remain readable. */
        candidateVersion?: number;
      };
      header?: never;
      path: {
        fileId: number;
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/octet-stream': string;
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_diff: {
    parameters: {
      query?: {
        /** @description Omit to read the latest candidate; older immutable versions remain readable. */
        candidateVersion?: number;
      };
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalDiffDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_validate: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ProposalVersionDto'];
      };
    };
    responses: {
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalValidationDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_validation: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        validationId: number;
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalValidationDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_accept: {
    parameters: {
      query?: never;
      header: {
        'Idempotency-Key': string;
      };
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['AcceptProposalDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalAcceptedDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  ProposalsController_reject: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        proposalId: number;
        projectId: number;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['ProposalVersionDto'];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ProposalDto'];
        };
      };
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      413: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
  HealthController_live: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['LiveHealthDto'];
        };
      };
    };
  };
  HealthController_ready: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ReadyHealthDto'];
        };
      };
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ErrorResponseDto'];
        };
      };
    };
  };
}
