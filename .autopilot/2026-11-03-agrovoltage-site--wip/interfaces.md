# Границы и правила проекта

Читай этот файл первым. Здесь решено, кто чем владеет: не меняй чужую границу без записи `D##`.

## Правила проекта

- Язык интерфейса и контента — русский. Имена в коде, файлах и полях данных — английские, без транслита. URL-слаги — транслит латиницей (`/uslugi/`, `/katalog/`, `/stati/`, `/dostavka/`, `/kontakty/`, `/o-kompanii/`, `/regiony/`, `/korzina/`).
- Факты о компании не выдумываем. Известны: название «АГРОВОЛЬТАЖ», телефон «+7 962 001 19 90», регионы «Ставропольский край», «Краснодарский край». Всё остальное — видимые заглушки вида `[АДРЕС — впиши]`.
- Тестовые услуги, товары и статьи имеют `demo: true`.
- Логотипы и фирменная символика John Deere и других брендов на картинках запрещены. Название марки в тексте можно использовать как описание.
- Секреты — только в `.env`. В `.env.example` перечислены имена с пустыми значениями.
- Node ≥ 22, PHP ≥ 8.2. Команды: `npm install`, `npm run dev`, `npm run build`, `npm test`.
- Без JS-фреймворков и CSS-фреймворков. Клиентский JS — ES-модули в `src/assets/js/`.

## Границы, решённые в спецификации

### 1. Данные контента — `src/content/`, `src/_data/` (владелец: тикет моделей данных и CMS)

Единственный источник правды для всего содержимого. Формат: Markdown с YAML front matter или JSON. Поля (англ.):

- `services/<slug>.md`: `title`, `slug`, `group` (одно из `diagnostics|electrics|equipment|climate|field`), `summary`, `priceFrom` (число или null → «по запросу»), `image`, `symptoms[]`, `diagnosticsSteps[]`, `works[]`, `stages[]`, `faq[{q,a}]`, `prices[{group, items[{name, price|null}]}]`, `order`, `demo`, `seo{title,description}`; тело — свободный текст.
- `categories/<slug>.json`: `title`, `slug`, `description`, `image`, `order`, `seo{}`.
- `products/<slug>.md`: `title`, `slug`, `sku`, `category` (slug категории), `price` (число или null), `inStock` (bool), `compatibility[]` (строки моделей), `images[]`, `summary`, `specs[{name,value}]`, `demo`, `seo{}`; тело — описание.
- `articles/<slug>.md`: `title`, `slug`, `date` (YYYY-MM-DD), `cover`, `excerpt`, `relatedServices[]` (slug), `demo`, `seo{}`; тело — текст.
- `regions/<slug>.md`: `title` (например «Ставропольский край»), `slug`, `lead`, `localities[]`, `faq[{q,a}]`, `seo{}`.
- `pages/<slug>.md`: `home`, `delivery`, `about`, `privacy`, `consent` — front matter со своими блоками; у `home` — `hero{title,lead,image}`, `advantages[{title,text}]`, `steps[]`, `faq[]`.
- `src/_data/settings.json`: `brand`, `phone`, `phoneHref`, `email`, `maxUrl`, `address`, `hours`, `regions[]`, `legal{operator, inn, ogrn}`, `seo{titleSuffix, defaultDescription, ogImage}`, `yandexMetrikaId`, `yandexVerification`, `consentVersion`.
- `src/_data/models.json`: `[{series, category, models[]}]`.

Схемы JSON Schema для каждой коллекции лежат в `schemas/`. `scripts/validate-content.mjs` проверяет их до рендера и падает с русским сообщением «<файл>: поле <поле> — <что не так>».

### 2. Sveltia — `src/admin/` (владелец: тикет CMS)

`index.html` и `config.yml`. Коллекции и поля в точности соответствуют §1. Медиатека: `src/assets/uploads/`, публичный путь `/assets/uploads/`.

### 3. Сборка и шаблоны — `eleventy.config.js`, `src/_includes/`, `src/*.njk` (владелец: тикеты каркаса и страниц)

- Базовый layout `layouts/base.njk` принимает `seo` (`title`, `description`, `canonical`, `ogImage`, `noindex`), `breadcrumbs[{name,url}]`, `jsonld[]`. Сам выводит `<head>`, шапку, подвал, модальное окно формы, баннер согласия.
- JSON-LD строит только `src/_data/` + фильтр `jsonld` из `lib/seo.js`. Функции: `organizationLd(settings)`, `serviceLd(service, settings)`, `productLd(product, settings)`, `breadcrumbLd(items, siteUrl)`, `faqLd(faq)`, `articleLd(article, settings)`, `itemListLd(items, siteUrl)`.
- Переменные окружения сборки: `SITE_URL` (по умолчанию `http://localhost:8080`), `INDEXABLE` (`true` включает индексацию только вместе с `SITE_URL`, начинающимся с `https://`).
- Картинки: шорткод `{% image src, alt, sizes, eager %}` → `<picture>` с AVIF и WebP.

### 4. Клиентский JS — `src/assets/js/` (владелец: тикеты корзины и форм)

- `cart.js` экспортирует `getCart()`, `addItem({slug, title, price, qty})`, `setQty(slug, qty)`, `removeItem(slug)`, `clearCart()`, `onChange(cb)`. Ключ localStorage — `agv.cart.v1`, формат `{items:[{slug,title,price,qty}], updatedAt}`.
- `forms.js` вешается на любой `<form data-lead-form="callback|service|order">`. Берёт токен из `GET /api/token.php`, отправляет `POST /api/lead.php` (JSON), показывает ошибки у полей.
- `consent.js` — баннер и загрузка Метрики; ключ `agv.consent.v1`. `window.agvGoal(name)` — безопасный вызов цели (без Метрики ничего не делает).
- Каталог для поиска и проверки корзины — `/katalog/index.json` (`[{slug,title,sku,category,price,inStock,url,image}]`), генерируется сборкой.

### 5. Обработчик заявок — `public/api/*.php` → `backend/` (владелец: тикет бэкенда)

- `GET /api/token.php` → `{"token": "..."}`, токен в сессии PHP.
- `POST /api/lead.php`, заголовок `X-CSRF-Token`, тело JSON:
  `{type: "callback"|"service"|"order", name, phone, message?, service?, page, items?: [{slug,title,price,qty}], consent: true, consentVersion, website: "" (ловушка), startedAt: <ms>}`.
  Ответы: `200 {ok:true, id:"AGV-YYYYMMDD-NNNN"}`, `422 {ok:false, errors:{field:"текст"}}`, `429 {ok:false, error:"..."}`, `403` (токен), `500 {ok:false, error:"..."}`.
- Порядок: проверка → запись в `storage/leads.jsonl` → отправка в каналы (`MailChannel`, `MaxChannel`, интерфейс `Channel::send(Lead): bool`) → отметка статуса доставки в журнале. Канал без настроек пропускается с записью в `storage/app.log`.
- `backend/console.php resend` — переотправляет записи со статусом недоставки.
- Конфигурация — `.env` в корне: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM`, `MAIL_TO`, `MAX_BOT_TOKEN`, `MAX_CHAT_ID`.
- `storage/` и `backend/` не отдаются вебом (`.htaccess` deny и вне `public/`).

### 6. Выход сборки — `dist/`

Корень сайта = `dist/`. Туда копируются `public/` (включая `api/`), собранные страницы, `assets/`, `admin/`, `sitemap.xml`, `robots.txt`, `llms.txt`, `.htaccess`. `backend/`, `storage/`, `.env` лежат рядом с `dist/`, а не внутри. PHP находит их как `__DIR__ . '/../../backend'`: и `public/api/`, и `dist/api/` лежат на два уровня ниже корня проекта. На хостинге структура та же: `dist/` — веб-корень, `backend/` и `storage/` рядом с ним.

## Тестовые швы

1. `scripts/validate-content.mjs` — данные против схем.
2. `dist/` после `npm run build` — проверки HTML, JSON-LD, sitemap, robots, бюджета (`tests/build.test.mjs`).
3. `cart.js` — юнит-тесты в jsdom (`tests/cart.test.mjs`).
4. HTTP-контракт `/api/*.php` через `php -S` в режиме «только журнал» (`tests/api.test.mjs`).

## Команды и запреты

- Проверка целиком: `npm test` (сначала собирает `dist/`, потом `node --test tests/`). Один файл: `node --test tests/<файл>.test.mjs`. PHP-синтаксис: `php -l <файл>`.
- Установка: `npm install`. Новые зависимости ставит только тикет 01. Если нужна другая зависимость, вернуть `BLOCKED`.
- Не трогать: `.autopilot/`, `AGENTS.md`, `CLAUDE.md`, `.gitignore` (кроме строк, которые явно нужны тикету: `dist/`, `storage/*` с `!storage/.gitkeep`, `vendor/`, если он ставится из lock-файла).
- Окружение: Windows 11, Git Bash, Node 24, PHP 8.3 (`php` в PATH), `python` (не `python3`).
