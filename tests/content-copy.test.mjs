// Тексты и SEO-поля в данных (G02, G03, R11): без штампов и выдуманных фактов,
// длины title/description как у готовой страницы, края — только там, где им место.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { ROOT } from "./helpers/dist.mjs";

const CONTENT = path.join(ROOT, "src/content");
const SETTINGS_FILE = path.join(ROOT, "src/_data/settings.json");
const SETTINGS = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
const SUFFIX = SETTINGS.seo.titleSuffix || "";

function load(dir) {
  const full = path.join(CONTENT, dir);
  return fs.readdirSync(full).filter((f) => /\.(md|json)$/.test(f)).map((f) => {
    const raw = fs.readFileSync(path.join(full, f), "utf8");
    if (f.endsWith(".json")) return { file: `${dir}/${f}`, raw, data: JSON.parse(raw), body: "" };
    const { data, content } = matter(raw);
    return { file: `${dir}/${f}`, raw, data, body: content };
  });
}

const services = load("services");
const products = load("products");
const categories = load("categories");
const articles = load("articles");
const regions = load("regions");
const pages = load("pages");
const all = [...services, ...products, ...categories, ...articles, ...regions, ...pages];
const home = pages.find((p) => p.data.slug === "home").data;

// История 10: продающие штампы.
const STOCK = ["качественно", "индивидуальный подход", "команда профессионалов", "широкий спектр", "в кратчайшие сроки", "выгодные цены"];
// Выдуманные факты о компании: стаж, гарантия со сроком, число клиентов.
const FACTS = [
  /\d+\s*\+?\s*(лет|года|год)\s+(опыта|на рынке|работы|в профессии)/i,
  /(опыт|стаж)\w*\s+(более\s+|свыше\s+)?\d+/i,
  /гаранти\w*\s+(на\s+\S+\s+)?(до\s+)?\d+/i,
  /\d[\d\s]*\+?\s*(довольных\s+)?клиент/i,
];
// Края показываются только на страницах регионов, контактов и доставки (история 17).
const REGION_WORDS = /Ставропол|Краснодар|Кубан/i;

describe("тексты без штампов и выдуманных фактов", () => {
  const sources = [...all.map((u) => [u.file, u.raw]), ["settings.json", fs.readFileSync(SETTINGS_FILE, "utf8")]];

  test("нет стоп-штампов", () => {
    for (const [file, raw] of sources)
      for (const phrase of STOCK) assert.ok(!raw.toLowerCase().includes(phrase), `${file}: «${phrase}»`);
  });

  test("нет выдуманных фактов: стаж, гарантия N, число клиентов", () => {
    for (const [file, raw] of sources) for (const re of FACTS) assert.ok(!re.test(raw), `${file}: ${raw.match(re)?.[0]}`);
  });
});

describe("SEO-поля в данных", () => {
  test("у каждой единицы контента title 50–70 (с суффиксом) и description 120–160, без повторов", () => {
    const titles = new Map();
    const descriptions = new Map();
    for (const { file, data } of all) {
      const seo = data.seo || {};
      assert.ok(seo.title, `${file}: нет seo.title`);
      assert.ok(seo.description, `${file}: нет seo.description`);
      const title = seo.title + SUFFIX;
      assert.ok(title.length >= 50 && title.length <= 70, `${file}: title ${title.length} — «${title}»`);
      assert.ok(seo.description.length >= 120 && seo.description.length <= 160, `${file}: description ${seo.description.length}`);
      assert.ok(!titles.has(title), `${file}: title повторяет ${titles.get(title)}`);
      assert.ok(!descriptions.has(seo.description), `${file}: description повторяет ${descriptions.get(seo.description)}`);
      titles.set(title, file);
      descriptions.set(seo.description, file);
    }
  });

  test("главный запрос с John Deere: главная, услуги, товары, категории", () => {
    assert.match(home.hero.title, /John Deere/, "H1 главной");
    for (const { file, data } of [...pages.filter((p) => p.data.slug === "home"), ...services, ...products, ...categories])
      assert.match(data.seo.title, /John Deere/, `${file}: seo.title`);
  });

  test("регион в SEO-полях страниц краёв", () => {
    for (const { file, data } of regions) {
      const stem = data.title.slice(0, 8);
      assert.ok(data.seo.title.includes(stem), `${file}: край в title`);
      assert.ok(data.seo.description.includes(stem), `${file}: край в description`);
    }
  });

  test("description настроек по умолчанию — 120–160 и без краёв", () => {
    const d = SETTINGS.seo.defaultDescription;
    assert.ok(d.length >= 120 && d.length <= 160, `длина ${d.length}`);
    assert.ok(!REGION_WORDS.test(d));
  });
});

describe("края — только в регионах, контактах и доставке", () => {
  test("нет названий краёв в услугах, товарах, категориях, статьях, главной, «О компании» и документах", () => {
    const outside = [...services, ...products, ...categories, ...articles, ...pages.filter((p) => p.data.slug !== "delivery")];
    for (const { file, raw } of outside) assert.ok(!REGION_WORDS.test(raw), `${file}: ${raw.match(REGION_WORDS)?.[0]}`);
  });
});

describe("структура текстов", () => {
  test("лид под H1 не длиннее 220 символов", () => {
    const leads = [
      ["home hero.lead", home.hero.lead],
      ...services.map((u) => [u.file, u.data.summary]),
      ...products.map((u) => [u.file, u.data.summary]),
      ...categories.map((u) => [u.file, u.data.description]),
      ...articles.map((u) => [u.file, u.data.excerpt]),
      ...regions.map((u) => [u.file, u.data.lead]),
      ...pages.filter((u) => u.data.lead).map((u) => [u.file, u.data.lead]),
    ];
    for (const [file, lead] of leads) {
      assert.ok(lead, `${file}: нет лида`);
      assert.ok(lead.length <= 220, `${file}: лид ${lead.length}`);
    }
  });

  // Конкретный узел: слово из словаря узлов электрики и климата техники.
  const NODE = /стартер|генератор|АКБ|аккумулятор|реле|предохранител|датчик|разъём|жгут|провод|клемм|масс[аеуы]|ЭБУ|блок|шин[аеуы] CAN|CAN|компрессор|муфт|конденсатор|испарител|осушител|шланг|клапан|хладагент|фар|монитор|вентилятор|стеклоочистител|омывател|джойстик|подлокотник|выключател|щёт|регулятор|диодн|подшипник|втулк|обмот|бендикс|якор|ламп|кабин/i;

  test("у каждой услуги не меньше 4 признаков и 4 работ, в каждом назван узел", () => {
    assert.equal(services.length, 8);
    for (const { file, data } of services) {
      assert.ok((data.symptoms || []).length >= 4, `${file}: признаков ${(data.symptoms || []).length}`);
      assert.ok((data.works || []).length >= 4, `${file}: работ ${(data.works || []).length}`);
      for (const item of [...data.symptoms, ...data.works]) assert.match(item, NODE, `${file}: нет узла в «${item}»`);
    }
  });

  test("главная: 4 шага «Заголовок: пояснение», FAQ 4–5 вопросов без регионов", () => {
    assert.deepEqual(home.steps.map((s) => s.split(":")[0].trim()), ["Заявка", "Диагностика", "Согласование цены", "Ремонт и проверка"]);
    for (const s of home.steps) assert.match(s, /^[^:]+: \S/, s);
    assert.ok(home.faq.length >= 4 && home.faq.length <= 5, `вопросов ${home.faq.length}`);
    for (const { q, a } of home.faq) assert.ok(!/регион|край|районы/i.test(q + a), q);
  });

  test("демо-позиции остаются демо", () => {
    for (const { file, data } of [...services, ...products, ...articles]) assert.equal(data.demo, true, file);
  });

  test("статьи: лид, не меньше двух разделов H2 и практические шаги списком", () => {
    for (const { file, body } of articles) {
      assert.ok((body.match(/^## /gm) || []).length >= 2, `${file}: H2`);
      assert.ok(!/^# /m.test(body), `${file}: H1 в теле`);
      assert.match(body, /^(\d+\.|-) /m, `${file}: список шагов`);
    }
  });
});
