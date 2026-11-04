<!-- autopilot:start -->
# АГРОВОЛЬТАЖ

Сайт сервиса по диагностике и ремонту электрики, электрооборудования и кондиционеров сельхозтехники (в основном John Deere): услуги, каталог с корзиной, статьи, контент редактируется через Sveltia CMS.

## Команды

| Команда | Что делает |
|---------|------------|
| `npm ci` | Ставит зависимости по lock-файлу. |
| `npm run build` | Проверяет контент, чистит `dist/`, собирает сайт. |
| `npm run validate` | Проверяет контент против `schemas/`. |
| `npm test` | Сначала `npm run build`, затем все тесты (`node --test "tests/*.test.mjs"`). |
| `node --test tests/<файл>.test.mjs` | Один тестовый файл (нужен собранный `dist/`). |
| `DEV_PORT=8091 npm run dev` | Сайт на http://localhost:8091/ (по умолчанию порт 8080), PHP выполняет `/api/lead.php`. |
| `php backend/console.php resend` | Переотправляет заявки, не доставленные в каналы. |
| `php -l <файл>` | Проверка синтаксиса PHP. |

Архитектура: `docs/architecture.md`. Решения и их причины: `docs/adr/`. Словарь проекта: `CONTEXT.md`.

## Где что

- `src/content/` — весь контент (Markdown + YAML, JSON), единственный источник правды; схемы в `schemas/`.
- `src/_data/settings.json`, `src/_data/models.json` — данные компании и модели техники.
- `src/*.njk`, `src/_includes/` — страницы и шаблоны (`layouts/base.njk`, `partials/lead-form.njk`).
- `eleventy.config.js`, `lib/` — коллекции, фильтры, шорткод `{% image %}`, JSON-LD (`lib/seo.js`), адреса (`lib/urls.js`).
- `src/assets/css/main.css` — вся дизайн-система B: токены в `:root` (`--bg`, `--ink`, `--brand`, `--live`, `--frost`, `--fault`, `--step-*`, `--r-*`) и компоненты. Правки внутренних страниц — только в конец файла под `/* pages */`. Описание — `docs/design-brief.md`, эталон вида — `docs/mockups/home-desktop-b-xray.png` и `home-mobile-b-xray.png`. Шрифты Unbounded и Golos Text — `src/assets/fonts/*.woff2`.
- «Рентген трактора» на главной: логика — `src/assets/js/xray.js`, картинки — `src/assets/images/xray/` (`tractor-xray-base.png` и по одной на систему), координаты узлов и точек — `src/index.11tydata.js`, разметка — `src/index.njk`, симптомы — поле `symptoms` в `src/content/pages/home.md`.
- Иконки — `{% from "partials/icon.njk" import icon %}{{ icon("phone") }}`, набор в `src/_includes/partials/icon.njk`.
- `src/assets/js/` — клиентский JS: `cart.js`, `forms.js`, `consent.js`, `catalog-search.js`, `xray.js`.
- `public/api/` — точки входа PHP, логика в `backend/src/`; журнал и лог — `storage/`.
- `src/admin/` — Sveltia CMS (`config.yml` повторяет поля из `schemas/`).
- `tests/` — тесты, `tests/helpers/` — сборка на фикстурах. SEO-правила — `tests/seo-headings.test.mjs`: на каждой странице один H1, заголовки без пропусков уровней, title уникален, 50–70 символов вместе с суффиксом (`settings.seo.titleSuffix`) и не повторяет H1, description уникален, 120–160. Рентген — `tests/xray.test.mjs`.

## Подводные камни

- `npm test` и `npm run dev` пишут в один `dist/`. Одновременный запуск роняет dev (sharp: «unable to open for write»).
- Асинхронный шорткод `{% image %}` внутри обычного `{% for %}` через include теряет вывод. Нужен `asyncEach`. Это касается `src/katalog/_product-card.html`: подключать только внутри `asyncEach`, как в `src/index.njk` и `src/katalog/*.njk`.
- Названия краёв видны только на `/regiony/` (и страницах краёв), `/kontakty/`, `/dostavka/`. На остальных страницах (текст и title) их быть не должно, иначе упадёт тест в `tests/pages.test.mjs`. В JSON-LD (`areaServed`) края остаются.
- Жёлтого цвета и логотипов John Deere в дизайне нет. `--fault` — только неисправность и ошибки форм, `--frost` — только климат.
- Картинки рентгена имеют почти белый фон, на `--bg` их кладут через `mix-blend-mode: multiply`. Не перерисовывать без решения.
- Заголовки, title и description на новых страницах проверяет `tests/seo-headings.test.mjs`: новая страница с неверной длиной или вторым H1 роняет `npm test`.
- `@fontsource/manrope` остался в `package.json`, но шрифт не используется (тест `tests/build.test.mjs` даже требует, чтобы Manrope не было в CSS и HTML). Зависимость не удалена, решение за владельцем.
- В Nunjucks нет теста `equalto` для `selectattr` с путём через точку.
- Node 24 не принимает папку в `node --test`. Нужен glob `"tests/*.test.mjs"`.
- В локальном PHP нет openssl, curl и mbstring. SMTP по TLS и HTTPS к MAX локально не работают.
- Sveltia грузится с unpkg: без сети админка не откроется. Локальный режим работает только в Chrome или Edge.
- Индексация закрыта, пока не заданы `INDEXABLE=true` и `SITE_URL=https://…`.
- Заявки, принятые без настроенных каналов (статус `skipped`), `resend` не переотправляет.
- Новые зависимости не добавлять без решения: тесты и сборка рассчитаны на текущий набор.

## Окружение

Шаблон — `.env.example`, рабочий `.env` в корне не коммитится. Значения не записывать сюда.

- `SITE_URL` — адрес сайта для canonical, sitemap, JSON-LD (по умолчанию `http://localhost:8080`).
- `INDEXABLE` — `true` открывает индексацию, только вместе с `SITE_URL` на `https://`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` — SMTP для писем с заявками.
- `MAIL_FROM`, `MAIL_TO` — отправитель и получатель писем.
- `MAX_BOT_TOKEN`, `MAX_CHAT_ID` — бот и чат мессенджера MAX.
- `MAX_API_URL` — адрес Bot API MAX (пусто — `https://platform-api2.max.ru`).

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять
только пользователь. Прерванную сборку продолжает «продолжи автопилот».

### Правка без автопилота

Мелкий баг или доводка после сборки — обычная сессия, без прогона.

Сначала прочитай:
1. `.autopilot/PROGRESS.md` — что не доделано, известные баги, о чём договорились с пользователем.
2. Что правили после последней сборки — первая строка таблицы в «История git».
3. Только если правка их касается: почему сделано так — `docs/adr/`; что значат слова — `CONTEXT.md`;
   что именно просили — `manifest.md` в папке сборки (указана в начале `PROGRESS.md`).

После правки:
- коммит — по правилам из «История git»;
- строка в «Правки без автопилота» в `PROGRESS.md`: дата — что — почему;
- починенный пункт из «Не доделано» или «Известные баги» — удали;
- договорились с пользователем о том, что следующая сборка не должна пересматривать, —
  строка в «Договорились», его словами.

### История git

Целиком не читай — бери срез под вопрос:

| Вопрос | Команда |
|---|---|
| что правили после последней сборки | `git log --oneline "$(git log -1 --format=%h --grep='^Autopilot: сборка сдана')"..HEAD -- . ':(exclude).autopilot'` |
| всё, что делали ради требования | `git log --oneline --grep="R02"` |
| история файла | `git log --oneline -10 -- <файл>` |
| когда появился или исчез код | `git log --oneline -S "<фрагмент>"` |
| почему строка такая | `git blame -L <с>,<по> <файл>`, затем `git show <sha>` |
| что внутри коммита | `git show --stat <sha>` |

Срез длиннее ~30 коммитов — отдай его субагенту и возьми выжимку в десять строк.

Коммит: заголовок — что (`fix: даты в одном формате`), тело — почему, трейлер
`--trailer "Requirements: R02"`, если правка касается требования из `manifest.md`.
Заголовок `Autopilot: сборка сдана` пишет только автопилот — по нему находят последнюю сборку.
<!-- autopilot:end -->
