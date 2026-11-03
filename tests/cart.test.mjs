// Корзина (interfaces.md §4): API cart.js в jsdom и страница /korzina/ на собранном dist/.
// Страница читает dist/, поэтому перед запуском нужен `npm run build` (его делает `npm test`).
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { DIST } from "./helpers/dist.mjs";

const KEY = "agv.cart.v1";
const CART_JS = new URL("../src/assets/js/cart.js", import.meta.url).href;
const SHELL = "<!doctype html><html><body><header><a><span data-cart-count></span></a></header><main></main></body></html>";

let counter = 0;
let current = null;

// Подменяет глобальные window/document/localStorage на окружение jsdom.
function setup(html = SHELL) {
  const dom = new JSDOM(html, { url: "http://localhost/korzina/" });
  const win = dom.window;
  const globals = { window: win, document: win.document, localStorage: win.localStorage, location: win.location, history: win.history };
  for (const [k, v] of Object.entries(globals)) {
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(DIST, "katalog", "index.json"), "utf8")) }),
  });
  current = dom;
  return win;
}

// Новый экземпляр модуля = «перезагрузка страницы» при тех же window и localStorage.
const load = () => import(`${CART_JS}?run=${++counter}`);
const count = () => current.window.document.querySelector("header [data-cart-count]");
const stored = () => JSON.parse(current.window.localStorage.getItem(KEY));

afterEach(() => {
  current?.window.close();
  current = null;
});

describe("cart.js: API", () => {
  test("addItem добавляет позицию и суммирует количество для того же slug", async () => {
    setup();
    const cart = await load();
    cart.addItem({ slug: "relay", title: "Реле", price: 620, qty: 1 });
    cart.addItem({ slug: "relay", title: "Реле", price: 620, qty: 2 });
    cart.addItem({ slug: "sensor", title: "Датчик", price: null });
    assert.deepEqual(cart.getCart().items, [
      { slug: "relay", title: "Реле", price: 620, qty: 3 },
      { slug: "sensor", title: "Датчик", price: null, qty: 1 },
    ]);
    assert.equal(typeof stored().updatedAt, "number");
  });

  test("setQty меняет количество, значение меньше 1 удаляет позицию", async () => {
    setup();
    const cart = await load();
    cart.addItem({ slug: "relay", title: "Реле", price: 620, qty: 1 });
    cart.setQty("relay", 5);
    assert.equal(cart.getCart().items[0].qty, 5);
    cart.setQty("relay", 0);
    assert.deepEqual(cart.getCart().items, []);
  });

  test("removeItem убирает только указанную позицию, clearCart очищает всё", async () => {
    setup();
    const cart = await load();
    cart.addItem({ slug: "a", title: "A", price: 1, qty: 1 });
    cart.addItem({ slug: "b", title: "B", price: 2, qty: 1 });
    cart.removeItem("a");
    assert.deepEqual(cart.getCart().items.map((i) => i.slug), ["b"]);
    cart.clearCart();
    assert.deepEqual(cart.getCart().items, []);
  });

  test("корзина сохраняется после перезагрузки: новый экземпляр модуля читает localStorage", async () => {
    setup();
    const first = await load();
    first.addItem({ slug: "relay", title: "Реле", price: 620, qty: 2 });
    const second = await load();
    assert.deepEqual(second.getCart().items, [{ slug: "relay", title: "Реле", price: 620, qty: 2 }]);
    assert.equal(count().textContent, "2");
  });

  test("счётчик в шапке показывает сумму количеств и пустой при пустой корзине", async () => {
    setup();
    const cart = await load();
    assert.equal(count().textContent, "");
    cart.addItem({ slug: "a", title: "A", price: 1, qty: 2 });
    cart.addItem({ slug: "b", title: "B", price: 1, qty: 3 });
    assert.equal(count().textContent, "5");
    cart.clearCart();
    assert.equal(count().textContent, "");
  });

  test("синхронизация вкладок: событие storage вызывает onChange и обновляет счётчик", async () => {
    const win = setup();
    const cart = await load();
    const seen = [];
    cart.onChange((c) => seen.push(c.items.map((i) => i.slug)));
    // Другая вкладка записала корзину напрямую в localStorage.
    win.localStorage.setItem(KEY, JSON.stringify({ items: [{ slug: "from-tab", title: "Из другой вкладки", price: 100, qty: 4 }], updatedAt: 1 }));
    win.dispatchEvent(new win.StorageEvent("storage", { key: KEY }));
    assert.deepEqual(seen, [["from-tab"]]);
    assert.equal(count().textContent, "4");
    // События по чужим ключам игнорируются.
    win.dispatchEvent(new win.StorageEvent("storage", { key: "other" }));
    assert.equal(seen.length, 1);
  });

  test("повреждённые данные в localStorage дают пустую корзину, а не ошибку", async () => {
    const win = setup();
    win.localStorage.setItem(KEY, "{не json");
    const cart = await load();
    assert.deepEqual(cart.getCart().items, []);
    cart.addItem({ slug: "a", title: "A", price: 1, qty: 1 });
    assert.equal(cart.getCart().items.length, 1);
  });

  test("кнопка [data-add-to-cart] кладёт товар в корзину; пустая цена = null", async () => {
    const win = setup(`${SHELL.replace("<main></main>", "")}`);
    win.document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-product><input data-add-qty value="2"><button data-add-to-cart data-slug="gen" data-title="Генератор" data-price="">В корзину</button></div>',
    );
    const cart = await load();
    win.document.querySelector("[data-add-to-cart]").click();
    assert.deepEqual(cart.getCart().items, [{ slug: "gen", title: "Генератор", price: null, qty: 2 }]);
  });
});

describe("страница /korzina/", () => {
  const html = () => fs.readFileSync(path.join(DIST, "korzina", "index.html"), "utf8");
  const items = [
    { slug: "generator-14v-150a", title: "Старое название", price: 1, qty: 2 }, // в каталоге цена 18 900
    { slug: "datchik-davleniya-masla", title: "Датчик давления масла", price: null, qty: 1 }, // цена по запросу
    { slug: "snyatyj-s-prodazhi", title: "Снятый товар", price: 500, qty: 1 }, // в каталоге нет
  ];
  const fill = (win) => win.localStorage.setItem(KEY, JSON.stringify({ items, updatedAt: 1 }));
  const root = () => current.window.document.querySelector("[data-cart-page]");
  const orderItems = () => JSON.parse(root().querySelector('form[data-lead-form="order"] input[name="items"]').value);

  test("итог без позиций «по запросу» и снятых с продажи, с подписью о них", async () => {
    fill(setup(html()));
    const cart = await load();
    await cart.ready;
    // 2 × 18 900 из каталога; цена в корзине (1 ₽) не используется.
    assert.equal(root().querySelector("[data-cart-total]").textContent, "37 800 ₽");
    const note = root().querySelector("[data-cart-note]");
    assert.equal(note.hidden, false);
    assert.match(note.textContent, /по запросу/);
  });

  test("позиция, которой нет в index.json, помечена и не попадает в заказ", async () => {
    fill(setup(html()));
    const cart = await load();
    await cart.ready;
    const stale = root().querySelector('[data-cart-item="snyatyj-s-prodazhi"]');
    assert.match(stale.textContent, /Товар больше не продаётся/);
    assert.deepEqual(orderItems().map((i) => i.slug).sort(), ["datchik-davleniya-masla", "generator-14v-150a"]);
    // Состав заказа: количество из корзины, цена из каталога, у «по запросу» — null.
    const gen = orderItems().find((i) => i.slug === "generator-14v-150a");
    assert.deepEqual(gen, { slug: "generator-14v-150a", title: "Генератор 14 В, 150 А", price: 18900, qty: 2 });
    assert.equal(orderItems().find((i) => i.slug === "datchik-davleniya-masla").price, null);
    assert.equal(root().querySelector("form[data-lead-form=order]").getAttribute("data-cart-items"), JSON.stringify(orderItems()));
  });

  test("пустая корзина: «Корзина пуста», ссылка в каталог, формы заказа не видно", async () => {
    setup(html());
    const cart = await load();
    await cart.ready;
    assert.equal(root().querySelector("[data-cart-empty]").hidden, false);
    assert.match(root().querySelector("[data-cart-empty]").textContent, /Корзина пуста/);
    assert.equal(root().querySelector('[data-cart-empty] a[href="/katalog/"]') !== null, true);
    assert.equal(root().querySelector("[data-cart-content]").hidden, true);
  });

  test("изменение количества и удаление на странице обновляют корзину и итог", async () => {
    fill(setup(html()));
    const cart = await load();
    await cart.ready;
    const input = root().querySelector('[data-qty-input="generator-14v-150a"]');
    input.value = "3";
    input.dispatchEvent(new current.window.Event("change", { bubbles: true }));
    assert.equal(cart.getCart().items.find((i) => i.slug === "generator-14v-150a").qty, 3);
    assert.equal(root().querySelector("[data-cart-total]").textContent, "56 700 ₽");
    root().querySelector('[data-remove="generator-14v-150a"]').click();
    assert.equal(root().querySelector('[data-cart-item="generator-14v-150a"]'), null);
    assert.equal(root().querySelector("[data-cart-total]").textContent, "0 ₽");
  });

  test("событие agv:lead-sent очищает корзину только для type=order", async () => {
    fill(setup(html()));
    const cart = await load();
    await cart.ready;
    const win = current.window;
    win.document.dispatchEvent(new win.CustomEvent("agv:lead-sent", { bubbles: true, detail: { type: "callback", id: "AGV-20261103-0001" } }));
    assert.equal(cart.getCart().items.length, 3, "заявка другого типа не трогает корзину");
    win.document.dispatchEvent(new win.CustomEvent("agv:lead-sent", { bubbles: true, detail: { type: "order", id: "AGV-20261103-0002" } }));
    assert.deepEqual(cart.getCart().items, []);
    assert.equal(count().textContent, "");
    const sent = root().querySelector("[data-cart-sent]");
    assert.equal(sent.hidden, false);
    assert.match(sent.textContent, /AGV-20261103-0002/);
    assert.equal(root().querySelector("[data-cart-empty]").hidden, true);
  });

  test("без события отправки (ошибка сервера) корзина не меняется", async () => {
    fill(setup(html()));
    const cart = await load();
    await cart.ready;
    const before = JSON.stringify(cart.getCart().items);
    const form = root().querySelector("form[data-lead-form=order]");
    form.dispatchEvent(new current.window.Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(JSON.stringify(cart.getCart().items), before);
  });
});
