import { itemListLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";

const inCategory = (data) => (data.collections.products || []).filter((p) => p.data.category === data.category.slug);

export default {
  eleventyComputed: {
    categoryProducts: (data) => inCategory(data),
    title: (data) => data.category.data.title,
    seo: (data) => ({
      title: data.category.data.seo?.title || `${data.category.data.title} для John Deere: цены и наличие`,
      description: data.category.data.seo?.description || data.category.data.description || "",
      ogImage: data.category.data.seo?.ogImage || data.category.data.image || undefined,
      noindex: data.category.data.seo?.noindex,
    }),
    breadcrumbs: (data) => [
      { name: "Главная", url: "/" },
      { name: "Каталог", url: urls.catalog() },
      { name: data.category.data.title, url: data.category.url },
    ],
    lastmod: (data) => data.category.date,
    jsonld: (data) => [
      itemListLd(inCategory(data).map((p) => ({ name: p.data.title, url: p.url }))),
    ],
  },
};
