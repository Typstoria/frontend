# Налаштування профілю й діалоги

Реалізовано редагування імені, зміну пароля та видалення акаунта. Email незмінний; прив’язування/відв’язування Google у профілі не потрібне за вимогою користувача. Google login зберігається.

## Профіль

GET `/api/auth/me` повертає AccountDto: `id`, nullable `name`, `email`, `emailVerified`, `createdAt`, `hasPassword`. Loading/error не завершують чинний сеанс; після помилки є «Повторити». На сторінці — одна панель із компактними розділами; не додаємо аватар, дату реєстрації, ID, декоративні описи або недоступні controls.

Ім’я редагується в діалозі через PATCH `/api/auth/me` `{name}`. String trim, від 1 до 80 Unicode code points без керівних символів. Порожнє поле, пробіли та null заборонені; прибрати збережене ім’я не можна. Серверна валідація остаточна; успіх оновлює поточний профіль та його кеш, помилка залишає введене значення.

«Змінити пароль» показується тільки за `hasPassword=true`. Діалог надсилає POST `/api/auth/change-password` `{currentPassword,newPassword}`: поточний 1–128, новий 6–128, без trim. Паролі очищуються після кожної спроби та при виході. Неправильний current password — контекстна помилка без logout. Тільки підтверджений 204 очищує поточний збережений сеанс і переводить на login із фактичним повідомленням про зміну пароля. Backend відкликає всі старі токени й старі reset/deletion links.

## Видалення

Перша дія — діалог із наслідками й адресою одержувача. «Надіслати посилання» виконує authenticated POST `/api/auth/request-account-deletion`; не видаляє акаунт. Після 202 — повідомлення перевірити пошту/«Спам», локальний cooldown 5 хвилин. Доставку не обіцяємо, server cooldown остаточний.

Лист відкриває `/auth/delete-account#token=…`. Fragment очищується до початкової ініціалізації Router, token живе лише в приватній пам’яті сторінки. Повторне відкриття link у тій самій сторінці теж прибирає fragment і скидає попереднє підтвердження. GET/mount/перегляд листа нічого не споживають. Перед фінальним POST `/api/auth/delete-account` потрібні непозначений checkbox і явне натискання «Видалити акаунт назавжди».

Token — одноразовий email proof, тому фінальна сторінка працює без входу і для passwordless акаунтів. Після 204 показує успіх та очищує локальний сеанс. Network failure залишає повтор доступним; invalid/expired/reused token прибирає руйнівну дію й пропонує налаштування для нового запиту. Повтор після втраченої успішної відповіді може отримати invalid token: якщо акаунт уже недоступний, повторне видалення не потрібне.

Backend атомарно прибирає акаунт і owned DB records та блокує доступ до файлів/PDF. Фізичні immutable bytes/repos/backups потребують окремої GC/retention policy; HTTP не обіцяє негайного стирання всіх копій. Деталі — [backend account settings](https://github.com/Typstoria/backend/blob/main/docs/backend/18-account-settings.md).

## Базовий діалог

`ModalDialog.vue` завжди змонтований, видимість керується `open`; `v-if` на самому компоненті не використовувати. Native dialog відкривається в Transition enter hook. Вхід/вихід — opacity й зміщення на 6 px зі слабким scale, 160 ms; backdrop теж згасає. За `prefers-reduced-motion: reduce` transitions/animations вимкнені.

`dismiss` просить батька змінити open на false. До завершення leave діалог залишається модальним, фон inert, focus containment активний. `closed` надходить після завершення animation/close й повернення фокуса — тоді батько очищує form state. Busy блокує повторний submit і Escape/скасування. Unmount через навігацію закриває dialog та прибирає listeners/state без затримки. Цей контракт використовують профіль і CRUD проєктів.

## Перевірки

Unit tests покривають credential persistence/expiry, malformed storage, cross-tab logout/switch, stale responses, API/network/timeout failures без logout, response boundary та password-change transition. Playwright desktop/mobile: редагування/заборона очищення імені, failed name save, wrong password/network failure без виходу, підтверджена зміна пароля, passwordless actions, request deletion/cooldown, token scrub/explicit confirmation, expired/retry та reduced motion/focus. Загальні auth/project сценарії перевіряються повторно. Backend інтеграційні перевірки використовують PostgreSQL та captured mail, без зовнішньої доставки.
