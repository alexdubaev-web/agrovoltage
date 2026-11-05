// «Рентген» трактора на первом экране главной (R03, R12).
// Разметка — src/index.njk:
//   [data-xray] data-active="<system>"            — корень, текущая система;
//   .xray__base                                    — базовая картинка, видна всегда, в смене не участвует;
//   [data-xray-variant="<system>"] data-x data-y data-tone — прозрачный слой подсветки поверх базы и координаты точки;
//   [data-xray-node] > a.xray__tag[data-system]    — подписи узлов; без JS ссылки на услуги, с JS кнопки выбора причины;
//   [data-xray-fault]                              — точка неисправности (data-tone: fault | frost);
//   a[data-xray-symptom] data-system data-hint data-service data-service-url data-price
//                                                  — симптомы; без JS это ссылки на услуги;
//   [data-xray-card] с [data-xray-hint], [data-xray-service], [data-xray-price], [data-xray-cta].
// Скрипт превращает ссылки в кнопки с aria-pressed. Неактивные слои подсветки получают
// возможность загрузиться (data-xray-ready) после первого взаимодействия или в простое.
// Смена — CSS: прежний слой (is-prev) гаснет до opacity 0 одновременно с проявлением нового,
// оба за 300 мс поверх неизменной базы (история 19), без анимации при prefers-reduced-motion.

const FADE_MS = 300;

export function initXray(win = window) {
  const doc = win.document;
  const root = doc.querySelector("[data-xray]");
  const links = [...doc.querySelectorAll("[data-xray-symptom]")];
  if (!root || !links.length) return null;

  const dot = root.querySelector("[data-xray-fault]");
  const card = doc.querySelector("[data-xray-card]");
  const hint = card?.querySelector("[data-xray-hint]");
  const service = card?.querySelector("[data-xray-service]");
  const price = card?.querySelector("[data-xray-price]");
  const cta = card?.querySelector("[data-xray-cta]");
  const variants = [...root.querySelectorAll("[data-xray-variant]")];

  const markReady = () => {
    if (!root.hasAttribute("data-xray-ready")) root.setAttribute("data-xray-ready", "");
  };

  // Ссылка → кнопка: те же классы, данные и содержимое.
  const toButton = (a) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = a.className;
    for (const [k, v] of Object.entries(a.dataset)) b.dataset[k] = v;
    b.innerHTML = a.innerHTML;
    a.replaceWith(b);
    return b;
  };
  const buttons = links.map((a, i) => {
    const b = toButton(a);
    b.setAttribute("aria-pressed", String(i === 0));
    return b;
  });
  // Подписи узлов на тракторе: нажатие = нажатие кнопки симптома той же system.
  const nodeButtons = [...root.querySelectorAll("[data-xray-node] a[data-system]")]
    .filter((a) => buttons.some((b) => b.dataset.system === a.dataset.system))
    .map((a) => {
      const b = toButton(a);
      const label = (a.dataset.symptom || "").replace(/^./, (c) => c.toLowerCase());
      b.setAttribute("aria-label", `${a.textContent.trim()}. Показать причину: ${label}`);
      b.setAttribute("aria-pressed", String(b.dataset.system === buttons[0].dataset.system));
      return b;
    });

  let fadeTimer = 0;
  function select(btn) {
    markReady();
    const system = btn.dataset.system;
    for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
    for (const b of nodeButtons) b.setAttribute("aria-pressed", String(b.dataset.system === system));
    const prev = variants.find((v) => v.classList.contains("is-active"));
    const next = variants.find((v) => v.dataset.xrayVariant === system);
    root.dataset.active = system;

    if (next && next !== prev) {
      // Прежний вариант гаснет под новым за те же 300 мс; is-prev держит его видимым до конца перехода.
      win.clearTimeout(fadeTimer);
      for (const v of variants) {
        v.classList.remove("is-prev");
        v.classList.toggle("is-active", v === next);
        if (v === next) v.removeAttribute("aria-hidden");
        else v.setAttribute("aria-hidden", "true");
      }
      prev?.classList.add("is-prev");
      fadeTimer = win.setTimeout(() => prev?.classList.remove("is-prev"), FADE_MS);
    }
    if (dot && next) {
      dot.style.left = `${next.dataset.x}%`;
      dot.style.top = `${next.dataset.y}%`;
      dot.dataset.tone = next.dataset.tone || "fault";
    }
    if (hint) hint.textContent = btn.dataset.hint || "";
    if (service) {
      service.textContent = btn.dataset.service || "";
      service.setAttribute("href", btn.dataset.serviceUrl || "/uslugi/");
    }
    if (price) price.textContent = btn.dataset.price || "по запросу";
    if (cta) cta.dataset.service = btn.dataset.service || "";
  }

  // До 1024 px карточка причины стоит под трактором и после нажатия на узел может оказаться за краем
  // экрана или под панелью связи. Докручиваем ровно до её низа; трактор может уйти под шапку не больше
  // чем верхними 15 % (крыша кабины, подписей там нет).
  function revealCard() {
    if (!card || typeof win.matchMedia !== "function" || !win.matchMedia("(max-width: 1023px)").matches) return;
    const bar = doc.querySelector(".contact-fab");
    const barTop = bar && win.getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().top : win.innerHeight;
    const limit = Math.min(win.innerHeight, barTop) - 12;
    const over = card.getBoundingClientRect().bottom - limit;
    if (over <= 0) return;
    const header = doc.querySelector(".site-header");
    const stage = root.getBoundingClientRect();
    const room = stage.top + stage.height * 0.15 - (header ? header.getBoundingClientRect().bottom : 0);
    const by = Math.min(over, Math.max(0, room));
    const smooth = !win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (by > 0) win.scrollBy({ top: by, behavior: smooth ? "smooth" : "auto" });
  }

  const list = buttons[0].closest("ul") || root;
  list.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-xray-symptom]");
    if (btn && buttons.includes(btn)) select(btn);
  });
  // Наведение или фокус на симптомах — повод подгрузить варианты заранее.
  list.addEventListener("pointerover", markReady, { once: true });
  list.addEventListener("focusin", markReady, { once: true });
  root.addEventListener("click", (e) => {
    const node = e.target.closest?.("button[data-system]");
    if (!node || !nodeButtons.includes(node)) return;
    const btn = buttons.find((b) => b.dataset.system === node.dataset.system);
    if (btn) {
      select(btn);
      revealCard();
    }
  });
  root.addEventListener("pointerover", markReady, { once: true });
  root.addEventListener("focusin", markReady, { once: true });
  if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(markReady, { timeout: 4000 });
  else win.setTimeout(markReady, 2500);

  return { select, buttons, nodeButtons };
}

if (typeof window !== "undefined" && window.document) initXray(window);
