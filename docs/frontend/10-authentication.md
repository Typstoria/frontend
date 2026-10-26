# Реалізована авторизація

Статус: frontend FE1. UI використовує наявний Identity API; пошта й Google-перевірка виконуються бекендом.

## 1. Екрани та сценарії

| Маршрут                 | Поведінка                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/auth/login`           | Email/password або офіційна GIS button; 403 verification → resend, 409 Google collision → локальний вхід і linking |
| `/auth/register`        | Пароль 6–128, без trim; generic 202, пояснення листа, resend після 5 хвилин                                        |
| `/auth/verify-email`    | Token із fragment прибирається до старту Router; POST тільки за кнопкою, після успіху окремий login                |
| `/auth/forgot-password` | Generic 202, cooldown; Google-only користувачу запропоновано Google login                                          |
| `/auth/reset-password`  | Новий пароль із token, без автоматичного входу; невалідне посилання → запит нового                                 |
| `/settings/account`     | Захищений профіль через GET me, явне прив’язування Google тієї самої адреси                                        |

Login приймає 1–128 символів пароля, register/reset — 6–128 відповідно до DTO. Password visibility доступна окремою кнопкою; password autocomplete відрізняється для login і нового пароля. UI не вигадує правила великих літер або додаткові можливості спільної роботи з мокапу.

Cooldown рахується за wall clock і блокує повторний запит у цій формі. Це UX-обмеження; server rate limits залишаються остаточними. Generic response не повідомляє про існування email і не гарантує доставку листа.

Після resend зі сторінки входу можна повернутися до пароля. Cooldown обмежує лише надсилання листа й не блокує login після підтвердження адреси.

## 2. Сеанс

`identity-session.ts` тримає access token у приватній змінній. У Vue доступні тільки readonly user/endReason та стан неповного logout. Немає token у Pinia/devtools state, localStorage, sessionStorage чи cookie; reload потребує нового входу.

Expiry timer завершує локальний сеанс. Приватний 401 відкликає локальний доступ і переводить на login. Захищені маршрути — `/projects` і `/settings/account`; guards не замінюють backend authorization. ReturnTo обмежений відомими внутрішніми сторінками.

При поверненні у вкладку перевіряється актуальний профіль через API, щоб виявити відкликання доступу, зокрема після reset в іншій вкладці. Тимчасовий network failure не завершує чинний локальний сеанс; приватний 401 або вимога повторного підтвердження пошти завершують його.

Кожний login змінює generation. Відповідь попередньої сесії не може записати профіль чи завершити новий вхід. Скасований при навігації login не встановлює сеанс. Logout одразу очищує локальний стан і надсилає revoke з попереднім token; network failure показує, що серверне відкликання не підтверджене. Автоматичного повтору mutation немає.

## 3. Email-посилання

Формат сумісний із backend: `/auth/verify-email#token=…`, `/auth/reset-password#token=…`. Token має бути base64url із 43 символів. Він утримується тільки до використання або виходу зі сторінки, не передається в query, logs, telemetry чи returnTo. Відкриття сторінки не споживає посилання.

Видалення fragment означає, що після reload потрібно відкрити лист повторно або запросити нове посилання. Використаний/прострочений token відображається як помилка з можливістю нового запиту. Verify/reset не авторизують і очищують локальну попередню сесію.

## 4. Google

У frontend environment задати **публічний** `VITE_GOOGLE_CLIENT_ID`; у backend — відповідний `GOOGLE_CLIENT_ID`. Frontend origin має бути дозволений у Google Cloud Web client і backend CORS. Client Secret у frontend не використовується.

Для локального popup flow використовується `Referrer-Policy: no-referrer-when-downgrade`, відповідно до інструкції Google; production — `strict-origin-when-cross-origin`. Повне `no-referrer` приховує Referer, який Google рекомендує передавати для localhost. Налаштування цього заголовка не замінює реєстрацію дозволеного origin у Google Cloud.

Якщо Google повертає `no registered origin` або `invalid_client`, окремо перевірити **Google Cloud → Google Auth Platform → Clients**: client типу **Web application**, а в **Authorized JavaScript origins** — `http://localhost` і `http://localhost:5173`, без кінцевого `/`. Frontend і backend мають використовувати ID цього клієнта. Для JavaScript callback flow redirect URI не потрібний. Зміни в Google Cloud повідомляються користувачу окремо; локальне налаштування коду не реєструє origin у Google автоматично.

SDK завантажується з офіційного `accounts.google.com/gsi/client` тільки за наявності Client ID та на екрані з Google button. Офіційний `renderButton` отримує українську locale і доступну ширину; callback передає `credential` у JSON. One Tap й автоматичний вибір акаунта не вмикаються. Handler очищується при unmount; повторний render використовує ту саму SDK initialization.

Кожна кнопка отримує власний `state`, який повертає GIS callback. Результат приймається лише її чинним handler: запізніла відповідь закритого login не може виконати linking на іншому екрані. Це кореляція кнопки за офіційним GIS контрактом, не власна реалізація OAuth.

Google login і linking — різні дії. Collision ніколи не виконує автоматичного linking; після локального входу користувач відкриває обліковий запис і явно обирає Google. Тип відповіді user не містить provider status, тому UI не вигадує збережений стан прив’язування з поля, якого немає в API.

Джерела: [налаштування origin та Referrer-Policy](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [GIS JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference), [офіційна кнопка](https://developers.google.com/identity/gsi/web/guides/display-button).

## 5. Вигляд і перевірки

Auth layout використовує кольори та controls M04, але дотримується загального правила мінімального UI: заголовок, поля, дії та контекстні повідомлення. Слогани, мовну мітку, декоративну панель, footer і повідомлення про неналаштований Google прибрано; недоступна Google-дія прихована. Технічні ідентифікатори й коди API не відображаються. Повідомлення можуть переноситися; немає фіксованої висоти card, що обрізає success/error text.

Playwright перевіряє desktop і mobile Chromium із mock API та GIS stub. Unit tests перевіряють response validation, expiry, late response, abort, logout failure, ізоляцію Google callbacks й очищення token/returnTo.

Наскрізно перевірено також frontend → реальний API → PostgreSQL: відмова до verification, підтвердження адреси, login/me/logout, відкликання токена, reset, відмова зі старим паролем і вхід із новим. Для перевірки використано тимчасовий акаунт і test challenges; після перевірки їх видалено. Окремі backend integration tests перевіряють register/resend/forgot та Google/link із перехопленою поштою і тестовим Google verifier.

Реальну доставку Mailjet і ручний вхід у Google ці перевірки не підтверджують. Вони потребують чинної конфігурації провайдерів та користувацької дії в листі/Google.
