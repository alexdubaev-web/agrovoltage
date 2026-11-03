// Каталог (interfaces.md §1, §3, §4): контент, страницы dist/, JSON-LD, index.json, поиск.
// Страницы читаются из dist/, поэтому перед запуском нужен `npm run build` (его делает `npm test`).
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { ROOT, DIST, dom, ldNode, ldTypes } from "./helpers/dist.mjs";
import { tempDir, writeFiles } from "./helpers/fixture.mjs";
import { validateContent } from "../scripts/validate-content.mjs";

const SEARCH_JS = new URL("../src/assets/js/catalog-search.js", import.meta.url).href;
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(DIST, rel), "utf8"));
const page = (url) => dom(path.join(DIST, url, "index.html"));
const index = () => readJson("katalog/index.json");

describe("контент каталога", () => {
  const categories = fs.readdirSync(path.join(ROOT, "src/content/categories")).filter((f) => f.endsWith(".json"));
  const products = fs.readdirSync(path.join(ROOT, "src/content/products")).filter((f) => f.endsWith(".md"));

  test("4 категории и 12 товаров проходят проверку схем", () => {
    assert.equal(categories.length, 4);
    assert.equal(products.length, 12);
    // Только файлы каталога: чужие коллекции проверяют их тикеты.
    assert.deepEqual(validateContent().filter((e) => /[\\/](products|categories)[\\/]/.test(e)), []);
  });

  test("все товары: demo, совместимость с John Deere, цена число или null, категория существует", () => {
    const slugs = new Set(categories.map((f) => f.replace(/\.json$/, "")));
    for (const file of products) {
      const text = fs.readFileSync(path.join(ROOT, "src/content/products", file), "utf8");
      assert.match(text, /^demo: true$/m, `${file}: demo`);
      assert.match(text, /^\s+- "John Deere /m, `${file}: совместимость`);
      assert.match(text, /^price: (null|\d+)$/m, `${file}: цена`);
      const category = text.match(/^category: (.+)$/m)[1];
      assert.ok(slugs.has(category), `${file}: категория ${category}`);
    }
    assert.ok(products.some((f) => /^price: null$/m.test(fs.readFileSync(path.join(ROOT, "src/content/products", f), "utf8"))), "есть товар «по запросу»");
  });
});

describe("страницы каталога в dist/", () => {
  test("собраны /katalog/, 4 категории и 12 товаров", () => {
    const items = index();
    assert.equal(items.length, 12);
    assert.ok(fs.existsSync(path.join(DIST, "katalog", "index.html")));
    const categories = new Set(items.map((i) => i.category));
    assert.equal(categories.size, 4);
    for (const c of categories) assert.ok(fs.existsSync(path.join(DIST, "katalog", c, "index.html")), c);
    for (const i of items) assert.ok(fs.existsSync(path.join(DIST, i.url, "index.html")), i.url);
  });

  test("index.json: поля из interfaces.md §4, цена число или null, адрес совпадает с адресом страницы", () => {
    for (const i of index()) {
      assert.deepEqual(Object.keys(i).sort(), ["category", "image", "inStock", "price", "sku", "slug", "title", "url"]);
      assert.ok(i.price === null || typeof i.price === "number");
      assert.equal(typeof i.inStock, "boolean");
      assert.equal(i.url, `/katalog/${i.category}/${i.slug}/`);
    }
  });

  test("карточка товара: артикул, цена, наличие, совместимость, характеристики, «В корзину»", () => {
    const item = index().find((i) => i.slug === "generator-14v-150a");
    const doc = page(item.url);
    const text = doc.querySelector("main").textContent.replace(/\s+/g, " ");
    assert.match(text, /Артикул: AGV-T-0301/);
    assert.match(text, /18\s900 ₽/);
    assert.match(text, /В наличии/);
    assert.match(text, /John Deere 7230R/);
    assert.match(text, /Характеристики/);
    const buy = doc.querySelector("[data-add-to-cart]");
    assert.equal(buy.getAttribute("data-slug"), "generator-14v-150a");
    assert.equal(buy.getAttribute("data-price"), "18900");
    const photo = doc.querySelector("main .product__media picture img");
    assert.ok(photo, "с фото выводится picture/img");
    assert.match(photo.getAttribute("src"), /generator-14v-150a/);
    assert.equal(doc.querySelector("main .product-ph"), null, "заглушки при наличии фото нет");
  });

  test("R32i: значения характеристик переносятся, nowrap таблицы цен на .product__specs не действует", () => {
    // jsdom не считает раскладку, поэтому проверяется вычисленный стиль ячеек с main.css.
    // Ширину 360 px (scrollWidth <= clientWidth) проверяли в браузере на длинном значении.
    const { url } = index()[0];
    const html = fs.readFileSync(path.join(DIST, url, "index.html"), "utf8");
    const css = fs.readFileSync(path.join(DIST, "assets/css/main.css"), "utf8");
    const win = new JSDOM(html.replace("</head>", `<style>${css}</style></head>`)).window;
    const cells = [...win.document.querySelectorAll(".product__specs td, .product__specs th")];
    assert.ok(cells.length > 0, "у товара есть характеристики");
    for (const cell of cells) {
      assert.notEqual(win.getComputedStyle(cell).whiteSpace, "nowrap", cell.textContent);
      assert.equal(win.getComputedStyle(cell).overflowWrap, "anywhere", cell.textContent);
    }
  });

  test("товар с ценой null: «по запросу», пустая цена в кнопке", () => {
    const item = index().find((i) => i.price === null);
    const doc = page(item.url);
    assert.match(doc.querySelector(".product__price").textContent, /по запросу/);
    assert.equal(doc.querySelector("[data-add-to-cart]").getAttribute("data-price"), "");
  });

  test("JSON-LD товара: Product с Offer; при цене null Offer без price; BreadcrumbList на 4 уровня", () => {
    const withPrice = page(index().find((i) => i.slug === "generator-14v-150a").url);
    const product = ldNode(withPrice, "Product");
    assert.equal(product.offers.price, 18900);
    assert.equal(product.offers.priceCurrency, "RUB");
    assert.equal(ldNode(withPrice, "BreadcrumbList").itemListElement.length, 4);

    const onRequest = page(index().find((i) => i.price === null).url);
    const offer = ldNode(onRequest, "Product").offers;
    assert.equal(offer["@type"], "Offer");
    assert.equal("price" in offer, false);
  });

  test("JSON-LD списков: ItemList на каталоге (категории) и в категории (товары)", () => {
    assert.ok(ldTypes(page("/katalog/")).includes("ItemList"));
    const catalogList = ldNode(page("/katalog/"), "ItemList");
    assert.equal(catalogList.itemListElement.length, 4);
    const first = index()[0].category;
    const inCategory = index().filter((i) => i.category === first);
    const list = ldNode(page(`/katalog/${first}/`), "ItemList");
    assert.equal(list.itemListElement.length, inCategory.length);
  });

  test("F2: списки без поиска — 12 карточек на /katalog/, в категории столько карточек, сколько товаров", () => {
    const items = index();
    const catalog = page("/katalog/");
    const cards = catalog.querySelectorAll("[data-catalog-browse] [data-product-card]");
    assert.equal(cards.length, 12, "карточки под «Все товары»");
    for (const card of cards) {
      assert.ok(card.querySelector("h3 a[href^='/katalog/']"), "в карточке ссылка на товар");
      assert.ok(card.querySelector("[data-add-to-cart][data-slug]"), "в карточке кнопка «В корзину»");
    }
    assert.doesNotMatch(catalog.querySelector("main").textContent, /Скоро появятся/);
    for (const category of new Set(items.map((i) => i.category))) {
      const expected = items.filter((i) => i.category === category);
      const link = catalog.querySelector(`[data-catalog-browse] .card p a[href="/katalog/${category}/"]`);
      assert.equal(link.textContent.trim(), `Товаров: ${expected.length}`, category);
      const doc = page(`/katalog/${category}/`);
      const slugs = [...doc.querySelectorAll("main [data-product-card] [data-add-to-cart]")].map((b) => b.dataset.slug);
      assert.deepEqual(slugs.sort(), expected.map((i) => i.slug).sort(), category);
      assert.doesNotMatch(doc.querySelector("main").textContent, /Товары скоро появятся/, category);
    }
  });

  test("/katalog/ подключает поиск, форма поиска скрыта до загрузки JS", () => {
    const doc = page("/katalog/");
    assert.ok(doc.querySelector('script[src="/assets/js/catalog-search.js"]'));
    assert.equal(doc.querySelector("[data-catalog-search]").hasAttribute("hidden"), true);
    assert.equal(doc.querySelector("[data-search-empty] a[data-lead-open]").textContent.trim(), "Спросить менеджера");
  });

  test("корзина: noindex, вне sitemap, форма заказа с type=order", () => {
    const doc = page("/korzina/");
    assert.match(doc.querySelector('meta[name="robots"]').content, /noindex/);
    assert.ok(doc.querySelector('form[data-lead-form="order"]'));
    assert.equal(fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8").includes("/korzina/"), false);
    assert.ok(fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8").includes("/katalog/"));
  });
});

describe("пустой каталог и пустая категория", () => {
  const dirs = [];
  afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  function build(files) {
    const content = writeFiles(tempDir("catalog-content"), files);
    const out = tempDir("catalog-out");
    dirs.push(content, out);
    const run = spawnSync(process.execPath, ["scripts/build.mjs"], {
      cwd: ROOT,
      env: { ...process.env, CONTENT_DIR: content, OUTPUT_DIR: out },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    return out;
  }

  test("категория без товаров: «Товары скоро появятся» и форма", () => {
    const out = build({
      "categories/pusto.json": JSON.stringify({ title: "Пустая категория", slug: "pusto", order: 1 }),
    });
    const doc = dom(path.join(out, "katalog", "pusto", "index.html"));
    assert.match(doc.querySelector("main").textContent, /Товары скоро появятся/);
    assert.ok(doc.querySelector("main form[data-lead-form]"));
    assert.equal(doc.querySelector("main [data-product-card]"), null);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, "katalog", "index.json"), "utf8")), []);
  });

  test("F2: «Скоро появятся» только у пустой категории, у полной — число товаров и карточка", () => {
    const out = build({
      "categories/pusto.json": JSON.stringify({ title: "Пустая", slug: "pusto", order: 1 }),
      "categories/polno.json": JSON.stringify({ title: "Полная", slug: "polno", order: 2 }),
      "products/tovar.md": [
        "---", "title: Товар", "slug: tovar", "sku: T-2", "category: polno", "price: 100", "inStock: true",
        "compatibility: [John Deere 6155M]", "images: []", "summary: Тест", "demo: true", "seo: {}", "---", "Описание.", "",
      ].join("\n"),
    });
    const catalog = dom(path.join(out, "katalog", "index.html"));
    assert.equal(catalog.querySelector('.card p a[href="/katalog/pusto/"]').textContent.trim(), "Скоро появятся");
    assert.equal(catalog.querySelector('.card p a[href="/katalog/polno/"]').textContent.trim(), "Товаров: 1");
    assert.equal(catalog.querySelectorAll("main [data-product-card]").length, 1);
    const full = dom(path.join(out, "katalog", "polno", "index.html"));
    assert.equal(full.querySelectorAll("main [data-product-card]").length, 1);
  });

  test("товар без фото: показана заглушка, а не picture", () => {
    const out = build({
      "categories/kat.json": JSON.stringify({ title: "Категория", slug: "kat", description: "Тест", image: "", order: 1, seo: {} }),
      "products/bez-foto.md": [
        "---", "title: Товар без фото", "slug: bez-foto", "sku: T-1", "category: kat", "price: null", "inStock: true",
        "compatibility: [John Deere 6155M]", "images: []", "summary: Тест", "demo: true", "seo: {}", "---", "Описание.", "",
      ].join("\n"),
    });
    const doc = dom(path.join(out, "katalog", "kat", "bez-foto", "index.html"));
    assert.ok(doc.querySelector("main .product-ph"), "без фото показана заглушка");
    assert.equal(doc.querySelector("main .product__media picture"), null);
  });

  test("каталог без товаров вообще: «Товары скоро появятся» и форма на /katalog/", () => {
    const out = build({});
    const doc = dom(path.join(out, "katalog", "index.html"));
    assert.match(doc.querySelector("main").textContent, /Товары скоро появятся/);
    assert.ok(doc.querySelector("main form[data-lead-form]"));
  });
});

describe("catalog-search.js", () => {
  let current = null;
  afterEach(() => current?.window.close());
  let n = 0;

  const ITEMS = [
    { slug: "datchik-davleniya-masla", title: "Датчик давления масла", sku: "AGV-T-0102", category: "c", price: null, inStock: true, url: "/katalog/c/datchik-davleniya-masla/", image: "" },
    { slug: "generator", title: "Генератор 14 В, 150 А", sku: "AGV-T-0301", category: "c", price: 18900, inStock: true, url: "/katalog/c/generator/", image: "" },
    { slug: "elka", title: "Ёлочка уплотнитель", sku: "X 77.1", category: "c", price: 10, inStock: false, url: "/katalog/c/elka/", image: "" },
  ];
  const load = () => import(`${SEARCH_JS}?run=${++n}`);

  test("ищет по названию без учёта регистра и по всем словам запроса", async () => {
    const { searchCatalog } = await load();
    assert.deepEqual(searchCatalog(ITEMS, "ДАТЧИК масла").map((i) => i.slug), ["datchik-davleniya-masla"]);
    assert.deepEqual(searchCatalog(ITEMS, "датчик генератор"), []);
  });

  test("ищет по артикулу целиком, по части и без дефисов; «ё» = «е»", async () => {
    const { searchCatalog } = await load();
    assert.deepEqual(searchCatalog(ITEMS, "agv-t-0301").map((i) => i.slug), ["generator"]);
    assert.deepEqual(searchCatalog(ITEMS, "agvt0102").map((i) => i.slug), ["datchik-davleniya-masla"]);
    assert.deepEqual(searchCatalog(ITEMS, "x77").map((i) => i.slug), ["elka"]);
    assert.deepEqual(searchCatalog(ITEMS, "елочка").map((i) => i.slug), ["elka"]);
  });

  test("пустой запрос ничего не возвращает", async () => {
    const { searchCatalog } = await load();
    assert.deepEqual(searchCatalog(ITEMS, "   "), []);
  });

  function mount() {
    const html = fs.readFileSync(path.join(DIST, "katalog", "index.html"), "utf8");
    current = new JSDOM(html, { url: "http://localhost/katalog/" });
    const win = current.window;
    for (const [k, v] of Object.entries({ window: win, document: win.document, location: win.location, history: win.history })) {
      Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    }
    Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: async () => ({ ok: true, json: async () => ITEMS }) });
    return win;
  }
  const typeQuery = (win, q) => {
    const input = win.document.querySelector("#catalog-q");
    input.value = q;
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  };

  test("страница: результаты поиска показываются, список «Все товары» скрывается", async () => {
    const win = mount();
    const { initCatalogSearch } = await load();
    await initCatalogSearch(win.document);
    assert.equal(win.document.querySelector("[data-catalog-search]").hidden, false);
    typeQuery(win, "генератор");
    assert.equal(win.document.querySelectorAll("[data-search-list] [data-product-card]").length, 1);
    assert.equal(win.document.querySelector("[data-catalog-browse]").hidden, true);
    assert.equal(win.document.querySelector("[data-search-empty]").hidden, true);
  });

  test("страница: пустой результат — «Ничего не нашли» и кнопка «Спросить менеджера» с текстом запроса", async () => {
    const win = mount();
    const { initCatalogSearch } = await load();
    await initCatalogSearch(win.document);
    typeQuery(win, "турбина");
    const empty = win.document.querySelector("[data-search-empty]");
    assert.equal(empty.hidden, false);
    assert.match(empty.textContent, /Ничего не нашли/);
    const ask = empty.querySelector("a[data-lead-open]");
    assert.equal(ask.getAttribute("href"), "#zayavka");
    assert.equal(ask.getAttribute("data-message"), "Запрос по каталогу: турбина");
  });
});
