# Екрани та навігація

Статус: основна інформаційна архітектура v0.1. Остаточні візуальні рішення — за [дизайн-брифом](09-design-and-mockups.md).

## 1. Карта екранів

| Екран                     | Цільовий маршрут                             | Основні дії                                         |
| ------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Вхід/реєстрація           | `/auth/login`, `/auth/register`              | Email/password, Google, verify/resend guidance      |
| Посилання з листів        | `/auth/verify-email`, `/auth/reset-password` | Явне підтвердження або новий пароль                 |
| Відновлення               | `/auth/forgot-password`                      | Generic відповідь, cooldown                         |
| Проєкти                   | `/projects`                                  | Пошук, створення, шаблон, імпорт, rename/delete     |
| Робочий простір           | `/projects/:projectId`                       | Файли, текст, PDF, контекст, структура, annotations |
| Пропозиція                | `/projects/:projectId/proposals/:proposalId` | Diff, validation, candidate PDF, accept/reject      |
| Історія                   | `/projects/:projectId/history`               | Read-only версія, diff, restore як нова версія      |
| Шаблони                   | `/templates`, `/shared/templates/:token`     | Вибір, незалежна копія, обмежений share snapshot    |
| Доступи й обліковий запис | `/settings/access`, `/settings/account`      | PAT/OAuth grants, revoke, Google linking            |
| Backup                    | `/projects/:projectId/settings/backup`       | GitHub repo/branch, склад копії, status/retry       |

OAuth consent route має визначити backend authorization flow; не вигадуємо робочий URL наперед. Експорт і upload progress можуть бути панелями, окрема сторінка для кожного job не потрібна.

Це **цільові маршрути**. У каркасі доступні `/projects`, `/preview/workspace`, `/preview/review`, auth placeholders і 404. Preview routes відкриті, містять лише статичні зразки; цільові приватні routes ще не зареєстровані.

## 2. Робочий простір

```text
Проєкти / Назва проєкту               Save status   [Зберегти] [Скомпілювати]
Файли / Структура | Вкладки файлів і Typst editor | PDF, ревізія, стан
                 |                               | page / zoom / download
                 | Діагностика з переходом        |
Контекст · Матеріали · Анотації · Пропозиції · Історія
```

Desktop: дерево, editor, PDF; користувач змінює ширину/ховає панелі. Нижня діагностична панель не перекриває текст. Контекстні матеріали відокремлені від дерева компіляції, щоб upload джерела інформації не виглядав як додавання ресурсу до PDF.

На середньому екрані — дерево й одна активна панель source/PDF; на телефоні — одна панель з перемиканням. Команди save/compile та попередження про незбережені зміни залишаються доступними. Full desktop tooling на телефоні не є умовою першого інкременту, але читання, review і базове редагування мають бути можливі.

Вибір файла прив’язаний до сталого fileId. Rename змінює шлях, не створює нову логічну вкладку. Історична версія й candidate відкриваються read-only з явною назвою режиму.

## 3. Review

Заголовок: мета, автор/клієнт, base revision, candidate version і validation status. Ліворуч список **усіх** операцій: текст, binary metadata, rename/delete, context/materials/annotations. У центрі diff, праворуч або вкладкою candidate PDF/diagnostics. Кнопки рішення поруч із результатом перевірки.

Після зміни candidate попередній перегляд і підтвердження втрачають чинність. Stale показує зміну бази та дію повторної перевірки; автоматичного merge немає. Для compile failure окремий діалог із фактичними помилками та непозначеним acknowledgement.

## 4. Загальні стани

Кожний data screen має loading, empty, error/retry, denied/not-found та ready. Empty проєктів після успішного GET відрізняється від помилки завантаження. Поки інтеграції немає, каркас показує окреме пояснення, а не нуль нібито реальних проєктів.

Помилка містить коротку дію та, де є, requestId для копіювання. Toast підходить для допоміжного успіху; конфлікт, втрата доступу, compile error та незбережений текст потребують постійного видимого стану.
