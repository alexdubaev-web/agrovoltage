// Проверки страниц тикета 02: услуги, регионы, статьи, главная, стандартные страницы.
// Основа — собранный dist/ (его делает `npm test`). Бейдж «Демо» и пагинацию проверяет
// отдельная сборка на копии контента: в ней у одной услуги и одной статьи снят demo и добавлено 12 статей.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, DIST, dom, ldNode, ldTypes } from "./helpers/dist.mjs";
import { tempDir } from "./helpers/fixture.mjs";

const SETTINGS = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/settings.json"), "utf8"));
const page = (url, dist = DIST) => dom(path.join(dist, url, "index.html"));
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();

const SERVICES = [
  "diagnostika-elektriki",
  "remont-elektriki",
  "remont-provodki-i-zhgutov",
  "remont-generatorov-i-starterov",
  "elektrooborudovanie-kabiny-i-osveshcheniya",
  "diagnostika-i-remont-kondicionerov",
  "zapravka-kondicionera",
  "vyezd-v-pole",
];
const SECTION_IDS = ["priznaki", "diagnostika", "raboty", "etapy", "modeli", "faq", "ceny", "zayavka-uslugi"];

describe("страницы услуг", () => {
  for (const slug of SERVICES) {
    test(`/uslugi/${slug}/: H1, порядок блоков, кнопки записи, форма, JSON-LD`, () => {
      const doc = page(`/uslugi/${slug}`);
      const h1s = doc.querySelectorAll("h1");
      assert.equal(h1s.length, 1);
      // История 17: в H1 услуги главный запрос с John Deere, края не называются.
      assert.match(text(h1s[0]), /John Deere$/);
      for (const r of SETTINGS.regions) assert.ok(!text(h1s[0]).includes(r.split(" ")[0].slice(0, -2)), `край в H1: ${text(h1s[0])}`);

      const crumbs = [...doc.querySelectorAll(".breadcrumbs li")].map(text);
      assert.deepEqual(crumbs.slice(0, 2), ["Главная", "Услуги"]);

      const order = SECTION_IDS.map((id) => doc.getElementById(id));
      assert.ok(order.every(Boolean), "не хватает блока из списка: " + SECTION_IDS.filter((id, i) => !order[i]).join(", "));
      for (let i = 1; i < order.length; i++) {
        assert.ok(order[i - 1].compareDocumentPosition(order[i]) & 4, `блок ${SECTION_IDS[i]} стоит раньше ${SECTION_IDS[i - 1]}`);
      }

      assert.match(text(doc.getElementById("modeli")), /6R 130/);
      assert.match(text(doc.getElementById("modeli")), /S660/);

      const title = text(h1s[0]).split(" John Deere")[0];
      const buttons = [...doc.querySelectorAll("#ceny a[data-lead-open]")];
      assert.ok(buttons.length >= 3);
      for (const b of buttons) {
        assert.equal(b.textContent.trim(), "Записаться");
        assert.equal(b.getAttribute("href"), "#zayavka");
        assert.equal(b.getAttribute("data-service"), title);
      }

      const form = doc.querySelector('#zayavka-uslugi form[data-lead-form="service"]');
      assert.ok(form, "нет формы услуги");
      assert.equal(form.querySelector('input[name="service"]').value, title);

      const types = ldTypes(doc);
      for (const t of ["Service", "BreadcrumbList", "FAQPage"]) assert.ok(types.includes(t), `нет ${t}`);
    });
  }

  test("тексты услуг своя разработка: нет совпадений длинных фраз с эталоном", () => {
    const reference = ["Диагностика ЭБУ", "Прошивка", "программное отключение"];
    for (const slug of SERVICES) {
      const body = fs.readFileSync(path.join(ROOT, "src/content/services", `${slug}.md`), "utf8");
      for (const phrase of reference) assert.ok(!body.includes(phrase), `${slug}: «${phrase}»`);
    }
  });
});

describe("/uslugi/", () => {
  test("строки услуг по группам как на главной, цена «от» или «по запросу», ItemList", () => {
    const doc = page("/uslugi");
    const groups = [...doc.querySelectorAll(".service-group > h2.service-group__title")].map(text);
    assert.deepEqual(groups, ["Электрика", "Электрооборудование", "Климат"]);
    const rows = doc.querySelectorAll(".service-group .service-row");
    assert.equal(rows.length, 8);
    for (const row of rows) assert.match(row.querySelector(".service-row__link").getAttribute("href"), /^\/uslugi\/[a-z-]+\/$/);
    assert.deepEqual(
      [...doc.querySelectorAll("#climate .service-row__link")].map((a) => a.getAttribute("href")).sort(),
      ["/uslugi/diagnostika-i-remont-kondicionerov/", "/uslugi/zapravka-kondicionera/"],
    );
    const prices = [...doc.querySelectorAll(".service-row__price")].map(text);
    assert.ok(prices.some((p) => /^от 2.?500 ₽$/.test(p)), prices.join("|"));
    assert.ok(prices.includes("по запросу"));
    assert.ok(ldTypes(doc).includes("ItemList"));
    assert.equal(ldNode(doc, "ItemList").itemListElement.length, 8);
  });
});

describe("главная", () => {
  // Макет B (редизайн, тикет 01): края на главной не показываются (R11), блоки — по макету.
  test("первый экран: H1 про John Deere, tel:, кнопка заявки; блоки ниже: запчасти раньше услуг", () => {
    const doc = page("/");
    assert.match(text(doc.querySelector("h1")), /John Deere/);
    const hero = doc.querySelector("main section");
    assert.equal(hero.querySelector('a[href^="tel:"]').getAttribute("href"), "tel:+79620011990");
    assert.ok(hero.querySelector("a[data-lead-open]"));
    const ids = ["zapchasti", "uslugi", "etapy", "vyezd", "faq", "stati", "forma"];
    const els = ids.map((id) => doc.getElementById(id));
    assert.ok(els.every(Boolean));
    for (let i = 1; i < els.length; i++) assert.ok(els[i - 1].compareDocumentPosition(els[i]) & 4, ids[i]);
    const first = doc.querySelector("#uslugi .service-row a");
    assert.equal(first.getAttribute("href"), "/uslugi/diagnostika-elektriki/");
    assert.equal(doc.querySelectorAll("#stati article").length, 3);
    assert.ok(ldTypes(doc).includes("FAQPage"));
  });
});

describe("регионы", () => {
  test("F2: /regiony/ — список регионов из коллекции, крошки, ItemList; крошка «Регионы» ведёт на неё", () => {
    const files = fs.readdirSync(path.join(ROOT, "src/content/regions")).filter((f) => f.endsWith(".md"));
    const slugs = files.map((f) => f.replace(/\.md$/, ""));
    assert.ok(fs.existsSync(path.join(DIST, "regiony", "index.html")), "/regiony/ собрана");
    const doc = page("/regiony");
    const links = [...doc.querySelectorAll("main .region-card a[href^='/regiony/']")].map((a) => a.getAttribute("href"));
    assert.deepEqual([...new Set(links)].sort(), slugs.map((s) => `/regiony/${s}/`).sort());
    const crumbs = [...doc.querySelectorAll(".breadcrumbs li")].map(text);
    assert.deepEqual(crumbs, ["Главная", "Регионы"]);
    const list = ldNode(doc, "ItemList");
    assert.equal(list.itemListElement.length, slugs.length);
    for (const slug of slugs) {
      const crumb = page(`/regiony/${slug}`).querySelector('.breadcrumbs a[href="/regiony/"]');
      assert.ok(crumb, `${slug}: ссылка на /regiony/ в крошках`);
      assert.equal(text(crumb), "Регионы");
    }
  });

  for (const [slug, name] of [["stavropolskij-kraj", "Ставропольск"], ["krasnodarskij-kraj", "Краснодарск"]]) {
    test(`/regiony/${slug}/: регион в title и H1, населённые пункты с пометкой, услуги, FAQ, форма`, () => {
      const doc = page(`/regiony/${slug}`);
      assert.ok(doc.title.includes(name), doc.title);
      assert.ok(text(doc.querySelector("h1")).includes(name));
      const places = [...doc.querySelectorAll("li")].map(text).filter((t) => t.includes("[уточнить]"));
      assert.ok(places.length >= 3);
      assert.equal(doc.querySelectorAll("#uslugi .service-row__link[href^='/uslugi/']").length, 8);
      assert.ok(doc.querySelector("#faq details"));
      assert.ok(doc.querySelector("form[data-lead-form]#lead-region"));
      assert.ok(ldTypes(doc).includes("FAQPage"));
    });
  }
});

describe("статьи", () => {
  test("/stati/: три статьи с бейджем «Демо», без пагинации при ≤ 12", () => {
    const doc = page("/stati");
    assert.equal(doc.querySelectorAll(".post-card").length, 3);
    assert.equal(doc.querySelectorAll(".post-card .badge--demo").length, 3);
    for (const card of doc.querySelectorAll(".post-card")) assert.match(card.querySelector("h2 a").getAttribute("href"), /^\/stati\/[a-z-]+\/$/);
    assert.equal(doc.querySelector('nav[aria-label="Страницы списка"]'), null);
    assert.ok(ldTypes(doc).includes("ItemList"));
  });

  test("/stati/<slug>/: Article JSON-LD, связанные услуги, форма", () => {
    const doc = page("/stati/pochemu-ne-holodit-kondicioner");
    assert.ok(ldTypes(doc).includes("Article"));
    const related = [...doc.querySelectorAll("section.section--alt .service-row__link")].map((a) => a.getAttribute("href"));
    assert.deepEqual(related, ["/uslugi/diagnostika-i-remont-kondicionerov/", "/uslugi/zapravka-kondicionera/"]);
    assert.match(text(doc.querySelector("section.section--alt h2")), /Связанные услуги/);
    assert.ok(doc.querySelector("form#lead-article"));
  });
});

describe("контакты и документы", () => {
  test("/kontakty/: телефон, заглушки, регионы, карта только по клику", () => {
    const doc = page("/kontakty");
    assert.equal(doc.querySelector('main a[href^="tel:"]').getAttribute("href"), SETTINGS.phoneHref);
    const placeholders = [...doc.querySelectorAll("main .placeholder")].map(text);
    for (const v of [SETTINGS.address, SETTINGS.email, SETTINGS.hours]) assert.ok(placeholders.includes(v), v);
    const body = text(doc.querySelector("main"));
    for (const r of SETTINGS.regions) assert.ok(body.includes(r));
    assert.equal(doc.querySelector("iframe"), null, "карта не должна грузиться заранее");
    assert.ok(doc.getElementById("map-load"));
  });

  test("/dostavka/ и /o-kompanii/ собраны из контента, есть форма", () => {
    for (const url of ["/dostavka", "/o-kompanii"]) {
      const doc = page(url);
      const md = fs.readFileSync(path.join(ROOT, "src/content/pages", url === "/dostavka" ? "delivery.md" : "about.md"), "utf8");
      const title = md.match(/^title: (.+)$/m)[1];
      assert.equal(text(doc.querySelector("h1")), title);
      assert.ok(doc.querySelector("form[data-lead-form]#lead-page"));
    }
    assert.match(text(page("/dostavka").querySelector("main")), /\[уточнить/);
  });

  test("политика и согласие содержат заглушку оператора", () => {
    for (const url of ["/politika-konfidencialnosti", "/soglasie"]) {
      const doc = page(url);
      const marks = [...doc.querySelectorAll("main .placeholder")].map(text);
      assert.ok(marks.includes("[ОПЕРАТОР — впиши]"), url);
      assert.ok(marks.includes("[ИНН — впиши]"), url);
    }
  });

  test("llms.txt перечисляет услуги, регионы и контакты", () => {
    const llms = fs.readFileSync(path.join(DIST, "llms.txt"), "utf8");
    for (const slug of SERVICES) assert.ok(llms.includes(`/uslugi/${slug}/`), slug);
    for (const r of SETTINGS.regions) assert.ok(llms.includes(r), r);
    assert.ok(llms.includes(SETTINGS.phone));
  });
});

describe("демо-флаг и пагинация (отдельная сборка)", () => {
  let out;
  before(() => {
    const content = tempDir("pages-content");
    out = tempDir("pages-dist");
    fs.cpSync(path.join(ROOT, "src/content"), content, { recursive: true });
    const flip = (file) => {
      const p = path.join(content, file);
      fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("demo: true", "demo: false"));
    };
    flip("services/diagnostika-elektriki.md");
    flip("articles/provodka-i-grizuny.md");
    const sample = fs.readFileSync(path.join(content, "articles/provodka-i-grizuny.md"), "utf8");
    for (let i = 1; i <= 12; i++) {
      const slug = `extra-${String(i).padStart(2, "0")}`;
      const date = `2026-09-${String(i).padStart(2, "0")}`;
      fs.writeFileSync(
        path.join(content, "articles", `${slug}.md`),
        sample.replace(/^slug: .+$/m, `slug: ${slug}`).replace(/^date: .+$/m, `date: ${date}`).replace(/^title: .+$/m, `title: Доп. статья ${i}`).replace("demo: false", "demo: true"),
      );
    }
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "build.mjs")], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, OUTPUT_DIR: out, CONTENT_DIR: content },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test("demo: true — бейдж «Демо», demo: false — бейджа нет", () => {
    const on = page("/uslugi/remont-elektriki", out);
    assert.ok(on.querySelector(".badge--demo"));
    assert.equal(text(on.querySelector(".badge--demo")), "Демо");
    const off = page("/uslugi/diagnostika-elektriki", out);
    assert.equal(off.querySelector(".badge--demo"), null);
    const offArticle = page("/stati/provodka-i-grizuny", out);
    assert.equal(offArticle.querySelector(".post .badge--demo"), null);
    assert.ok(page("/stati/pochemu-ne-holodit-kondicioner", out).querySelector(".post .badge--demo"));
    const list = page("/uslugi", out);
    const card = [...list.querySelectorAll(".service-row")].find((c) => c.querySelector('a[href="/uslugi/diagnostika-elektriki/"]'));
    assert.ok(card, "строка услуги на /uslugi/");
    const demoRow = [...list.querySelectorAll(".service-row")].find((c) => c.querySelector('a[href="/uslugi/remont-elektriki/"]'));
    assert.equal(text(demoRow.querySelector(".badge--demo")), "Демо");
    assert.equal(card.querySelector(".badge--demo"), null);
  });

  // Метка «Демо» должна быть видна и на 375: не внутри .service-row__summary (там она скрыта на мобильных).
  const demoOf = (el) => {
    const b = el.querySelector(".badge--demo");
    return b && !b.closest(".service-row__summary") ? text(b) : null;
  };
  const REGION_PAGES = ["/regiony/stavropolskij-kraj", "/regiony/krasnodarskij-kraj"];
  test("«Демо» у каждой позиции с demo: true в списках, вне скрытого описания строки", () => {
    // Основная сборка: все услуги, товары и статьи помечены demo: true.
    const home = page("/");
    const lists = [
      ["главная: услуги", home.querySelectorAll("#uslugi .service-row"), 8],
      ["главная: запчасти", home.querySelectorAll("#zapchasti [data-product-card]"), 1],
      ["главная: статьи", home.querySelectorAll("#stati article"), 3],
      ["каталог", page("/katalog").querySelectorAll("[data-product-card]"), 12],
      ["/uslugi/", page("/uslugi").querySelectorAll(".service-row"), 8],
      ...REGION_PAGES.map((u) => [u, page(u).querySelectorAll("#uslugi .service-row"), 8]),
    ];
    for (const [name, items, min] of lists) {
      assert.ok(items.length >= min, `${name}: ${items.length}`);
      for (const el of items) assert.equal(demoOf(el), "Демо", name);
    }
    // Отдельная сборка: у diagnostika-elektriki demo снят — метки нет.
    const rowOf = (doc, href) => [...doc.querySelectorAll(".service-row")].find((r) => r.querySelector(`a[href="${href}"]`));
    for (const u of ["/", "/uslugi", ...REGION_PAGES]) {
      const doc = page(u, out);
      assert.equal(demoOf(rowOf(doc, "/uslugi/remont-elektriki/")), "Демо", u);
      assert.equal(rowOf(doc, "/uslugi/diagnostika-elektriki/").querySelector(".badge--demo"), null, u);
    }
  });

  test("главная: блок «Запчасти» собран из _product-card.html (артикул и наличие как в каталоге)", () => {
    const cards = [...page("/").querySelectorAll("#zapchasti [data-product-card]")];
    assert.ok(cards.length > 0);
    for (const c of cards) {
      assert.ok(c.querySelector(".product-card__sku"), "артикул");
      assert.ok(c.querySelector(".product-card__stock"), "наличие");
    }
  });

  test("/stati/: 12 на страницу, вторая страница и ссылки между ними", () => {
    const first = page("/stati", out);
    assert.equal(first.querySelectorAll(".post-card").length, 12);
    assert.equal(first.querySelector('a[rel="next"]').getAttribute("href"), "/stati/page/2/");
    const second = page("/stati/page/2", out);
    assert.equal(second.querySelectorAll(".post-card").length, 3);
    assert.equal(second.querySelector('a[rel="prev"]').getAttribute("href"), "/stati/");
  });
});

// R27.1 / R12: регионы на страницах берутся из settings.regions. Сборка на копии проекта,
// где в настройках другие регионы. В копии контента старые названия тоже заменены:
// так каждое оставшееся упоминание указывает на шаблон или код, а не на текст владельца.
describe("регионы из настроек (сборка с подменённой конфигурацией)", () => {
  const OLD = /Ставрополь|Краснодар/i;
  const NEW_REGIONS = ["Ростовская область", "Волгоградская область"];
  let out;
  before(() => {
    const root = tempDir("regions-root");
    for (const item of ["src", "lib", "scripts", "schemas", "public", "eleventy.config.js", "package.json"]) {
      fs.cpSync(path.join(ROOT, item), path.join(root, item), { recursive: true });
    }
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
    const settingsFile = path.join(root, "src/_data/settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    settings.regions = NEW_REGIONS;
    settings.seo.defaultDescription = "Диагностика и ремонт электрики сельхозтехники John Deere.";
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    const contentDir = path.join(root, "src/content");
    for (const file of fs.readdirSync(contentDir, { recursive: true })) {
      const p = path.join(contentDir, file);
      if (!/\.(md|json)$/.test(p)) continue;
      fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/(Ставрополь|Краснодар)[а-яё]*/gi, "Энск"));
    }
    out = path.join(root, "dist");
    const r = spawnSync(process.execPath, ["scripts/build.mjs"], {
      cwd: root, encoding: "utf8", env: { ...process.env, OUTPUT_DIR: out, CONTENT_DIR: contentDir },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });

  test("старых названий регионов нет ни в одном файле dist/", () => {
    const hits = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (!(dir === out && e.name === "admin")) walk(p); // админка — подсказки Sveltia, не страницы сайта
        } else if (/\.(html|txt|xml|json|js|css)$/.test(e.name) && OLD.test(fs.readFileSync(p, "utf8"))) {
          hits.push(path.relative(out, p));
        }
      }
    };
    walk(out);
    assert.deepEqual(hits, []);
  });

  // История 17: края видны на /kontakty/ и /regiony/, на услугах их нет ни в H1, ни в тексте шаблона.
  test("новые регионы на /kontakty/ и /regiony/, на услугах и /uslugi/ их нет", () => {
    for (const url of ["/kontakty", "/regiony"]) {
      const doc = page(url, out);
      const all = text(doc.querySelector("main")) + " " + doc.querySelector('meta[name="description"]').getAttribute("content");
      assert.match(all, /Ростовск/, url);
      assert.match(all, /Волгоградск/, url);
    }
    for (const url of ["/uslugi", "/uslugi/diagnostika-elektriki"]) {
      const doc = page(url, out);
      const all = text(doc.querySelector("main")) + " " + doc.title;
      assert.doesNotMatch(all, /Ростовск|Волгоградск/, url);
    }
  });
});

// R31i: о стационарной мастерской пользователь ничего не подтверждал.
describe("нет неподтверждённых утверждений о мастерской", () => {
  test("ни в одном файле dist/, в регионах — пометка «[уточнить]»", () => {
    const hits = fs.readdirSync(DIST, { recursive: true })
      .filter((rel) => /\.(html|txt|xml|json|js|yml)$/.test(rel))
      .filter((rel) => /мастерск/i.test(fs.readFileSync(path.join(DIST, rel), "utf8")));
    assert.deepEqual(hits, []);
    for (const slug of ["stavropolskij-kraj", "krasnodarskij-kraj"]) {
      const doc = page(`/regiony/${slug}`);
      // Как идёт работа (выезд или приём техники), пока не подтверждено: в тексте пометка «[уточнить]».
      for (const el of [doc.querySelector(".lead"), ...doc.querySelectorAll("#faq details")]) {
        const t = text(el);
        if (/выезж|выезд|привез|приним.*техник/i.test(t)) assert.match(t, /\[уточнить/, t);
      }
    }
  });
});

// История 17 (R11): края называются только на /regiony/ и страницах краёв, /kontakty/ и /dostavka/.
// Остальные страницы — ни в видимом тексте, ни в title. В JSON-LD (areaServed) края остаются.
describe("края только на своих страницах", () => {
  test("на остальных страницах нет названий краёв в тексте и title", () => {
    const stems = SETTINGS.regions.map((r) => r.split(" ")[0].slice(0, -2));
    const re = new RegExp(stems.join("|"), "i");
    const allowed = (rel) => /^(regiony|kontakty|dostavka)([\\/]|$)/.test(rel);
    const hits = [];
    for (const rel of fs.readdirSync(DIST, { recursive: true })) {
      if (!rel.endsWith(".html") || rel.startsWith("admin") || allowed(rel)) continue;
      const doc = dom(path.join(DIST, rel));
      doc.querySelectorAll("script, template").forEach((el) => el.remove());
      const visible = text(doc.body) + " " + doc.title;
      const m = visible.match(re);
      if (m) hits.push(`${rel}: …${visible.slice(Math.max(0, m.index - 40), m.index + 30)}…`);
    }
    assert.deepEqual(hits, []);
  });
});
