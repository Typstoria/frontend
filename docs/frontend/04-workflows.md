# Основні робочі процеси

Статус: цільова поведінка v0.1. У поточному каркасі ці бізнес-сценарії ще не реалізовані.

## 1. Відкриття і редагування

GET state фіксує `currentRevisionId`; дерево, вміст і контекст завантажуються з **цією** revisionId. Draft зберігає базові дані й локальні edits окремо. LSP отримує незбережений текст із documentVersion, але не створює прийняту ревізію.

Початкове рішення — явне збереження кнопкою або Ctrl/Cmd+S, без автоматичного створення ревізій за кожним введенням. Debounce language diagnostics не дорівнює autosave. При виході з dirty workspace — route warning; при закритті вкладки — `beforeunload`, лише поки є незбережені зміни.

## 2. Збереження без втрати правок

1. Зафіксувати payload усіх вибраних змін, його local generation, `baseRevisionId` та новий Idempotency-Key.
2. Надіслати один atomic batch. Під час запиту користувач може продовжувати вводити текст; паралельний save цього workspace не запускається.
3. На success оновити base revision і базовий snapshot. Позначити clean тільки тексти, які досі дорівнюють відправленим; пізніше введений текст залишається dirty.
4. При втраті відповіді результат невідомий: повторити **той самий payload із тим самим key**, або перевірити стан. Новий payload — новий key після встановлення результату попереднього.
5. На `409 REVISION_CONFLICT` зберегти base/local, завантажити remote окремо й показати порівняння. Користувач вручну обирає/об’єднує текст перед новим save. Не підставляти новий baseRevisionId у старий batch автоматично.

Стани save: `clean`, `dirty`, `saving`, `conflict`, `failed`, `outcome_unknown`. Це модель UI, не назви серверних статусів. Save failure не очищає editor undo або draft.

Для майбутнього локального recovery: IndexedDB за userId/projectId/baseRevisionId, явна позначка «локальна незбережена чернетка», без credentials. Після входу того самого користувача порівнювати базу перед відновленням; інший користувач не бачить draft. Запис може не вдатися через quota/private mode — показати стан і дозволити завантажити локальний текст. Поточний каркас нічого не зберігає у browser storage.

## 3. Compile та PDF

Натискання compile за dirty source пропонує «Зберегти й скомпілювати» або compile останньої збереженої ревізії. Компіляція не починається до success save. Якщо під час save з’явилися нові правки, результат позначається як PDF збереженої ревізії, а не поточного draft.

Серверні job states: `queued → running → succeeded | failed | timed_out | cancelled`. Infrastructure failure і `TYPST_ERROR` мають різні пояснення. Окремо показуються:

| Стан                 | Що бачить користувач                                             |
| -------------------- | ---------------------------------------------------------------- |
| Source збережено     | Save успішний, незалежно від PDF                                 |
| Compile триває       | Job конкретної ревізії, попередній PDF залишається з позначкою   |
| Compile failed       | Діагностика; source не відкочується                              |
| PDF stale            | Невідповідність compile inputs за серверним `isCurrent`          |
| Є unsaved edits      | Додаткове попередження, навіть якщо сервер каже `isCurrent=true` |
| Артефакт недоступний | `artifactAvailable=false`, дія повторної компіляції              |

Context-only revision не обов’язково робить PDF stale: відповідність залежить від inputs/fingerprint, не лише revision number. Старий job, завершений пізніше нового, не замінює вибраний актуальний PDF. Candidate PDF ніколи не видається за accepted revision PDF.

Diagnostic range — zero-based UTF-16; за `range=null` немає вигаданого переходу на рядок. Старі diagnostics видно як історичні; навігація в новий draft можлива лише після коректного mapping.

## 4. ШІ-пропозиція

Користувач відкриває proposal version, бачить увесь diff та validation, прив’язані до candidate. `draft/validating` очікують перевірки; `ready` дозволяє accept; `compile_failed` вимагає окремого попередження; `invalid` та `validation_failed` блокують accept. Context/annotation-only може мати compile `not_required`, але structural validation обов’язкова.

Accept передає base revision, expectedProposalVersion і validationId для переглянутого candidate. Acknowledgement compile error початково false; стає true лише після явної дії в діалозі та скидається після будь-якої зміни candidate/validation. Чинність усіх полів сервер перевіряє повторно.

При `stale` — пояснення, що основний проєкт змінився; rebase тільки явний, після нього нова validation. `accepted/rejected/expired` — terminal read-only. Повтор accept після timeout використовує той самий key; не створює другу ревізію. Наявний dirty manual draft перед accept треба зберегти/відкласти/скасувати дію, щоб success acceptance не стер локальний текст.

## 5. Історія та інші операції

- Restore показує цільову й поточну ревізії, обсяг відновлення та попередження щодо dirty draft. Надсилає targetRevisionId + expectedCurrentRevisionId; результат — нова ревізія, старі залишаються.
- Rename зберігає fileId; видалення entrypoint можливе лише разом із вибором нового у batch. Файли завантажуються у staging, застосовуються після підтвердженої зміни; невдалий upload не означає успішне додавання.
- Матеріал може мати `no text layer`/failed extraction при доступному оригіналі. Заміна — нова версія. Анотації мають active/resolved і окремо attached/outdated/orphaned, історичний anchor не губиться.
- Template/share/export/backup показують склад копії. Context/materials включаються явно. Share відкриває лише конкретний snapshot; копія незалежна. Import із кількома entrypoints потребує вибору, без мовчазного вгадування.
- Git pending/failed не скасовує save. GitHub remote conflict показується без pull/force push; disconnect не видаляє вже створені копії.

## 6. Reconnect і втрата доступу

SSE тільки інвалідовує loaded state. Після розриву/пропуску — GET state і reconciliation із local draft; не заміна draft новим текстом. Без SSE доступний обмежений polling активних jobs із backoff; після unmount/terminal status він зупиняється.

Приватний 401 блокує mutations, закриває streams і пропонує повторний вхід. Перед очищенням приватного серверного кешу draft утримується окремо в межах того самого акаунта. Після зміни акаунта прибираються його дані, workers і object URLs. Logout пропонує зберегти/експортувати/відкинути dirty draft до відкликання токена.
