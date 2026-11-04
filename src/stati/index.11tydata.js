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
      return n === 0
        ? {
            title: "Статьи об электрике и ремонте сельхозтехники John Deere",
            description: "Разборы неисправностей электрики, проводки и кондиционеров техники John Deere: как проявляются, что проверить на месте и когда вызывать мастера.",
          }
        : {
            title: `Статьи об электрике техники John Deere, страница ${n + 1}`,
            description: `Статьи об электрике, проводке и кондиционерах сельхозтехники John Deere, страница ${n + 1}: разборы неисправностей и советы механика по ремонту.`,
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
