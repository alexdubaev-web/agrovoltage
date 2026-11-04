// Проверки каркаса: lib/seo.js, валидатор контента, собранный dist/ и тестовая сборка.
// Перед запуском нужен `npm run build` (его делает `npm test`).
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JSDOM } from "jsdom";
import {
  ROOT, DIST, htmlPages, dom, jsonLd, ldTypes, ldNode, gzipSize, resolveLocal, pageJs, pageCss, localRefs,
} from "./helpers/dist.mjs";
import { tempDir, writeFiles, VALID_CONTENT, fixtureBuild } from "./helpers/fixture.mjs";
import * as seo from "../lib/seo.js";
import { loadCollection } from "../lib/content.js";

const SETTINGS = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/settings.json"), "utf8"));
const REGIONS = ["Ставропольский край", "Краснодарский край"];
const read = (rel, dist = DIST) => fs.readFileSync(path.join(dist, rel), "utf8");

describe("lib/seo.js", () => {
  const site = "https://example.test";

  test("organizationLd: Organization + AutoRepair, телефон, оба края, адрес из настроек", () => {
    const ld = seo.organizationLd(SETTINGS, site);
    const types = ld["@graph"].map((n) => n["@type"]);
    assert.deepEqual(types, ["Organization", "AutoRepair"]);
    const shop = ld["@graph"][1];
    assert.equal(shop.telephone, "+79620011990");
    assert.deepEqual(shop.areaServed.map((a) => a.name), REGIONS);
    assert.equal(shop.address.streetAddress, SETTINGS.address);
    assert.equal(ld["@graph"][0].url, "https://example.test/");
  });

  test("serviceLd: Service с адресом услуги и ценой «от»", () => {
    const ld = seo.serviceLd({ title: "Ремонт", slug: "remont", summary: "s", priceFrom: 1500 }, SETTINGS, site);
    assert.equal(ld["@type"], "Service");
    assert.equal(ld.url, "https://example.test/uslugi/remont/");
    assert.equal(ld.offers.priceSpecification.minPrice, 1500);
    assert.equal(seo.serviceLd({ data: { title: "x", slug: "x", priceFrom: null } }, SETTINGS, site).offers, undefined);
  });

  test("productLd: Product/Offer, цена «по запросу» без Offer", () => {
    const p = { title: "Генератор", slug: "gen", sku: "RE1", category: "generatory", price: 9900, inStock: true, images: ["/a.jpg"] };
    const ld = seo.productLd(p, SETTINGS, site);
    assert.equal(ld["@type"], "Product");
    assert.equal(ld.url, "https://example.test/katalog/generatory/gen/");
    assert.equal(ld.offers.price, 9900);
    assert.equal(ld.offers.availability, "https://schema.org/InStock");
    assert.deepEqual(ld.image, ["https://example.test/a.jpg"]);
    assert.equal(seo.productLd({ ...p, price: null }, SETTINGS, site).offers, undefined);
  });

  test("breadcrumbLd, faqLd, articleLd, itemListLd", () => {
    const bc = seo.breadcrumbLd([{ name: "Главная", url: "/" }, { name: "Услуги", url: "/uslugi/" }], site);
    assert.equal(bc["@type"], "BreadcrumbList");
    assert.deepEqual(bc.itemListElement.map((i) => [i.position, i.item]), [[1, "https://example.test/"], [2, "https://example.test/uslugi/"]]);
    const faq = seo.faqLd([{ q: "Вопрос?", a: "Ответ" }]);
    assert.equal(faq.mainEntity[0].acceptedAnswer.text, "Ответ");
    assert.equal(seo.faqLd([]), null);
    const art = seo.articleLd({ title: "Статья", slug: "st", date: "2026-11-01", excerpt: "e" }, SETTINGS, site);
    assert.equal(art["@type"], "Article");
    assert.equal(art.datePublished, "2026-11-01");
    assert.equal(art.url, "https://example.test/stati/st/");
    const list = seo.itemListLd([{ name: "A", url: "/a/" }], site);
    assert.equal(list.itemListElement[0].url, "https://example.test/a/");
  });

  test("jsonldScript экранирует «<»", () => {
    const html = seo.jsonldScript({ name: "</script><b>" });
    assert.ok(!html.slice(0, -9).includes("</script><b>"));
    assert.equal(JSON.parse(html.replace(/^<script[^>]*>|<\/script>$/g, "")).name, "</script><b>");
  });
});

describe("валидатор контента", () => {
  test("файл без обязательного поля: русская ошибка с файлом и полем, dist не создаётся", () => {
    const content = writeFiles(tempDir("broken"), {
      "services/bad.md": "---\nslug: bad\ngroup: diagnostics\n---\nтекст\n",
    });
    const out = path.join(tempDir("out"), "site");
    const v = spawnSync(process.execPath, ["scripts/validate-content.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CONTENT_DIR: content } });
    assert.notEqual(v.status, 0);
    assert.match(v.stderr, /services[\\/]bad\.md: поле title — /);
    const b = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CONTENT_DIR: content, OUTPUT_DIR: out } });
    assert.notEqual(b.status, 0);
    assert.equal(fs.existsSync(out), false, "сборка с ошибкой не должна создавать выходную папку");
  });

  test("неверный формат и связь: pattern slug и несуществующая категория", () => {
    const content = writeFiles(tempDir("bad-format"), {
      ...VALID_CONTENT,
      "articles/test-article.md": VALID_CONTENT["articles/test-article.md"].replace("date: 2026-11-01", "date: 01.11.2026"),
      "products/test-product.md": VALID_CONTENT["products/test-product.md"].replace("category: test-category", "category: net-takoy"),
    });
    const v = spawnSync(process.execPath, ["scripts/validate-content.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CONTENT_DIR: content } });
    assert.notEqual(v.status, 0);
    assert.match(v.stderr, /test-article\.md: поле date — /);
    assert.match(v.stderr, /test-product\.md: поле category — /);
  });

  test("R25.1: пустой «Порядок» из Sveltia (order: null) проходит проверку, элемент — в конце списка", () => {
    const content = tempDir("order-null");
    fs.cpSync(path.join(ROOT, "src/content"), content, { recursive: true });
    // Sveltia сохраняет очищенное числовое поле как пустое значение.
    const svc = path.join(content, "services/diagnostika-elektriki.md");
    fs.writeFileSync(svc, fs.readFileSync(svc, "utf8").replace(/^order: 1$/m, "order:"));
    const cat = path.join(content, "categories/datchiki-i-rele.json");
    fs.writeFileSync(cat, JSON.stringify({ ...JSON.parse(fs.readFileSync(cat, "utf8")), order: null }, null, 2));
    const v = spawnSync(process.execPath, ["scripts/validate-content.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CONTENT_DIR: content } });
    assert.equal(v.status, 0, v.stderr);
    assert.equal(loadCollection("services", content).at(-1).slug, "diagnostika-elektriki");
    assert.equal(loadCollection("categories", content).at(-1).slug, "datchiki-i-rele");
  });

  test("R03.1: симптом главной с неизвестным system не проходит проверку", () => {
    const home = VALID_CONTENT["pages/home.md"].replace(
      "faq: []",
      "faq: []\nsymptoms:\n  - label: Не заводится\n    system: engine\n    service: test-service\n    hint: стартер",
    );
    const content = writeFiles(tempDir("bad-symptom"), { ...VALID_CONTENT, "pages/home.md": home });
    const v = spawnSync(process.execPath, ["scripts/validate-content.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CONTENT_DIR: content } });
    assert.notEqual(v.status, 0);
    assert.match(v.stderr, /home\.md: поле symptoms\[0\]\.system — допустимые значения: start, charge, ecu, cab, harness, climate/);
  });

  test("корректный контент проходит", () => {
    const content = writeFiles(tempDir("ok"), VALID_CONTENT);
    const v = spawnSync(process.execPath, ["scripts/validate-content.mjs"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CONTENT_DIR: content } });
    assert.equal(v.status, 0, v.stderr);
  });
});

describe("dist/ после npm run build", () => {
  const pages = htmlPages();

  test("есть страница 404 и служебные файлы", () => {
    for (const f of ["404.html", "robots.txt", "sitemap.xml", "llms.txt", ".htaccess", "favicon.ico",
      "assets/brand/favicon-32.png", "assets/brand/apple-touch-icon.png", "assets/brand/logo.png",
      "assets/css/main.css", "admin/index.html", "admin/config.yml"]) {
      assert.ok(fs.existsSync(path.join(DIST, f)), `нет dist/${f}`);
    }
    assert.ok(fs.readdirSync(path.join(DIST, "assets/fonts")).some((f) => f.endsWith(".woff2")));
  });

  test("каждая страница: один H1, title с суффиксом, description, canonical, OG, JSON-LD", () => {
    const titles = new Map();
    for (const file of pages) {
      const d = dom(file);
      const rel = path.relative(DIST, file);
      assert.equal(d.querySelectorAll("h1").length, 1, `${rel}: H1`);
      const title = d.querySelector("title")?.textContent || "";
      assert.ok(title.endsWith(SETTINGS.seo.titleSuffix), `${rel}: суффикс title`);
      assert.ok(!titles.has(title), `${rel}: title повторяет ${titles.get(title)}`);
      titles.set(title, rel);
      assert.ok(d.querySelector('meta[name="description"]')?.content, `${rel}: description`);
      assert.match(d.querySelector('link[rel="canonical"]')?.href || "", /^http:\/\/localhost:8080\//, `${rel}: canonical`);
      for (const p of ["og:title", "og:description", "og:url", "og:image", "og:type"]) {
        assert.ok(d.querySelector(`meta[property="${p}"]`)?.content, `${rel}: ${p}`);
      }
      assert.ok(d.querySelector('meta[name="twitter:card"]'), `${rel}: twitter:card`);
      const types = ldTypes(d);
      assert.ok(types.includes("Organization") && types.includes("AutoRepair"), `${rel}: Organization + AutoRepair`);
      assert.equal(ldNode(d, "AutoRepair").telephone, "+79620011990");
      assert.deepEqual(ldNode(d, "AutoRepair").areaServed.map((a) => a.name), REGIONS);
    }
  });

  test("без INDEXABLE: noindex на страницах и Disallow: / в robots.txt", () => {
    for (const file of pages) {
      assert.equal(dom(file).querySelector('meta[name="robots"]')?.content, "noindex,nofollow", path.relative(DIST, file));
    }
    assert.match(read("robots.txt"), /User-agent: \*\s+Disallow: \/\s*$/);
  });

  test("шапка и подвал: логотип, телефон tel:, корзина, мобильное меню; модальное окно и баннер согласия", () => {
    const d = dom(path.join(DIST, "404.html"));
    assert.ok(d.querySelector("header img[src*='logo'], header picture"), "логотип в шапке");
    assert.ok(d.querySelector("footer img[src*='logo'], footer picture"), "логотип в подвале");
    assert.ok(d.querySelector('header a[href="tel:+79620011990"]'), "телефон в шапке");
    assert.ok(d.querySelector('footer a[href="tel:+79620011990"]'), "телефон в подвале");
    assert.ok(d.querySelector("header [data-cart-count]"), "счётчик корзины");
    assert.ok(d.querySelector("#nav-toggle") && d.querySelector('label[for="nav-toggle"]'), "мобильное меню");
    assert.ok(d.querySelector('#zayavka form[data-lead-form="callback"]'), "модальное окно с формой");
    assert.ok(d.querySelector("[data-consent-banner]"), "баннер согласия");
    assert.ok(d.querySelector('link[rel="icon"][href="/favicon.ico"]') && d.querySelector('link[rel="apple-touch-icon"]'));
    assert.ok(d.querySelector('meta[name="theme-color"]'));
    assert.ok(d.querySelector('link[rel="preload"][as="font"]'), "preload шрифта");
    for (const a of d.querySelectorAll("header nav a[href^='/']")) assert.ok(resolveLocal(a.getAttribute("href")), "меню ведёт в 404");
  });

  test("R11: подвал ведёт на «Где работаем» без перечня краёв; края остаются в JSON-LD", () => {
    const d = dom(path.join(DIST, "index.html"));
    const footer = d.querySelector("footer");
    assert.ok(footer.querySelector('a[href="/regiony/"]'), "нет ссылки /regiony/ в подвале");
    for (const r of REGIONS) assert.ok(!footer.textContent.includes(r), `край «${r}» в подвале`);
    assert.ok(!footer.querySelector('a[href^="/regiony/"][href$="-kraj/"]'), "ссылки на края в подвале");
    assert.deepEqual(ldNode(d, "AutoRepair").areaServed.map((a) => a.name), REGIONS);
  });

  test("R11: первый экран главной не показывает края из настроек", () => {
    const hero = dom(path.join(DIST, "index.html")).querySelector("main .hero");
    assert.ok(hero, "нет первого экрана .hero");
    // H1 — текст из контента (его переписывает тикет 03); шаблон сам краёв не добавляет.
    const rest = hero.cloneNode(true);
    rest.querySelector("h1")?.remove();
    for (const r of REGIONS) assert.ok(!rest.textContent.includes(r), `«${r}» на первом экране`);
  });

  test("R04: мобильная панель «Позвонить» и «Заявка», шрифты Unbounded и Golos Text без Manrope", () => {
    const d = dom(path.join(DIST, "index.html"));
    const bar = d.querySelector(".contact-fab");
    assert.ok(bar.querySelector('a[href="tel:+79620011990"]'), "Позвонить");
    assert.ok(bar.querySelector('a[href="#zayavka"][data-lead-open]'), "Заявка");
    const css = read("assets/css/main.css");
    assert.doesNotMatch(css, /manrope/i);
    assert.doesNotMatch(read("index.html"), /manrope/i);
    for (const family of ["Unbounded", "Golos Text"]) assert.match(css, new RegExp(`font-family:\\s*"?${family}"?;[^}]*font-display:\\s*swap`), family);
    const preload = [...d.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute("href"));
    assert.ok(preload.some((h) => /unbounded|golos/.test(h)), preload.join());
    for (const h of preload) assert.ok(fs.existsSync(path.join(DIST, h)), h);
  });

  test("меню в шапке и подвале ведёт на собранные разделы", () => {
    const d = dom(path.join(DIST, "index.html"));
    for (const url of ["/uslugi/", "/katalog/", "/kontakty/"]) {
      assert.ok(d.querySelector(`header nav a[href="${url}"]`), `нет ${url} в меню шапки`);
      assert.ok(d.querySelector(`footer nav a[href="${url}"]`), `нет ${url} в подвале`);
    }
    assert.ok(d.querySelectorAll("header nav li").length <= 7, "в меню не больше 7 пунктов");
  });

  test("стили подключены только из <head>, без inline <style>", () => {
    for (const file of pages) {
      const d = dom(file);
      const rel = path.relative(DIST, file);
      assert.equal(d.querySelectorAll("style").length, 0, `${rel}: <style>`);
      for (const l of d.querySelectorAll('link[rel="stylesheet"]')) assert.equal(l.parentElement.tagName, "HEAD", `${rel}: stylesheet вне head`);
    }
  });

  test("форма заявки по контракту §5", () => {
    const form = dom(path.join(DIST, "404.html")).querySelector("form[data-lead-form]");
    for (const name of ["name", "phone", "message", "service", "page", "consent", "consentVersion", "website", "startedAt"]) {
      assert.ok(form.querySelector(`[name="${name}"]`), `поле ${name}`);
    }
    assert.equal(form.querySelector('[name="phone"]').type, "tel");
    assert.ok(form.querySelector('[name="consent"][type="checkbox"][required]'));
    assert.equal(form.querySelector('[name="consentVersion"]').value, SETTINGS.consentVersion);
    assert.ok(form.querySelector('[data-error-for="phone"]') && form.querySelector("[data-form-status]"));
  });

  test("внутренние ссылки ведут на существующие файлы", () => {
    for (const file of pages) {
      for (const ref of localRefs(dom(file))) assert.ok(resolveLocal(ref), `${path.relative(DIST, file)} → ${ref}`);
    }
  });

  test("бюджет: JS ≤ 30 КБ и CSS ≤ 40 КБ в gzip на страницу", () => {
    for (const file of pages) {
      const d = dom(file);
      const js = pageJs(d).reduce((s, f) => s + gzipSize(f), 0);
      const css = pageCss(d).reduce((s, f) => s + gzipSize(f), 0);
      assert.ok(js <= 30 * 1024, `${path.relative(DIST, file)}: JS ${js} Б`);
      assert.ok(css <= 40 * 1024, `${path.relative(DIST, file)}: CSS ${css} Б`);
      assert.ok(css > 0, "CSS подключён");
    }
  });

  test("sitemap.xml и llms.txt собираются", () => {
    const xml = new JSDOM(read("sitemap.xml"), { contentType: "text/xml" }).window.document;
    assert.equal(xml.documentElement.nodeName, "urlset");
    assert.match(read("sitemap.xml"), /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
    const llms = read("llms.txt");
    assert.match(llms, /^# АГРОВОЛЬТАЖ/);
    assert.match(llms, /\+7 962 001 19 90/);
    for (const r of REGIONS) assert.ok(llms.includes(r));
  });

  test("/admin/: Sveltia с закреплённой версией и конфиг всех коллекций", () => {
    const html = read("admin/index.html");
    assert.match(html, /https:\/\/unpkg\.com\/@sveltia\/cms@\d+\.\d+\.\d+\/dist\/sveltia-cms\.js/);
    const yml = read("admin/config.yml");
    for (const name of ["services", "categories", "products", "articles", "regions", "pages", "settings"]) {
      assert.match(yml, new RegExp(`- name: ${name}\\b`), `коллекция ${name}`);
    }
    assert.match(yml, /repo: alexdubaev-web\/agrovoltage/);
    assert.match(yml, /media_folder: src\/assets\/uploads/);
  });
});

describe("тестовая сборка с контентом и INDEXABLE=true", () => {
  let out;
  before(() => {
    out = path.join(tempDir("fixture"), "site");
    const content = writeFiles(tempDir("content"), VALID_CONTENT);
    const r = fixtureBuild({ outDir: out, contentDir: content, env: { INDEXABLE: "true", SITE_URL: "https://example.test" } });
    assert.equal(r.status, 0, r.stderr);
  });

  test("индексация открыта, robots с Clean-param и Sitemap", () => {
    const d = dom(path.join(out, "index.html"));
    assert.equal(d.querySelector('meta[name="robots"]'), null);
    assert.equal(d.querySelector('link[rel="canonical"]').href, "https://example.test/");
    const robots = read("robots.txt", out);
    assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
    assert.match(robots, /Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&yclid&gclid&ysclid/);
    assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
  });

  test("страница услуги: seo, хлебные крошки, JSON-LD из данных страницы", () => {
    const d = dom(path.join(out, "uslugi/test-service/index.html"));
    assert.equal(d.querySelector("title").textContent, `Диагностика электрики John Deere${SETTINGS.seo.titleSuffix}`);
    assert.equal(d.querySelector('meta[name="description"]').content, "Тестовое описание услуги");
    assert.equal(d.querySelector('meta[property="og:image"]').content, "https://example.test/assets/brand/og-default.png");
    assert.ok(d.querySelector("nav.breadcrumbs a[href='/']"));
    const types = ldTypes(d);
    for (const t of ["Organization", "AutoRepair", "Service", "FAQPage", "BreadcrumbList"]) assert.ok(types.includes(t), t);
    const form = d.querySelector('form[data-lead-form="service"]');
    assert.equal(form.querySelector('[name="service"]').value, "Диагностика электрики");
    assert.ok(d.querySelector('label[for="svc-phone"]') && d.querySelector("#svc-phone"), "id полей уникальны для формы");
  });

  test("sitemap: страницы с lastmod и image:image, без noindex-страниц", () => {
    const xml = read("sitemap.xml", out);
    assert.match(xml, /<loc>https:\/\/example\.test\/uslugi\/test-service\/<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    assert.match(xml, /<image:loc>https:\/\/example\.test\/assets\/brand\/og-default\.png<\/image:loc>/);
    assert.doesNotMatch(xml, /404/);
  });

  test("llms.txt перечисляет услуги, регионы и статьи из коллекций", () => {
    const llms = read("llms.txt", out);
    assert.match(llms, /\[Диагностика электрики\]\(https:\/\/example\.test\/uslugi\/test-service\/\)/);
    assert.match(llms, /https:\/\/example\.test\/regiony\/test-region\//);
    assert.match(llms, /https:\/\/example\.test\/stati\/test-article\//);
  });

  test("пустые коллекции не ломают сборку", () => {
    const empty = path.join(tempDir("empty-out"), "site");
    const r = fixtureBuild({ outDir: empty, contentDir: tempDir("empty-content") });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(path.join(empty, "sitemap.xml")) && fs.existsSync(path.join(empty, "llms.txt")));
  });
});
