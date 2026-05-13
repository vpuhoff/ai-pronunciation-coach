# Implementation plan: Session Results — устранение избыточных пустот на desktop

## Metadata

| Field | Value |
|-------|-------|
| Spec link | `docs/ai/specs/002-session-results-desktop-whitespace.md` |
| Bug link | `docs/ai/bugs/001-session-results-excessive-whitespace-wide-viewport.md` |
| Base feature | `docs/ai/specs/001-session-results-responsive-dynamics.md`, план `docs/ai/plans/001-session-results-responsive-dynamics.md` |
| Plan author | AI Architect |
| Created | 2026-05-13 |
| Status | Approved |

## Preconditions

- Ветка с актуальными изменениями `001` в `components/ResultScreen.tsx`.
- Не менять контракт `types.ts`, `WaveformVisualizer` API (кроме классов обёртки при необходимости), сервисы Gemini.
- Tailwind через CDN в проекте — использовать только существующие утилиты / arbitrary values без новых зависимостей.

## Root cause (для Coder)

1. На `lg:` grid с `lg:grid-rows-3` и **дефолтным** `align-items: stretch` — короткая ячейка в строке растягивается по высоте; карточка внутри `<section>` не на `h-full` → **пустая зона** под карточкой.
2. **`lg:gap-12`** увеличивает визуальный разрыв между колонками и строками.
3. **`flex-[2]`** на Next при `flex-1` у соседей даёт ~50% ширины панели на `max-w-6xl`.

## Решение (обязательное направление)

- **Шаг 1:** на контейнере основной сетки секций (тот же `div` с `lg:grid-cols-2 lg:grid-rows-3`) добавить **`lg:items-start`**, чтобы на desktop ячейки **не растягивались** по высоте строки. Проверить, что ни одна секция не полагалась на stretch для корректной высоты (ожидается: нет).
- **Шаг 2:** уменьшить или разделить gap на `lg:` (например **`lg:gap-x-8 lg:gap-y-8`** или единый **`lg:gap-8`** вместо `lg:gap-12`) — подобрать один вариант, не дробить без необходимости на `gap-x`/`gap-y`, если одного значения достаточно.
- **Шаг 3:** нижняя панель — заменить **`flex-[2]`** на схему без доминирования половиной ширины: например все три кнопки **`flex-1 min-w-0`** + у Next **`font-bold` / визуальный primary** уже есть; **или** `flex-1` у Retry/Custom и у Next с **`max-w-md`** / **`lg:max-w-xs`** на кнопке Next (уточнить визуально). Зафиксировать выбранный вариант одним комментарием в коде (ссылка на этот план / spec).

## Implementation steps

Complete in order. **Coder:** after each step, set `[x]` and add one status line (e.g. `Done — commit …`).

- [x] **Step 1 — `lg:items-start` на grid секций** — В `components/ResultScreen.tsx` на обёртке с `lg:grid-cols-2 lg:grid-rows-3` добавить `lg:items-start`. Убедиться, что на `max-lg` / одноколоночном режиме поведение не меняется (класс только `lg:`). Smoke: длинный feedback + короткий score — нет «поля» под score в той же строке.  
  Done — no commit (local only).
- [x] **Step 2 — Смягчить `lg:gap-*`** — Заменить `lg:gap-12` на согласованное меньшее значение (см. раздел «Решение»). Проверить двухколоночный ритм и отсутствие горизонтального скролла.  
  Done — no commit (local only); `lg:gap-8` на grid секций (`ResultScreen.tsx`).
- [x] **Step 3 — Пропорции нижней панели** — Скорректировать flex-классы у Retry / Custom / Next; сохранить hover/active/disabled и `isActionBarBlocked`. Проверка на ширине окна ~1280px и ~1920px (контент по-прежнему `max-w-6xl`).  
  Done — no commit (local only); три кнопки `flex-1 min-w-0`, комментарий plan 002 в `ResultScreen.tsx`.
- [x] **Step 4 (опционально)** — Если Product подтвердит: **`xl:max-w-7xl`** (или `2xl:`) на корневом скролл-контейнере Result **и** на внутреннем ряду панели (`max-w-6xl` → те же брейкпоинты), чтобы боковые поля на ультрашироких мониторах уменьшились. **Не делать** без отметки в spec «Open questions» / явного согласования — иначе пропустить шаг с пометкой `Skipped — Product`.  
  Done — no commit (local only); `max-w-6xl xl:max-w-7xl` на корне и на ряду панели; согласовано запросом «шаг 3 и 4» в сессии.

## Testing plan

- [ ] **Desktop `lg:` (~1024–1440px):** визуально нет больших пустых полос под Score / Audio при высоком Feedback или Deep Analysis.
- [ ] **С `detailedScore` и без:** корректное размещение Word Analysis (`wordsLgPlacement`) без налезания и без горизонтального скролла.
- [ ] **Mobile `max-md`:** порядок секций, fixed-панель, нижний padding — без изменений.
- [ ] **Модалки Custom / Ask Coach:** панель inert, z-index — без регрессии.
- [ ] **`npm run build`** проходит.

## Rollout / cleanup

- [x] Обновить статус бага `docs/ai/bugs/001-session-results-excessive-whitespace-wide-viewport.md` после merge (вне scope Coder в том же PR — по процессу команды).  
  Done — 2026-05-13: статус **Решён**, критерии закрытия отмечены, раздел «Решение».
- [ ] Без новых `console.log`.

## Notes for Reviewer

- Проверить, что **`lg:items-start`** не ломает выравнивание, если позже добавят `h-full` на карточки для другой цели (дублирование паттернов).
- Не путать с **`items-stretch`** на flex внутри карточек — scope только внешний grid секций.
