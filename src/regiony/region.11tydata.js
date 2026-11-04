import { faqLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";

export default {
  eleventyComputed: {
    permalink: (data) => data.region.url,
    title: (data) => data.region.data.title,
    // Fallback title не совпадает с H1 («Ремонт электрики John Deere: <край>»).
    seo: (data) => {
      const seo = data.region.data.seo || {};
      return {
        ...seo,
        title: seo.title || `Электрика и кондиционеры John Deere: ${data.region.data.title}`,
        description: seo.description || data.region.data.lead,
      };
    },
    lastmod: (data) => data.region.date,
    breadcrumbs: (data) => [
      { name: "Главная", url: "/" },
      { name: "Регионы", url: urls.regions() },
      { name: data.region.data.title, url: data.region.url },
    ],
    jsonld: (data) => [faqLd(data.region.data.faq)].filter(Boolean),
  },
};
