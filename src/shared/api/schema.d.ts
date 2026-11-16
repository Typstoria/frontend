/** Generated TypeScript types from backend OpenAPI. Run npm run api:types; do not edit manually. */
export interface paths {
  '/api/access/tokens': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** List PAT metadata. Secrets are never returned. */
    get: operations['AccessController_tokens'];
    put?: never;
    /** Create a project-scoped MCP token. Copy the secret from this response; it is shown once. */
    post: operations['AccessController_create'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/access/tokens/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    /** Revoke a PAT. It stops working on the next MCP request. */
    delete: operations['AccessController_revokeToken'];
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
    CreatePatDto: {
      /** @example Local MCP client */
      name: string;
      /**
       * @description Only these active projects will be accessible to this token.
       * @example [
       *       1
       *     ]
       */
      projectIds: number[];
      /**
       * @example [
       *       "projects:read",
       *       "documents:read"
       *     ]
       */
      scopes: (
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
      /** @default 30 */
      expiresInDays: number;
    };
    CreatedPatDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      scopes: (
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
      /** @description Copy now; this secret cannot be retrieved again. Use it only with /mcp. */
      token: string;
      name: string;
    };
    AccessGrantDto: {
      /**
       * Format: int32
       * @example 1
       */
      id: number;
      scopes: (
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
    };
    AccessGrantListDto: {
      /**
       * Format: int32
       * @example 1
       */
      nextCursor: number | null;
      items: components['schemas']['AccessGrantDto'][];
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
      tree: components['schemas']['ProjectFileDto'][];
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
      status: 'expired' | 'available';
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
        | 'WORKER_LOST'
        | 'GIT_UNAVAILABLE'
        | 'GIT_DIVERGED'
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
      changes: ('renamed' | 'modified' | 'added' | 'deleted')[];
      before: components['schemas']['ProjectFileDto'] | null;
      after: components['schemas']['ProjectFileDto'] | null;
      patch: string | null;
      /** @enum {string|null} */
      patchOmittedReason: 'BINARY' | 'TEXT_TOO_LARGE' | 'PATCH_LIMIT' | 'COMPUTATION_LIMIT' | null;
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
      files: components['schemas']['FileDiffDto'][];
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
      tree: components['schemas']['ProjectFileDto'][];
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
      /** @description Exact UTF-16 ranges are not available in this CLI adapter yet. */
      range: Record<string, never> | null;
      /** @enum {string} */
      severity: 'error' | 'warning';
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
    CreateCompilationDto: {
      /**
       * Format: int32
       * @example 1
       */
      revisionId: number;
    };
    CompilationDto: {
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
        | 'TYPST_ERROR'
        | 'DEPENDENCY_UNAVAILABLE'
        | 'RUNNER_UNAVAILABLE'
        | 'STORAGE_UNAVAILABLE'
        | 'OUTPUT_LIMIT'
        | 'RESOURCE_LIMIT'
        | 'INTERNAL_ERROR'
        | 'ACCESS_REVOKED'
        | 'WORKER_LOST'
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
  AccessController_tokens: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
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
  AccessController_create: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['CreatePatDto'];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['CreatedPatDto'];
        };
      };
      /** @description A selected project does not belong to this account or was deleted. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      /** @description Rate limit or active credential limit. */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AccessController_revokeToken: {
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
  AccessController_connections: {
    parameters: {
      query?: {
        /** @description Last project ID from the previous page; projects are ordered by ID descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
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
  HistoryController_list: {
    parameters: {
      query?: {
        /** @description Revision number cursor, exclusive; ordered by number descending. */
        cursor?: number;
        /** @description Number of projects per page. */
        limit?: number;
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
