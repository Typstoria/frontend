# План реалізації та перевірки

Статус: v0.1, без календарних оцінок. Залежності backend P1–P9 описано в його [плані](https://github.com/Typstoria/backend/blob/main/docs/backend/07-delivery-plan.md).

## 1. Етапи

| Етап                   | Результат                                                                      | Залежність / критерій виходу                                             |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| FE0 — поточна задача   | Архітектура, основні екрани, дизайн-бриф, Vue shell, tooling/CI                | Збірка й smoke працюють; placeholders не видаються за інтеграцію         |
| FE1 — auth             | Register/verify/login/reset/logout, Google/link, memory token, приватні guards | Наявний Identity API; повний цикл із поштою, expiry та reload            |
| FE2 — projects/save    | CRUD, multi-file draft, context text, upload, atomic save/conflict             | Backend P2/OpenAPI; конкурентне збереження не втрачає текст              |
| FE3 — PDF/history      | Compile jobs, protected PDF, diagnostics, history/diff/restore, SSE            | Backend P3; old job не замінює новий результат, restore створює версію   |
| FE4 — review/access    | Proposal lifecycle, candidate PDF, accept/reject/stale, PAT та consent/revoke  | P4/P5 і Bearer consent contract; користувач підтверджує точний candidate |
| FE5 — повний workspace | Матеріали/annotations, templates/shares, ZIP, LSP/outline, GitHub backup       | P6–P8 і editor/WS spike; усі функціональні групи з 01 покриті            |
| FE6 — release          | Browser/accessibility/performance, deployment, integration matrix              | Backend P9 + наскрізні сценарії, документація фактичних обмежень         |

Окремий дизайн-прохід із 4 мокапами до FE2; він не потребує реалізації всіх інтеграцій. CodeMirror/LSP/PDF та Bearer transport spikes виконуються до залежних етапів. Закриття FE0 не означає готовності FE1–FE6.

## 2. Основні перевірки

| ID   | Сценарій                                                                                                                  | Вимоги                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| FT01 | Register → verify явним POST → login → logout; reset/reused token; Google collision/link; 401 без refresh                 | F01, N04                  |
| FT02 | Create/template, multi-file save/reopen, concurrent вкладки, rename entrypoint, lost response/idempotency                 | F02, F04, F08, N01, N05   |
| FT03 | Typst error зберігає draft; compile out of order, unsaved source, stale/expired PDF                                       | F05, N02, N03             |
| FT04 | Усі proposal operations видимі; candidate changed/stale, validation failure, explicit compile-error accept, повтор accept | F10, N01, N02             |
| FT05 | History/binary diff/restore; annotations на rename/delete; матеріал без витягу                                            | F03, F09, F12, F13        |
| FT06 | PAT one-time secret, least privilege/project grants, consent deny/revoke, реальний MCP → web review                       | F06, F07, F19, N04        |
| FT07 | Template share/revoke/copy, explicit inclusion, ZIP round trip/entrypoint required, GitHub conflict/retry                 | F14, F15, F17, F18        |
| FT08 | UTF-16 (українська, emoji), IME, completion/format/undo/definition; outline partial/stale                                 | F11, F16                  |
| FT09 | Offline/reconnect, expired access під час save, другий акаунт не бачить cache/drafts; cleanup streams/workers             | N01, N04, N05             |
| FT10 | Production deep link/fallback, keyboard/focus, mobile panes, Chromium/Firefox/WebKit                                      | N06 та всі основні екрани |

Unit tests — state transitions, save generation/retry, response adapters і protocol parsing. Component tests додавати для форм, dirty guards і review acknowledgement. Playwright — user journeys та browser integration. Mock API перевіряє UI, але не доводить реальну компіляцію, email delivery або MCP compatibility; перед release потрібні real-backend сценарії з двома акаунтами.

## 3. Definition of Done

Функція має готовий API/response validation, loading/empty/error/conflict states, cleanup/cancellation, доступність keyboard, негативні сценарії й актуальну документацію. Перевірки відповідають ризику, не дублюють implementation. Нові dependencies pinned і lockfile оновлений.

Початкові цілі, не результати вимірювань: приватний shell без editor/PDF dependencies; важкі бібліотеки lazy; введення в тестовому Typst fixture без помітного блокування UI; відсутність page overflow від 390 px. Перед FE6 зафіксувати browser/device, розмір fixture і час завантаження/введення/рендеру, тоді встановити числові performance budgets.

## 4. Фінальна демонстрація

Auth → проєкт із шаблону → ручні правки й PDF → зовнішній MCP proposal → diff/validation → accept/reject → history/restore. Далі матеріали й анотації, незалежна template copy/share/revoke, ZIP round trip, GitHub backup conflict та revoke зовнішнього доступу. Усі ці сценарії є частиною повної поставки; поточна задача завершується FE0.
