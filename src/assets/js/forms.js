// Формы заявок: <form data-lead-form="callback|service|order"> (interfaces.md §4, §5).
// Токен — GET /api/token.php, отправка — POST /api/lead.php (JSON, заголовок X-CSRF-Token).
// После успеха — событие document "agv:lead-sent" {detail:{type,id}}: на него подписывается корзина.

const FALLBACK_PHONE = "+7 962 001 19 90";
const FALLBACK_PHONE_HREF = "tel:+79620011990";

const MSG = {
  name: "Укажите имя.",
  phone: "Укажите телефон в формате +7 (999) 123-45-67.",
  consent: "Нужно согласие на обработку персональных данных.",
  emptyCart: "Корзина пуста — добавьте товары, чтобы оформить заказ.",
  check: "Проверьте поля формы.",
  sending: "Отправляем…",
  // R17.2: «Не удалось отправить. Позвоните <телефон> или попробуйте ещё раз».
  fail: ["Не удалось отправить. Позвоните ", " или попробуйте ещё раз."],
};

/** «9620011990» → «+7 (962) 001-19-90»; неполный ввод форматируется частично. */
export function formatPhone(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (!d) return "";
  if (d[0] === "8") d = "7" + d.slice(1);
  else if (d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = "+7";
  if (p[0]) out += ` (${p[0]}`;
  if (p[0].length === 3 && (p[1] || d.length > 4)) out += ")";
  if (p[1]) out += ` ${p[1]}`;
  if (p[2]) out += `-${p[2]}`;
  if (p[3]) out += `-${p[3]}`;
  return out;
}

function phoneValid(value) {
  const d = String(value || "").replace(/\D/g, "");
  return d.length === 11 && (d[0] === "7" || d[0] === "8") && "3489".includes(d[1]);
}

// Состав заказа берётся из формы: cart.js сверяет корзину с /katalog/index.json и пишет
// в input[name="items"] и data-cart-items только товары из каталога с его ценой и названием.
// localStorage здесь не читается: там могут лежать снятые товары и старые цены.
function orderItemsOf(form) {
  const raw = form.querySelector('input[name="items"]')?.value || form.getAttribute("data-cart-items") || "[]";
  try {
    const items = JSON.parse(raw);
    return (Array.isArray(items) ? items : [])
      .filter((i) => i && typeof i.slug === "string" && Number.isInteger(i.qty) && i.qty > 0)
      .map(({ slug, title, price, qty }) => ({ slug, title: String(title ?? slug), price: typeof price === "number" ? price : null, qty }));
  } catch {
    return [];
  }
}

export function initForms(win = window) {
  const doc = win.document;
  let tokenPromise = null;

  const getToken = (fresh = false) => {
    if (fresh || !tokenPromise) {
      tokenPromise = win
        .fetch("/api/token.php", { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("token"))))
        .then((b) => b.token)
        .catch((e) => { tokenPromise = null; throw e; });
    }
    return tokenPromise;
  };

  const phoneLink = () => {
    const a = doc.querySelector('a[href^="tel:"]');
    return { href: a?.getAttribute("href") || FALLBACK_PHONE_HREF, text: a?.textContent.trim() || FALLBACK_PHONE };
  };

  // text — строка или [до, после]: тогда между частями встаёт ссылка на телефон.
  function setStatus(form, text, state) {
    const el = form.querySelector("[data-form-status]");
    if (!el) return;
    if (state) el.dataset.state = state;
    else delete el.dataset.state;
    if (!Array.isArray(text)) {
      el.textContent = text;
      return;
    }
    const { href, text: label } = phoneLink();
    const a = doc.createElement("a");
    a.href = href;
    a.textContent = label;
    a.dataset.goal = "phone";
    el.replaceChildren(text[0], a, text[1]);
  }

  function setError(form, field, text) {
    const el = form.querySelector(`[data-error-for="${field}"]`);
    const input = form.elements[field];
    if (el) {
      el.textContent = text || "";
      el.hidden = !text;
    }
    if (input && input.setAttribute) {
      if (text) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    return Boolean(el);
  }

  function clearErrors(form) {
    form.querySelectorAll("[data-error-for]").forEach((el) => setError(form, el.dataset.errorFor, ""));
  }

  function showErrors(form, errors) {
    const rest = [];
    let first = null;
    for (const [field, text] of Object.entries(errors || {})) {
      if (setError(form, field, text)) first ??= form.elements[field];
      else rest.push(text);
    }
    setStatus(form, rest.length ? rest.join(" ") : MSG.check, "error");
    if (first && typeof first.focus === "function") first.focus();
  }

  function setBusy(form, busy) {
    form.dataset.busy = busy ? "1" : "";
    const btn = form.querySelector("[data-submit]");
    if (btn) {
      btn.disabled = busy;
      if (busy) btn.setAttribute("aria-busy", "true");
      else btn.removeAttribute("aria-busy");
    }
  }

  function markStart(form) {
    const f = form.elements.startedAt;
    if (f && !f.value) f.value = String(Date.now());
  }

  function payloadOf(form) {
    const el = form.elements;
    const val = (n) => (el[n] && typeof el[n].value === "string" ? el[n].value : "");
    const type = form.dataset.leadForm;
    const body = {
      type,
      name: val("name").trim(),
      phone: formatPhone(val("phone")),
      message: val("message").trim(),
      service: val("service").trim(),
      page: val("page") || win.location.pathname,
      consent: Boolean(el.consent?.checked),
      consentVersion: val("consentVersion"),
      website: val("website"),
      startedAt: Number(val("startedAt")) || 0,
    };
    if (type === "order") body.items = orderItemsOf(form);
    return body;
  }

  function validate(form, body) {
    const errors = {};
    if (!body.name) errors.name = MSG.name;
    if (!phoneValid(body.phone)) errors.phone = MSG.phone;
    if (!body.consent) errors.consent = MSG.consent;
    if (body.type === "order" && !body.items.length) errors.items = MSG.emptyCart;
    return errors;
  }

  async function send(body, retry = true) {
    const token = await getToken();
    const res = await win.fetch("/api/lead.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token },
      body: JSON.stringify(body),
    });
    if (res.status === 403 && retry) {
      await getToken(true);
      return send(body, false);
    }
    let data = null;
    try { data = await res.json(); } catch { /* ответ не JSON */ }
    return { status: res.status, data };
  }

  async function onSubmit(event) {
    const form = event.target.closest?.("form[data-lead-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.busy === "1") return;

    clearErrors(form);
    const body = payloadOf(form);
    const errors = validate(form, body);
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return;
    }
    if (form.elements.phone) form.elements.phone.value = body.phone;

    setBusy(form, true);
    setStatus(form, MSG.sending, "pending");
    try {
      const { status, data } = await send(body);
      if (status === 200 && data?.ok && data.id) {
        setStatus(form, `Заявка № ${data.id} принята, перезвоним в рабочее время.`, "success");
        win.agvGoal?.("lead");
        if (body.type === "order") win.agvGoal?.("order");
        doc.dispatchEvent(new win.CustomEvent("agv:lead-sent", { bubbles: true, detail: { type: body.type, id: data.id } }));
        resetForm(form);
      } else if (status === 422 && data?.errors) {
        showErrors(form, data.errors);
      } else if (status === 429 && data?.error) {
        setStatus(form, data.error, "error");
      } else {
        setStatus(form, MSG.fail, "error");
      }
    } catch {
      setStatus(form, MSG.fail, "error");
    } finally {
      setBusy(form, false);
    }
  }

  function resetForm(form) {
    const status = form.querySelector("[data-form-status]");
    const keep = status ? [status.textContent, status.dataset.state] : null;
    form.reset();
    if (form.dataset.leadFormDefault) form.dataset.leadForm = form.dataset.leadFormDefault;
    markStart(form);
    if (keep) {
      status.textContent = keep[0];
      status.dataset.state = keep[1];
    }
  }

  // Кнопки «Оставить заявку» → форма в модальном окне #zayavka с услугой и текстом.
  function onOpen(opener) {
    const id = (opener.getAttribute("href") || "#zayavka").slice(1) || "zayavka";
    const form = doc.getElementById(id)?.querySelector("form[data-lead-form]");
    if (!form) return;
    form.dataset.leadFormDefault ||= form.dataset.leadForm;
    const service = opener.dataset.service || "";
    if (form.elements.service) form.elements.service.value = service;
    if (form.elements.message && opener.dataset.message !== undefined) form.elements.message.value = opener.dataset.message;
    form.dataset.leadForm = service && form.dataset.leadFormDefault === "callback" ? "service" : form.dataset.leadFormDefault;
    markStart(form);
    win.setTimeout(() => form.elements.name?.focus?.(), 50);
  }

  doc.querySelectorAll("form[data-lead-form]").forEach((form) => {
    form.noValidate = true; // ошибки показывает скрипт, по-русски у полей
    markStart(form);
  });
  doc.addEventListener("submit", onSubmit);
  doc.addEventListener("input", (e) => {
    const t = e.target;
    // При удалении символов не форматируем, иначе скобку или дефис нельзя стереть.
    if (t?.name === "phone" && !String(e.inputType || "").startsWith("delete") && t.closest?.("form[data-lead-form]")) {
      const formatted = formatPhone(t.value);
      if (formatted !== t.value) t.value = formatted;
    }
  });
  doc.addEventListener("focusin", (e) => {
    if (e.target.closest?.("form[data-lead-form]")) getToken().catch(() => {});
  });
  doc.addEventListener("click", (e) => {
    const opener = e.target.closest?.("[data-lead-open]");
    if (opener) onOpen(opener);
  });
  doc.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = doc.querySelector(".modal:target, .modal.is-open");
    open?.querySelector("[data-lead-close]")?.click();
  });
}

if (typeof window !== "undefined" && window.document) initForms(window);
