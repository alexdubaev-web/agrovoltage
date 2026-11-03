import { itemListLd } from "../../lib/seo.js";

export default {
  eleventyComputed: {
    permalink: (data) => {
      const n = data.pagination?.pageNumber || 0;
      return n === 0 ? "/stati/" : `/stati/page/${n + 1}/`;
    },
    title: "Статьи",
    seo: (data) => {
      const n = data.pagination?.pageNumber || 0;
      return {
        title: n === 0 ? "Статьи об электрике и ремонте сельхозтехники John Deere" : `Статьи, страница ${n + 1}`,
        description: "Советы по диагностике и ремонту электрики, проводки и кондиционеров сельхозтехники John Deere.",
      };
    },
    breadcrumbs: (data) => {
      const n = data.pagination?.pageNumber || 0;
      return n === 0
        ? [{ name: "Главная", url: "/" }, { name: "Статьи" }]
        : [{ name: "Главная", url: "/" }, { name: "Статьи", url: "/stati/" }, { name: `Страница ${n + 1}` }];
    },
    jsonld: (data) => [itemListLd((data.articlesPage || []).map((a) => ({ name: a.data.title, url: a.url })))].filter(Boolean),
  },
};
