# Рішення, припущення та джерела

Статус: журнал v0.1, 26.10.2026.

## 1. Погоджено

| ID     | Рішення                                                   | Наслідок                                                                      |
| ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| U-FE01 | TypeScript + Vue                                          | Vue 3 SFC, strict TS                                                          |
| U-FE02 | Проєктування + каркас Vue-застосунку                      | FE0; робоча авторизація та domain integration наступними етапами              |
| U-FE03 | Документація приблизно як у бекенді                       | Нумеровані файли, фактичний статус окремо від цільових контрактів             |
| U-FE04 | Дизайн-систему й мокапи опрацювати окремо, тільки основне | Один стислий бриф, 4 ключові макети; повний каталог усіх екранів не потрібний |

Backend U01–U15 успадковано як предметні обмеження, зокрема web acceptance усіх ШІ-правок, числові IDs, один Bearer без cookies/refresh, Google та односторонній backup. Оригінальні матеріали не переписуються.

## 2. Технічні рішення каркаса

| ADR    | Рішення                                 | Причина та перевірка                                                           |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| FE-A01 | Vite SPA, без Nuxt/SSR                  | Приватний workspace не потребує SEO; перевірити deep links на production host  |
| FE-A02 | Pinia для shared state, fetch transport | Прості явні залежності; query cache за потребою, без другого джерела draft     |
| FE-A03 | Same-origin `/api`, dev reverse proxy   | Один browser origin, простіший auth; CORS/Origin backend збережені             |
| FE-A04 | Memory-only Bearer                      | Відповідає backend; reload потребує входу, persistence окремим рішенням        |
| FE-A05 | Explicit save спочатку                  | Зрозумілі ревізії, conflict/retry/dirty generation перевіряються до autosave   |
| FE-A06 | CSS tokens, без UI-kit                  | Візуальна система ще обговорюється; каркас має тимчасове нейтральне оформлення |
| FE-A07 | CodeMirror 6 і PDF.js — кандидати       | LSP/Typst/UTF-16/worker spike перед install; альтернативу задокументувати      |

Exact installed versions — у package.json/package-lock.json; сумісність перевіряється build/tests, а не твердженням «latest». TypeScript 5.9.3 обрано в межах peer range поточного typescript-eslint; оновлення окремим перевіреним кроком.

## 3. Відкриті питання, які не блокують FE0

- Остаточна стилістика, логотип, шрифт і потреба темної теми — до деталізації мокапів. Початково світла спокійна робоча тема та system fonts.
- Максимальні розміри файлів/матеріалів і навантаження — backend limits, уточнити до upload/performance acceptance.
- Точні Bearer handshake для LSP та validated request/consent flow — узгодити з backend до FE4/FE5; див. 05.
- Перші системні шаблони та два реальні MCP-клієнти — з backend release plan, не вигадувати їхню підтримку.

## 4. Джерела

Предметні правила: [backend README](https://github.com/Typstoria/backend/blob/main/README.md), [scope](https://github.com/Typstoria/backend/blob/main/docs/backend/01-scope.md), [модель](https://github.com/Typstoria/backend/blob/main/docs/backend/03-data-model.md), [workflows](https://github.com/Typstoria/backend/blob/main/docs/backend/04-workflows.md), [API](https://github.com/Typstoria/backend/blob/main/docs/backend/05-api-and-mcp.md), [auth](https://github.com/Typstoria/backend/blob/main/docs/backend/10-authentication.md), [Google](https://github.com/Typstoria/backend/blob/main/docs/backend/11-google-sign-in.md), фактичні identity controllers/DTO. При зміні бекенду контракти перевіряти повторно.

Перевірені первинні технічні джерела:

- [Vue + TypeScript](https://vuejs.org/guide/typescript/overview): Vite не замінює перевірку типів, потрібний vue-tsc.
- [Vue Router lazy loading](https://router.vuejs.org/guide/advanced/lazy-loading.html): route components через dynamic import.
- [Pinia](https://pinia.vuejs.org/core-concepts/): визначення й межі shared stores.
- [Vite environment](https://vite.dev/guide/env-and-mode.html): VITE_* потрапляє у браузерний bundle.
- [CodeMirror guide](https://codemirror.net/docs/guide/): джерело для майбутнього editor spike; інтеграцію ще не перевірено.
- [PDF.js](https://mozilla.github.io/pdf.js/getting_started/): display/viewer layers та worker для PDF preview.

Поточні версії пакетів і peer/engine requirements перевірено через npm registry під час створення lockfile. Ці джерела визначають можливості бібліотек, але не є доказом реалізації Typstoria integration.
