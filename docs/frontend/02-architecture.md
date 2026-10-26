# Архітектура та стек

Статус: цільова архітектура v0.1. Позначка «каркас» означає встановлену й використану залежність; «далі» — рішення для наступного інкременту.

## 1. Технології

| Область          | Рішення                                                 | Статус і причина                                                                 |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Застосунок       | Vue 3, Composition API, SFC, `<script setup lang="ts">` | Каркас; погоджений стек, strict TypeScript                                       |
| Збірка           | Vite, npm, exact versions і lockfile                    | Каркас; SPA без потреби в SSR для приватного редактора                           |
| Маршрути         | Vue Router, history mode, lazy pages                    | Каркас; окремі chunks для основних екранів                                       |
| Спільний UI-стан | Pinia                                                   | Каркас; зараз тільки стан панелей редактора                                      |
| API              | Нативний fetch у спільному transport                    | Каркас; без automatic mutation retries, результат `unknown` до валідації модулем |
| Редактор         | Кандидат CodeMirror 6 з окремим LSP adapter             | Далі; перевірити Typst grammar, UTF-16, IME, undo, LSP та продуктивність         |
| PDF              | Кандидат PDF.js у worker                                | Далі; власні controls, protected fetch, текстовий шар                            |
| UI               | CSS custom properties і невеликі спільні Vue-компоненти | Каркас має попередні tokens; остаточний вигляд після дизайн-брифу                |
| Перевірки        | Vitest, Playwright, ESLint, vue-tsc, Prettier           | Каркас; перевірка типів окрема від Vite transpilation                            |

CodeMirror/PDF.js ще не встановлені. Якщо spike виявить проблему Typst/LSP, альтернативу (зокрема Monaco) обрати ADR до реалізації редактора. Не додаємо UI-kit або другу state/cache library до появи конкретної потреби.

## 2. Межі модулів

```text
src/
  app/                         # bootstrap, router, shell, загальні екрани помилок
  modules/
    identity/                  # auth flow, memory session, API та response validation
    projects/                  # список і метадані проєктів
    workspace/                 # координація файлів, редактора й PDF
    review/                    # пропозиції та рішення
  shared/
    api/                       # transport і нормалізація HTTP errors
    styles/                    # tokens і базове оформлення
tests/e2e/
docs/frontend/
```

`history`, `context`, `annotations`, `templates`, `access`, `transfer`, `backup` додаються разом із реальною функцією. Порожні дерева каталогів наперед не потрібні. Усередині складного модуля поступово з’являться `api/`, `model/`, `components/`, `pages/`; каркас не вимагає чотирьох файлів для однієї сторінки.

Залежності: `app → modules → shared`. Shared не імпортує доменні модулі. Workspace компонує публічні функції модулів, а не змінює чужий store напряму. Fetch не викликається з довільної кнопки: module API виконує запит і перевіряє відповідь, use case керує станом, component відображає результат.

## 3. Власники стану

| Дані                             | Де зберігати                            | Правило                                                              |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Проєкт, ревізії, jobs, proposals | Сервер; module store тримає loaded view | Ключ включає project/revision/candidate; не змішувати з draft        |
| Незбережені тексти               | Workspace draft model                   | `baseRevisionId`, `fileId`, local documentVersion та save generation |
| Відкриті панелі/вкладки          | Pinia UI store                          | Не оголошувати ці дані серверним станом                              |
| Пошук/вибраний файл              | URL query, якщо потрібне посилання      | Жодного повного тексту або credentials                               |
| Access token                     | Приватне memory-сховище auth-модуля     | Без persistence та devtools store зі значенням токена                |
| Editor/PDF instances             | Нереактивні adapters при mounted view   | Dispose document, workers, listeners та object URLs при виході       |

Auth уже використовує explicit load/invalidate/abort і generation для відсікання відповідей попереднього сеансу. Для нових модулів — той самий принцип. Request sequence захищає від пізньої відповіді іншого проєкту; abort сам по собі не гарантує цього. Shared query cache додається лише якщо ручне узгодження стану стане повторюваною проблемою.

## 4. Завантаження та межі довіри

Редактор, diff і PDF завантажуються лише на відповідних екранах; великі дерева, історія та PDF сторінки — з pagination/virtualization за виміряною потребою. Raw source і великі PDF не копіюються в кілька stores.

Усі дані сервера й документів недовірені: Vue interpolation для тексту, без довільного `v-html`; SVG/HTML не вставляються як DOM. Для приватних відповідей немає service-worker cache. Основні security та transport правила — у [05](05-api-and-auth.md).
