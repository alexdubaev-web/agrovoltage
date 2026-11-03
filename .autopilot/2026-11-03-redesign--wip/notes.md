# Заметки по существующему коду

Код описан полностью — читать, а не исследовать заново:
- `docs/architecture.md` — поток данных, модули, соглашения.
- `.autopilot/2026-11-03-agrovoltage-site/interfaces.md` — точные имена коллекций, полей, фильтров, партиалов, data-атрибутов форм, корзины и поиска (разделы «Что построил тикет 01…04»).
- `AGENTS.md` — команды и подводные камни (asyncEach для `{% image %}` в циклах; нет `equalto`; `npm test` и `npm run dev` пишут в один dist/).
- Шаблоны: `src/index.njk`, `src/uslugi/`, `src/katalog/`, `src/korzina/`, `src/stati/`, `src/kontakty/`, `src/regiony/`, `src/dostavka/`, `src/o-kompanii/`, `src/politika-konfidencialnosti/`, `src/soglasie/`, `src/404.njk`; общие — `src/_includes/layouts/base.njk`, `src/_includes/partials/*`.
- CSS — один `src/assets/css/main.css` (~300 строк); JS — `src/assets/js/{cart,forms,consent,catalog-search}.js`.
- Контент — `src/content/{services,products,categories,articles,regions,pages}`, настройки — `src/_data/settings.json`, модели — `src/_data/models.json`.
- Незакоммичено к старту: шрифты Unbounded + Golos Text в `src/assets/fonts/` (Manrope удалён, CSS ещё ссылается на Manrope).
- Тесты: 119, опираются на data-атрибуты (`data-lead-form`, `data-product-card`, `data-add-to-cart`, `data-cart-count`, `data-consent-*`), классы `.product-ph`, `.contact-fab`, `.price-table` и др.
