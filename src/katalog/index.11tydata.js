import { itemListLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";

export default {
  eleventyComputed: {
    // Число товаров по slug категории (selectattr в Nunjucks не понимает путь «data.category»).
    categoryCounts: (data) =>
      (data.collections.products || []).reduce((acc, p) => {
        acc[p.data.category] = (acc[p.data.category] || 0) + 1;
        return acc;
      }, {}),
    breadcrumbs: () => [
      { name: "Главная", url: "/" },
      { name: "Каталог", url: urls.catalog() },
    ],
    jsonld: (data) => [
      itemListLd((data.collections.categories || []).map((c) => ({ name: c.data.title, url: c.url }))),
    ],
  },
};
