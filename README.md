# Typstoria — клієнтська частина

Проєктування та початковий каркас **TypeScript + Vue 3**. Реалізовано Vite, Router, Pinia, адаптивну оболонку, сторінку проєктів, демонстраційні компонування редактора й review, заготовки auth-маршрутів, базовий JSON HTTP-клієнт, перевірки та CI.

**API ще не підключено.** Документи у макетах — статичні приклади; створення, збереження, компіляція та рішення щодо пропозицій недоступні. Авторизація поки представлена сторінками-заготовками. Це каркас, а не завершений інкремент роботи з документами.

## Запуск

Потрібні Node.js **24.15+ у гілці 24 LTS** і npm, як у бекенді. Контейнери для фронтенду не потрібні.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Відкрити [http://localhost:5173](http://localhost:5173). `.env` необов’язковий: типові значення вже задані. При потребі скопіювати `.env.example` у `.env`, зберігши наявні налаштування.

Vite перенаправляє `/api` на `http://127.0.0.1:3000`; бекенд запускається окремо. Для каркаса він не потрібен. Його `CORS_ORIGINS` і `PUBLIC_WEB_URL` мають містити `http://localhost:5173`. Порт фіксований: якщо зайнятий, dev server повідомить про це.

| Команда            | Призначення                                     |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Локальна розробка                               |
| `npm run build`    | Перевірка типів і збірка в `dist/`              |
| `npm run preview`  | Локальний перегляд збірки; не production server |
| `npm run check`    | Форматування, lint, типи, unit tests, build     |
| `npm run test:e2e` | Browser smoke, desktop і mobile Chromium        |
| `npm run format`   | Форматування коду й документації                |

Перед першим browser test: `npx playwright install chromium`. CI встановлює Chromium автоматично. Unit-тести не потребують БД чи бекенду.

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

Спершу читати 01 → 02 → 03 → 04. Для окремої роботи над дизайном достатньо 09 та сценаріїв із 04.

Джерело предметних вимог — репозиторій [Typstoria/backend](https://github.com/Typstoria/backend/blob/main/README.md), його `docs/backend/01–11` та вихідне бачення. Серверні контракти перевіряються за актуальним OpenAPI.
