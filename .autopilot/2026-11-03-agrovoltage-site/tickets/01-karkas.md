# 01 — Каркас сайта, дизайн, SEO-основа и Sveltia

**Требования:** R01, R02, R03, R05, R13, R14, R15, R20, R25, R25.1, R26, R26.1, R29i, R32i
**Зависит от:** —
**Зона:** `package.json` · `eleventy.config.js` · `lib/` · `schemas/` · `scripts/` · `src/_includes/` · `src/_data/settings.json` · `src/admin/` · `src/assets/css/` · `src/assets/fonts/` · `src/assets/brand/` · `src/404.njk` · `src/sitemap.xml.njk` · `src/robots.txt.njk` · `src/llms.txt.njk` · `public/.htaccess` · `.github/` · `tests/build.test.mjs` · `tests/helpers/` · `README.md` · `.env.example`
**Волна:** 1
**Ревью:** да — фундамент
**Модель:** сильная

## Что должно заработать

`npm install && npm run build` собирает пустой, но готовый каркас сайта в `dist/`. В нём есть шапка с логотипом АГРОВОЛЬТАЖ, меню, кликабельный телефон, счётчик корзины (разметка), мобильное меню, подвал с контактами из настроек, хлебные крошки и страница 404. На каждой странице правильный `<head>`: title, description, canonical, OG, noindex по умолчанию и JSON-LD Organization + AutoRepair. Собираются sitemap.xml, robots.txt с Clean-param и llms.txt, которые наполнятся сами, когда появятся коллекции. `/admin/` открывает Sveltia с конфигом всех коллекций из `interfaces.md` §1. Валидатор данных падает с русской ошибкой на битом файле. `npm run dev` поднимает сайт с пересборкой и PHP-сервером на одном адресе. `npm test` — единая команда проверок. GitHub Actions собирает сайт и прогоняет тесты.

## Из брифа, дословно

> «давай тогда сделаем новый сайт под Sveltia, https://github.com/alexdubaev-web/agrovoltage.git разместим его в этом репозитории»
> «разработка должна вестись с помощью /autopilot»
> «логотип АГРОВОЛЬТАЖ прикрепил»
> «Сайт должен быть понятным, легким, быстрым»
> «Ну и все  стандартные моменты»
> «мы должны иметь возможность потом все редактировать через Svetlia»
> «Сайт должен быть с хорошей SEO оптимизацией под Яндекс»
> «Хостинга и домена пока нет, давай локально пока»

## Разделы спецификации

Истории 1, 2, 3, 5, 13, 14, 15, 27, 32, 33, 34, 35, 41, 44 и все «Решения по реализации». `interfaces.md` — целиком: здесь создаются все границы §1–§6:
- схемы всех коллекций;
- конфиг Sveltia на все коллекции;
- базовый layout;
- `lib/seo.js` со всеми функциями JSON-LD;
- разметка формы заявки `src/_includes/partials/lead-form.njk` по контракту §5, без JS-логики;
- разметка баннера согласия, без логики;
- разметка модального окна.

## Критерии приёмки

- [ ] `npm install` ставит все зависимости из «Решений по реализации»: Eleventy 3, @11ty/eleventy-img, esbuild, ajv, jsdom (PHPMailer — в тикете 04). `npm run build` создаёт `dist/` без ошибок
- [ ] Логотип из `.autopilot/2026-11-03-agrovoltage-site--wip/logo-source.png` стоит в шапке и подвале с прозрачным фоном. Есть favicon.ico, 32px и apple-touch 180px. Цветовые токены CSS взяты из зелёных цветов логотипа
- [ ] Каждая страница: один H1, уникальный title с суффиксом из настроек, description, canonical от `SITE_URL`, OG/twitter. Без `INDEXABLE=true` — `<meta name="robots" content="noindex,nofollow">` и `robots.txt` с `Disallow: /`. С `INDEXABLE=true SITE_URL=https://…` индексация открыта, есть `Clean-param` для utm_*, yclid, gclid, ysclid
- [ ] JSON-LD Organization + AutoRepair на всех страницах: telephone `+79620011990`, areaServed — оба края, адрес — из настроек (заглушка). Все функции `lib/seo.js` из `interfaces.md` §3 существуют и покрыты тестом
- [ ] `sitemap.xml` (с lastmod и image:image) и `llms.txt` генерируются из коллекций и не падают при пустых коллекциях
- [ ] `src/admin/config.yml` описывает все коллекции и настройки из §1 с обязательными полями и pattern. `/admin/` открывается в браузере и показывает Sveltia. README описывает локальный режим Sveltia
- [ ] `scripts/validate-content.mjs` на файле без обязательного поля падает с текстом «<файл>: поле <поле> — …», и сборка не создаёт `dist/`
- [ ] Нет горизонтальной прокрутки от 360 px, мобильное меню работает без JS-фреймворка, кнопки не меньше 44 px
- [ ] `npm test` прогоняет проверки сборки и бюджет: JS ≤ 30 КБ, CSS ≤ 40 КБ в gzip на страницу
- [ ] `npm run dev` поднимает сайт по одному адресу (`http://localhost:8080`) с живой пересборкой, PHP-файлы из `public/api/` выполняются
- [ ] `.github/workflows/build.yml` ставит Node 22 и PHP, собирает сайт и запускает `npm test`. Деплоя нет
- [ ] `.env.example` содержит все имена из `interfaces.md` §5, а также `SITE_URL` и `INDEXABLE`, все с пустыми значениями
