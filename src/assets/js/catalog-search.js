// Поиск по каталогу без сервера: /katalog/index.json → [{slug,title,sku,category,price,inStock,url,image}].
// Ищет по названию и артикулу, регистр и «ё» не важны, слова запроса должны встретиться все.

const INDEX_URL = "/katalog/index.json";

const norm = (s) => String(s ?? "").toLowerCase().replace(/ё/g, "е").trim();
// Артикул сравниваем без пробелов, дефисов и точек: «agv t 0101» найдёт «AGV-T-0101».
const compact = (s) => norm(s).replace(/[\s\-_.\/]+/g, "");

export function searchCatalog(items, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return (items || []).filter((item) => {
    const title = norm(item.title);
    const sku = norm(item.sku);
    const skuCompact = compact(item.sku);
    return words.every((w) => title.includes(w) || sku.includes(w) || skuCompact.includes(compact(w)));
  });
}

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

function card(doc, item) {
  const media = make(doc, "a", { class: "product-card__media", href: item.url, tabindex: "-1", "aria-hidden": "true" });
  if (item.image) media.append(make(doc, "img", { src: item.image, alt: "", loading: "lazy", decoding: "async" }));
  else media.append(make(doc, "span", { class: "product-ph", "aria-hidden": "true" }));
  const price = typeof item.price === "number" ? item.price : null;
  const buy = make(doc, "button", {
    class: "btn btn--primary",
    type: "button",
    text: "В корзину",
    "data-add-to-cart": "",
    "data-slug": item.slug,
    "data-title": item.title,
    "data-price": price === null ? "" : String(price),
  });
  return make(
    doc,
    "article",
    { class: "card product-card", "data-product-card": "" },
    media,
    make(doc, "h3", {}, make(doc, "a", { href: item.url, text: item.title })),
    make(doc, "p", { class: "muted", text: `Арт. ${item.sku}` }),
    make(doc, "p", { class: "product-card__price", text: price === null ? "по запросу" : rubles(price) }),
    make(doc, "p", { class: "product-card__stock", text: item.inStock ? "В наличии" : "Под заказ" }),
    buy,
  );
}

export function initCatalogSearch(doc = globalThis.document) {
  const form = doc?.querySelector("[data-catalog-search]");
  if (!form) return Promise.resolve();
  const input = form.querySelector("input[name=q]");
  const results = doc.querySelector("[data-search-results]");
  const list = doc.querySelector("[data-search-list]");
  const count = doc.querySelector("[data-search-count]");
  const empty = doc.querySelector("[data-search-empty]");
  const ask = doc.querySelector("[data-search-ask]");
  const base = doc.querySelector("[data-catalog-browse]");

  return globalThis
    .fetch(INDEX_URL, { headers: { Accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("index"))))
    .then((items) => {
      form.hidden = false;
      const run = () => {
        const q = input.value.trim();
        const found = q ? searchCatalog(items, q) : [];
        if (base) base.hidden = Boolean(q);
        results.hidden = !q;
        list.replaceChildren(...found.map((i) => card(doc, i)));
        list.hidden = found.length === 0;
        empty.hidden = !q || found.length > 0;
        count.textContent = q && found.length ? `Найдено: ${found.length}` : "";
        if (ask) ask.setAttribute("data-message", `Запрос по каталогу: ${q}`);
      };
      input.addEventListener("input", run);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        run();
        try {
          const url = new URL(globalThis.location.href);
          if (input.value.trim()) url.searchParams.set("q", input.value.trim());
          else url.searchParams.delete("q");
          globalThis.history.replaceState(null, "", url);
        } catch {
          /* адресная строка не обязательна */
        }
      });
      const q = new URLSearchParams(globalThis.location?.search || "").get("q");
      if (q) {
        input.value = q;
        run();
      }
    })
    .catch(() => {
      // Индекс недоступен: поиск остаётся скрытым, каталог работает по ссылкам.
    });
}

if (globalThis.document && globalThis.window) initCatalogSearch();
