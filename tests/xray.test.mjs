// «Рентген» трактора на главной: разметка из dist/index.html + xray.js в jsdom.
// Нужен собранный dist/ (`npm run build`, его делает `npm test`).
// Ожидаемые значения — из home.md (симптомы), карточек услуг (цены) и таблицы координат
// «Что построил тикет 00» в interfaces.md, а не из кода под тестом.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { ROOT, DIST } from "./helpers/dist.mjs";
import { parseFile } from "../lib/content.js";
import { initXray } from "../src/assets/js/xray.js";

const HTML = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const SYMPTOMS = parseFile(path.join(ROOT, "src/content/pages/home.md")).data.symptoms;
const service = (slug) => parseFile(path.join(ROOT, "src/content/services", `${slug}.md`)).data;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// Точка неисправности по system (interfaces.md, «Что построил тикет 00»).
const FAULT = {
  start: ["31.6%", "57.6%"],
  charge: ["27.2%", "50.8%"],
  ecu: ["42.3%", "43%"],
  cab: ["51.4%", "13.7%"],
  harness: ["46.2%", "54.2%"],
  climate: ["19.5%", "45.9%"],
};
const LABELS = {
  "АКБ": ["54.7%", "61%"],
  "Стартер": ["31.6%", "57.6%"],
  "Генератор": ["27.2%", "50.8%"],
  "ЭБУ": ["42.3%", "43%"],
  "Кабина": ["63.5%", "27.3%"],
  "Кондиционер": ["19.5%", "45.9%"],
  "Жгут": ["46.2%", "54.2%"],
};
// Подпись узла → system (spec.md, «Доработка 2026-11-05», история 20).
const NODE_SYSTEM = {
  "АКБ": "start",
  "Стартер": "start",
  "Генератор": "charge",
  "ЭБУ": "ecu",
  "Кабина": "cab",
  "Кондиционер": "climate",
  "Жгут": "harness",
};

function setup({ reduce = false } = {}) {
  const dom = new JSDOM(HTML, { url: "http://localhost/" });
  const win = dom.window;
  win.matchMedia = (q) => ({ matches: reduce && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  initXray(win);
  const doc = win.document;
  return { win, doc, root: doc.querySelector("[data-xray]") };
}
const raw = () => new JSDOM(HTML).window.document;
const buttons = (doc) => [...doc.querySelectorAll("[data-xray-symptom]")];
const nodeTag = (doc, label) =>
  [...doc.querySelectorAll("[data-xray-node]")].find((n) => norm(n.textContent) === label).querySelector(".xray__tag");
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));

describe("главная: рентген трактора", () => {
  test("в home.md стартовый набор из шести симптомов", () => {
    assert.deepEqual(
      SYMPTOMS.map((s) => [s.label, s.system, s.service]),
      [
        ["Не заводится", "start", "remont-elektriki"],
        ["Не заряжает АКБ", "charge", "remont-generatorov-i-starterov"],
        ["Ошибки на мониторе", "ecu", "diagnostika-elektriki"],
        ["Не работает свет", "cab", "elektrooborudovanie-kabiny-i-osveshcheniya"],
        ["Повреждён жгут", "harness", "remont-provodki-i-zhgutov"],
        ["Не холодит кондиционер", "climate", "diagnostika-i-remont-kondicionerov"],
      ],
    );
    for (const s of SYMPTOMS) assert.ok(s.hint, `подсказка у «${s.label}»`);
  });

  test("без JS симптомы — ссылки на страницы услуг", () => {
    const doc = raw();
    const links = buttons(doc);
    assert.equal(links.length, SYMPTOMS.length);
    links.forEach((a, i) => {
      assert.equal(a.tagName, "A");
      assert.equal(a.getAttribute("href"), `/uslugi/${SYMPTOMS[i].service}/`);
      assert.equal(norm(a.textContent), SYMPTOMS[i].label);
    });
  });

  test("картинка: база всегда видна и грузится сразу, поверх — слой подсветки активной системы", () => {
    const doc = raw();
    const base = doc.querySelector(".xray__base picture img");
    assert.ok(base, "база лежит в <picture>");
    assert.match(base.getAttribute("src"), /tractor-xray-base/);
    assert.equal(base.getAttribute("loading"), "eager");
    assert.ok(Number(base.getAttribute("width")) > 0 && Number(base.getAttribute("height")) > 0, "width и height");
    assert.equal(base.closest("[data-xray-variant]"), null, "база не слой смены");
    const variants = [...doc.querySelectorAll("[data-xray-variant]")];
    assert.deepEqual(variants.map((v) => v.dataset.xrayVariant).sort(), Object.keys(FAULT).sort());
    const active = doc.querySelector(`[data-xray-variant="${SYMPTOMS[0].system}"]`);
    assert.equal(active.querySelector("picture img").getAttribute("loading"), "eager");
    for (const v of variants) {
      if (v === active) continue;
      assert.equal(v.querySelector("picture img").getAttribute("loading"), "lazy", v.dataset.xrayVariant);
    }
  });

  test("у каждой системы свой прозрачный слой подсветки того же кадра, что база", () => {
    const doc = raw();
    const base = doc.querySelector(".xray__base picture img");
    for (const system of Object.keys(FAULT)) {
      const img = doc.querySelector(`[data-xray-variant="${system}"] picture img`);
      assert.ok(img, system);
      assert.match(img.getAttribute("src"), new RegExp(`tractor-xray-${system}-layer`), system);
      assert.equal(img.getAttribute("width"), base.getAttribute("width"), `${system}: ширина как у базы`);
      assert.equal(img.getAttribute("height"), base.getAttribute("height"), `${system}: высота как у базы`);
      // Слой — PNG с альфой: исходник лежит рядом с базой.
      assert.ok(fs.existsSync(path.join(ROOT, `src/assets/images/xray/tractor-xray-${system}-layer.png`)), system);
    }
  });

  test("подписи узлов — HTML поверх картинки в процентах", () => {
    const doc = raw();
    const nodes = [...doc.querySelectorAll("[data-xray-node]")];
    const got = Object.fromEntries(nodes.map((n) => [norm(n.textContent), [n.style.left, n.style.top]]));
    assert.deepEqual(got, LABELS);
  });

  test("после загрузки JS: кнопки с aria-pressed, нажат первый симптом", () => {
    const { doc } = setup();
    const list = buttons(doc);
    assert.equal(list.length, SYMPTOMS.length);
    for (const b of list) assert.equal(b.tagName, "BUTTON");
    assert.deepEqual(list.map((b) => b.getAttribute("aria-pressed")), list.map((_, i) => String(i === 0)));
  });

  test("выбор симптома: сменяется вариант, точка переезжает, карточка обновляется", () => {
    const { doc, root } = setup();
    const i = SYMPTOMS.findIndex((s) => s.system === "charge");
    const s = SYMPTOMS[i];
    const svc = service(s.service);
    click(buttons(doc)[i]);

    assert.deepEqual(buttons(doc).map((b) => b.getAttribute("aria-pressed")), buttons(doc).map((_, k) => String(k === i)));
    assert.equal(root.dataset.active, "charge");
    const on = doc.querySelector('[data-xray-variant="charge"]');
    const off = doc.querySelector(`[data-xray-variant="${SYMPTOMS[0].system}"]`);
    assert.ok(on.classList.contains("is-active"));
    assert.ok(!off.classList.contains("is-active"));

    const dot = doc.querySelector("[data-xray-fault]");
    assert.deepEqual([dot.style.left, dot.style.top], FAULT.charge);
    assert.equal(dot.dataset.tone, "fault");

    assert.equal(norm(doc.querySelector("[data-xray-hint]").textContent), norm(s.hint));
    const link = doc.querySelector("[data-xray-service]");
    assert.equal(link.getAttribute("href"), `/uslugi/${s.service}/`);
    assert.equal(norm(link.textContent), norm(svc.title));
    // Ожидаемая цена — из priceFrom выбранной услуги в контенте.
    assert.ok(typeof svc.priceFrom === "number", "у услуги есть priceFrom");
    assert.equal(norm(doc.querySelector("[data-xray-price]").textContent), norm(`от ${svc.priceFrom.toLocaleString("ru-RU")} ₽`));
    const cta = doc.querySelector("[data-xray-cta]");
    assert.ok(cta.hasAttribute("data-lead-open"));
    assert.equal(cta.getAttribute("href"), "#zayavka");
    assert.equal(cta.getAttribute("data-service"), svc.title);
  });

  test("каждый симптом ставит точку к своему узлу, климат — цветом Frost", () => {
    const { doc } = setup();
    SYMPTOMS.forEach((s, i) => {
      click(buttons(doc)[i]);
      const dot = doc.querySelector("[data-xray-fault]");
      assert.deepEqual([dot.style.left, dot.style.top], FAULT[s.system], s.system);
      assert.equal(dot.dataset.tone, s.system === "climate" ? "frost" : "fault", s.system);
    });
  });

  test("услуга без цены показывает «по запросу»", () => {
    const { doc } = setup();
    const btn = buttons(doc)[0];
    btn.dataset.price = "";
    click(btn);
    assert.equal(norm(doc.querySelector("[data-xray-price]").textContent), "по запросу");
  });

  test("без JS подписи узлов — ссылки на услуги своей системы", () => {
    const doc = raw();
    for (const [label, system] of Object.entries(NODE_SYSTEM)) {
      const tag = nodeTag(doc, label);
      const s = SYMPTOMS.find((x) => x.system === system);
      assert.equal(tag.tagName, "A", label);
      assert.equal(tag.getAttribute("href"), `/uslugi/${s.service}/`, label);
    }
  });

  test("подпись узла — кнопка с понятным именем, нажатие выбирает свою причину", () => {
    const { doc, root } = setup();
    for (const [label, system] of Object.entries(NODE_SYSTEM)) {
      const tag = nodeTag(doc, label);
      const i = SYMPTOMS.findIndex((x) => x.system === system);
      const s = SYMPTOMS[i];
      assert.equal(tag.tagName, "BUTTON", label);
      const name = tag.getAttribute("aria-label") || "";
      assert.ok(name.includes(label), `${label}: имя содержит подпись`);
      assert.ok(name.toLowerCase().includes(`показать причину: ${s.label.toLowerCase()}`), `${label}: ${name}`);

      click(tag);
      assert.equal(root.dataset.active, system, label);
      assert.deepEqual(buttons(doc).map((b) => b.getAttribute("aria-pressed")), buttons(doc).map((_, k) => String(k === i)), label);
      assert.equal(tag.getAttribute("aria-pressed"), "true", label);
      assert.ok(doc.querySelector(`[data-xray-variant="${system}"]`).classList.contains("is-active"), label);
      assert.equal(norm(doc.querySelector("[data-xray-hint]").textContent), norm(s.hint), label);
      assert.equal(doc.querySelector("[data-xray-service]").getAttribute("href"), `/uslugi/${s.service}/`, label);
      const dot = doc.querySelector("[data-xray-fault]");
      assert.deepEqual([dot.style.left, dot.style.top], FAULT[system], label);
    }
  });

  test("база не участвует в смене: без классов и прозрачности смены", () => {
    const { doc } = setup();
    const base = doc.querySelector(".xray__base");
    const before = base.outerHTML;
    for (const b of buttons(doc)) click(b);
    click(nodeTag(doc, "Жгут"));
    assert.equal(base.outerHTML, before);
    assert.ok(!base.classList.contains("is-active") && !base.classList.contains("is-prev"));
    assert.equal(base.style.opacity, "");
  });

  test("варианты подгружаются после первого взаимодействия", () => {
    const { doc, root } = setup();
    assert.ok(!root.hasAttribute("data-xray-ready"));
    click(buttons(doc)[1]);
    assert.ok(root.hasAttribute("data-xray-ready"));
  });
});
