// Построение JSON-LD (schema.org). Единственное место, где собирается разметка
// (interfaces.md §3). Функции принимают данные коллекций как есть: объект front matter
// или элемент коллекции ({ data: {...} }). Последний аргумент siteUrl необязателен:
// без него берётся SITE_URL сборки.
import { getSite } from "./site.js";
import { urls, absoluteUrl } from "./urls.js";

const PLACEHOLDER = /^\s*\[.*\]\s*$/;
const isReal = (v) => typeof v === "string" && v.trim() !== "" && !PLACEHOLDER.test(v);
const dataOf = (item) => (item && typeof item === "object" && item.data ? item.data : item) || {};
const base = (siteUrl) => String(siteUrl || getSite().url).replace(/\/+$/, "");

export function telephoneOf(settings) {
  const digits = String(settings?.phoneHref || settings?.phone || "").replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : digits ? `+${digits}` : "";
}

function areaServed(settings) {
  return (settings?.regions || []).map((name) => ({ "@type": "AdministrativeArea", name }));
}

export const orgId = (siteUrl) => `${base(siteUrl)}/#organization`;
export const businessId = (siteUrl) => `${base(siteUrl)}/#autorepair`;

// Organization + AutoRepair: выводится на каждой странице базовым layout.
export function organizationLd(settings, siteUrl) {
  const root = base(siteUrl);
  const telephone = telephoneOf(settings);
  const logo = absoluteUrl("/assets/brand/logo.png", root);
  const sameAs = [settings?.maxUrl].filter((u) => isReal(u) && /^https?:\/\//.test(u));
  const organization = {
    "@type": "Organization",
    "@id": orgId(root),
    name: settings?.brand,
    url: `${root}/`,
    logo,
    telephone,
    ...(isReal(settings?.email) ? { email: settings.email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    areaServed: areaServed(settings),
  };
  const business = {
    "@type": "AutoRepair",
    "@id": businessId(root),
    name: settings?.brand,
    url: `${root}/`,
    image: logo,
    telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings?.address || "",
      addressCountry: "RU",
    },
    ...(isReal(settings?.hours) ? { openingHours: settings.hours } : {}),
    areaServed: areaServed(settings),
    parentOrganization: { "@id": orgId(root) },
  };
  return { "@context": "https://schema.org", "@graph": [organization, business] };
}

export function serviceLd(service, settings, siteUrl) {
  const d = dataOf(service);
  const root = base(siteUrl);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: d.title,
    ...(d.summary ? { description: d.summary } : {}),
    url: absoluteUrl(urls.service(d.slug), root),
    ...(d.image ? { image: absoluteUrl(d.image, root) } : {}),
    provider: { "@id": businessId(root) },
    areaServed: areaServed(settings),
  };
  if (typeof d.priceFrom === "number") {
    ld.offers = {
      "@type": "Offer",
      priceCurrency: "RUB",
      priceSpecification: { "@type": "PriceSpecification", minPrice: d.priceFrom, priceCurrency: "RUB" },
    };
  }
  return ld;
}

export function productLd(product, settings, siteUrl) {
  const d = dataOf(product);
  const root = base(siteUrl);
  const url = absoluteUrl(urls.product(d.slug, d.category), root);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: d.title,
    ...(d.sku ? { sku: d.sku } : {}),
    ...(d.summary ? { description: d.summary } : {}),
    url,
    ...(d.images?.length ? { image: d.images.map((i) => absoluteUrl(i, root)) } : {}),
  };
  if (typeof d.price === "number") {
    ld.offers = {
      "@type": "Offer",
      price: d.price,
      priceCurrency: "RUB",
      availability: d.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      seller: { "@id": orgId(root) },
    };
  }
  return ld;
}

// items: [{ name, url }] — те же, что хлебные крошки.
export function breadcrumbLd(items, siteUrl) {
  if (!items?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: absoluteUrl(it.url, base(siteUrl)) } : {}),
    })),
  };
}

export function faqLd(faq) {
  const list = (faq || []).filter((f) => f && f.q && f.a);
  if (!list.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: list.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function articleLd(article, settings, siteUrl) {
  const d = dataOf(article);
  const root = base(siteUrl);
  const url = absoluteUrl(urls.article(d.slug), root);
  const date = d.date instanceof Date ? d.date.toISOString().slice(0, 10) : d.date;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: d.title,
    ...(d.excerpt ? { description: d.excerpt } : {}),
    ...(date ? { datePublished: date, dateModified: date } : {}),
    ...(d.cover ? { image: absoluteUrl(d.cover, root) } : {}),
    mainEntityOfPage: url,
    url,
    author: { "@id": orgId(root), "@type": "Organization", name: settings?.brand },
    publisher: { "@id": orgId(root), "@type": "Organization", name: settings?.brand },
  };
}

// items: [{ name, url }]
export function itemListLd(items, siteUrl) {
  if (!items?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.url, base(siteUrl)),
    })),
  };
}

// Сериализация в <script>: экранируем «<», чтобы текст не закрыл тег.
export function jsonldScript(obj) {
  if (!obj) return "";
  const json = JSON.stringify(obj).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
