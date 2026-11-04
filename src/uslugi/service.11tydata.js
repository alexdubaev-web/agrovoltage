import { serviceLd, faqLd } from "../../lib/seo.js";

// Края в H1 и title услуги не называются (история 17): они остаются в JSON-LD (areaServed).
export default {
  eleventyComputed: {
    permalink: (data) => data.service.url,
    title: (data) => `${data.service.data.title} John Deere`,
    seo: (data) => {
      const seo = data.service.data.seo || {};
      return {
        ...seo,
        title: seo.title || `${data.service.data.title} John Deere: цены и сроки`,
        ogImage: seo.ogImage || data.service.data.image || "",
      };
    },
    lastmod: (data) => data.service.date,
    sitemapImages: (data) => [data.service.data.image].filter(Boolean),
    breadcrumbs: (data) => [
      { name: "Главная", url: "/" },
      { name: "Услуги", url: "/uslugi/" },
      { name: data.service.data.title },
    ],
    jsonld: (data) => [serviceLd(data.service, data.settings), faqLd(data.service.data.faq)].filter(Boolean),
  },
};
