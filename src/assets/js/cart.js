// Корзина (interfaces.md §4). Хранилище — localStorage, ключ agv.cart.v1.
// Формат: { items: [{ slug, title, price, qty }], updatedAt }. price — число или null («по запросу»).
// Модуль безопасно импортируется и без браузера: window и document берутся при вызове.

export const STORAGE_KEY = "agv.cart.v1";
const MAX_QTY = 999;
const CATALOG_URL = "/katalog/index.json";

const listeners = new Set();
let memory = null; // запасное хранилище, если localStorage недоступен

const store = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

function cleanQty(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), MAX_QTY);
}

function cleanItem(raw) {
  if (!raw || typeof raw.slug !== "string" || !raw.slug) return null;
  const price = typeof raw.price === "number" && Number.isFinite(raw.price) && raw.price >= 0 ? raw.price : null;
  return { slug: raw.slug, title: String(raw.title ?? raw.slug), price, qty: cleanQty(raw.qty) };
}

function readRaw() {
  const s = store();
  if (!s) return memory;
  try {
    return s.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function writeRaw(text) {
  memory = text;
  const s = store();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, text);
  } catch {
    /* хранилище переполнено или закрыто: работаем из памяти */
  }
}

export function getCart() {
  let data = null;
  try {
    data = JSON.parse(readRaw() || "null");
  } catch {
    data = null;
  }
  const items = Array.isArray(data?.items) ? data.items.map(cleanItem).filter(Boolean) : [];
  return { items, updatedAt: typeof data?.updatedAt === "number" ? data.updatedAt : 0 };
}

function emit() {
  const cart = getCart();
  updateCounter(cart);
  for (const cb of [...listeners]) {
    try {
      cb(cart);
    } catch {
      /* ошибка подписчика не должна ломать корзину */
    }
  }
}

function save(items) {
  writeRaw(JSON.stringify({ items, updatedAt: Date.now() }));
  emit();
  return getCart();
}

export function addItem({ slug, title, price = null, qty = 1 } = {}) {
  const incoming = cleanItem({ slug, title, price, qty });
  if (!incoming) return getCart();
  const items = getCart().items;
  const found = items.find((i) => i.slug === incoming.slug);
  if (found) {
    found.qty = cleanQty(found.qty + incoming.qty);
    found.title = incoming.title;
    found.price = incoming.price;
  } else {
    items.push(incoming);
  }
  return save(items);
}

export function setQty(slug, qty) {
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n < 1) return removeItem(slug);
  const items = getCart().items;
  const found = items.find((i) => i.slug === slug);
  if (!found) return getCart();
  found.qty = cleanQty(n);
  return save(items);
}

export function removeItem(slug) {
  return save(getCart().items.filter((i) => i.slug !== slug));
}

export function clearCart() {
  return save([]);
}

// Подписка на любые изменения: свои и из других вкладок. Возвращает функцию отписки.
export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const totalQty = (cart = getCart()) => cart.items.reduce((sum, i) => sum + i.qty, 0);

// Счётчик в шапке: header [data-cart-count].
export function updateCounter(cart = getCart()) {
  const doc = globalThis.document;
  if (!doc) return;
  const n = totalQty(cart);
  for (const node of doc.querySelectorAll("header [data-cart-count]")) {
    node.textContent = n > 0 ? String(n) : "";
    if (n > 0) node.removeAttribute("data-empty");
    else node.setAttribute("data-empty", "");
  }
}

/* ---------- Кнопки «В корзину» ---------- */

function handleAddClick(event) {
  const btn = event.target?.closest?.("[data-add-to-cart]");
  if (!btn) return;
  event.preventDefault();
  const priceAttr = btn.getAttribute("data-price");
  const holder = btn.closest("[data-product], [data-product-card]");
  const qtyInput = holder?.querySelector("[data-add-qty]");
  addItem({
    slug: btn.getAttribute("data-slug"),
    title: btn.getAttribute("data-title"),
    price: priceAttr === null || priceAttr === "" ? null : Number(priceAttr),
    qty: qtyInput ? cleanQty(qtyInput.value) : 1,
  });
  const label = btn.getAttribute("data-label") || btn.textContent;
  btn.setAttribute("data-label", label);
  btn.textContent = "Добавлено";
  const status = holder?.querySelector("[data-add-status]");
  if (status) status.textContent = `«${btn.getAttribute("data-title")}» в корзине`;
  clearTimeout(btn._agvTimer);
  btn._agvTimer = setTimeout(() => {
    btn.textContent = label;
    if (status) status.textContent = "";
  }, 1600);
}

/* ---------- Страница корзины ---------- */

const rubles = (n) => `${n.toLocaleString("ru-RU")} ₽`.replace(/[  ]/g, " ");

function make(doc, tag, props = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "text") node.textContent = v;
    else if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

async function loadCatalog() {
  try {
    const res = await globalThis.fetch(CATALOG_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) ? new Map(list.map((p) => [p.slug, p])) : null;
  } catch {
    return null; // каталог недоступен: товары не помечаем как снятые
  }
}

// Позиции заказа: только те, что есть в каталоге; название и цена — из каталога.
export function orderItems(cart, catalog) {
  return cart.items
    .map((i) => {
      if (!catalog) return i;
      const p = catalog.get(i.slug);
      return p ? { slug: i.slug, title: p.title, price: typeof p.price === "number" ? p.price : null, qty: i.qty } : null;
    })
    .filter(Boolean);
}

function renderCartPage(root, catalog) {
  const doc = root.ownerDocument;
  const cart = getCart();
  const rows = root.querySelector("[data-cart-rows]");
  const empty = root.querySelector("[data-cart-empty]");
  const content = root.querySelector("[data-cart-content]");
  const sent = root.querySelector("[data-cart-sent]");
  const orderBox = root.querySelector("[data-cart-order]");
  const form = root.querySelector('form[data-lead-form="order"]');
  const hasSent = sent && !sent.hidden;

  const items = orderItems(cart, catalog);
  const stale = new Set(cart.items.filter((i) => catalog && !catalog.has(i.slug)).map((i) => i.slug));

  empty.hidden = cart.items.length > 0 || Boolean(hasSent);
  content.hidden = cart.items.length === 0;

  rows.replaceChildren(
    ...cart.items.map((item) => {
      const p = catalog?.get(item.slug);
      const isStale = stale.has(item.slug);
      const price = p ? (typeof p.price === "number" ? p.price : null) : item.price;
      const title = p?.title ?? item.title;
      const name = p?.url ? make(doc, "a", { href: p.url, text: title }) : make(doc, "span", { text: title });
      const info = make(doc, "div", { class: "cart-item__info" }, make(doc, "strong", {}, name));
      if (p?.sku) info.append(make(doc, "span", { class: "muted", text: `Арт. ${p.sku}` }));
      if (isStale) info.append(make(doc, "span", { class: "cart-item__stale", text: "Товар больше не продаётся" }));

      const input = make(doc, "input", { class: "field__input", type: "number", min: "1", max: String(MAX_QTY), inputmode: "numeric", value: String(item.qty), "aria-label": `Количество: ${title}`, "data-qty-input": item.slug });
      const minus = make(doc, "button", { class: "btn btn--ghost", type: "button", "aria-label": "Меньше", text: "−", "data-qty-step": "-1", "data-slug": item.slug });
      const plus = make(doc, "button", { class: "btn btn--ghost", type: "button", "aria-label": "Больше", text: "+", "data-qty-step": "1", "data-slug": item.slug });
      if (isStale) input.disabled = minus.disabled = plus.disabled = true;
      const qty = make(doc, "div", { class: "cart-item__qty" }, minus, input, plus);

      const priceText = isStale ? "" : price === null ? "по запросу" : rubles(price);
      const sumText = isStale ? "" : price === null ? "по запросу" : rubles(price * item.qty);
      const remove = make(doc, "button", { class: "btn btn--ghost cart-item__remove", type: "button", "data-remove": item.slug, "aria-label": `Удалить: ${title}`, text: "Удалить" });
      return make(
        doc,
        "li",
        { class: `cart-item${isStale ? " is-stale" : ""}`, "data-cart-item": item.slug },
        info,
        make(doc, "div", { class: "cart-item__price", text: priceText }),
        qty,
        make(doc, "div", { class: "cart-item__sum", text: sumText }),
        remove,
      );
    }),
  );

  const priced = items.filter((i) => typeof i.price === "number");
  const onRequest = items.length - priced.length;
  const total = priced.reduce((s, i) => s + i.price * i.qty, 0);
  const totalEl = root.querySelector("[data-cart-total]");
  if (totalEl) totalEl.textContent = rubles(total);
  const note = root.querySelector("[data-cart-note]");
  if (note) {
    note.hidden = onRequest === 0;
    note.textContent = onRequest ? `В итог не входят позиции «по запросу» (${onRequest}): цену сообщит менеджер.` : "";
  }
  const staleNote = root.querySelector("[data-cart-stale-note]");
  if (staleNote) staleNote.hidden = stale.size === 0;

  if (orderBox) orderBox.hidden = items.length === 0;
  if (form) syncOrderForm(form, items);
}

// Передача состава заказа форме: скрытое поле items (JSON) и атрибут data-cart-items.
// forms.js читает любое из них; позиций, снятых с продажи, здесь нет.
function syncOrderForm(form, items) {
  const json = JSON.stringify(items);
  form.setAttribute("data-cart-items", json);
  let field = form.querySelector('input[name="items"]');
  if (!field) {
    field = form.ownerDocument.createElement("input");
    field.type = "hidden";
    field.name = "items";
    form.append(field);
  }
  field.value = json;
}

function bindCartPage(root, catalog) {
  const rerender = () => renderCartPage(root, catalog);
  root.addEventListener("click", (e) => {
    const remove = e.target.closest?.("[data-remove]");
    if (remove) return void removeItem(remove.getAttribute("data-remove"));
    const step = e.target.closest?.("[data-qty-step]");
    if (step) {
      const slug = step.getAttribute("data-slug");
      const cur = getCart().items.find((i) => i.slug === slug);
      if (cur) setQty(slug, cur.qty + Number(step.getAttribute("data-qty-step")));
    }
  });
  root.addEventListener("change", (e) => {
    const input = e.target.closest?.("[data-qty-input]");
    if (input) setQty(input.getAttribute("data-qty-input"), input.value);
  });
  onChange(rerender);
  rerender();
}

export let ready = Promise.resolve();

export function initCartPage(doc = globalThis.document) {
  const root = doc?.querySelector("[data-cart-page]");
  if (!root) return Promise.resolve();
  return loadCatalog().then((catalog) => bindCartPage(root, catalog));
}

// Успешная отправка (событие выпускает forms.js): очищаем корзину только для заказа.
function handleLeadSent(event) {
  if (event?.detail?.type !== "order") return;
  const root = globalThis.document?.querySelector("[data-cart-page]");
  const sent = root?.querySelector("[data-cart-sent]");
  if (sent) {
    const id = event.detail.id;
    const idEl = sent.querySelector("[data-cart-sent-id]");
    if (idEl) idEl.textContent = typeof id === "string" && /^AGV-/.test(id) ? `Номер заявки: ${id}.` : "";
    sent.hidden = false;
  }
  clearCart();
}

export function init() {
  const win = globalThis.window;
  if (!win || !globalThis.document) return;
  updateCounter();
  win.addEventListener("storage", (e) => {
    if (e.key === null || e.key === STORAGE_KEY) emit();
  });
  globalThis.document.addEventListener("click", handleAddClick);
  win.addEventListener("agv:lead-sent", handleLeadSent, true);
  ready = initCartPage(globalThis.document);
}

init();
