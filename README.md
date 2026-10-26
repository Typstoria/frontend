# Typstoria — клієнтська частина

Фронтенд **TypeScript + Vue 3**. Реалізовано основу застосунку та авторизацію: реєстрацію, вхід/вихід, підтвердження пошти, відновлення пароля, Google-вхід і явне прив’язування Google. Форми використовують наявний Identity API бекенду; оформлення спирається на мокап M04.

Робота з документами ще не реалізована: `/projects` — захищена заготовка, редактор і review — відкриті демонстраційні макети. Створення, збереження, компіляція та рішення щодо пропозицій поки недоступні.

## Запуск

Потрібні Node.js **24.15+ у гілці 24 LTS** і npm, як у бекенді. Контейнери для фронтенду не потрібні.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Відкрити [http://localhost:5173](http://localhost:5173). `.env` необов’язковий: типові значення вже задані. При потребі скопіювати `.env.example` у `.env`, зберігши наявні налаштування.

Vite перенаправляє `/api` на `http://127.0.0.1:3000`; для авторизації потрібен окремо запущений бекенд із БД і налаштованим Mailjet. Його `CORS_ORIGINS` і `PUBLIC_WEB_URL` мають містити `http://localhost:5173`. Порт фіксований: якщо зайнятий, dev server повідомить про це. Для перегляду оформлення бекенд не потрібний.

Сеанс зберігається лише в пам’яті цієї вкладки: після reload потрібен новий вхід. Для Google задайте публічний `VITE_GOOGLE_CLIENT_ID` у frontend `.env` та такий самий `GOOGLE_CLIENT_ID` у бекенді. Без Client ID Google script не завантажується; звичайний вхід доступний. Докладніше — [авторизація](docs/frontend/10-authentication.md).

| Команда            | Призначення                                     |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Локальна розробка                               |
| `npm run build`    | Перевірка типів і збірка в `dist/`              |
| `npm run preview`  | Локальний перегляд збірки; не production server |
| `npm run check`    | Форматування, lint, типи, unit tests, build     |
| `npm run test:e2e` | Browser smoke, desktop і mobile Chromium        |
| `npm run format`   | Форматування коду й документації                |

Перед першим browser test: `npx playwright install chromium`. CI встановлює Chromium автоматично. Browser tests запускають окремий сервер на порту 5174 і підміняють API/GIS; БД та зовнішні листи не потрібні.

Для оновлення типів виконайте експорт OpenAPI у бекенді, потім `npm run api:types -- <path-to-openapi.json>`. Це ручна dev-команда, яка читає JSON і генерує лише TypeScript-типи у `src/shared/api/schema.d.ts`; API та код браузера вона не створює. Generated файл вручну не редагувати.

## Документація

| Файл                                                               | Зміст                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| [01-scope.md](docs/frontend/01-scope.md)                           | Межі й основні вимоги                                    |
| [02-architecture.md](docs/frontend/02-architecture.md)             | Стек, модулі, стан і залежності                          |
| [03-screens.md](docs/frontend/03-screens.md)                       | Екрани, навігація, компонування                          |
| [04-workflows.md](docs/frontend/04-workflows.md)                   | Редагування, конфлікти, PDF, review                      |
| [05-api-and-auth.md](docs/frontend/05-api-and-auth.md)             | Наявні та майбутні API, Bearer, SSE/LSP                  |
| [06-delivery-plan.md](docs/frontend/06-delivery-plan.md)           | Етапи, перевірки та критерії готовності                  |
| [07-development.md](docs/frontend/07-development.md)               | Поточний каркас, запуск, правила розвитку                |
| [08-decisions.md](docs/frontend/08-decisions.md)                   | Рішення, припущення, відкриті питання, джерела           |
| [09-design-and-mockups.md](docs/frontend/09-design-and-mockups.md) | Короткий бриф дизайн-системи й чотирьох основних мокапів |
| [10-authentication.md](docs/frontend/10-authentication.md)         | Реалізовані auth-сценарії, налаштування та перевірки     |

Спершу читати 01 → 02 → 03 → 04. Для окремої роботи над дизайном достатньо 09 та сценаріїв із 04.

Джерело предметних вимог — репозиторій [Typstoria/backend](https://github.com/Typstoria/backend/blob/main/README.md), його `docs/backend/01–11` та вихідне бачення. Серверні контракти перевіряються за актуальним OpenAPI.
