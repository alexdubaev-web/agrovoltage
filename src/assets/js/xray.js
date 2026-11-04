// «Рентген» трактора на первом экране главной (R03, R12).
// Разметка — src/index.njk:
//   [data-xray] data-active="<system>"            — корень, текущая система;
//   [data-xray-variant="<system>"] data-x data-y data-tone — слой с картинкой варианта и координатами точки;
//   [data-xray-fault]                              — точка неисправности (data-tone: fault | frost);
//   a[data-xray-symptom] data-system data-hint data-service data-service-url data-price
//                                                  — симптомы; без JS это ссылки на услуги;
//   [data-xray-card] с [data-xray-hint], [data-xray-service], [data-xray-price], [data-xray-cta].
// Скрипт превращает ссылки в кнопки с aria-pressed. Неактивные варианты картинки получают
// возможность загрузиться (data-xray-ready) после первого взаимодействия или в простое.
// Перекрёстная смена — CSS (opacity 300 мс, без анимации при prefers-reduced-motion).

const FADE_MS = 320;

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

  // Ссылки → кнопки: те же классы, данные и содержимое.
  const buttons = links.map((a, i) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = a.className;
    for (const [k, v] of Object.entries(a.dataset)) b.dataset[k] = v;
    b.innerHTML = a.innerHTML;
    b.setAttribute("aria-pressed", String(i === 0));
    a.replaceWith(b);
    return b;
  });

  let fadeTimer = 0;
  function select(btn) {
    markReady();
    const system = btn.dataset.system;
    for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
    const prev = variants.find((v) => v.classList.contains("is-active"));
    const next = variants.find((v) => v.dataset.xrayVariant === system);
    root.dataset.active = system;

    if (next && next !== prev) {
      // Прежний вариант остаётся под новым, пока тот проявляется.
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

  const list = buttons[0].closest("ul") || root;
  list.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-xray-symptom]");
    if (btn && buttons.includes(btn)) select(btn);
  });
  // Наведение или фокус на симптомах — повод подгрузить варианты заранее.
  list.addEventListener("pointerover", markReady, { once: true });
  list.addEventListener("focusin", markReady, { once: true });
  if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(markReady, { timeout: 4000 });
  else win.setTimeout(markReady, 2500);

  return { select, buttons };
}

if (typeof window !== "undefined" && window.document) initXray(window);
