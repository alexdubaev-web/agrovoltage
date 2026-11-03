// Единые адреса страниц контента. Шаблоны страниц (permalink) и SEO берут их отсюда.
const clean = (s) => String(s ?? "").replace(/^\/+|\/+$/g, "");

export const pageUrls = {
  home: "/",
  delivery: "/dostavka/",
  about: "/o-kompanii/",
  privacy: "/politika-konfidencialnosti/",
  consent: "/soglasie/",
};

export const urls = {
  services: () => "/uslugi/",
  service: (slug) => `/uslugi/${clean(slug)}/`,
  catalog: () => "/katalog/",
  category: (slug) => `/katalog/${clean(slug)}/`,
  product: (slug, category) => `/katalog/${clean(category)}/${clean(slug)}/`,
  articles: () => "/stati/",
  article: (slug) => `/stati/${clean(slug)}/`,
  regions: () => "/regiony/",
  region: (slug) => `/regiony/${clean(slug)}/`,
  page: (slug) => pageUrls[slug] ?? `/${clean(slug)}/`,
  cart: () => "/korzina/",
  contacts: () => "/kontakty/",
};

// Адрес элемента коллекции по её имени.
export function contentUrl(type, data) {
  switch (type) {
    case "services": return urls.service(data.slug);
    case "categories": return urls.category(data.slug);
    case "products": return urls.product(data.slug, data.category);
    case "articles": return urls.article(data.slug);
    case "regions": return urls.region(data.slug);
    case "pages": return urls.page(data.slug);
    default: return "";
  }
}

export function absoluteUrl(path, siteUrl) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${String(siteUrl).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}
