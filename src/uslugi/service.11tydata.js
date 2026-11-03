import { serviceLd, faqLd } from "../../lib/seo.js";
import { regionsIn } from "./region-text.js";

export default {
  eleventyComputed: {
    permalink: (data) => data.service.url,
    // «в Ставропольском и Краснодарском крае» — из settings.regions.
    regionText: (data) => regionsIn(data.settings?.regions),
    title: (data) => `${data.service.data.title} John Deere ${regionsIn(data.settings?.regions)}`.trim(),
    seo: (data) => ({
      title: `${data.service.data.title} John Deere ${regionsIn(data.settings?.regions)}`.trim(),
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
