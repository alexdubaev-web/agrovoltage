window.STATE =
{
  "version": 2,
  "slug": "redesign",
  "dir": "2026-11-03-redesign--wip",
  "title": "Редизайн сайта АГРОВОЛЬТАЖ",
  "mode": "semi",
  "depth": "normal",
  "tier": "T2",
  "briefFile": "2026-11-03-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "autopilot",
  "skillDir": "C:/Users/Alexandr/.claude/skills/autopilot",
  "baseCommit": null,
  "startedAt": "2026-11-03T14:28:04+03:00",
  "updatedAt": "2026-11-03T14:33:19+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-11-03T14:28:04+03:00",
      "finishedAt": "2026-11-03T14:28:22+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-11-03T14:28:22+03:00",
      "finishedAt": "2026-11-03T14:31:02+03:00"
    },
    {
      "id": "briefing",
      "status": "skipped",
      "startedAt": "2026-11-03T14:28:23+03:00",
      "finishedAt": "2026-11-03T14:28:23+03:00",
      "note": "вопросов не потребовалось: направление задано дизайн-брифом"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-11-03T14:31:02+03:00",
      "finishedAt": "2026-11-03T14:33:08+03:00"
    },
    {
      "id": "plan",
      "status": "active",
      "startedAt": "2026-11-03T14:33:08+03:00"
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
    "total": 10,
    "done": 0,
    "inTicket": 10,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Дизайн-система, шапка и подвал, главная со схемой трактора",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R03.1",
        "R04",
        "R04.1",
        "R04.2",
        "R06",
        "R07i"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "src/assets/css/main.css",
        "src/assets/fonts/",
        "src/_includes/",
        "src/index.njk",
        "src/index.11tydata.js",
        "src/assets/js/symptoms.js",
        "src/content/pages/home.md",
        "symptoms",
        "schemas/page-home.schema.json",
        "src/admin/config.yml",
        "eleventy.config.js",
        "tests/build.test.mjs",
        "tests/forms.test.mjs",
        "tests/symptoms.test.mjs",
        "docs/design-brief.md"
      ],
      "review": "да — фундамент",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "02",
      "title": "Внутренние страницы в новой системе и SEO-иерархия заголовков",
      "requirements": [
        "R05",
        "R05.1",
        "G01",
        "G03",
        "R02",
        "R07i"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/uslugi/",
        "src/katalog/",
        "src/korzina/",
        "src/stati/",
        "src/regiony/",
        "src/kontakty/",
        "src/dostavka/",
        "src/o-kompanii/",
        "src/politika-konfidencialnosti/",
        "src/soglasie/",
        "src/404.njk",
        "tests/seo-headings.test.mjs",
        "tests/pages.test.mjs",
        "tests/catalog.test.mjs",
        "tests/cart.test.mjs",
        "src/assets/css/main.css",
        "/* pages */"
      ],
      "review": "нет",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "03",
      "title": "Тексты всего сайта и SEO-поля",
      "requirements": [
        "G02",
        "G03"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "src/content/services/",
        "src/content/products/",
        "src/content/categories/",
        "src/content/articles/",
        "src/content/regions/",
        "src/content/pages/",
        "home.md",
        "symptoms",
        "src/_data/settings.json",
        "seo",
        "src/_data/models.json",
        "tests/content-copy.test.mjs"
      ],
      "review": "нет",
      "model": "сильная",
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
    "found": 4,
    "fixed": 4,
    "deferred": 0,
    "items": []
  },
  "concerns": [],
  "blind": null,
  "beats": [
    "2026-11-03T14:28:04+03:00",
    "2026-11-03T14:28:21+03:00",
    "2026-11-03T14:28:22+03:00",
    "2026-11-03T14:28:23+03:00",
    "2026-11-03T14:28:37+03:00",
    "2026-11-03T14:31:02+03:00",
    "2026-11-03T14:32:27+03:00",
    "2026-11-03T14:33:08+03:00",
    "2026-11-03T14:33:18+03:00",
    "2026-11-03T14:33:19+03:00"
  ],
  "rev": 13,
  "waiting": null,
  "waits": [
    {
      "kind": "briefing",
      "from": "2026-11-03T14:28:37+03:00",
      "to": "2026-11-03T14:31:02+03:00"
    }
  ],
  "log": [
    {
      "t": "2026-11-03T14:28:04+03:00",
      "k": "init"
    },
    {
      "t": "2026-11-03T14:28:22+03:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-11-03T14:28:23+03:00",
      "k": "stage",
      "id": "briefing",
      "act": "skip",
      "note": "вопросов не потребовалось: направление задано дизайн-брифом"
    },
    {
      "t": "2026-11-03T14:28:37+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "один вопрос — брать ли в редизайн пункты прошлой сборки"
    },
    {
      "t": "2026-11-03T14:31:02+03:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-11-03T14:31:02+03:00",
      "k": "gate",
      "g": "G1",
      "ok": false,
      "open": 10,
      "total": 10
    },
    {
      "t": "2026-11-03T14:31:02+03:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-11-03T14:32:27+03:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 4,
      "fixed": 4,
      "deferred": 0
    },
    {
      "t": "2026-11-03T14:33:08+03:00",
      "k": "stage",
      "id": "plan",
      "act": "start"
    },
    {
      "t": "2026-11-03T14:33:18+03:00",
      "k": "tier",
      "v": "T2"
    },
    {
      "t": "2026-11-03T14:33:18+03:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-11-03T14:33:19+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«используй /frontend-design»",
      "status": "in-ticket"
    },
    {
      "id": "R02",
      "text": "«сделай пожалуйста красивый»",
      "status": "in-ticket"
    },
    {
      "id": "R03",
      "text": "«интересный»",
      "status": "in-ticket"
    },
    {
      "id": "R04",
      "text": "«и удобный сайт»",
      "status": "in-ticket"
    },
    {
      "id": "R05",
      "text": "«а не то что ты сделал»",
      "status": "in-ticket"
    },
    {
      "id": "R06",
      "text": "«запусти снова через /autopilot»",
      "status": "in-ticket"
    },
    {
      "id": "R07i",
      "text": "(подразумевается) всё, что работало, продолжает работать: каталог, корзина, формы, Sveltia, SEO, тесты",
      "status": "in-ticket"
    },
    {
      "id": "G01",
      "text": "«переделай мене весь сайт»",
      "status": "in-ticket"
    },
    {
      "id": "G02",
      "text": "«и тексты в нем должны быть нормальные»",
      "status": "in-ticket"
    },
    {
      "id": "G03",
      "text": "«заголовки по всем правилам SEO»",
      "status": "in-ticket"
    }
  ],
  "gates": {
    "G1": {
      "ok": false,
      "at": "2026-11-03T14:31:02+03:00",
      "open": 10,
      "total": 10
    },
    "G2": {
      "ok": true,
      "at": "2026-11-03T14:32:27+03:00",
      "found": 4,
      "fixed": 4,
      "deferred": 0
    },
    "G3": {
      "ok": true,
      "at": "2026-11-03T14:33:19+03:00",
      "problems": 0
    }
  },
  "result": null
}
