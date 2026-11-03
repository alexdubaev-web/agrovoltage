import { serviceLd, faqLd } from "../../lib/seo.js";

const REGION_TEXT = "в Ставропольском и Краснодарском крае";

export default {
  eleventyComputed: {
    permalink: (data) => data.service.url,
    title: (data) => `${data.service.data.title} John Deere ${REGION_TEXT}`,
    seo: (data) => ({
      title: `${data.service.data.title} John Deere ${REGION_TEXT}`,
      ...(data.service.data.seo || {}),
      ogImage: data.service.data.seo?.ogImage || data.service.data.image || "",
    }),
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
