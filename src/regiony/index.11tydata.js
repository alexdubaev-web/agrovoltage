import { itemListLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";

export default {
  eleventyComputed: {
    seo: () => ({
      title: "Регионы работы: ремонт электрики John Deere",
      description: "Регионы, где АГРОВОЛЬТАЖ принимает заявки на диагностику и ремонт электрики сельхозтехники John Deere.",
    }),
    breadcrumbs: () => [
      { name: "Главная", url: "/" },
      { name: "Регионы", url: urls.regions() },
    ],
    jsonld: (data) => [itemListLd((data.collections.regions || []).map((r) => ({ name: r.data.title, url: r.url })))].filter(Boolean),
  },
};
