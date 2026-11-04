# Архитектура

Сайт АГРОВОЛЬТАЖ: статический Eleventy 3 + PHP-обработчик заявок. Решения и причины — `adr/`, термины — `../CONTEXT.md`.

## Поток данных

Сайт:

```
src/content/*.md|json, src/_data/*.json
  → scripts/validate-content.mjs (схемы из schemas/, ошибки по-русски: «<файл>: поле <поле> — <что не так>»)
  → Eleventy (eleventy.config.js, lib/, src/*.njk, src/_includes/)
  → dist/
```

- `scripts/build.mjs` запускает валидатор до рендера. При ошибке данных `dist/` не создаётся и не меняется.
- Корень сайта = `dist/`. Туда попадают `public/` (включая `api/`), страницы, `assets/`, `admin/`, `sitemap.xml`, `robots.txt`, `llms.txt`, `.htaccess`.
- `backend/`, `storage/`, `.env` лежат рядом с `dist/`, не внутри. PHP находит их как `__DIR__ . '/../../backend'`: и `public/api/`, и `dist/api/` на два уровня ниже корня проекта.
- Клиентский JS: esbuild минифицирует каждый файл из `src/assets/js/` отдельно. `cart`, `forms`, `consent` подключаются на всех страницах, остальные — через поле страницы `scripts: ["catalog-search"]`.
- Каталог для поиска и проверки корзины — `/katalog/index.json`, генерируется сборкой.

Заявка:

```
форма [data-lead-form] (forms.js)
  → GET /api/token.php (токен в сессии PHP)
  → POST /api/lead.php (JSON, заголовок X-CSRF-Token)
  → проверка (LeadValidator, RateLimiter, ловушка website, startedAt)
  → запись в storage/leads.jsonl (Journal)
  → каналы MailChannel, MaxChannel (интерфейс Channel)
  → статус доставки sent|failed|skipped в журнале
```

- Ответы `/api/lead.php`: 200 `{ok,id:"AGV-YYYYMMDD-NNNN"}`, 422 с `errors` по полям, 429, 403 (токен), 400, 405, 500.
- Спам получает 200 с фиктивным id, в журнал не пишется.
- Канал без настроек пропускается с записью в `storage/app.log`.
- Журнал хранит записи `kind:"lead"` и `kind:"delivery"`. `php backend/console.php resend` переотправляет недоставленные (`failed`). `skipped` не трогает.
- Клиент после успеха шлёт событие `agv:lead-sent {type,id}`. Корзина очищается только при `type==="order"`.

## Дизайн-система B и рентген трактора

- Весь вид — один файл `src/assets/css/main.css`: токены в `:root`, затем компоненты (`.btn`, `.section`, `.service-row`, `.steps`, `.faq`, `.plane`, `.grid-products`, `.photo-band` и др.), в конце блок `/* pages */` для правок внутренних страниц. Описание и принципы — `../docs/design-brief.md`, эталон — `../docs/mockups/*-b-xray.png`. Шрифты Unbounded и Golos Text отдаются из `src/assets/fonts/`.
- Иконки — макрос `partials/icon.njk`, без внешних наборов и фреймворков.
- Рентген трактора на главной собран из четырёх частей: симптомы (`symptoms` в `src/content/pages/home.md`), координаты узлов и точек неисправности (`src/index.11tydata.js`, в Sveltia их нет), картинки систем (`src/assets/images/xray/`), поведение (`src/assets/js/xray.js`, `initXray(win)`). Разметка — `src/index.njk`.
- Без JS симптомы остаются ссылками на услуги. `xray.js` превращает их в кнопки с `aria-pressed`, меняет активную картинку, двигает точку и обновляет карточку (подсказка, услуга, цена, кнопка заявки). Смена картинок — CSS, 300 мс, без анимации при `prefers-reduced-motion`.
- Граница «края только на своих страницах»: названия Ставропольского и Краснодарского краёв (из `settings.regions`) видны только на `/regiony/` и страницах краёв, `/kontakty/`, `/dostavka/`. На остальных страницах их нет ни в тексте, ни в title. В JSON-LD (`areaServed`) края остаются. Проверка — `tests/pages.test.mjs`.
- Тексты и SEO страниц проверяет `tests/seo-headings.test.mjs` по всему `dist/` кроме `admin/`: один H1, заголовки без пропусков, уникальные title (50–70) и description (120–160).

## Границы модулей

| Модуль | Владеет | Не делает |
|---|---|---|
| `src/content/`, `src/_data/`, `schemas/` | Данные и их формат | Вёрстку, логику |
| `src/admin/` | Sveltia: коллекции и поля в точности по схемам, медиатека `src/assets/uploads/` (публичный путь `/assets/uploads/`) | Хранение данных вне git |
| `eleventy.config.js`, `lib/`, `src/_includes/`, `src/*.njk` | Коллекции, фильтры, шаблоны, SEO, JSON-LD | Валидацию данных |
| `src/assets/js/` | Корзина, формы, согласие и Метрика, поиск | Серверную логику |
| `public/api/` → `backend/src/` | Приём заявок, журнал, каналы | Рендер страниц |
| `dist/` | Только результат сборки | Ручные правки |

## Соглашения

- Язык интерфейса и контента — русский. Имена в коде, файлах, полях данных — английские. URL-слаги — транслит латиницей.
- Контент — единственный источник правды. Тестовые записи помечены `demo: true`. Неизвестные факты о компании — видимые заглушки `[АДРЕС — впиши]`.
- Коллекции Eleventy (`lib/content.js`): `services`, `categories`, `products`, `articles`, `regions`, `pages`. Элемент: `{slug,url,inputPath,date,data,body,content}`. `CONTENT_DIR` подменяет `src/content` (тесты).
- Страница — `src/<путь>.njk` с `layout: layouts/base.njk`. Поля: `seo{title,description,canonical,ogImage,noindex}`, `breadcrumbs[{name,url}]`, `jsonld[]`, `scripts[]`, `lastmod`, `sitemapImages[]`, `sitemap:false`. Вычисляемые поля — в `.11tydata.js` или `eleventyComputed`.
- JSON-LD строят только данные и `lib/seo.js` (функции и одноимённые фильтры; `jsonld` выводит `<script>`).
- Адреса страниц — в `lib/urls.js`. Меню и подвал ссылаются только на существующие страницы (фильтр `pageExists`).
- Картинки — только шорткод `{% image src, alt, sizes, eager %}` (`<picture>` с AVIF и WebP).
- Форма — партиал `partials/lead-form.njk` (`{% set leadForm = {...} %}` + include). Типы: `callback|service|order`. Модальное окно `#zayavka` открывается ссылкой `a[href="#zayavka"][data-lead-open]` и без JS работает через `:target`.
- Корзина: localStorage `agv.cart.v1`, формат `{items:[{slug,title,price,qty}], updatedAt}`. Согласие: `agv.consent.v1`. Цель Метрики — `window.agvGoal(name)`, без Метрики ничего не делает.
- Без JS-фреймворков и CSS-фреймворков. Клиентский JS — ES-модули.
- Логотипы и символика John Deere и других брендов на картинках запрещены. Название марки в тексте допустимо.
- Секреты — только в `.env`. В `.env.example` имена с пустыми значениями.
- Индексация закрыта по умолчанию (`INDEXABLE=true` и `SITE_URL=https://…`, см. ADR 0005).
- Тестовые швы: валидатор против схем; `dist/` после сборки (`tests/build.test.mjs`); `cart.js` в jsdom; HTTP-контракт `/api/*.php` через `php -S` в режиме «только журнал» (`tests/api.test.mjs`). Переменные тестов: `AGV_ENV_FILE`, `AGV_STORAGE_DIR`.
- Node ≥ 22, PHP ≥ 8.2.
