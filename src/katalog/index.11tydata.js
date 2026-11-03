import { itemListLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";

export default {
  eleventyComputed: {
    breadcrumbs: () => [
      { name: "Главная", url: "/" },
      { name: "Каталог", url: urls.catalog() },
    ],
    jsonld: (data) => [
      itemListLd((data.collections.categories || []).map((c) => ({ name: c.data.title, url: c.url }))),
    ],
  },
};
