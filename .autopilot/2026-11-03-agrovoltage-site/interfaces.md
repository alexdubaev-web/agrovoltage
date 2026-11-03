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

- Проверка целиком: `npm test` (сначала собирает `dist/`, потом `node --test "tests/*.test.mjs"` — Node 24 не принимает папку). Один файл: `node --test tests/<файл>.test.mjs`. PHP-синтаксис: `php -l <файл>`.
- Установка: `npm install`. Новые зависимости ставит только тикет 01. Если нужна другая зависимость, вернуть `BLOCKED`.
- Не трогать: `.autopilot/`, `AGENTS.md`, `CLAUDE.md`, `.gitignore` (кроме строк, которые явно нужны тикету: `dist/`, `storage/*` с `!storage/.gitkeep`, `vendor/`, если он ставится из lock-файла).
- Окружение: Windows 11, Git Bash, Node 24, PHP 8.3 (`php` в PATH), `python` (не `python3`).

## Что построил тикет 01 (T01)

- Коллекции (`lib/content.js`, `CONTENT_DIR` подменяет `src/content`): `collections.services|categories|products|articles|regions|pages`, элемент `{slug,url,inputPath,date,data,body,content}`. Файлы контента не являются шаблонами Eleventy, `src/content` игнорируется.
- Своя страница: `src/<путь>.njk` с `layout: layouts/base.njk`. Данные страницы:
  - `seo{title,description,canonical,ogImage,noindex}`, `title`;
  - `breadcrumbs[{name,url}]` — layout сам выводит крошки и BreadcrumbList;
  - `jsonld[]`, `scripts[]`, `lastmod`, `sitemapImages[]`, `sitemap:false`.
  
  `jsonld` и вычисляемые поля задаются в `.11tydata.js` или `eleventyComputed` (`import {serviceLd,…} from lib/seo.js`). Образец — `tests/helpers/fixture-build.mjs`: пагинация по `collections.services`, `permalink = service.url`.
- `lib/seo.js`: `organizationLd(settings,siteUrl?)`, `serviceLd(item,settings,siteUrl?)`, `productLd`, `articleLd`, `breadcrumbLd(items,siteUrl?)`, `faqLd(faq)`, `itemListLd(items,siteUrl?)`, `jsonldScript(obj)`. Те же имена доступны как фильтры, плюс `jsonld` (→ `<script>`).
- Фильтры: `absUrl`, `serviceUrl`, `categoryUrl`, `productUrl(slug,category)`, `articleUrl`, `regionUrl`, `pageUrl`, `pageExists(url, collections.all)`, `existingPages`, `findBySlug`, `md`, `isPlaceholder`, `price` (число → «12 500 ₽», null → «по запросу»), `dateRu`, `isoDate`, `pageScripts`, `sitemapImages`. Шорткод `{% image src, alt, sizes, eager %}`. Адреса страниц — в `lib/urls.js`.
- Меню, подвал и логотип ссылаются только на уже собранные страницы (фильтр `pageExists`): пункт меню появляется сам, когда тикет собирает страницу.
- Форма: `{% set leadForm = {type, id, service, message, title, submit, messageLabel} %}{% include "partials/lead-form.njk" %}`.
  - Разметка: `form[data-lead-form]`, поля `name/phone/message/service/page/consent/consentVersion/website/startedAt`, `[data-error-for]`, `[data-form-status]`, `[data-submit]`.
  - Модальное окно `#zayavka` открывается ссылкой `a[href="#zayavka"][data-lead-open][data-service][data-message]`. Без JS оно работает через `:target`, закрывается по `[data-lead-close]`.
- Баннер согласия `[data-consent-banner][hidden]` с `data-metrika-id` и `data-consent-version`, кнопки `[data-consent-accept|decline]`. Счётчик корзины — `header [data-cart-count]`. Ссылки на телефон помечены `data-goal="phone"`.
- JS: заглушек нет. esbuild минифицирует каждый существующий `src/assets/js/**/*.js` по отдельному файлу, `import './x.js'` работает. `consent`, `forms`, `cart` подключаются на всех страницах, если файл существует. Остальные модули подключаются через поле страницы `scripts: ["catalog-search"]`.
- Схемы — `schemas/*.schema.json`, у `pages/home.md` своя схема `page-home`. Поля `steps[]` и `prices` — строки. Команды: `npm install | dev | build | validate | test`.

## Что построил тикет 02 (T02)

Адреса: `/`, `/uslugi/`, `/uslugi/<slug>/`, `/regiony/<slug>/`, `/stati/`, `/stati/page/N/`, `/stati/<slug>/`, `/dostavka/`, `/kontakty/`, `/o-kompanii/`, `/politika-konfidencialnosti/`, `/soglasie/`. Якоря услуги: `priznaki`, `diagnostika`, `raboty`, `etapy`, `modeli`, `faq`, `ceny`, `zayavka-uslugi`. Id форм: `lead-service`, `lead-region`, `lead-article`, `lead-home`, `lead-page`. `models.json` — 9 серий John Deere. Поля картинок пока пустые.

## Что построил тикет 03 (T03)

- `cart.js` экспортирует `getCart()`, `addItem`, `setQty` (qty<1 удаляет), `removeItem`, `clearCart`, `onChange(cb)` → отписка, `totalQty()`, `orderItems(cart,catalog)`, `ready` (Promise). Слушает `agv:lead-sent` и очищает корзину только при `detail.type==="order"`.
- Форма заказа на `/korzina/`: `cart.js` держит `input[name="items"]` (JSON) и `data-cart-items` с тем же JSON. Кнопка «В корзину»: `button[data-add-to-cart][data-slug][data-title][data-price]`. `catalog-search.js`: `searchCatalog(items,query)`, `initCatalogSearch(doc)`. Стили каталога — `src/assets/css/catalog.css`, подключены `<link>` в теле страницы.

## Что построил тикет 04 (T04)

- `GET /api/token.php` → `{token}`. `POST /api/lead.php` → 200/422/429/403/400/405/500. Спам получает 200 с фиктивным id, в журнал не пишется.
- Журнал `leads.jsonl` хранит записи `kind:"lead"` и `kind:"delivery"` со статусами каналов `sent|failed|skipped`. Интерфейс `Channel{name();missingSettings();send(Lead):bool}`. Команда `php backend/console.php resend`.
- `forms.js`: `initForms(win)`, `formatPhone(v)`, событие `agv:lead-sent` `{type,id}`. `consent.js`: `initConsent(win)`, `window.agvGoal(name,params)`, цели `lead|order|phone`.
- Переменные для тестов: `AGV_ENV_FILE`, `AGV_STORAGE_DIR`. Новая переменная `MAX_API_URL`, по документации MAX — `https://platform-api2.max.ru`. Это D01: в спецификации был указан `platform-api.max.ru`.
- PHPMailer 7.1.1 лежит в `backend/vendor/phpmailer/`.
