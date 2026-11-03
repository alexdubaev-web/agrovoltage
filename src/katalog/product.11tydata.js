import { productLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";
import { getSite } from "../../lib/site.js";

// Offer нужен и при цене «по запросу»: без поля price, с наличием.
function productJsonLd(product, settings) {
  const ld = productLd(product, settings);
  if (!ld.offers) {
    ld.offers = {
      "@type": "Offer",
      priceCurrency: "RUB",
      availability: product.data.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: ld.url,
      seller: { "@id": `${getSite().url}/#organization` },
    };
  }
  return ld;
}

const categoryTitle = (data) =>
  (data.collections.categories || []).find((c) => c.slug === data.product.data.category)?.data.title || data.product.data.category;

export default {
  eleventyComputed: {
    title: (data) => data.product.data.title,
    seo: (data) => ({
      title: data.product.data.seo?.title || `${data.product.data.title}, арт. ${data.product.data.sku}`,
      description: data.product.data.seo?.description || data.product.data.summary || "",
      ogImage: data.product.data.seo?.ogImage || (data.product.data.images || []).find(Boolean) || undefined,
      noindex: data.product.data.seo?.noindex,
    }),
    breadcrumbs: (data) => [
      { name: "Главная", url: "/" },
      { name: "Каталог", url: urls.catalog() },
      { name: categoryTitle(data), url: urls.category(data.product.data.category) },
      { name: data.product.data.title, url: data.product.url },
    ],
    lastmod: (data) => data.product.date,
    sitemapImages: (data) => (data.product.data.images || []).filter(Boolean),
    jsonld: (data) => [productJsonLd(data.product, data.settings)],
  },
};
