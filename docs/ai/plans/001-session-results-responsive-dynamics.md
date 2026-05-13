# Implementation plan: Session Results — адаптивность и микро-взаимодействия

## Metadata

| Field | Value |
|-------|-------|
| Spec link | `docs/ai/specs/001-session-results-responsive-dynamics.md` |
| Plan author | AI Architect |
| Created | 2026-05-12 |
| Updated | 2026-05-12 |
| Status | **Draft** — план доведён до исполнимого вида для Coder; перевод в **Approved** после review / закрытия пунктов **Architect → Product** (если продукт вносит правки в ТЗ). |

## Preconditions

- Ветка с актуальным `main` / рабочая ветка фичи; **без новых env vars** и без секретов в репозитории.
- **Pitch Contour** остаётся на **Recharts** в `components/WaveformVisualizer.tsx`; контракт `App.tsx`, `AnalysisResult` / `WordAnalysis` в `types.ts` и логику Gemini **не менять** ради UI.

## Фактическое состояние кода (baseline для диффа)

| Область | Файл | Сейчас | Риск относительно ТЗ |
|--------|------|--------|----------------------|
| Колонки + порядок | `components/ResultScreen.tsx` | При `grid-cols-1` в DOM: **левая** ветка (Score → Reference/My Recording → **Pitch Contour**), затем **правая** (AI Feedback → Deep Analysis → **Word Analysis**) | На mobile визуальный порядок **не** совпадает с acceptance (Word Analysis и Deep Analysis должны быть **выше** Pitch Contour) |
| Нижняя панель | `components/ResultScreen.tsx` | `fixed` на **всех** ширинах; внутренний ряд кнопок `max-w-4xl`, основной контент `max-w-6xl` | ТЗ: sticky только mobile; ширина панели должна быть **согласована** с контентом |
| Deep Analysis bars | `components/ResultScreen.tsx` (`MetricBar`) | Заполнение через **`width` + `transition-all` (1000ms)** | ТЗ: **0.5–0.8s**, `ease-out`, без «тяжёлых» анимаций ширины — нужен **scaleX** (или эквивалент) |
| Word Analysis | `components/ResultScreen.tsx` | У **всех** слов `cursor-pointer`, клик → **`playAudio('user')`** целиком | ТЗ: tooltip + a11y для **warning/error**; конфликт с «клик = play» |
| Модалки | `components/ResultScreen.tsx` | Оверлей модалок `z-50`, панель `z-40` — визуально ок; панель **не** скрывается при модалке | Тапы/фокус могут уходить на панель под оверлеем |
| Pitch | `components/WaveformVisualizer.tsx` | `ResponsiveContainer` + `AreaChart` | Нужна явная политика IO / смена `result` / reduced motion |

## Решения по верстке и a11y (обязательные для реализации)

### A. Mobile: порядок блоков и один DOM без дублирования

- **Брейкпоинт mobile:** **`max-md`** в терминах Tailwind v3 = **`max-width: 767px`**, что совпадает с ТЗ **≤767px**. Использовать **`max-md:`** для правил одной колонки и reorder; с **`md:`** (≥768) — планшет/десктоп правила ниже.
- **Стратегия контейнера:** один внешний **CSS Grid** (или flex + grid на подуровне) в `ResultScreen.tsx`, **без дублирования** разметки секций. Секции оформить как **отдельные обёртки** (6 блоков: Score, Audio pair, AI Feedback, Word Analysis, Deep Analysis, Pitch Contour), каждая — **один** узел в дереве.
- **Порядок DOM (зафиксировано):** дочерние секции расположить в DOM в порядке **mobile acceptance** — строго:  
  **1 Score → 2 Reference/My Recording → 3 AI Coach Feedback → 4 Word Analysis → 5 Deep Analysis → 6 Pitch Contour.**  
  На **`lg:` (≥1024px)** задать **`grid-template-areas`** и/или **`grid-column` / `grid-row`**, чтобы визуально получить текущую **двухколоночную** схему: **левая** колонка = (1, 2, 6), **правая** = (3, 5, 4) — т.е. Score, Audio, Pitch слева; Feedback, Deep, Words справа (как в текущем UI по смыслу).
- **Табуляция vs визуал на desktop:** при DOM = mobile-линейному порядку **последовательность фокуса по Tab** совпадает с **порядком DOM** (т.е. линейно как на mobile: после Audio фокус перейдёт на Feedback в правой колонке, **до** Pitch слева). Это **осознанный компромисс**: один DOM, без `flex order` для перестановки фокусируемых регионов, без дублирования. Если продукт потребует **строго колоночный** Tab на desktop (вся левая колонка, затем правая) — это **вынесено в Architect → Product** (возможны усложнения: только если согласовано).

### B. Ширина нижней панели действий

- Выровнять панель с основным контентом: **тот же горизонтальный предел**, что и у скролл-области результатов — **`max-w-6xl mx-auto w-full`** и **те же боковые отступы** (`px-6` или актуальные классы родителя). **Удалить** внутренний **`max-w-4xl`** у ряда кнопок, чтобы не было «узкой» панели на широком экране (расхождение с ТЗ и с основным гридом).

### C. Нижняя панель: только mobile `fixed`

- При **`max-md`**: панель **`fixed bottom-0 inset-x-0`** (как сейчас по смыслу), с градиентом/фоном по необходимости.
- При **`md:` и выше**: панель **в потоке документа** внизу основного контента (после грида секций), **не** `fixed` — не перекрывает вьюпорт на планшете/десктопе.

### D. Слово «perfect» vs проблемные слова

- Решение для Coder (**без противоречия с acceptance**):  
  - **`warning` / `error`:** элемент **`button type="button"`** (или эквивалент с ролью кнопки), **`cursor-pointer`**, **`focus-visible`** кольцо; **основное действие по клику/tap** — **открыть/закрыть tooltip** (не воспроизведение всей записи). Hover/focus показывают tooltip по политике: desktop — hover + focus; touch — tap toggle, tap outside закрывает.  
  - **`perfect`:** **не** интерактив для tooltip — рендер как **`<span>`** (или `role="presentation"`), **`cursor-default`**, **вне порядка табуляции** (не `tabIndex={0}`). **Снять** воспроизведение по клику на слове для perfect (сейчас оно есть через общий обработчик — убрать).  
  - **Воспроизведение целиком:** только кнопки **Reference / My Recording** (регрессия из ТЗ сохраняется).  
- **Шаг 12 (опционально):** если позже добавляется сегмент по `start`/`end`, **клик по проблемному слову** может открывать tooltip и **опционально** содержать вторичное действие «Play clip» **только при наличии обоих таймкодов** — в базовом scope шага 10 **не** требовать.

---

## Implementation steps

Complete in order. **Coder:** after each step, set `[x]` and add one status line (e.g. `Done — commit …`).

- [x] **Step 1 — Рефактор секций и DOM-порядок = mobile** — В `components/ResultScreen.tsx` выделить шесть секций-обёрток в порядке DOM: **Score → Reference/My Recording → AI Feedback → Word Analysis → Deep Analysis → Pitch Contour** (перенести блок Pitch из «левой» колонки вниз по DOM, не дублируя контент). На **`lg:`** включить **CSS Grid** с явным размещением областей так, чтобы визуально восстановить **левую** (Score, Audio, Pitch) и **правую** (Feedback, Deep, Words) колонки. На **`max-md`:** одна колонка, **без** `order`, если визуальный порядок уже совпадает с DOM.  
  Done — no commit (локально); `npm run build` OK.

- [x] **Step 2 — Брейкпоинты, `min-w-0`, горизонтальный скролл** — Зафиксировать классы: **`max-md`** = mobile; **`lg:`** = две колонки (≥1024). На всех цепочках, ведущих к Recharts, задать **`min-w-0` / `overflow-x` по необходимости**, чтобы при **768–1023** и **≥1024** не было нежелательного горизонтального скролла страницы и не обрезался Pitch Contour.  
  Done — no commit (локально); `ResultScreen` + `WaveformVisualizer` (`min-w-0`, `ResponsiveContainer minWidth={0}`, `overflow-x` у контейнеров графика/слов).

- [x] **Step 3 — Нижняя панель: ширина + fixed только mobile** — В `components/ResultScreen.tsx`: панель действий — **`max-w-6xl mx-auto w-full`** с теми же `px-*`, что основной контент; **убрать `max-w-4xl`**. Условные классы: **`max-md:fixed max-md:bottom-0 max-md:inset-x-0`** (и существующие z-index); **`md:static md:relative`** (или эквивалент «в потоке») без `fixed`. Проверить, что на **`md+`** панель **после** основного грида в DOM, чтобы порядок чтения и скролл были предсказуемы.  
  Done — no commit (локально); `npm run build` OK.

- [x] **Step 4 — Sticky-контент: отступ снизу только на mobile** — У основного скролл-контейнера **`pb-*`** / **`scroll-padding-bottom`** достаточный для высоты **fixed**-панели **только при `max-md`**, плюс **`env(safe-area-inset-bottom)`** (через arbitrary Tailwind). На **`md+`** убрать избыточный нижний padding, если он был только под global fixed.  
  Done — no commit (локально); корень `ResultScreen`: `p-6`, `max-md:pb-[calc(8rem+env(safe-area-inset-bottom,0px))]` + тот же `scroll-pb`; `npm run build` OK.

- [x] **Step 5 — Модалки + a11y нижней панели** — При `isCustomModalOpen || isQuestionModalOpen`: нижняя панель (если остаётся в DOM) — **`pointer-events-none`**, **`aria-hidden={true}`**, **`tabIndex={-1}`** на контейнере панели **или** дочерние кнопки **`disabled`** + **`aria-hidden`** по гайду команды, чтобы панель **не участвовала в порядке фокуса** и не перехватывала клики. После закрытия модалки — восстановить интерактив. Краткий комментарий в коде с ссылкой на этот пункт плана.  
  Done — no commit (локально); `isActionBarBlocked`, контейнер + `disabled` на трёх кнопках, комментарий Step 5; `npm run build` OK.

- [x] **Step 6 — Pronunciation Score: count-up + кольцо** — Число от **0** до **`result.overallScore`** за **750–1000ms** (внутри ТЗ **0.6–1.2s**); круговая обводка **синхронно** с тем же нормализованным прогрессом (**0→1**). Реализация дуги: **`strokeDashoffset`** от полного к длине, пропорциональной score, **без** анимации **`width`** трека. При смене **`result`** (retry, запись из истории) — **сброс** анимации и повтор от 0. При **`prefers-reduced-motion`** (см. шаг 11) — мгновенный финал.  
  Done — no commit (локально); `SCORE_COUNT_UP_MS=850`, rAF + ease-out-cubic, `strokeDashoffset` без CSS transition; reduced motion / score 0 → финал; `npm run build` OK.

- [x] **Step 7 — `MetricBar`: scaleX, 0.5–0.8s, ease-out** — Вынести в подкомпонент в том же файле или `components/result/MetricBar.tsx`. Разметка: внешний трек **фиксированной ширины** (`w-full`), внутренний заполнитель **`transform: scaleX(0→1)`**, **`transform-origin: left`**, **`transition: transform 600ms cubic-bezier(...)`** с длительностью **строго в диапазоне 500–800ms** (зафиксировать одно значение, напр. **650ms**). **Удалить** анимацию **`width`** и **`transition-all`** для полосы on-load. Числовой label может обновляться синхронно с прогрессом (опционально через тот же easing). При отсутствии **`result.detailedScore`** — секция не рендерится (как сейчас); регрессий нет.  
  Done — no commit (локально); `components/result/MetricBar.tsx`, `METRIC_FILL_MS=650`, `scaleX` + label `Math.round(fill)`; `npm run build` OK.

- [x] **Step 8 — Pitch Contour (Recharts): IO, один цикл, смена result, resize** — В `components/WaveformVisualizer.tsx` (и при необходимости проп из `ResultScreen`):  
  - **Триггер анимации:** **Intersection Observer** на обёртке графика с **`rootMargin`** по необходимости; анимация считается **«одним показом»** = **не повторять** при повторном входе во viewport **в рамках одного монтирования** и **одного** `result` (флаг `hasAnimatedInView` в `useRef`).  
  - **Смена `result`:** сброс флага и **key** на `ResponsiveContainer` / корне графика от стабильного идентификатора (`result` reference или `phrase.id` + `timestamp` из родителя, если доступен) — чтобы Recharts **переанимировал** при новом анализе и при открытии **другой** записи из истории.  
  - **Повторный заход на экран RESULT:** при размонтировании/монтировании компонента флаг сбрасывается естественно — анимация может снова отработать **один раз** после появления в viewport.  
  - **Resize:** не сбрасывать флаг только из-за resize; при **смене ширины без смены данных** не спамить повторной анимацией (оставить финальный кадр).  
  - **`prefers-reduced-motion`:** передать в визуализатор **`isAnimationActive={false}`** (или эквивалент Recharts) и **не** запускать обёрточную анимацию opacity/transform.  
  - Контейнер: **`minWidth={0}`** на `ResponsiveContainer`, родитель с **`min-w-0`**.  
  Done — no commit (локально); `animationKey` из `ResultScreen` (`useMemo`), IO + `revealTick` (один раз на ключ), `key` на `ResponsiveContainer`, `Area` `isAnimationActive`, градиенты через `useId`; `npm run build` OK.

- [x] **Step 9 — Типографика `clamp()`** — Ключевые текстовые узлы экрана (заголовок «Session Results», крупная цифра score, при необходимости заголовки секций) — **`clamp()`** через arbitrary classes для **`max-lg`** или **`max-md`** согласно ТЗ планшета/ниже.
  Done — no commit (локально); `ResultScreen` + `WaveformVisualizer` (заголовок графика), `max-lg:` + `lg:` фиксированные размеры; `npm run build` OK.

- [x] **Step 10 — Word Analysis: tooltip, perfect vs problem, клавиатура** — Реализовать согласно разделу **D** выше в `components/ResultScreen.tsx`. Tooltip: контент минимум **`score`**, **`status`**, **`issue`** + fallback текста; позиционирование без выхода за край вьюпорта; **Escape** закрывает tooltip при фокусе на кнопке слова. Не ломать модалки (z-index tooltip ниже модалки или портал с уровнем слоя по решению Coder, зафиксировать в комментарии).
  Done — no commit (локально); портал `createPortal` + `fixed` + `z-index: 30`, hover/focus/tap, `pointerdown` вне якоря; perfect — `span` без play; `npm run build` OK.

- [x] **Step 11 — `prefers-reduced-motion: reduce`** — Один источник правды (хук или `matchMedia` в `ResultScreen`): при reduce — **отключить** count-up score (показать финал), **отключить** transform-анимацию `MetricBar` (показать целевые значения сразу), **отключить** Recharts animation + обёртку Pitch. Убедиться в согласованности с шагами 6–8.
  Done — no commit (локально); `readPrefersReducedMotion` + `matchMedia` в `ResultScreen`, проп `reduceMotion` в `MetricBar` / `WaveformVisualizer`; `npm run build` OK.

- [ ] **Step 12 (опционально) — Сегмент записи по `start`/`end`** — Выполнять **только** если явно включено в sprint. **Готовность / критерии:**  
  - Оба **`start`** и **`end`** заданы, **`0 ≤ start < end`**, **`end`** не длительнее длительности **`userAudioUrl`** (если длительность недоступна — ограничить **`end`** разумным максимумом после `loadedmetadata`).  
  - **Нет** отдельной кнопки/иконки «play word» в UI, если таймкодов нет.  
  - **iOS / autoplay:** воспроизведение только по **явному жесту** пользователя (клик по контролу в tooltip); не вызывать `play()` без жеста — зафиксировать как **риск**, без обязательного полифилла.  
  - Не расширять контракт Gemini в этом шаге.

- [x] **Step 13 — Hover / active кнопок** — Reference, My Recording, Retry, Custom, Next и связанные: hover **`scale(1.02)`** и/или лёгкий **glow**; **active** — короткое изменение масштаба/яркости. Не ломать `disabled` для аудио без URL.
  Done — no commit (локально); `ResultScreen.tsx` — `enabled:hover:*` для аудио без URL, `motion-reduce:*`, нижняя панель / History / feedback / модалки; `npm run build` OK.

## Testing plan

- [ ] **Mobile (`≤767px`):** визуальный порядок строго **Score → Reference/My Recording → AI Feedback → Word Analysis → Deep Analysis → Pitch Contour**; сделать скриншотную проверку или чеклист по DOM в DevTools.
- [ ] **Tab order:** с клавиатуры пройти секции на **`max-md`** — порядок совпадает с визуальным (DOM mobile). На **`lg+`** задокументировать фактический порядок (компромисс из шага 1); нет «ловушек» фокуса вне модалок.
- [ ] **`md`–`1023`:** нет обрезания Pitch; `clamp()` заметен на ключевых заголовках/цифрах.
- [ ] **`≥1024`:** две колонки; нет лишнего горизонтального скролла; панель **в потоке**, не fixed.
- [ ] **Нижняя панель:** ширина **`max-w-6xl`**, нет **`max-w-4xl`** у внутреннего flex; на mobile fixed + достаточный нижний padding контента + safe-area smoke test (эмулятор по возможности).
- [ ] **Модалки:** при открытии Custom / Ask Coach панель **не** фокусируется и **не** кликается; фокус в поле ввода модалки; закрытие по кнопке и логике проекта; после закрытия панель снова доступна.
- [ ] **Анимации:** новый результат и открытие из **History** — score и полосы не залипают на 0; длительность полос **в 500–800ms**; Pitch **не** re-triggers при каждом микродвижении скролла.
- [ ] **`prefers-reduced-motion`:** все декоративные анимации отключены/мгновенный финал.
- [ ] **Граничные данные:** `detailedScore === undefined` — экран без падений; пустые или **очень короткие** `pitchCurveReference` / `pitchCurveUser` — график без ошибок (Recharts, пустой state по UX команды).
- [ ] **Регрессия:** Reference / My Recording, Retry, Next, Custom, AI Q&A, восстановление Original feedback.

## Rollout / cleanup

- [ ] README — только если менялись пользовательские инструкции (обычно нет).
- [ ] Удалить отладочные `console.log`.
- [ ] Сверка с **Acceptance criteria** в `docs/ai/specs/001-session-results-responsive-dynamics.md`.

## Notes for Reviewer

- **DOM order vs visual order:** на **`lg`** визуал двухколоночный за счёт **grid placement**; DOM остаётся **mobile-first** — Tab на desktop **не** следует строго геометрии «левая колонка целиком, затем правая» (см. шаг 1 и Architect → Product).
- **Производительность:** не держать `will-change` постоянно; не пересоздавать график без смены данных; mid-range Android.
- **Bundle:** только Recharts для Pitch; второй стек не добавлять.
- **Виртуальная клавиатура (mobile):** корректировка layout при появлении клавиатуры **не входит** в обязательный scope этого плана (риск остаётся); достаточно safe-area + нижний padding под fixed-панель. Если продукт требует — отдельная задача.
- **Модалки и фокус:** проверить отсутствие «протечек» фокуса на панель под оверлеем (шаг 5).

## Architect → Product (согласование ТЗ / приоритетов; спеку меняет Product, не этот план)

1. **Tab order на desktop (≥1024):** при DOM = mobile-порядку Tab проходит линейно по DOM, а не «левая колонка сверху вниз, затем правая». Нужно ли требование **строго колоночного** Tab и чтение слева направо по колонкам? Если да — потребуется доработка ТЗ и отдельный техдизайн (возможен другой паттерн разметки).
2. **Шаг 12:** подтвердить, остаётся ли **вне** первого релиза всегда, или допускается в тот же спринт при наличии данных `start`/`end`.
3. **Tooltip на проблемном слове:** ок ли **только** кнопки Reference/My Recording для полного воспроизведения (слова не запускают запись целиком) — против текущего поведения «клик по любому слову = play».
