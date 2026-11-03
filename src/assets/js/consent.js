// Баннер согласия и Яндекс Метрика (interfaces.md §4).
// Метрика грузится только после согласия и только если в настройках задан yandexMetrikaId.
// Решение хранится в localStorage "agv.consent.v1" 180 дней и сбрасывается при смене версии согласия.
// window.agvGoal(name, params) — безопасный вызов цели: без Метрики ничего не делает.
// Цели: "lead" (отправлена любая форма), "order" (оформлен заказ), "phone" (клик по tel:).

const KEY = "agv.consent.v1";
const TTL_MS = 180 * 24 * 60 * 60 * 1000;

function readChoice(win, version) {
  try {
    const c = JSON.parse(win.localStorage.getItem(KEY) || "null");
    if (!c || (c.value !== "accepted" && c.value !== "declined")) return null;
    if (String(c.version) !== String(version)) return null;
    if (!(Date.now() - Number(c.at) < TTL_MS)) return null;
    return c.value;
  } catch {
    return null;
  }
}

function saveChoice(win, value, version) {
  try {
    win.localStorage.setItem(KEY, JSON.stringify({ value, version: String(version), at: Date.now() }));
  } catch { /* приватный режим: решение действует до перезагрузки */ }
}

export function initConsent(win = window) {
  const doc = win.document;
  const banner = doc.querySelector("[data-consent-banner]");
  const rawId = banner?.dataset.metrikaId?.trim() || "";
  const metrikaId = /^\d{4,12}$/.test(rawId) ? Number(rawId) : null;
  const version = banner?.dataset.consentVersion || "1";
  let loaded = false;

  function loadMetrika() {
    if (loaded || !metrikaId) return;
    loaded = true;
    // Официальный код подключения Метрики (tag.js), без вебвизора.
    win.ym = win.ym || function ym() { (win.ym.a = win.ym.a || []).push(arguments); };
    win.ym.l = Date.now();
    const s = doc.createElement("script");
    s.async = true;
    s.src = "https://mc.yandex.ru/metrika/tag.js";
    doc.head.append(s);
    win.ym(metrikaId, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }

  win.agvGoal = (name, params) => {
    if (!loaded || typeof win.ym !== "function") return;
    try { win.ym(metrikaId, "reachGoal", name, params); } catch { /* цель не важнее страницы */ }
  };

  doc.addEventListener("click", (e) => {
    const link = e.target.closest?.('a[href^="tel:"]');
    if (link) win.agvGoal(link.dataset.goal || "phone");
  });

  const choice = readChoice(win, version);
  if (choice === "accepted") loadMetrika();
  if (!banner) return;
  // Без ID Метрики спрашивать не о чем: баннер не показываем.
  banner.hidden = choice !== null || !metrikaId;

  banner.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
    saveChoice(win, "accepted", version);
    banner.hidden = true;
    loadMetrika();
  });
  banner.querySelector("[data-consent-decline]")?.addEventListener("click", () => {
    saveChoice(win, "declined", version);
    banner.hidden = true;
  });
}

if (typeof window !== "undefined" && window.document) initConsent(window);
