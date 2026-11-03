import { articleLd } from "../../lib/seo.js";

export default {
  eleventyComputed: {
    permalink: (data) => data.article.url,
    title: (data) => data.article.data.title,
    seo: (data) => ({
      title: data.article.data.title,
      description: data.article.data.excerpt,
      ogType: "article",
      ...(data.article.data.seo || {}),
      ogImage: data.article.data.seo?.ogImage || data.article.data.cover || "",
    }),
    lastmod: (data) => data.article.date,
    sitemapImages: (data) => [data.article.data.cover].filter(Boolean),
    breadcrumbs: (data) => [
      { name: "Главная", url: "/" },
      { name: "Статьи", url: "/stati/" },
      { name: data.article.data.title },
    ],
    jsonld: (data) => [articleLd(data.article, data.settings)],
  },
};
