# Розвиток каркаса

Статус: FE0, 26.10.2026. Цей файл описує наявний код; решта документів містить також цільову поведінку.

## 1. Що є зараз

- Vue 3 + strict TypeScript, Vite, Vue Router, Pinia.
- Адаптивна оболонка, skip link, 404, lazy pages і page titles.
- `/projects` із поясненням відсутності інтеграції; кнопка створення вимкнена.
- `/preview/workspace`: статичний Typst і HTML-зразок сторінки, показ/приховування файлів, source/preview switch для вузького екрана.
- `/preview/review`: статичне порівняння, вимкнені accept/reject. Це не реалізований diff engine.
- Auth placeholders, які не приймають credentials і не обробляють email tokens.
- JSON fetch helper та unit tests transport boundary; browser smoke і CI.

Жодного автоматичного запиту до API, auth store, route guard, CodeMirror, PDF.js, LSP чи SSE ще немає. Приватні дані в каркас не додаються; preview routes відкриті й не є прикладом захисту реального workspace.

## 2. Локальна робота

```bash
nvm use
npm ci
npm run dev
```

Для зміни proxy target створити `.env` за `.env.example`, після редагування перезапустити dev server. Змінна `API_PROXY_TARGET` читається тільки Vite config; браузерний base завжди `/api`. Backend origins мають містити frontend origin; proxy зберігає Origin.

Перевірки:

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

Build виходить у `dist/`. `vite preview` не є production host. Вебсервер надає frontend assets і SPA fallback, проксіює API окремо. Production deploy цього каркаса не створює функціональної авторизації чи редактора.

## 3. Додавання функції

1. Перевірити фактичний OpenAPI, уточнити failure/conflict states і позначити відповідний етап у 06.
2. Додати module API adapter із runtime response validation; наявні DTO не копіювати вручну як друге джерело істини.
3. Відокремити server view, local draft і UI state. Long-lived token тримати в auth service memory, не Pinia state.
4. Додати use case, component/page, route та cleanup. Не читати singleton router із shared transport.
5. Перевірити meaningful негативні сценарії, `npm run check` та потрібний browser test.
6. Оновити статус документації й прибрати placeholder для готової функції. Preview fixtures лишати явно демонстраційними, не fallback при API failure.

## 4. Домовленості

`PascalCase.vue`, `kebab-case.ts`, `*.store.ts`, `*.test.ts`. Composition API; TypeScript imports із `type`, без `any` за замовчуванням. Error/data з мережі — `unknown` до перевірки. Server IDs — number; candidate/revision типи розрізняти на рівні моделей, не лише назв змінних.

Спільні компоненти витягати після реального повторення. На перший етап достатньо button/input/dialog/status/empty state; складний generic form framework наперед не потрібний. UI text українською, програмні ідентифікатори англійською.

Tests не залежать від робочої БД чи mail secrets. CI запускає quality checks і Chromium desktop/mobile smoke. Firefox/WebKit входять до release matrix наступних етапів, поточний CI їх не перевіряє.

## 5. Межі автоматичних перевірок

`npm run check` перевіряє форматування, lint, типи, unit tests і production build. `npm run test:e2e` перевіряє навігацію та адаптивне компонування в Chromium desktop/mobile.

Перевірки каркаса не звертаються до backend API, Google чи Mailjet. Реальна авторизація, PDF-компіляція та MCP потребуватимуть окремих інтеграційних перевірок після реалізації відповідних frontend-сценаріїв.
