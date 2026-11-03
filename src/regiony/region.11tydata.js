import { faqLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";

export default {
  eleventyComputed: {
    permalink: (data) => data.region.url,
    title: (data) => data.region.data.title,
    seo: (data) => ({
      title: `Ремонт электрики John Deere: ${data.region.data.title}`,
      description: data.region.data.lead,
      ...(data.region.data.seo || {}),
    }),
    lastmod: (data) => data.region.date,
    breadcrumbs: (data) => [
      { name: "Главная", url: "/" },
      { name: "Регионы", url: urls.regions() },
      { name: data.region.data.title, url: data.region.url },
    ],
    jsonld: (data) => [faqLd(data.region.data.faq)].filter(Boolean),
  },
};
