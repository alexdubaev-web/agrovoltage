window.STATE =
{
  "version": 2,
  "slug": "agrovoltage-site",
  "dir": "2026-11-03-agrovoltage-site--wip",
  "title": "Сайт АГРОВОЛЬТАЖ: ремонт электрики сельхозтехники",
  "mode": "semi",
  "depth": "normal",
  "tier": "T2",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "autopilot",
  "skillDir": "C:/Users/Alexandr/.claude/skills/autopilot",
  "baseCommit": null,
  "startedAt": "2026-11-03T10:42:06+03:00",
  "updatedAt": "2026-11-03T10:59:16+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T10:42:06+03:00",
      "finishedAt": "2026-11-03T10:42:26+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T10:42:26+03:00",
      "finishedAt": "2026-11-03T10:42:57+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-11-03T10:42:57+03:00",
      "finishedAt": "2026-11-03T10:53:33+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T10:53:33+03:00",
      "finishedAt": "2026-11-03T10:56:50+03:00"
    },
    {
      "id": "plan",
      "status": "active",
      "startedAt": "2026-11-03T10:56:50+03:00"
    },
    {
      "id": "build",
      "status": "pending"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 32,
    "done": 0,
    "inTicket": 32,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Каркас сайта, дизайн, SEO-основа и Sveltia",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R05",
        "R13",
        "R14",
        "R15",
        "R20",
        "R25",
        "R25.1",
        "R26",
        "R26.1",
        "R29i",
        "R32i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "package.json",
        "eleventy.config.js",
        "lib/",
        "schemas/",
        "scripts/",
        "src/_includes/",
        "src/_data/settings.json",
        "src/admin/",
        "src/assets/css/",
        "src/assets/fonts/",
        "src/assets/brand/",
        "src/404.njk",
        "src/sitemap.xml.njk",
        "src/robots.txt.njk",
        "src/llms.txt.njk",
        "public/.htaccess",
        ".github/",
        "tests/build.test.mjs",
        "tests/helpers/",
        "README.md",
        ".env.example"
      ],
      "review": "да — фундамент",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "02",
      "title": "Услуги, регионы, статьи, главная и стандартные страницы",
      "requirements": [
        "R06",
        "R07",
        "R08",
        "R09",
        "R10",
        "R11",
        "R12",
        "R19",
        "R21",
        "R22",
        "R23",
        "R24",
        "R27",
        "R27.1",
        "R30i",
        "R31i"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/content/services/",
        "src/content/regions/",
        "src/content/articles/",
        "src/content/pages/",
        "src/_data/models.json",
        "src/index.njk",
        "src/uslugi/",
        "src/regiony/",
        "src/stati/",
        "src/dostavka/",
        "src/kontakty/",
        "src/o-kompanii/",
        "src/politika-konfidencialnosti/",
        "src/soglasie/",
        "tests/pages.test.mjs"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "03",
      "title": "Каталог запчастей и корзина",
      "requirements": [
        "R16",
        "R16.1",
        "R16.2",
        "R17",
        "R17.1",
        "R17.2",
        "R17.3",
        "R24"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/content/products/",
        "src/content/categories/",
        "src/katalog/",
        "src/korzina/",
        "src/assets/js/cart.js",
        "src/assets/js/catalog-search.js",
        "tests/cart.test.mjs",
        "tests/catalog.test.mjs"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "04",
      "title": "Приём заявок: формы, почта, MAX, согласие и Метрика",
      "requirements": [
        "R18",
        "R18.1",
        "R18.2",
        "R26.2",
        "R28i",
        "R28i.1",
        "R30i",
        "A01"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "public/api/",
        "backend/",
        "storage/.gitkeep",
        "src/assets/js/forms.js",
        "src/assets/js/consent.js",
        "src/_includes/partials/contact-fab.njk",
        "tests/api.test.mjs",
        "tests/forms.test.mjs"
      ],
      "review": "да — ключи и секреты",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "05",
      "title": "Картинки сайта через /codex-image",
      "requirements": [
        "R04"
      ],
      "blockedBy": [
        "02",
        "03"
      ],
      "wave": 3,
      "zone": [
        "src/assets/images/",
        "image",
        "images",
        "cover",
        "src/content/**",
        "src/_data/settings.json",
        "seo.ogImage"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    }
  ],
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 1,
    "fixed": 1,
    "deferred": 0,
    "items": []
  },
  "concerns": [],
  "blind": null,
  "beats": [
    "2026-11-03T10:42:06+03:00",
    "2026-11-03T10:42:26+03:00",
    "2026-11-03T10:42:56+03:00",
    "2026-11-03T10:42:57+03:00",
    "2026-11-03T10:43:27+03:00",
    "2026-11-03T10:43:47+03:00",
    "2026-11-03T10:53:27+03:00",
    "2026-11-03T10:53:33+03:00",
    "2026-11-03T10:56:46+03:00",
    "2026-11-03T10:56:50+03:00",
    "2026-11-03T10:59:15+03:00",
    "2026-11-03T10:59:16+03:00"
  ],
  "rev": 14,
  "waiting": null,
  "waits": [
    {
      "kind": "briefing",
      "from": "2026-11-03T10:43:27+03:00",
      "to": "2026-11-03T10:53:27+03:00"
    }
  ],
  "log": [
    {
      "t": "2026-11-03T10:42:06+03:00",
      "k": "init"
    },
    {
      "t": "2026-11-03T10:42:26+03:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-11-03T10:42:57+03:00",
      "k": "stage",
      "id": "briefing",
      "act": "start"
    },
    {
      "t": "2026-11-03T10:43:27+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "4 вопроса — хостинг и домен, куда идут заявки, корзина без оплаты, регион и контакты"
    },
    {
      "t": "2026-11-03T10:43:47+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "4 вопроса — хостинг и домен, куда идут заявки, корзина без оплаты, регион и контакты"
    },
    {
      "t": "2026-11-03T10:53:27+03:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-11-03T10:53:33+03:00",
      "k": "gate",
      "g": "G1",
      "ok": false,
      "open": 32,
      "total": 32
    },
    {
      "t": "2026-11-03T10:53:33+03:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-11-03T10:56:46+03:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 1,
      "fixed": 1,
      "deferred": 0
    },
    {
      "t": "2026-11-03T10:56:50+03:00",
      "k": "stage",
      "id": "plan",
      "act": "start"
    },
    {
      "t": "2026-11-03T10:59:15+03:00",
      "k": "tier",
      "v": "T2"
    },
    {
      "t": "2026-11-03T10:59:16+03:00",
      "k": "tickets",
      "n": 5
    },
    {
      "t": "2026-11-03T10:59:16+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«сделаем новый сайт под Sveltia»",
      "status": "in-ticket"
    },
    {
      "id": "R02",
      "text": "«https://github.com/alexdubaev-web/agrovoltage.git разместим его в этом репозитории»",
      "status": "in-ticket"
    },
    {
      "id": "R03",
      "text": "«разработка должна вестись с помощью /autopilot»",
      "status": "in-ticket"
    },
    {
      "id": "R04",
      "text": "«картинки для сайта генерируй с помощью /codex-image»",
      "status": "in-ticket"
    },
    {
      "id": "R05",
      "text": "«логотип АГРОВОЛЬТАЖ прикрепил»",
      "status": "in-ticket"
    },
    {
      "id": "R06",
      "text": "«диагнocтике неиспpавноcти … сельскохозяйственной техники»",
      "status": "in-ticket"
    },
    {
      "id": "R07",
      "text": "«Pемoнтe элeктpики»",
      "status": "in-ticket"
    },
    {
      "id": "R08",
      "text": "«электpoпpовoдки»",
      "status": "in-ticket"
    },
    {
      "id": "R09",
      "text": "«элeктpоoборудовaния»",
      "status": "in-ticket"
    },
    {
      "id": "R10",
      "text": "«систем кондиционирования сельскохозяйственной техники»",
      "status": "in-ticket"
    },
    {
      "id": "R11",
      "text": "«в основном это John Deere»",
      "status": "in-ticket"
    },
    {
      "id": "R12",
      "text": "«на этом сайте можно посмотреть примерно чем наполнена информация у людей смежной направленности https://spb.mea-service.ru/remont/elektriki-ebu/john-deere»",
      "status": "in-ticket"
    },
    {
      "id": "R13",
      "text": "«Сайт должен быть понятным»",
      "status": "in-ticket"
    },
    {
      "id": "R14",
      "text": "«легким»",
      "status": "in-ticket"
    },
    {
      "id": "R15",
      "text": "«быстрым»",
      "status": "in-ticket"
    },
    {
      "id": "R16",
      "text": "«с каталогом товаров»",
      "status": "in-ticket"
    },
    {
      "id": "R17",
      "text": "«с корзиной»",
      "status": "in-ticket"
    },
    {
      "id": "R18",
      "text": "«обратной связью»",
      "status": "in-ticket"
    },
    {
      "id": "R19",
      "text": "«должна быть возможность писать статьи»",
      "status": "in-ticket"
    },
    {
      "id": "R20",
      "text": "«Ну и все  стандартные моменты»",
      "status": "in-ticket"
    },
    {
      "id": "R21",
      "text": "«контакты»",
      "status": "in-ticket"
    },
    {
      "id": "R22",
      "text": "«доставка»",
      "status": "in-ticket"
    },
    {
      "id": "R23",
      "text": "«должен быть еще перечень услуг»",
      "status": "in-ticket"
    },
    {
      "id": "R24",
      "text": "«пока товары и услуги должны быть тестовые»",
      "status": "in-ticket"
    },
    {
      "id": "R25",
      "text": "«мы должны иметь возможность потом все редактировать через Svetlia»",
      "status": "in-ticket"
    },
    {
      "id": "R26",
      "text": "«с хорошей SEO оптимизацией под Яндекс»",
      "status": "in-ticket"
    },
    {
      "id": "R27",
      "text": "«и под GEO»",
      "status": "in-ticket"
    },
    {
      "id": "R28i",
      "text": "(подразумевается) заказы из корзины и сообщения обратной связи должны куда-то доходить",
      "status": "in-ticket"
    },
    {
      "id": "R29i",
      "text": "(подразумевается) сайт где-то размещается и обновляется после правок в Sveltia",
      "status": "in-ticket"
    },
    {
      "id": "R30i",
      "text": "(подразумевается) сайт собирает имя и телефон — нужны политика и согласие на обработку ПД (152-ФЗ)",
      "status": "in-ticket"
    },
    {
      "id": "R31i",
      "text": "(подразумевается) реальные контакты, адрес, регион работы, реквизиты компании",
      "status": "in-ticket"
    },
    {
      "id": "R32i",
      "text": "(подразумевается) адаптивность под телефон",
      "status": "in-ticket"
    }
  ],
  "gates": {
    "G1": {
      "ok": false,
      "at": "2026-11-03T10:53:33+03:00",
      "open": 32,
      "total": 32
    },
    "G2": {
      "ok": true,
      "at": "2026-11-03T10:56:46+03:00",
      "found": 1,
      "fixed": 1,
      "deferred": 0
    },
    "G3": {
      "ok": true,
      "at": "2026-11-03T10:59:16+03:00",
      "problems": 0
    }
  },
  "result": null
}
