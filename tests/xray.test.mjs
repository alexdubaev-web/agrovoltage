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

  test("картинка: активный вариант eager с fetchpriority и размерами, остальные lazy в <picture>", () => {
    const doc = raw();
    const variants = [...doc.querySelectorAll("[data-xray-variant]")];
    assert.deepEqual(variants.map((v) => v.dataset.xrayVariant).sort(), Object.keys(FAULT).sort());
    const active = doc.querySelector(`[data-xray-variant="${SYMPTOMS[0].system}"]`);
    const img = active.querySelector("picture img");
    assert.ok(img, "вариант лежит в <picture>");
    assert.equal(img.getAttribute("loading"), "eager");
    assert.equal(img.getAttribute("fetchpriority"), "high");
    assert.ok(Number(img.getAttribute("width")) > 0 && Number(img.getAttribute("height")) > 0, "width и height");
    for (const v of variants) {
      if (v === active) continue;
      assert.equal(v.querySelector("picture img").getAttribute("loading"), "lazy", v.dataset.xrayVariant);
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

  test("варианты подгружаются после первого взаимодействия", () => {
    const { doc, root } = setup();
    assert.ok(!root.hasAttribute("data-xray-ready"));
    click(buttons(doc)[1]);
    assert.ok(root.hasAttribute("data-xray-ready"));
  });
});
