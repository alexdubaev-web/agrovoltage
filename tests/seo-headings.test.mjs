// SEO-правила по всему собранному сайту (spec.md, история 11; interfaces.md «Тестовые швы»).
// Страницы читаются из dist/ (кроме admin/), перед запуском нужен `npm run build` (его делает `npm test`).
// Каждая проверка собирает все нарушения и выводит их списком: так видно, какие страницы править.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, DIST, htmlPages, dom } from "./helpers/dist.mjs";

const SETTINGS = JSON.parse(fs.readFileSync(path.join(ROOT, "src/_data/settings.json"), "utf8"));
const CATALOG = JSON.parse(fs.readFileSync(path.join(DIST, "katalog", "index.json"), "utf8"));
const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const url = (file) => "/" + path.relative(DIST, file).split(path.sep).join("/").replace(/index\.html$/, "");

const pages = htmlPages().map((file) => ({ file, url: url(file), doc: dom(file) }));
const meta = (doc) => doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";

// Названия краёв — из src/content/regions/*.md (title), независимо от шаблонов.
const REGION_TITLES = Object.fromEntries(
  fs.readdirSync(path.join(ROOT, "src/content/regions"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => [f.replace(/\.md$/, ""), fs.readFileSync(path.join(ROOT, "src/content/regions", f), "utf8").match(/^title: (.+)$/m)[1].trim()]),
);

describe("SEO по всему dist/", () => {
  test("страниц найдено достаточно", () => {
    assert.ok(pages.length >= 30, `страниц: ${pages.length}`);
  });

  test("ровно один H1 на странице", () => {
    const bad = pages.filter((p) => p.doc.querySelectorAll("h1").length !== 1).map((p) => `${p.url}: ${p.doc.querySelectorAll("h1").length}`);
    assert.deepEqual(bad, []);
  });

  test("заголовки идут без пропусков уровней, первый — H1", () => {
    const bad = [];
    for (const p of pages) {
      const levels = [...p.doc.body.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => ({ n: Number(h.tagName[1]), t: text(h) }));
      if (levels.length && levels[0].n !== 1) bad.push(`${p.url}: первый заголовок H${levels[0].n} «${levels[0].t}»`);
      for (let i = 1; i < levels.length; i++) {
        if (levels[i].n > levels[i - 1].n + 1) bad.push(`${p.url}: H${levels[i - 1].n} → H${levels[i].n} «${levels[i].t}»`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("title уникален, 50–70 символов и не повторяет H1", () => {
    const bad = [];
    const seen = new Map();
    for (const p of pages) {
      const title = text(p.doc.querySelector("title"));
      if (title.length < 50 || title.length > 70) bad.push(`${p.url}: ${title.length} «${title}»`);
      if (seen.has(title)) bad.push(`${p.url}: повторяет ${seen.get(title)}`);
      seen.set(title, p.url);
      const own = title.endsWith(SETTINGS.seo.titleSuffix) ? title.slice(0, -SETTINGS.seo.titleSuffix.length) : title;
      if (own === text(p.doc.querySelector("h1"))) bad.push(`${p.url}: title совпадает с H1`);
    }
    assert.deepEqual(bad, []);
  });

  test("H1 уникален по всему сайту", () => {
    const bad = [];
    const seen = new Map();
    for (const p of pages) {
      const h1 = text(p.doc.querySelector("h1"));
      if (seen.has(h1)) bad.push(`${p.url}: H1 «${h1}» повторяет ${seen.get(h1)}`);
      else seen.set(h1, p.url);
    }
    assert.deepEqual(bad, []);
  });

  test("description уникален, 120–160 символов", () => {
    const bad = [];
    const seen = new Map();
    for (const p of pages) {
      const d = meta(p.doc).trim();
      if (d.length < 120 || d.length > 160) bad.push(`${p.url}: ${d.length}`);
      if (seen.has(d)) bad.push(`${p.url}: повторяет ${seen.get(d)}`);
      seen.set(d, p.url);
    }
    assert.deepEqual(bad, []);
  });

  test("у содержательных картинок в контенте есть alt", () => {
    const bad = [];
    for (const p of pages) {
      for (const img of p.doc.querySelectorAll("main picture img")) {
        if (!img.hasAttribute("alt")) bad.push(`${p.url}: нет alt у ${img.getAttribute("src")}`);
        // Картинка внутри aria-hidden дублирует соседнюю ссылку, ей alt может быть любым.
        else if (!img.closest("[aria-hidden='true']") && !img.getAttribute("alt").trim()) bad.push(`${p.url}: пустой alt у ${img.getAttribute("src")}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe("главный запрос в H1", () => {
  const h1 = (u) => text(pages.find((p) => p.url === u)?.doc.querySelector("h1"));

  test("«John Deere» в H1 главной, /uslugi/ и каждой услуги", () => {
    const urls = pages.map((p) => p.url).filter((u) => u === "/" || u.startsWith("/uslugi/"));
    assert.ok(urls.length >= 9, urls.join());
    const bad = urls.filter((u) => !/John Deere/.test(h1(u))).map((u) => `${u}: «${h1(u)}»`);
    assert.deepEqual(bad, []);
  });

  test("регион в H1 страницы региона", () => {
    const bad = Object.entries(REGION_TITLES).filter(([slug, name]) => !h1(`/regiony/${slug}/`).includes(name)).map(([slug]) => `/regiony/${slug}/: «${h1(`/regiony/${slug}/`)}»`);
    assert.deepEqual(bad, []);
  });

  test("название товара в H1 товара", () => {
    assert.ok(CATALOG.length > 0);
    const bad = CATALOG.filter((i) => !h1(i.url).includes(i.title)).map((i) => `${i.url}: «${h1(i.url)}»`);
    assert.deepEqual(bad, []);
  });
});
