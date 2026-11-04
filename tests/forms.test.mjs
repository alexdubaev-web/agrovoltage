// forms.js и consent.js в jsdom (interfaces.md §4). Сеть подменена: fetch — заглушка.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { initForms, formatPhone } from "../src/assets/js/forms.js";
import { initConsent } from "../src/assets/js/consent.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const PHONE = "+7 962 001 19 90";

// Разметка по контракту partials/lead-form.njk.
function formHtml(type = "callback", id = type) {
  return `
<form data-lead-form="${type}" id="lead-${id}" action="/api/lead.php" method="post">
  <input name="name" id="${id}-name"><p data-error-for="name" hidden></p>
  <input name="phone" id="${id}-phone" type="tel"><p data-error-for="phone" hidden></p>
  <textarea name="message" id="${id}-message"></textarea><p data-error-for="message" hidden></p>
  <input type="hidden" name="service" value="">
  <input type="hidden" name="page" value="/uslugi/test/">
  <input type="hidden" name="consentVersion" value="1">
  <input type="hidden" name="startedAt" value="">
  <div class="hp"><input name="website" value=""></div>
  <input name="consent" type="checkbox" value="true"><p data-error-for="consent" hidden></p>
  <p data-form-status></p>
  <button type="submit" data-submit>Отправить</button>
</form>`;
}

const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

// Окно jsdom + заглушка fetch. leadReply — функция (body) => ответ или Promise.
function setup({ html = formHtml(), leadReply = () => json(200, { ok: true, id: "AGV-20261103-0007" }) } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}<a href="tel:+79620011990" data-goal="phone">${PHONE}</a></body>`, { url: "http://localhost/uslugi/test/" });
  const win = dom.window;
  const calls = [];
  win.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("/api/token.php")) return json(200, { token: "tok-1" });
    return leadReply(JSON.parse(opts.body), opts);
  };
  const env = { dom, win, doc: win.document, calls };
  initForms(win);
  return env;
}

function fill(doc, { name = "Иван", phone = "9620011990", consent = true, form = doc.querySelector("form") } = {}) {
  form.elements.name.value = name;
  form.elements.phone.value = phone;
  form.elements.phone.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
  form.elements.consent.checked = consent;
  return form;
}

const submit = (form) => form.dispatchEvent(new form.ownerDocument.defaultView.Event("submit", { bubbles: true, cancelable: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 10; i++) await tick(); }
const leadCalls = (calls) => calls.filter((c) => c.url.includes("/api/lead.php"));

describe("forms.js", () => {
  test("маска телефона: +7 (962) 001-19-90 из разных вводов", () => {
    assert.equal(formatPhone("9620011990"), "+7 (962) 001-19-90");
    assert.equal(formatPhone("89620011990"), "+7 (962) 001-19-90");
    assert.equal(formatPhone("+7 962 001"), "+7 (962) 001");
    assert.equal(formatPhone(""), "");
  });

  test("успех: токен в X-CSRF-Token, JSON по контракту, номер заявки, событие agv:lead-sent", async () => {
    const { doc, win, calls } = setup();
    const events = [];
    doc.addEventListener("agv:lead-sent", (e) => events.push(e.detail));
    const form = fill(doc);
    submit(form);
    await settle();
    const [call] = leadCalls(calls);
    assert.ok(call, "запрос ушёл");
    assert.equal(call.opts.method, "POST");
    assert.equal(call.opts.headers["X-CSRF-Token"], "tok-1");
    const body = JSON.parse(call.opts.body);
    assert.equal(body.type, "callback");
    assert.equal(body.name, "Иван");
    assert.equal(body.phone, "+7 (962) 001-19-90");
    assert.equal(body.consent, true);
    assert.equal(body.consentVersion, "1");
    assert.equal(body.website, "");
    assert.equal(body.page, "/uslugi/test/");
    assert.equal(typeof body.startedAt, "number");
    assert.ok(body.startedAt > 0 && body.startedAt <= Date.now(), "время начала заполнения — до отправки");
    assert.match(doc.querySelector("[data-form-status]").textContent, /AGV-20261103-0007/);
    assert.deepEqual(events, [{ type: "callback", id: "AGV-20261103-0007" }]);
    assert.equal(win.document.querySelector("[data-submit]").disabled, false);
  });

  test("ошибки 422 показываются у полей, введённое не стирается", async () => {
    const { doc } = setup({ leadReply: () => json(422, { ok: false, errors: { phone: "Укажите телефон в формате +7 (999) 123-45-67." } }) });
    const form = fill(doc, { name: "Пётр", phone: "9620011990" });
    form.elements.message.value = "Нужна диагностика";
    submit(form);
    await settle();
    const err = doc.querySelector('[data-error-for="phone"]');
    assert.equal(err.hidden, false);
    assert.match(err.textContent, /Укажите телефон/);
    assert.equal(form.elements.phone.getAttribute("aria-invalid"), "true");
    assert.equal(form.elements.name.value, "Пётр");
    assert.equal(form.elements.message.value, "Нужна диагностика");
  });

  test("проверка на клиенте: пустое имя и нет согласия — без запроса, ошибки по-русски", async () => {
    const { doc, calls } = setup();
    const form = fill(doc, { name: " ", consent: false });
    submit(form);
    await settle();
    assert.equal(leadCalls(calls).length, 0);
    assert.match(doc.querySelector('[data-error-for="name"]').textContent, /имя/i);
    assert.match(doc.querySelector('[data-error-for="consent"]').textContent, /согласи/i);
  });

  test("пока запрос идёт, повторная отправка заблокирована", async () => {
    let release;
    const { doc, calls } = setup({ leadReply: () => new Promise((r) => { release = () => r(json(200, { ok: true, id: "AGV-20261103-0001" })); }) });
    const form = fill(doc);
    submit(form);
    await settle();
    assert.equal(doc.querySelector("[data-submit]").disabled, true);
    submit(form);
    submit(form);
    await settle();
    assert.equal(leadCalls(calls).length, 1);
    release();
    await settle();
    assert.equal(doc.querySelector("[data-submit]").disabled, false);
  });

  test("сбой сети или 500 — текст с телефоном, данные на месте", async () => {
    for (const leadReply of [() => { throw new TypeError("Failed to fetch"); }, () => json(500, { ok: false, error: "x" })]) {
      const { doc } = setup({ leadReply });
      const form = fill(doc, { name: "Олег" });
      submit(form);
      await settle();
      const status = doc.querySelector("[data-form-status]");
      assert.ok(status.textContent.includes(PHONE), status.textContent);
      // Текст из спецификации (история 21, R17.2).
      assert.ok(status.textContent.includes(`Не удалось отправить. Позвоните ${PHONE} или попробуйте ещё раз`), status.textContent);
      assert.ok(status.querySelector('a[href="tel:+79620011990"]'), "телефон — ссылка");
      assert.equal(status.dataset.state, "error");
      assert.equal(form.elements.name.value, "Олег");
    }
  });

  test("429 — текст ошибки сервера", async () => {
    const { doc } = setup({ leadReply: () => json(429, { ok: false, error: "Слишком много заявок подряд." }) });
    submit(fill(doc));
    await settle();
    assert.match(doc.querySelector("[data-form-status]").textContent, /Слишком много/);
  });

  test("403 — токен обновляется и запрос повторяется один раз", async () => {
    let n = 0;
    const { doc, calls } = setup({ leadReply: () => (++n === 1 ? json(403, { ok: false }) : json(200, { ok: true, id: "AGV-20261103-0002" })) });
    submit(fill(doc));
    await settle();
    assert.equal(leadCalls(calls).length, 2);
    assert.equal(calls.filter((c) => c.url.includes("token.php")).length, 2);
    assert.match(doc.querySelector("[data-form-status]").textContent, /AGV-20261103-0002/);
  });

  // Состав заказа держит cart.js: input[name="items"] и data-cart-items (interfaces.md, тикет 03).
  const orderHtml = (items, { attr = true, field = true } = {}) => {
    const json = JSON.stringify(items).replace(/'/g, "&#39;");
    return formHtml("order")
      .replace('data-lead-form="order"', `data-lead-form="order"${attr ? ` data-cart-items='${json}'` : ""}`)
      .replace("<p data-form-status>", `${field ? `<input type="hidden" name="items" value='${json}'>` : ""}<p data-form-status>`);
  };

  test("заказ: позиции из формы, которую заполняет cart.js, цели Метрики «order»", async () => {
    const items = [{ slug: "rele", title: "Реле", price: 1500, qty: 2 }, { slug: "datchik", title: "Датчик", price: null, qty: 1 }];
    const { doc, win, calls } = setup({ html: orderHtml(items) });
    const goals = [];
    win.agvGoal = (name) => goals.push(name);
    win.localStorage.setItem("agv.cart.v1", JSON.stringify({ items, updatedAt: 1 }));
    submit(fill(doc));
    await settle();
    const body = JSON.parse(leadCalls(calls)[0].opts.body);
    assert.equal(body.type, "order");
    assert.deepEqual(body.items, items);
    assert.deepEqual(goals, ["lead", "order"]);
  });

  test("R17.3: снятый с продажи товар не уходит в заказ, цена и название — из каталога", async () => {
    // В localStorage — старые цена и название и товар, которого уже нет в /katalog/index.json.
    const stored = [
      { slug: "rele", title: "Реле (старое)", price: 1500, qty: 2 },
      { slug: "snyat-s-prodazhi", title: "Снятый товар", price: 900, qty: 1 },
    ];
    // cart.js сверил корзину с каталогом и оставил только то, что продаётся, с данными каталога.
    const fromCatalog = [{ slug: "rele", title: "Реле стартера", price: 1700, qty: 2 }];
    for (const opts of [{ attr: true, field: true }, { attr: false, field: true }, { attr: true, field: false }]) {
      const { doc, win, calls } = setup({ html: orderHtml(fromCatalog, opts) });
      win.localStorage.setItem("agv.cart.v1", JSON.stringify({ items: stored, updatedAt: 1 }));
      submit(fill(doc));
      await settle();
      const body = JSON.parse(leadCalls(calls)[0].opts.body);
      assert.deepEqual(body.items, fromCatalog, JSON.stringify(opts));
      assert.ok(!body.items.some((i) => i.slug === "snyat-s-prodazhi"));
    }
  });

  test("заказ с пустой корзиной не отправляется", async () => {
    const { doc, calls } = setup({ html: formHtml("order") });
    submit(fill(doc));
    await settle();
    assert.equal(leadCalls(calls).length, 0);
    assert.match(doc.querySelector("[data-form-status]").textContent, /корзин/i);
  });

  test("кнопка «Оставить заявку» с услугой подставляет услугу и текст в форму модального окна", async () => {
    const html = `<a href="#zayavka" data-lead-open data-service="Ремонт кондиционера" data-message="Не холодит">Записаться</a>
      <div id="zayavka">${formHtml("callback", "modal")}</div>`;
    const { doc, calls } = setup({ html });
    doc.querySelector("[data-lead-open]").click();
    const form = doc.querySelector("#zayavka form");
    assert.equal(form.elements.service.value, "Ремонт кондиционера");
    assert.equal(form.elements.message.value, "Не холодит");
    submit(fill(doc, { form }));
    await settle();
    const body = JSON.parse(leadCalls(calls)[0].opts.body);
    assert.equal(body.type, "service");
    assert.equal(body.service, "Ремонт кондиционера");
  });
});

// Баннер по контракту partials/consent-banner.njk.
function consentSetup({ metrikaId = "12345678", stored } = {}) {
  const dom = new JSDOM(`<!doctype html><head></head><body>
    <div data-consent-banner data-metrika-id="${metrikaId}" data-consent-version="1" hidden>
      <button data-consent-accept>Принять</button><button data-consent-decline>Отклонить</button>
    </div><a href="tel:+79620011990" data-goal="phone">${PHONE}</a></body>`, { url: "http://localhost/" });
  const win = dom.window;
  if (stored !== undefined) win.localStorage.setItem("agv.consent.v1", JSON.stringify(stored));
  initConsent(win);
  const doc = win.document;
  return {
    win, doc,
    banner: doc.querySelector("[data-consent-banner]"),
    metrikaLoaded: () => [...doc.querySelectorAll("script")].some((s) => s.src.includes("mc.yandex.ru/metrika/tag.js")),
  };
}

describe("consent.js", () => {
  test("без согласия Метрика не грузится, баннер виден", () => {
    const c = consentSetup();
    assert.equal(c.banner.hidden, false);
    assert.equal(c.metrikaLoaded(), false);
    c.win.agvGoal("lead"); // без Метрики — ничего не делает и не падает
  });

  test("согласие при заданном ID грузит Метрику и запоминается", () => {
    const c = consentSetup();
    c.doc.querySelector("[data-consent-accept]").click();
    assert.equal(c.metrikaLoaded(), true);
    assert.equal(c.banner.hidden, true);
    const saved = JSON.parse(c.win.localStorage.getItem("agv.consent.v1"));
    assert.equal(saved.value, "accepted");
    assert.equal(saved.version, "1");
  });

  test("отказ: Метрика не грузится, баннер скрыт", () => {
    const c = consentSetup();
    c.doc.querySelector("[data-consent-decline]").click();
    assert.equal(c.metrikaLoaded(), false);
    assert.equal(c.banner.hidden, true);
    assert.equal(JSON.parse(c.win.localStorage.getItem("agv.consent.v1")).value, "declined");
  });

  test("без ID Метрики не грузится даже с согласием", () => {
    const c = consentSetup({ metrikaId: "", stored: { value: "accepted", version: "1", at: Date.now() } });
    assert.equal(c.metrikaLoaded(), false);
  });

  test("сохранённое согласие действует 180 дней и для той же версии", () => {
    const day = 86_400_000;
    assert.equal(consentSetup({ stored: { value: "accepted", version: "1", at: Date.now() - 10 * day } }).metrikaLoaded(), true);
    const old = consentSetup({ stored: { value: "accepted", version: "1", at: Date.now() - 181 * day } });
    assert.equal(old.metrikaLoaded(), false);
    assert.equal(old.banner.hidden, false);
    assert.equal(consentSetup({ stored: { value: "accepted", version: "0", at: Date.now() } }).banner.hidden, false);
    assert.equal(consentSetup({ stored: { value: "declined", version: "1", at: Date.now() } }).banner.hidden, true);
  });

  test("цели: agvGoal вызывает reachGoal, клик по tel: — цель phone", () => {
    const c = consentSetup({ stored: { value: "accepted", version: "1", at: Date.now() } });
    const calls = [];
    c.win.ym = (...args) => calls.push(args);
    c.win.agvGoal("lead");
    c.doc.querySelector('a[href^="tel:"]').dispatchEvent(new c.win.MouseEvent("click", { bubbles: true, cancelable: true }));
    assert.deepEqual(calls.filter((a) => a[1] === "reachGoal").map((a) => [a[0], a[2]]), [[12345678, "lead"], [12345678, "phone"]]);
  });
});

describe("плавающая кнопка связи", () => {
  test("звонок и MAX, видна только на мобильной ширине", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/_includes/partials/contact-fab.njk"), "utf8");
    assert.match(src, /settings\.phoneHref/);
    assert.match(src, /settings\.maxUrl/);
    // Стили кнопки лежат в main.css (подключён из <head>).
    const css = fs.readFileSync(path.join(ROOT, "src/assets/css/main.css"), "utf8");
    // Панель видна на ширине до 768 включительно (R04).
    assert.match(css, /@media\s*\(min-width:\s*769px\)\s*\{[^}]*\.contact-fab\s*\{\s*display:\s*none/);
    const page = path.join(ROOT, "dist", "index.html");
    if (fs.existsSync(page)) {
      const doc = new JSDOM(fs.readFileSync(page, "utf8")).window.document;
      const fab = doc.querySelector(".contact-fab");
      assert.ok(fab, "кнопка выведена на страницах");
      assert.ok(fab.querySelector('a[href^="tel:"][data-goal="phone"]'));
    }
  });
});
