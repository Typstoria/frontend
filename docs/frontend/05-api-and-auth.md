# Контракти API та авторизація

Статус: 26.10.2026. Джерело фактів — актуальні контролери/DTO бекенду та його OpenAPI. Документація цільових API не є доказом їх реалізації.

## 1. Реалізований бекенд

Усі маршрути нижче мають prefix `/api`. Фронтенд використовує їх у реалізованому auth-модулі; деталі налаштування та обмеження перевірок — у [10-authentication.md](10-authentication.md).

| Метод/маршрут                    | Тіло                 | Результат                                        |
| -------------------------------- | -------------------- | ------------------------------------------------ |
| POST `/auth/register`            | `{email,password}`   | 202 generic message                              |
| POST `/auth/login`               | `{email,password}`   | 200 `{accessToken,tokenType,expiresAt,user}`     |
| GET `/auth/me`                   | Bearer               | `{id,email,emailVerified,createdAt}`             |
| POST `/auth/logout`              | Bearer               | 204 без body                                     |
| POST `/auth/resend-verification` | `{email}`            | 202 generic message                              |
| POST `/auth/verify-email`        | `{token}`            | 200 message, без login                           |
| POST `/auth/forgot-password`     | `{email}`            | 202 generic message                              |
| POST `/auth/reset-password`      | `{token,password}`   | 200 message, без login                           |
| POST `/auth/google`              | `{idToken}`          | 200 звичайний LoginResponse Typstoria            |
| POST `/auth/google/link`         | `{idToken}` + Bearer | 200 message, явне linking після локального входу |

Сутності мають JSON number IDs, додатний int32 (1–2147483647). RequestId, hashes та секрети — рядки; токен Typstoria непрозорий, це не JWT. Дати — ISO 8601 UTC. У концептуальних backend-прикладах рядкові `revision-10` є підписами, не реальними ID.

Email trim/lowercase визначає backend. Register/reset: пароль 6–128 символів без додаткових вимог; не trim. Login допускає 1–128, щоб зміна password policy не змінювала перевірку існуючих credentials. Фронтенд відтворює DTO limits, але серверна валідація остаточна.

## 2. Bearer lifecycle

Один access token у приватному memory-сховищі auth-модуля, без refresh/cookies, browser storage та reactive store із самим секретом. Після reload потрібен новий login. Технічну поведінку описано в документації; UI повідомляє лише про фактичне завершення сеансу. Клієнтський expiry timer і приватний 401 завершують сеанс та прибирають профіль.

Приватний запит явно передає `Authorization: Bearer …`; public auth requests без нього. `expiresAt` дає клієнтське попередження, але server 401 остаточний. Reset/verify відкликають попередні tokens і не авторизують. Після logout очистити memory/cache; якщо server revoke не вдався, повідомити, що серверний токен міг залишитися чинним.

Login до email verification: 403 `EMAIL_NOT_VERIFIED`, без токена. UI пропонує resend та перевірку пошти. Register/resend/forgot завжди generic, 202 не гарантує доставку. Cooldown — 5 хвилин; таймер UX не замінює server rate limits.

Посилання: `/auth/verify-email#token=…` і `/auth/reset-password#token=…`. Перед створенням Router клієнт читає fragment у memory й очищує URL через history.replaceState. POST виконується лише після натискання підтвердження/submit форми; GET/mount не споживає token. Token не потрапляє у router persistence, telemetry, console чи returnTo та очищується після використання/виходу зі сторінки. Після reload потрібно відкрити лист повторно або запросити нове посилання.

Google: офіційна GIS button, callback `credential` → JSON `{idToken}`. Це окремий credential, не Bearer Typstoria. `GOOGLE_ACCOUNT_LINK_REQUIRED` веде до звичайного login й окремого linking; автоматичного об’єднання немає. Google-only recovery — через Google. Client ID публічний; client secret у frontend не потрібний. `GOOGLE_AUTH_NOT_CONFIGURED` — провайдер недоступний, звичайний вхід залишається.

## 3. Transport каркаса

`src/shared/api/client.ts`: JSON request, optional explicit Bearer/Idempotency-Key, AbortSignal + 15 s timeout, 204, нормалізований ApiError. Transport повертає `unknown`: module adapter повинен валідовувати response, а не робити безумовний `as DTO`. Abort/network error не видається за server envelope. Жодного retry або автоматичного redirect на login тут немає.

Каркас підтримує лише same-origin `/api`, прості шляхи без query і JSON body. Pagination/query, FormData upload, streaming та PDF bytes потребують окремих transport methods при реалізації відповідних модулів. Вони повинні зберегти ті самі правила auth, origin і cleanup; поточний helper не використовувати для PDF.

Приклад актуального error envelope:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "requestId": "request-id"
  }
}
```

UI обирає зрозумілий текст за `code`; невідомий code має safe fallback. Details з validation може бути object; не рендерити як HTML. 401 — re-login; 403 — пояснення доступу/verification; 404 — ресурс недоступний; 409 — conflict UI; 413/415 — upload help; 429 — backoff; 503 — тимчасова недоступність. Retry-After використовувати лише якщо header фактично доступний: наразі CORS exposedHeaders містить тільки X-Request-Id.

## 4. Майбутні контракти та узгодження

Точні шляхи — у [backend API design](https://github.com/Typstoria/backend/blob/main/docs/backend/05-api-and-mcp.md). Projects/files/revisions/compile/proposals та решта доменних endpoints **ще не реалізовані**. Типи фактичного OpenAPI генеруються через openapi-typescript у `src/shared/api/schema.d.ts`; identity adapter додатково перевіряє відповіді в runtime. Після додавання endpoint оновити generated файл, не дописувати до нього майбутні DTO вручну.

| До реалізації функції     | Мінімальний узгоджений контракт                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Workspace                 | State snapshot, stable file IDs, atomic operations, baseRevisionId, metadataVersion, limits          |
| Save/retry                | Idempotency-Key, payload conflict, recovery після втрати відповіді                                   |
| Compile/PDF               | Job status, diagnostics UTF-16, isCurrent, artifactAvailable, inputs fingerprint, protected download |
| Review                    | Exact candidate/version/hash, validationId, accept/reject/rebase, stale та acknowledgement           |
| Materials/annotations     | Extraction/provenance і anchor versions/status; pagination                                           |
| Templates/transfer/backup | Inclusion preview, capability scope, job progress, remote conflict                                   |

GET lists — cursor pagination (проєктно default 20/max 100). Для example fixtures використовувати числові IDs. Не розміщувати згенеровані майбутні DTO поруч із реальними як нібито підтверджений контракт.

## 5. Bearer у SSE, WebSocket та OAuth consent

- Native EventSource не дає встановити довільний Authorization header. Кандидат — fetch streaming SSE adapter із Bearer, коректним SSE parsing (не `split` на мережеві chunks), event ID/replay і reconnect. Query token заборонений; після reconnect — GET reconciliation. Парсер та бібліотеку вибрати у spike.
- Browser WebSocket також не надає довільний Authorization header. Потрібен узгоджений серверний handshake: кандидат first-message auth із timeout і повною забороною LSP frames до успішної перевірки. Наявність такого handshake поки не підтверджена. Не підставляти довгоживучий access token у URL/subprotocol.
- OAuth consent не можна завершити простим browser navigation, очікуючи на auth cookie. Backend має видати validated authorization-request handle, web UI показати client/scopes/projects, authenticated consent POST підтвердити рішення, сервер повернути перевірений redirect. Точні routes й handle lifecycle — blocker перед consent реалізацією. Не приймати довільний redirect URL із query.

Ці три інтеграційні питання не блокують каркас, але потребують реального контракту й негативних тестів перед відповідними етапами.

## 6. Браузерна безпека та deployment

Production SPA та `/api` рекомендовано на одному HTTPS origin через reverse proxy. SPA fallback застосовується лише до frontend routes: `/api`, `/mcp`, WS та реальні assets не повинні повертати index.html. Config у VITE_* публічний; Mailjet, DB, GitHub secrets тут не буває. Не кешувати приватні responses у service worker/CDN.

PDF завантажується з Bearer як bytes у PDF.js; нативний iframe URL не додає Authorization. Object URLs, PDF documents/workers і buffers прибираються на зміну ресурсу/logout. Source/SVG/materials не виконуються як HTML. Для capability share page — no-referrer та відсутність сторонньої аналітики з повним URL. CSP задає web server; GIS/worker origins додаються лише після перевірки конкретної інтеграції.
